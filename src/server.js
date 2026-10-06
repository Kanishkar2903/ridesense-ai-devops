const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const riderRoutes = require("./routes/riderRoutes");
const workoutRoutes = require("./routes/workoutRoutes");
const coachingRoutes = require("./routes/coachingRoutes");
const progressRoutes = require("./routes/progressRoutes");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({
    application: "RideSense AI",
    description:
      "Adaptive Training and Safety Coach for SmartBikeVR",
    version: "1.0.0",
    status: "running"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "ridesense-ai",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/riders", riderRoutes);

app.use("/api/workouts", workoutRoutes);

app.use("/api/coaching", coachingRoutes);

app.use("/api/progress", progressRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `RideSense AI server running on port ${PORT}`
    );
  });
}

module.exports = app;