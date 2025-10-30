// logger.js
const isProduction = process.env.NODE_ENV === "production";

// Override console.log and console.debug globally in production
if (isProduction) {
  console.log = () => {}; // all console.log calls now do nothing
  console.debug = () => {}; // all console.debug calls now do nothing
}
