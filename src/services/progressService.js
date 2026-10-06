const { getWorkoutsByRider } = require("./workoutService");

function getProgressSummary(riderId) {
  const riderWorkouts = getWorkoutsByRider(riderId);

  if (riderWorkouts.length === 0) {
    return {
      riderId,
      totalWorkouts: 0,
      averageCadence: 0,
      averageSpeed: 0,
      averageFatigueScore: 0,
      message: "No workout data available"
    };
  }

  const totalCadence = riderWorkouts.reduce(
    (sum, workout) => sum + workout.cadence,
    0
  );

  const totalSpeed = riderWorkouts.reduce(
    (sum, workout) => sum + workout.speed,
    0
  );

  const totalFatigue = riderWorkouts.reduce(
    (sum, workout) => sum + workout.fatigueScore,
    0
  );

  return {
    riderId,
    totalWorkouts: riderWorkouts.length,
    averageCadence: Number(
      (totalCadence / riderWorkouts.length).toFixed(2)
    ),
    averageSpeed: Number(
      (totalSpeed / riderWorkouts.length).toFixed(2)
    ),
    averageFatigueScore: Number(
      (totalFatigue / riderWorkouts.length).toFixed(2)
    )
  };
}

module.exports = {
  getProgressSummary
};