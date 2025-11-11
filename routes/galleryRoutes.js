const express = require("express");
const GalleryImage = require("../model/GalleryImage");
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

    const imagesWithLikes = await Promise.all(
      resources.map(async (img) => {
        const dbImg = await GalleryImage.findOne({ public_id: img.public_id });
        return {
          url: img.secure_url.replace(
            "/upload/",
            "/upload/q_auto,f_auto,w_500/"
          ),
          public_id: img.public_id,
          uploader: dbImg?.uploader || "Anonymous",
          likes: dbImg?.likes || 0,
          created_at: img.created_at,
        };
      })
    );

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
