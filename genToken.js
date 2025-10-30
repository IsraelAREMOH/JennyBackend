const jwt = require("jsonwebtoken");
require("dotenv").config();

const payload = { id: "12345", email: "israelaremoh@gmail.com" };
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
console.log("Token:", token);
