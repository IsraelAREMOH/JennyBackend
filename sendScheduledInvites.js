require("dotenv").config();
const mongoose = require("mongoose");
const schedule = require("node-schedule");
const twilio = require("twilio");
const Guest = require("../jennyBackend/Guest");
const eventDetails = require("./config/event"); // event.js path

//  Initialize Twilio client
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

//  Read Twilio variables from .env
const WHATSAPP_NUMBER = process.env.TWILIO_NUMBER;
const TEMPLATE_SID = process.env.TWILIO_TEMPLATE_SID;

//  Function to send WhatsApp invite
async function sendWhatsAppInvite(guest) {
  const { firstName, uniqueId, qrUrl, phone } = guest;
  const { coupleNames, date, venue, invitationImageUrl, rsvpBaseUrl } =
    eventDetails;

  if (!phone) {
    console.warn(` Skipping ${firstName} (${uniqueId}) — no phone number`);
    return;
  }

  const rsvpLink = `${rsvpBaseUrl}?id=${encodeURIComponent(uniqueId)}`;

  try {
    // Send Twilio-approved template message
    const inviteMsg = await client.messages.create({
      from: WHATSAPP_NUMBER,
      to: `whatsapp:${phone}`,
      contentSid: TEMPLATE_SID,
      contentVariables: JSON.stringify({
        1: firstName,
        2: coupleNames,
        3: date,
        4: venue,
        5: rsvpLink,
      }),
      mediaUrl: [invitationImageUrl], // Cloudinary
    });

    console.log(` Template sent to ${firstName}: ${inviteMsg.sid}`);

    // Wait briefly before sending QR (avoids rate limit or ordering issues)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 2. Send QR Code message separately
    try {
      const qrMsg = await client.messages.create({
        from: WHATSAPP_NUMBER,
        to: `whatsapp:${phone}`,
        body: `Here’s your personal QR code, ${firstName}. Please present this at the venue — strictly by invitation.`,
        mediaUrl: [qrUrl],
      });

      console.log(` QR Code sent to ${firstName}: ${qrMsg.sid}`);
    } catch (qrError) {
      console.error(
        ` QR message failed for ${firstName} (${phone}): ${qrError.message}`
      );
    }

    // 3. Update guest record after both messages
    guest.inviteSent = true;
    guest.inviteSentAt = new Date();
    await guest.save();
  } catch (error) {
    console.error(
      ` Failed to send invite to ${firstName} (${phone}): ${error.message}`
    );
  }
}

//  Scheduler — runs automatically at a set time
async function scheduleInvites() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log(" MongoDB connected successfully");

    // Example: schedule for Oct 29, 2025 at 4:29 PM
    const scheduledDate = new Date(2025, 9, 30, 11, 48, 0);

    schedule.scheduleJob(scheduledDate, async function () {
      console.log(" Scheduled job started. Fetching guest list...");

      const guests = await Guest.find({ inviteSent: false });
      console.log(` Found ${guests.length} guests to invite.`);

      for (const guest of guests) {
        await sendWhatsAppInvite(guest);
        // wait 10 seconds before next guest to avoid rate limiting
        await new Promise((r) => setTimeout(r, 10000));
      }

      console.log(" All invites sent successfully.");
    });

    console.log(` Invites scheduled for ${scheduledDate}`);
  } catch (error) {
    console.error(" Error initializing scheduler:", error.message);
  }
}

//  Run scheduler
scheduleInvites();
