const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema(
  {
    uniqueId: { type: String, unique: true, required: true },
    firstName: { type: String, required: true, trim: true },

    phone: {
      type: String,
      match: [/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number"],
      required: function () {
        return this.whatsappOptIn === true;
      },
    },

    whatsappOptIn: { type: Boolean, default: false },
    tableNo: { type: Number, min: 1, required: true },
    qrUrl: { type: String, required: true },

    rsvpStatus: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    rsvpCount: { type: Number, default: 0, min: 0, max: 10 },
    attendance: { type: Boolean, default: false },
    attendanceConfirmedAt: { type: Date },
    notes: String,
    inviteSent: { type: Boolean, default: false },
    inviteSentAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for performance
guestSchema.index({ rsvpStatus: 1 });

module.exports = mongoose.model("Guest", guestSchema);
