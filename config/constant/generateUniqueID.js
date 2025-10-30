// constant/generateUniqueId.js
const Guest = require("../../Guest");

const crypto = require("crypto");

function generateGuestId(firstName, tableNo) {
  const prefix = "J&A/2025";
  const safeName = firstName.replace(/\s+/g, "");
  const paddedTable = String(tableNo).padStart(2, "0");
  const randomCode = crypto.randomBytes(2).toString("hex").toUpperCase(); // e.g., A3F9
  return `${prefix}/Table-${paddedTable}/${safeName}-${randomCode}`;
}

// Ensure ID is unique in DB
async function generateUniqueId(firstName, tableNo) {
  console.log(`🧠 Generating unique ID for: ${firstName} (Table ${tableNo})`);
  let uniqueId;
  let exists;
  do {
    uniqueId = generateGuestId(firstName, tableNo);
    exists = await Guest.exists({ uniqueId });
  } while (exists);
  return uniqueId;
}

module.exports = generateUniqueId;
