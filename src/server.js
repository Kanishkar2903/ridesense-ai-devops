const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const riderRoutes = require("./routes/riderRoutes");
const workoutRoutes = require("./routes/workoutRoutes");
const coachingRoutes = require("./routes/coachingRoutes");
const progressRoutes = require("./routes/progressRoutes");

const monitoringMiddleware =
  require("./monitoring/monitoringMiddleware");

const {
  client
} = require("./monitoring/metrics");

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(monitoringMiddleware);

// Main application endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    application: "RideSense AI",
    description:
      "Adaptive Training and Safety Coach for SmartBikeVR",
    version: "1.0.1",
    status: "running"
  });
});

// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "ridesense-ai",
    timestamp: new Date().toISOString()
  });
});

// RideSense API routes
app.use("/api/riders", riderRoutes);

app.use("/api/workouts", workoutRoutes);

app.use("/api/coaching", coachingRoutes);

app.use("/api/progress", progressRoutes);

// Prometheus metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set(
      "Content-Type",
      client.register.contentType
    );

    res.end(
      await client.register.metrics()
    );
  } catch (error) {
    res.status(500).json({
      error: "Unable to collect metrics"
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

// Start server only when executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `RideSense AI server running on port ${PORT}`
    );
  });
}

module.exports = app;