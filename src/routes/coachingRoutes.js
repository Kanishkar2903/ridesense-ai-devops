const express = require("express");

const {
  analyseWorkout
} = require("../services/coachingService");

const {
  validateWorkout
} = require("../validation/workoutValidation");

const router = express.Router();

router.post("/analyse", (req, res) => {
  const errors = validateWorkout(req.body);

  if (errors.length > 0) {
    return res.status(400).json({
      errors
    });
  }

  const result = analyseWorkout(req.body);

  return res.status(200).json({
    riderId: req.body.riderId,
    ...result
  });
});

module.exports = router;