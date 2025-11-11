const express = require("express");
const GalleryImage = require("../model/GalleryImage");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

// GET /api/gallery
router.get("/", async (req, res) => {
  try {
    // Fetch all images from MongoDB
    const images = await GalleryImage.find({})
      .sort({ created_at: -1 }) // latest first
      .limit(50)
      .lean();

    const imagesWithLikes = images.map((img) => ({
      url: img.url.replace("/upload/", "/upload/q_auto,f_auto,w_500/"), // optional optimization
      public_id: img.public_id,
      uploader: img.uploader,
      likes: img.likes || 0,
      created_at: img.created_at,
    }));

    res.json({
      success: true,
      count: imagesWithLikes.length,
      images: imagesWithLikes,
    });
  } catch (err) {
    console.error("Gallery fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch gallery images.",
    });
  }
});

router.post("/like", async (req, res) => {
  const { public_id, uploader } = req.body;

  if (!public_id || !uploader) {
    return res.status(400).json({
      success: false,
      message: "Missing image ID or uploader name",
    });
  }

  try {
    // Increment likes or create record if not exists
    const image = await GalleryImage.findOneAndUpdate(
      { public_id },
      { $inc: { likes: 1 }, $setOnInsert: { uploader } }, // set uploader if new
      { new: true, upsert: true } // create if not exist
    );

    res.json({
      success: true,
      likes: image.likes,
    });
  } catch (err) {
    console.error("Error updating likes:", err);
    res.status(500).json({ success: false, message: "Failed to update likes" });
  }
});

module.exports = router;
