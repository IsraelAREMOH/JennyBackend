const express = require("express");
const router = express.Router();
const Guest = require("../jennyBackend/Guest");

// Get all guests
router.get("/", async (req, res) => {
  const guests = await Guest.find();
  res.json(guests);
});

// RSVP endpoint
router.post("/rsvp", async (req, res) => {
  const { uid, attending, count } = req.body;
  const guest = await Guest.findOne({ uniqueId: uid });
  if (!guest) return res.status(404).json({ error: "Guest not found" });

  guest.rsvpStatus = attending ? "accepted" : "declined";
  guest.rsvpCount = count;
  await guest.save();

  res.json({ ok: true, guest });
});

// Validate guest (for QR scan)
router.get("/validate/:uid", async (req, res) => {
  const { uid } = req.params;
  const guest = await Guest.findOne({ uniqueId: uid });
  if (!guest) return res.status(404).json({ error: "Invalid ID" });

  guest.attendance = true;
  await guest.save();

  res.json({ ok: true, guest });
});

module.exports = router;
