const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    name: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);
