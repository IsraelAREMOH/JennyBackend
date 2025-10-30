// backend/routes/validateRoutes.js
const express = require("express");
const router = express.Router();
const Guest = require("../../jennyBackend/Guest");

/**
 * GET /api/validate?id=uniqueId
 * Returns guest info but does NOT change attendance (safe check)
 */
router.get("/", async (req, res) => {
  try {
    const id = req.query.id;
    if (!id)
      return res.status(400).json({ valid: false, message: "Missing id" });

    const guest = await Guest.findOne({ uniqueId: id }).lean();
    if (!guest)
      return res.status(404).json({ valid: false, message: "Invalid ID" });

    return res.json({ valid: true, guest });
  } catch (err) {
    console.error("Validate GET error:", err);
    return res.status(500).json({ valid: false, message: "Server error" });
  }
});

/**
 * POST /api/validate
 * Body: { id: uniqueId, staff: 'string' }
 * Marks attendance (check-in)
 */
router.post("/", async (req, res) => {
  try {
    const { id, staff } = req.body;
    if (!id) return res.status(400).json({ ok: false, message: "Missing id" });

    const guest = await Guest.findOne({ uniqueId: id });
    if (!guest)
      return res.status(404).json({ ok: false, message: "Invalid ID" });

    if (guest.attendance) {
      return res.json({ ok: false, message: "Already checked in", guest });
    }

    guest.attendance = true;
    guest.attendanceConfirmedAt = new Date();
    // optional: attach staff who scanned
    guest.lastScanBy = staff || null;
    await guest.save();

    // Optional: create a scan log collection/record here (omitted for brevity)

    return res.json({
      ok: true,
      message: `Welcome ${guest.firstName}!`,
      guest,
    });
  } catch (err) {
    console.error("Validate POST error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
