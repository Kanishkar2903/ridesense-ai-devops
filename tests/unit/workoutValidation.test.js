const {
  validateWorkout
} = require("../../src/validation/workoutValidation");

describe("Workout Validation", () => {
  test("accepts valid workout data", () => {
    const workout = {
      riderId: "R001",
      cadence: 80,
      speed: 20,
      brakingEvents: 3,
      duration: 40
    };

    const errors = validateWorkout(workout);

    expect(errors).toHaveLength(0);
  });

  test("rejects invalid workout data", () => {
    const workout = {
      riderId: "",
      cadence: -1,
      speed: -5,
      brakingEvents: -2,
      duration: 0
    };

    const errors = validateWorkout(workout);

    expect(errors).toContain("riderId is required");
    expect(errors).toContain(
      "cadence must be a positive number"
    );
    expect(errors).toContain(
      "speed must be a non-negative number"
    );
    expect(errors).toContain(
      "brakingEvents must be a non-negative number"
    );
    expect(errors).toContain(
      "duration must be a positive number"
    );
  });
});