const express = require("express");
const GalleryImage = require("../model/GalleryImage");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

const router = express.Router();

// Use memory storage explicitly
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed!"));
    }
  },
});

// POST /api/upload-photo
router.post("/", upload.single("photo"), async (req, res) => {
  try {
    // Validate file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No photo uploaded. Please select an image.",
      });
    }

    // Validate uploader name
    const { uploader } = req.body;
    if (!uploader || uploader.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Please tell us your name!",
      });
    }

    const streamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "wedding_uploads",
            resource_type: "image",
            quality: "auto",
            fetch_format: "auto",
            transformation: [
              { width: 1200, height: 1200, crop: "limit" }, // prevent huge files
              { quality: "auto" },
              { fetch_format: "auto" },
            ],
          },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload();

    // Save to MongoDB
    const newImage = new GalleryImage({
      public_id: result.public_id,
      url: result.secure_url,
      uploader: uploader.trim(),
      likes: 0,
      created_at: new Date(),
    });
    await newImage.save();

    res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      uploader: uploader.trim(),
      message: "Photo uploaded successfully!",
    });
  } catch (err) {
    console.error("Upload error:", err);

    // Handle multer errors (file too big, wrong type)
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Max 10MB allowed.",
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Upload failed. Please try again.",
    });
  }
});

module.exports = router;
