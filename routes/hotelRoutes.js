require("dotenv").config(); // ensure .env loads before anything else
const express = require("express");
const axios = require("axios");

const router = express.Router();

//  Load API credentials
const RAPIDAPI_KEY = (process.env.RAPIDAPI_KEY || "").trim();
const RAPIDAPI_HOST = "booking-com15.p.rapidapi.com";

//  Helper: Generate valid arrival/departure dates (today + 2 days)
function getBookingDates() {
  const today = new Date();
  const arrival = today.toISOString().split("T")[0];
  const departureDate = new Date(today);
  departureDate.setDate(today.getDate() + 2);
  const departure = departureDate.toISOString().split("T")[0];
  return { arrival, departure };
}

//  GET /api/hotels/search?city=Lagos
router.get("/search", async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: "City is required" });

  console.log(` Searching hotels in: ${city}`);

  try {
    //  Step 1: Find destination info
    const destRes = await axios.get(
      `https://${RAPIDAPI_HOST}/api/v1/hotels/searchDestination`,
      {
        params: { query: city },
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
      }
    );

    const destinations = destRes.data?.data || [];
    console.log(" Destinations found: ", destinations.length);

    //  Filter only Nigerian destinations
    const nigeriaDest = destinations.find((d) => d.country === "Nigeria");
    if (!nigeriaDest) {
      console.log(" No Nigerian destination found for:", city);
      return res.status(404).json({ error: "City not found in Nigeria" });
    }

    console.log(
      ` Using destination: ${nigeriaDest.label} (${nigeriaDest.country})`
    );

    // Step 3: Fetch hotels for that Nigerian destination
    const { arrival, departure } = getBookingDates();
    console.log(` Arrival: ${arrival} | Departure: ${departure}`);

    const hotelRes = await axios.get(
      `https://${RAPIDAPI_HOST}/api/v1/hotels/searchHotels`,
      {
        params: {
          dest_id: nigeriaDest.dest_id,
          search_type: nigeriaDest.search_type,
          arrival_date: arrival,
          departure_date: departure,
          adults: 1,
          room_qty: 1,
          locale: "en-gb",
          currency: "USD",
        },
        headers: {
          "x-rapidapi-key": RAPIDAPI_KEY,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
      }
    );

    console.log(" Hotel search status:", hotelRes.status);

    // 4 Format the data for your frontend
    const hotels = hotelRes.data?.data?.hotels?.map((h) => ({
      id: h.hotel_id,
      name: h.property.name,
      address: h.property.address,
      city: h.property.city,
      country: h.property.country,
      reviewScore: h.property.reviewScore,
      image: h.property.photoUrls?.[0],
      price: h.property.priceBreakdown?.grossPrice?.value,
      currency: h.property.priceBreakdown?.grossPrice?.currency,
    }));

    //  Final JSON response
    return res.json({
      success: true,
      city: nigeriaDest.city_name,
      country: nigeriaDest.country,
      total: hotels?.length || 0,
      hotels,
    });
  } catch (error) {
    console.error(" Search error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch hotels",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
