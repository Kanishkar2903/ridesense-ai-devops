const express = require("express");

const {
  createRider,
  getAllRiders
} = require("../services/riderService");

const router = express.Router();

router.post("/", (req, res) => {
  try {
    const {
      riderId,
      name,
      age,
      fitnessLevel,
      goal
    } = req.body;

    if (!riderId || !name || !age) {
      return res.status(400).json({
        error: "riderId, name and age are required"
      });
    }

    const rider = createRider({
      riderId,
      name,
      age,
      fitnessLevel,
      goal
    });

    return res.status(201).json(rider);
  } catch (error) {
    return res.status(409).json({
      error: error.message
    });
  }
});

router.get("/", (req, res) => {
  return res.status(200).json({
    riders: getAllRiders()
  });
});

module.exports = router;