const express = require("express");

const {
  createWorkout,
  getWorkoutsByRider
} = require("../services/workoutService");

const {
  getRiderById
} = require("../services/riderService");

const {
  validateWorkout
} = require("../validation/workoutValidation");

const {
  workoutsProcessedTotal
} = require("../monitoring/metrics");

const router = express.Router();

router.post("/", (req, res) => {
  const errors = validateWorkout(req.body);

  if (errors.length > 0) {
    return res.status(400).json({
      errors
    });
  }

  const rider = getRiderById(req.body.riderId);

  if (!rider) {
    return res.status(404).json({
      error: "Rider not found"
    });
  }

  const workout = createWorkout(req.body);

  workoutsProcessedTotal.inc();

  return res.status(201).json(workout);
});

router.get("/:riderId", (req, res) => {
  const workouts = getWorkoutsByRider(
    req.params.riderId
  );

  return res.status(200).json({
    riderId: req.params.riderId,
    workouts
  });
});

module.exports = router;