const request = require("supertest");
const app = require("../../src/server");

const {
  riders,
  workouts
} = require("../../src/data/store");

describe("RideSense API Integration Tests", () => {
  beforeEach(() => {
    riders.length = 0;
    workouts.length = 0;
  });

  test("GET /health returns healthy status", async () => {
    const response = await request(app)
      .get("/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("healthy");
    expect(response.body.service).toBe("ridesense-ai");
  });

  test("POST /api/riders creates a rider", async () => {
    const response = await request(app)
      .post("/api/riders")
      .send({
        riderId: "R001",
        name: "Alex",
        age: 24,
        fitnessLevel: "intermediate",
        goal: "endurance"
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.riderId).toBe("R001");
    expect(response.body.name).toBe("Alex");
  });

  test("duplicate rider returns 409", async () => {
    const rider = {
      riderId: "R001",
      name: "Alex",
      age: 24
    };

    await request(app)
      .post("/api/riders")
      .send(rider);

    const response = await request(app)
      .post("/api/riders")
      .send(rider);

    expect(response.statusCode).toBe(409);
    expect(response.body.error).toBe(
      "Rider already exists"
    );
  });

  test("POST /api/workouts creates workout for valid rider", async () => {
    await request(app)
      .post("/api/riders")
      .send({
        riderId: "R001",
        name: "Alex",
        age: 24
      });

    const response = await request(app)
      .post("/api/workouts")
      .send({
        riderId: "R001",
        cadence: 72,
        speed: 18.5,
        brakingEvents: 7,
        duration: 45
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.workoutId).toBe("W1");
    expect(response.body.fatigueScore).toBe(50);
  });

  test("workout for unknown rider returns 404", async () => {
    const response = await request(app)
      .post("/api/workouts")
      .send({
        riderId: "R999",
        cadence: 80,
        speed: 20,
        brakingEvents: 2,
        duration: 30
      });

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe(
      "Rider not found"
    );
  });

  test("invalid workout returns 400", async () => {
    const response = await request(app)
      .post("/api/coaching/analyse")
      .send({
        riderId: "R001",
        cadence: -10,
        speed: -5,
        brakingEvents: -2,
        duration: 0
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  test("POST /api/coaching/analyse returns coaching result", async () => {
    const response = await request(app)
      .post("/api/coaching/analyse")
      .send({
        riderId: "R001",
        cadence: 72,
        speed: 18.5,
        brakingEvents: 7,
        duration: 45
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.fatigueScore).toBe(50);
    expect(response.body.fatigueLevel).toBe("moderate");
    expect(response.body.difficulty).toBe("maintain");
  });

  test("GET /api/progress returns workout progress", async () => {
    await request(app)
      .post("/api/riders")
      .send({
        riderId: "R001",
        name: "Alex",
        age: 24
      });

    await request(app)
      .post("/api/workouts")
      .send({
        riderId: "R001",
        cadence: 72,
        speed: 18.5,
        brakingEvents: 7,
        duration: 45
      });

    const response = await request(app)
      .get("/api/progress/R001");

    expect(response.statusCode).toBe(200);
    expect(response.body.totalWorkouts).toBe(1);
    expect(response.body.averageCadence).toBe(72);
    expect(response.body.averageSpeed).toBe(18.5);
    expect(response.body.averageFatigueScore).toBe(50);
  });

  test("unknown route returns 404", async () => {
    const response = await request(app)
      .get("/api/not-real");

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe(
      "Route not found"
    );
  });
});