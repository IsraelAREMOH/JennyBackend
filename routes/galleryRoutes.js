// routes/galleryRoutes.js
const express = require("express");
const GalleryImage = require("../model/GalleryImage");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    // 1) Pull list from Cloudinary
    const cloudRes = await cloudinary.search
      .expression("folder:wedding_uploads")
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();

    const resources = Array.isArray(cloudRes?.resources)
      ? cloudRes.resources
      : [];

    // 2) For each Cloudinary item, ensure a MongoDB row exists and combine data
    const imagesWithMetadata = await Promise.all(
      resources.map(async (img) => {
        try {
          const public_id = img?.public_id;
          const secure_url = img?.secure_url || null;
          const created_at = img?.created_at || new Date();

          // Defensive: if no public_id or no secure_url, skip this resource
          if (!public_id || !secure_url) {
            return null;
          }

          // Find or create DB record for this public_id
          let dbImg = await GalleryImage.findOne({ public_id }).lean();

          if (!dbImg) {
            // create a minimal record so uploader/likes persist from now on
            const created = await GalleryImage.create({
              public_id,
              url: secure_url,
              uploader: "Unknown", // minimal safe fallback — you can clean this later
              likes: 0,
              created_at,
            });
            dbImg = created.toObject();
          }

          // Use optimized Cloudinary URL for delivery but fall back to db url if needed
          const urlToUse = secure_url.replace(
            "/upload/",
            "/upload/q_auto,f_auto,w_800/"
          );

          return {
            url: urlToUse,
            public_id,
            uploader: dbImg.uploader || "Unknown",
            likes: typeof dbImg.likes === "number" ? dbImg.likes : 0,
            created_at: dbImg.created_at || created_at,
          };
        } catch (innerErr) {
          console.error("Error processing Cloudinary resource", innerErr);
          return null;
        }
      })
    );

    // Filter out any null entries and respond
    const images = imagesWithMetadata.filter(Boolean);

    return res.json({
      success: true,
      count: images.length,
      images,
    });
  } catch (err) {
    console.error("Gallery fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch gallery images.",
      error: err.message,
    });
  }
});

// Increment likes for an image
router.post("/like", async (req, res) => {
  const { public_id } = req.body;
  if (!public_id) {
    return res
      .status(400)
      .json({ success: false, message: "No public_id provided." });
  }

  try {
    // Find the image in DB
    const img = await GalleryImage.findOne({ public_id });
    if (!img)
      return res
        .status(404)
        .json({ success: false, message: "Image not found." });

    img.likes = (img.likes || 0) + 1;
    await img.save();

    return res.json({ success: true, likes: img.likes });
  } catch (err) {
    console.error("Like error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to like image." });
  }
});

module.exports = router;
