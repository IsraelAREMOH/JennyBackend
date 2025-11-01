// test.js  (run with node)
const fetch = require("node-fetch");

// test.js – Fixed with real data
const BASE = "http://localhost:5000/api";
const uid = "J&A/2025/Table-04/israel-D985"; // ← Use exact uniqueId from DB

(async () => {
  try {
    // 1. Fetch single guest
    const guestRes = await fetch(`${BASE}/guest?id=${uid}`);
    const data = await guestRes.json();

    // If backend returns array, pick the right one
    const guest = Array.isArray(data)
      ? data.find((g) => g.uniqueId === uid)
      : data;
    console.log("Guest:", guest);

    // 2. Submit RSVP
    const rsvpRes = await fetch(`${BASE}/guest/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: uid,
        status: "accepted",
        rsvpCount: 2,
        notes: "Bringing my partner",
      }),
    });

    if (!rsvpRes.ok) {
      const err = await rsvpRes.json();
      throw new Error(err.error || "RSVP failed");
    }

    const rsvp = await rsvpRes.json();
    console.log("RSVP Success:", rsvp);

    // 3. Get QR
    const qr = await fetch(`${BASE}/guest/${encodeURIComponent(uid)}/qr`).then(
      (r) => r.json()
    );
    console.log("✅ QR URL:", qr.qrUrl);
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
