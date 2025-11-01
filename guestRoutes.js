const express = require("express");
const router = express.Router();
const Guest = require("./Guest");
const cloudinary = require("cloudinary").v2;

// GET /api/guest  → supports ?id= for single guest
router.get("/", async (req, res) => {
  const { id } = req.query;

  try {
    if (id) {
      // Single guest lookup (for RSVP page)
      const guest = await Guest.findOne({ uniqueId: id });
      if (!guest) return res.status(404).json({ error: "Guest not found" });
      return res.json(guest); // ← return object, not array
    }

    // No id → return all (admin)
    const guests = await Guest.find();
    res.json(guests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

//  POST /api/guest/rsvp
//  body: { id, status:"accepted"|"declined", rsvpCount, notes }

router.post("/rsvp", async (req, res) => {
  let { id, status, rsvpCount, notes } = req.body;

  // DECODE in case the frontend double‑encodes
  if (id) id = decodeURIComponent(id);

  if (!id || !["accepted", "declined"].includes(status)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const guest = await Guest.findOne({ uniqueId: id });
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    guest.rsvpStatus = status;
    guest.rsvpCount = Number(rsvpCount) || 1;
    guest.notes = notes?.trim() || "";

    await guest.save();

    res.json({ message: "RSVP saved successfully!", guest });
  } catch (err) {
    console.error("RSVP error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//  GET /api/guest/validate/:uid   → QR-scan check-in

router.get("/validate/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    const guest = await Guest.findOne({ uniqueId: uid });
    if (!guest) return res.status(404).json({ error: "Invalid ID" });

    if (guest.attendance) {
      return res.status(400).json({ error: "Already checked-in" });
    }

    guest.attendance = true;
    await guest.save();

    res.json({ ok: true, guest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

//  GET /api/guest/:id/qr   → secure signed QR URL

router.get("/:id/qr", async (req, res) => {
  try {
    const guest = await Guest.findOne({ uniqueId: req.params.id });
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    // 1. RSVP must be accepted
    if (guest.rsvpStatus !== "accepted") {
      return res.status(403).json({ error: "RSVP not accepted yet." });
    }

    // 2. QR can’t be downloaded after check-in
    if (guest.attendance) {
      return res
        .status(403)
        .json({ error: "QR code cannot be downloaded after check-in" });
    }

    // 3. QR must exist in the DB (pre-generated when guest is created)
    if (!guest.qrUrl) {
      return res.status(404).json({ error: "QR code not available" });
    }

    // Cloudinary signed URL (expires in 1 hour by default)
    const qrUrl = cloudinary.url(guest.qrUrl, {
      sign_url: true,
      secure: true,
    });

    res.json({ qrUrl });
  } catch (err) {
    console.error("QR download error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
