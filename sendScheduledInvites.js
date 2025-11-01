require("dotenv").config();
const mongoose = require("mongoose");
const schedule = require("node-schedule");
const twilio = require("twilio");
const Guest = require("../jennyBackend/Guest");
const eventDetails = require("./config/event");

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

const WHATSAPP_NUMBER = process.env.TWILIO_NUMBER;
const TEMPLATE_INVITE_SID = process.env.TWILIO_TEMPLATE_SID; // Invite template
const TEMPLATE_QR_SID = process.env.TWILIO_TEMPLATE_QR_SID; // QR template

async function sendWhatsAppInvite(guest) {
  const { firstName, uniqueId, qrUrl, phone } = guest;
  const { coupleNames, date, venue, invitationImageUrl, rsvpBaseUrl } =
    eventDetails;

  if (!phone) {
    console.warn(`Skipping ${firstName} (${uniqueId}) — no phone number`);
    return;
  }

  const rsvpLink = `${rsvpBaseUrl}?id=${encodeURIComponent(uniqueId)}`;

  try {
    // 1 Send Invite template message
    const inviteMsg = await client.messages.create({
      from: WHATSAPP_NUMBER,
      to: `whatsapp:${phone}`,
      contentSid: TEMPLATE_INVITE_SID,
      contentVariables: JSON.stringify({
        1: firstName,
        2: coupleNames,
        3: date,
        4: venue,
        5: rsvpLink,
      }),
      mediaUrl: [invitationImageUrl],
    });

    console.log(`Template sent to ${firstName}: ${inviteMsg.sid}`);

    // Small delay before second template
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 2 Send QR template message
    const qrMsg = await client.messages.create({
      from: WHATSAPP_NUMBER,
      to: `whatsapp:${phone}`,
      contentSid: TEMPLATE_QR_SID,
      contentVariables: JSON.stringify({
        1: firstName,
      }),
      mediaUrl: [qrUrl],
    });

    console.log(`QR template sent to ${firstName}: ${qrMsg.sid}`);

    // Update guest record
    guest.inviteSent = true;
    guest.inviteSentAt = new Date();
    await guest.save();
  } catch (error) {
    console.error(
      `Failed to send messages to ${firstName} (${phone}): ${error.message}`
    );
  }
}

// Scheduler
async function scheduleInvites() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected successfully");

    const scheduledDate = new Date(2025, 9, 30, 19, 40, 0);

    schedule.scheduleJob(scheduledDate, async function () {
      console.log("Scheduled job started. Fetching guest list...");

      const guests = await Guest.find({ inviteSent: false });
      console.log(`Found ${guests.length} guests to invite.`);

      for (const guest of guests) {
        await sendWhatsAppInvite(guest);
        await new Promise((r) => setTimeout(r, 10000));
      }

      console.log("All invites sent successfully.");
    });

    console.log(`Invites scheduled for ${scheduledDate}`);
  } catch (error) {
    console.error("Error initializing scheduler:", error.message);
  }
}

scheduleInvites();
