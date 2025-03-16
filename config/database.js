const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Add more detailed logging for connection attempts
    console.log("Attempting to connect to MongoDB...");
    
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    // Log more details about the error for debugging
    if (error.name === 'MongoNetworkError') {
      console.error("Network error - check your IP whitelist and network connectivity");
    }
    process.exit(1);
  }
};

module.exports = connectDB;