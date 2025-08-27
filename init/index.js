require("dotenv").config({ path: "../.env" });

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const geoCodingClient = mbxGeocoding({ accessToken: process.env.MAP_TOKEN });

const mongoUrl = process.env.ATLASDB_URL;

async function main() {
  try {
    await mongoose.connect(mongoUrl);
    console.log("✅ Connected to DB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

main();

const convertOid = (value) => {
  if (typeof value === "object" && value.$oid) {
    return new mongoose.Types.ObjectId(value.$oid);
  }
  return value;
};

const initDB = async () => {
  try {
    await Listing.deleteMany({});
    console.log("🧹 Old listings deleted");

    const updatedData = await Promise.all(
      initData.data.map(async (obj) => {
        // Fix _id if it's using $oid
        if (obj._id && obj._id.$oid) {
          obj._id = new mongoose.Types.ObjectId(obj._id.$oid);
        }

        // Fix reviews array
        if (Array.isArray(obj.reviews)) {
          obj.reviews = obj.reviews.map(convertOid);
        }

        // Get geometry using Mapbox
        let geometry = null;
        try {
          const response = await geoCodingClient
            .forwardGeocode({
              query: `${obj.location}, ${obj.country}`,
              limit: 1,
            })
            .send();
          geometry = response.body.features[0]?.geometry || null;
        } catch (err) {
          console.warn(`⚠️ Geocoding failed for ${obj.location}:`, err.message);
        }

        return {
          ...obj,
          geometry,
          owner: new mongoose.Types.ObjectId("66567b03fda820235197b582"),
        };
      })
    );

    await Listing.insertMany(updatedData);
    console.log("✅ DB seeded successfully!");
  } catch (err) {
    console.error("❌ Error initializing DB:", err);
  } finally {
    mongoose.connection.close();
  }
};

initDB();
