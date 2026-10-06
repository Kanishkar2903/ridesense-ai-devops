const express = require("express");

const {
  getProgressSummary
} = require("../services/progressService");

const router = express.Router();

router.get("/:riderId", (req, res) => {
  const summary = getProgressSummary(
    req.params.riderId
  );

  return res.status(200).json(summary);
});

module.exports = router;