// backend/routes/adminRoutes.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Admin = require("../../jennyBackend/Admin");

const router = express.Router();

// NOTE: Use register only for initial setup. Remove/disable after creating first admin.
if (process.env.ALLOW_ADMIN_REGISTER === "true") {
  router.post("/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password)
        return res.status(400).json({ error: "Missing email or password" });

      const exists = await Admin.findOne({ email });
      if (exists)
        return res.status(409).json({ error: "Admin already exists" });

      const passwordHash = await bcrypt.hash(password, 10);
      const admin = await Admin.create({ email, passwordHash, name });
      return res.json({ id: admin._id, email: admin.email, name: admin.name });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  });
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Missing email or password" });

    const admin = await Admin.findOne({ email });
    if (!admin)
      return res
        .status(401)
        .json({ error: "Invalid credentials, use RSVP to register" });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin._id, email: admin.email },
      process.env.JWT_SECRET,
      {
        expiresIn: "12h",
      }
    );

    return res.json({
      token,
      admin: { id: admin._id, email: admin.email, name: admin.name },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
