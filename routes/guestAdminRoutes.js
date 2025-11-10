const express = require("express");
const router = express.Router();
const Guest = require("../Guest");
const authJwt = require("../middleware/authJwt");
const { Parser } = require("json2csv");
const generateUniqueId = require("../config/constant/generateUniqueID");

// protect all routes below
router.use(authJwt);

/**
 * GET /api/admin/guests
 * Query: ?status=accepted&tableNo=3&search=ade&page=1&perPage=100
 */
router.get("/guests", async (req, res) => {
  try {
    const { status, tableNo, search, page = 1, perPage = 100 } = req.query;
    const q = {};
    if (status) q.rsvpStatus = status;
    if (tableNo) q.tableNo = Number(tableNo);
    if (search) {
      const re = new RegExp(search, "i");
      q.$or = [
        { firstName: re },
        { lastName: re },
        { email: re },
        { uniqueId: re },
      ];
    }

    const skip = (Number(page) - 1) * Number(perPage);
    const total = await Guest.countDocuments(q);
    const guests = await Guest.find(q)
      .sort({ tableNo: 1, lastName: 1 })
      .skip(skip)
      .limit(Number(perPage))
      .lean();

    return res.json({
      total,
      page: Number(page),
      perPage: Number(perPage),
      guests,
    });
  } catch (err) {
    console.error("GET guests error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// create guest
// POST /api/admin/guests
router.post("/guests", async (req, res) => {
  try {
    const cloudinary = require("cloudinary").v2;
    const QRCode = require("qrcode");
    const streamifier = require("streamifier");

    const { firstName, tableNo } = req.body;

    if (!firstName || !tableNo) {
      return res
        .status(400)
        .json({ error: "firstName and tableNo are required." });
    }

    // upload helper
    async function uploadToCloudinary(buffer, filename) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "wedding_qrcodes",
            public_id: filename,
            resource_type: "image",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
      });
    }

    // generate QR + upload
    async function generateAndUploadQR(uniqueId, tableNo) {
      const qrPayload = JSON.stringify({ uniqueId, tableNo });
      const buffer = await QRCode.toBuffer(qrPayload, {
        width: 300,
        margin: 2,
      });
      const safeId = uniqueId.replace(/[^\w-]+/g, "_");
      return await uploadToCloudinary(buffer, `qr_${safeId}`);
    }

    // use the new random-based generator
    const uniqueId = await generateUniqueId(firstName, tableNo);

    // Generate & upload QR
    const qrUrl = await generateAndUploadQR(uniqueId, tableNo);

    // Save guest to DB
    const guest = await Guest.create({
      ...req.body,
      uniqueId,
      qrUrl,
    });

    console.log(`✅ Guest created: ${uniqueId}`);
    return res.json(guest);
  } catch (err) {
    console.error("Create guest error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// delete guest
router.delete("/guests/:id", async (req, res) => {
  try {
    const cloudinary = require("cloudinary").v2;

    // Find the guest first
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    //  Delete QR image from Cloudinary
    if (guest.qrUrl) {
      // Extract the public_id from the qrUrl the part after the folder name
      const match = guest.qrUrl.match(/wedding_qrcodes\/([^/.]+)/);
      if (match && match[1]) {
        const publicId = `wedding_qrcodes/${match[1]}`;
        await cloudinary.uploader.destroy(publicId);
        console.log(`🧹 Cloudinary QR deleted for ${guest.uniqueId}`);
      } else {
        console.warn("⚠️ Could not extract public_id from qrUrl:", guest.qrUrl);
      }
    }

    // --- Delete from MongoDB ---
    await Guest.findByIdAndDelete(req.params.id);
    return res.json({ ok: true, message: "Guest and QR deleted" });
  } catch (err) {
    console.error("Delete guest error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// manual checkin endpoint: POST /api/admin/guests/:id/checkin
router.post("/guests/:id/checkin", async (req, res) => {
  try {
    const g = await Guest.findById(req.params.id);
    if (!g) return res.status(404).json({ error: "Not found" });
    if (g.attendance)
      return res.status(400).json({ error: "Already checked in" });

    g.attendance = true;
    g.attendanceConfirmedAt = new Date();
    await g.save();
    return res.json({ ok: true, guest: g });
  } catch (err) {
    console.error("Checkin error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// export CSV: GET /api/admin/export
router.get("/export", async (req, res) => {
  try {
    const all = await Guest.find({}).lean();
    const fields = [
      "uniqueId",
      "firstName",
      "lastName",
      "phone",
      "tableNo",
      "rsvpStatus",
      "rsvpCount",
      "attendance",
      "attendanceConfirmedAt",
      "qrUrl",
      "inviteSent",
      "inviteSentAt",
    ];
    const parser = new Parser({ fields });
    const csv = parser.parse(all);

    res.header("Content-Type", "text/csv");
    res.attachment("guests_export.csv");
    return res.send(csv);
  } catch (err) {
    console.error("Export error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
