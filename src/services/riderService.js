const { riders } = require("../data/store");

function createRider(riderData) {
  const existingRider = riders.find(
    (rider) => rider.riderId === riderData.riderId
  );

  if (existingRider) {
    throw new Error("Rider already exists");
  }

  const rider = {
    riderId: riderData.riderId,
    name: riderData.name,
    age: riderData.age,
    fitnessLevel: riderData.fitnessLevel || "beginner",
    goal: riderData.goal || "general-fitness",
    createdAt: new Date().toISOString()
  };

  riders.push(rider);

  return rider;
}

function getRiderById(riderId) {
  return riders.find((rider) => rider.riderId === riderId);
}

function getAllRiders() {
  return riders;
}

module.exports = {
  createRider,
  getRiderById,
  getAllRiders
};