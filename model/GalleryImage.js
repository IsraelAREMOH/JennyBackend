// models/GalleryImage.js
const mongoose = require("mongoose");

const galleryImageSchema = new mongoose.Schema(
  {
    public_id: { type: String, required: true, unique: true },
    uploader: { type: String, required: true },
    likes: { type: Number, default: 0 }, // default 0 likes
    url: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GalleryImage", galleryImageSchema);
