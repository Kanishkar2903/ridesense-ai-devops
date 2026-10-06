const {
  analyseWorkout
} = require("../../src/services/coachingService");

describe("Coaching Service", () => {
  test("recommends maintaining intensity for moderate fatigue", () => {
    const workout = {
      riderId: "R001",
      cadence: 72,
      speed: 18.5,
      brakingEvents: 7,
      duration: 45
    };

    const result = analyseWorkout(workout);

    expect(result.fatigueScore).toBe(50);
    expect(result.fatigueLevel).toBe("moderate");
    expect(result.difficulty).toBe("maintain");
  });

  test("recommends reducing difficulty for high fatigue", () => {
    const workout = {
      riderId: "R001",
      cadence: 50,
      speed: 35,
      brakingEvents: 15,
      duration: 90
    };

    const result = analyseWorkout(workout);

    expect(result.fatigueLevel).toBe("high");
    expect(result.difficulty).toBe("reduce");
  });

  test("recommends increasing difficulty for strong performance", () => {
    const workout = {
      riderId: "R001",
      cadence: 90,
      speed: 25,
      brakingEvents: 0,
      duration: 20
    };

    const result = analyseWorkout(workout);

    expect(result.fatigueLevel).toBe("low");
    expect(result.difficulty).toBe("increase");
  });
});