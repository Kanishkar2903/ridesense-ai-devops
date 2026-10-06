function validateWorkout(workout) {
  const errors = [];

  if (!workout.riderId) {
    errors.push("riderId is required");
  }

  if (
    typeof workout.cadence !== "number" ||
    workout.cadence <= 0
  ) {
    errors.push("cadence must be a positive number");
  }

  if (
    typeof workout.speed !== "number" ||
    workout.speed < 0
  ) {
    errors.push("speed must be a non-negative number");
  }

  if (
    typeof workout.brakingEvents !== "number" ||
    workout.brakingEvents < 0
  ) {
    errors.push("brakingEvents must be a non-negative number");
  }

  if (
    typeof workout.duration !== "number" ||
    workout.duration <= 0
  ) {
    errors.push("duration must be a positive number");
  }

  return errors;
}

module.exports = {
  validateWorkout
};