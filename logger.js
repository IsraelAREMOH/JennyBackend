const isProduction = process.env.NODE_ENV === "production";

// Override console.log and console.debug globally in production
if (isProduction) {
  console.log = () => {};
  console.debug = () => {};
}
