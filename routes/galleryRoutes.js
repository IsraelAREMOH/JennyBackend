const express = require("express");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

// GET /api/gallery
router.get("/", async (req, res) => {
  try {
    const { resources } = await cloudinary.search
      .expression("folder:wedding_uploads")
      .sort_by("created_at", "desc")
      .max_results(50) // limit results for performance
      .execute();

    const images = resources.map((img) => ({
      url: img.secure_url.replace("/upload/", "/upload/q_auto,f_auto,w_500/"),
      public_id: img.public_id,
      created_at: img.created_at,
    }));

    res.json({ success: true, count: images.length, images });
  } catch (err) {
    console.error("Gallery fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch gallery images.",
    });
  }
});

module.exports = router;
