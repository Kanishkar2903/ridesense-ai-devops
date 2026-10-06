const {
  calculateFatigueScore,
  getFatigueLevel
} = require("./fatigueService");

function analyseWorkout(workout) {
  const fatigueScore = calculateFatigueScore(workout);

  const fatigueLevel = getFatigueLevel(fatigueScore);

  let difficulty = "maintain";
  let recommendation =
    "Maintain your current training intensity and continue monitoring performance.";

  if (fatigueLevel === "high") {
    difficulty = "reduce";

    recommendation =
      "Reduce training intensity, take a recovery interval and focus on controlled cadence.";
  }

  if (fatigueLevel === "moderate") {
    difficulty = "maintain";

    recommendation =
      "Maintain current intensity but include a short recovery period before increasing effort.";
  }

  if (
    fatigueLevel === "low" &&
    workout.cadence >= 80 &&
    workout.speed >= 20
  ) {
    difficulty = "increase";

    recommendation =
      "Performance is stable. Increase difficulty gradually while maintaining safe cadence.";
  }

  return {
    fatigueScore,
    fatigueLevel,
    difficulty,
    recommendation
  };
}

module.exports = {
  analyseWorkout
};