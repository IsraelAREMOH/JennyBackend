const express = require("express");
const router = express.Router();
const Guest = require("../jennyBackend/Guest");

/**
 * @route GET /api/guest
 * @desc Fetch guest details by uniqueId for RSVP form
 * @query id=uniqueId
 */
router.get("/guest", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Missing guest ID" });
    }

    const guest = await Guest.findOne({ uniqueId: id });

    if (!guest) {
      return res.status(404).json({ error: "Invalid guest ID" });
    }

    res.json({
      firstName: guest.firstName,
      lastName: guest.lastName,
      uniqueId: guest.uniqueId,
      rsvpStatus: guest.rsvpStatus,
      tableNo: guest.tableNo,
    });
  } catch (err) {
    console.error("❌ Error fetching guest:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route POST /api/rsvp
 * @desc Submit RSVP response (accept / decline)
 */
router.post("/rsvp", async (req, res) => {
  try {
    const { id, status, rsvpCount, notes } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const guest = await Guest.findOne({ uniqueId: id });

    if (!guest) {
      return res.status(404).json({ error: "Invalid guest ID" });
    }

    // Update RSVP fields
    guest.rsvpStatus = status;
    guest.rsvpCount = rsvpCount || 1;
    guest.notes = notes || "";
    guest.rsvpAt = new Date();

    await guest.save();

    const message =
      status === "accepted"
        ? `🎉 Thank you, ${guest.firstName}! We look forward to seeing you at the wedding. Cheers!`
        : `💐 Thank you, ${guest.firstName}. We're sorry you can't make it.`;

    res.json({ success: true, message });
  } catch (err) {
    console.error("❌ RSVP submission failed:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
