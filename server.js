require("./logger");
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const cloudinary = require("cloudinary").v2;

const guestRoutes = require("./routes/guestRoutes");
const rsvpRoutes = require("./routes/rsvpRoutes");
const adminRoutes = require("./routes/adminRoutes");
const guestAdminRoutes = require("./routes/guestAdminRoutes");
const validateRoutes = require("./routes/validateRoutes");
const hotelRoutes = require("./routes/hotelRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const galleryRoutes = require("./routes/galleryRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

//cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Routes
app.use("/api/guest", guestRoutes);
app.use("/api/admin", adminRoutes); // register / login + protected admin endpoints
app.use("/api/admin", guestAdminRoutes); // guest management, export (protected)
app.use("/api/validate", validateRoutes); // public validate endpoints
app.use("/api/hotels", hotelRoutes);
app.use("/api/upload-photo", uploadRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api", rsvpRoutes);

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log(" Connected to MongoDB Atlas");
    app.listen(process.env.PORT, () => {
      console.log(` Server running on http://localhost:${process.env.PORT}`);
    });
  })
  .catch((err) => console.error(" MongoDB connection error:", err));
