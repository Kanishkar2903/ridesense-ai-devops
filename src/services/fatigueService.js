function calculateFatigueScore(workout) {
  const cadenceScore = Math.max(0, (90 - workout.cadence) * 0.5);

  const durationScore = workout.duration * 0.6;

  const brakingScore = workout.brakingEvents * 2;

  const speedScore =
    workout.speed > 30
      ? (workout.speed - 30) * 1.5
      : 0;

  let fatigueScore =
    cadenceScore +
    durationScore +
    brakingScore +
    speedScore;

  fatigueScore = Math.round(fatigueScore);

  return Math.min(100, Math.max(0, fatigueScore));
}

function getFatigueLevel(score) {
  if (score >= 75) {
    return "high";
  }

  if (score >= 45) {
    return "moderate";
  }

  return "low";
}

module.exports = {
  calculateFatigueScore,
  getFatigueLevel
};