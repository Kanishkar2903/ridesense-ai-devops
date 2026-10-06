const {
  calculateFatigueScore,
  getFatigueLevel
} = require("../../src/services/fatigueService");

describe("Fatigue Service", () => {
  test("calculates fatigue score correctly", () => {
    const workout = {
      cadence: 72,
      speed: 18.5,
      brakingEvents: 7,
      duration: 45
    };

    const result = calculateFatigueScore(workout);

    expect(result).toBe(50);
  });

  test("returns low fatigue level", () => {
    expect(getFatigueLevel(30)).toBe("low");
  });

  test("returns moderate fatigue level", () => {
    expect(getFatigueLevel(50)).toBe("moderate");
  });

  test("returns high fatigue level", () => {
    expect(getFatigueLevel(80)).toBe("high");
  });

  test("fatigue score does not exceed 100", () => {
    const workout = {
      cadence: 20,
      speed: 60,
      brakingEvents: 30,
      duration: 120
    };

    const result = calculateFatigueScore(workout);

    expect(result).toBeLessThanOrEqual(100);
  });
});