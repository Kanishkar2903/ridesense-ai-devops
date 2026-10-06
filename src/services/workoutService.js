const { workouts } = require("../data/store");
const { analyseWorkout } = require("./coachingService");

function createWorkout(workoutData) {
  const coaching = analyseWorkout(workoutData);

  const workout = {
    workoutId: `W${workouts.length + 1}`,
    riderId: workoutData.riderId,
    cadence: workoutData.cadence,
    speed: workoutData.speed,
    brakingEvents: workoutData.brakingEvents,
    duration: workoutData.duration,
    fatigueScore: coaching.fatigueScore,
    fatigueLevel: coaching.fatigueLevel,
    difficulty: coaching.difficulty,
    recommendation: coaching.recommendation,
    createdAt: new Date().toISOString()
  };

  workouts.push(workout);

  return workout;
}

function getWorkoutsByRider(riderId) {
  return workouts.filter(
    (workout) => workout.riderId === riderId
  );
}

function getAllWorkouts() {
  return workouts;
}

module.exports = {
  createWorkout,
  getWorkoutsByRider,
  getAllWorkouts
};