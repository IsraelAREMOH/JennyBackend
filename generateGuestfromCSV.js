const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const QRCode = require("qrcode");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const Guest = require("../jennyBackend/Guest");
const generateUniqueId = require("./config/constant/generateUniqueID");

// ===== MongoDB Connection =====
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ===== Cloudinary Config =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ===== Utility: Upload to Cloudinary =====
async function uploadToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "wedding_qrcodes",
          public_id: filename,
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      )
      .end(buffer);
  });
}

// ===== Generate QR Code and Upload =====
async function generateAndUploadQR(uniqueId, tableNo) {
  try {
    const qrPayload = `http://localhost:5000/api/validate?id=${encodeURIComponent(
      uniqueId
    )}`;

    // Sanitize Cloudinary public_id
    const safeId = uniqueId.replace(/[^\w-]+/g, "_");
    const publicId = `qr_${safeId}`;

    // Check if QR already exists on Cloudinary
    try {
      const existing = await cloudinary.api.resource(
        `wedding_qrcodes/${publicId}`
      );
      if (existing && existing.secure_url) {
        console.log(` QR already exists for ${uniqueId}, skipping re-upload.`);
        return existing.secure_url;
      }
    } catch (err) {
      if (err.http_code !== 404) throw err; // ignore if not found
    }

    // Generate fresh QR buffer
    const buffer = await QRCode.toBuffer(qrPayload, { width: 300, margin: 2 });

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(buffer, publicId);
    console.log(` QR uploaded for ${uniqueId} → ${uploadResult}`);
    return uploadResult;
  } catch (err) {
    console.error(
      `❌ Failed to generate/upload QR for ${uniqueId}:`,
      err.message
    );
    return null;
  }
}

// ===== Validate Row Data (no email or lastName required) =====
function validateRow(row, lineNo) {
  const errors = [];

  if (!row.firstName) {
    errors.push("Missing first name");
  }

  if (row.phone && !/^\+?[1-9]\d{1,14}$/.test(row.phone)) {
    errors.push("Invalid phone number");
  }

  if (row.whatsappOptIn && !["true", "false"].includes(row.whatsappOptIn)) {
    errors.push("whatsappOptIn must be true or false");
  }

  if (!row.tableNo || isNaN(parseInt(row.tableNo, 10))) {
    errors.push("Missing or invalid tableNo");
  }

  if (errors.length > 0) {
    console.warn(`⚠️ Validation errors (line ${lineNo}): ${errors.join(", ")}`);
    return false;
  }
  return true;
}

// ===== Process CSV and Insert Guests =====
async function processCSV(filePath) {
  const rows = [];
  const phones = new Set();

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      try {
        console.log(`📑 CSV loaded with ${rows.length} rows`);

        // Step 1: Validate and Deduplicate in CSV
        const validGuests = [];
        rows.forEach((row, index) => {
          const lineNo = index + 2; // header = line 1
          if (!validateRow(row, lineNo)) return;

          if (row.phone && phones.has(row.phone)) {
            console.warn(
              `⚠️ Duplicate phone in CSV (line ${lineNo}): ${row.phone}`
            );
            return;
          }

          if (row.phone) phones.add(row.phone);
          validGuests.push(row);
        });

        console.log(
          `✅ ${validGuests.length}/${rows.length} guests passed validation`
        );

        // Step 2: Check duplicates in MongoDB (by phone only)
        const existingPhones = await Guest.find(
          { phone: { $in: [...phones] } },
          { phone: 1 }
        );

        const duplicatePhones = new Set(existingPhones.map((g) => g.phone));

        const newGuests = validGuests.filter(
          (g) => !g.phone || !duplicatePhones.has(g.phone)
        );

        console.log(
          ` Removed ${
            validGuests.length - newGuests.length
          } duplicates already in DB`
        );

        // Step 3: Prepare documents for bulk insert
        const docs = [];

        for (const guest of newGuests) {
          delete guest.email;
          delete guest.lastName;

          const tableNo = parseInt(guest.tableNo, 10);
          const uniqueId = await generateUniqueId(
            guest.firstName,
            guest.tableNo
          );
          const qrUrl = await generateAndUploadQR(uniqueId, tableNo);

          docs.push({
            ...guest,
            whatsappOptIn: guest.whatsappOptIn === "true",
            uniqueId,
            qrUrl,
          });
        }

        if (docs.length === 0) {
          console.warn(" No new guests to insert");
          return;
        }

        await Guest.insertMany(docs);
        console.log(` Successfully inserted ${docs.length} new guests`);
      } catch (error) {
        console.error("❌ Error while processing CSV:", error);
      } finally {
        await mongoose.connection.close();
      }
    });
}

// ===== Run Script =====
const filePath = path.join(__dirname, "data", "guests.csv");
processCSV(filePath);
