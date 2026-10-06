const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Main route
app.get("/", (req, res) => {
  res.status(200).json({
    application: "RideSense AI",
    description: "Adaptive Training and Safety Coach for SmartBikeVR",
    status: "running"
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "ridesense-ai",
    timestamp: new Date().toISOString()
  });
});

// Start server only when this file is executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RideSense AI server running on port ${PORT}`);
  });
}

module.exports = app;