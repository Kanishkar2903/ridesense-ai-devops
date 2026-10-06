const client = require("prom-client");

client.collectDefaultMetrics();

const httpRequestsTotal = new client.Counter({
  name: "ridesense_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"]
});

const httpErrorsTotal = new client.Counter({
  name: "ridesense_http_errors_total",
  help: "Total number of HTTP error responses",
  labelNames: ["method", "route", "status"]
});

const coachingRequestsTotal = new client.Counter({
  name: "ridesense_coaching_requests_total",
  help: "Total number of coaching analysis requests"
});

const workoutsProcessedTotal = new client.Counter({
  name: "ridesense_workouts_processed_total",
  help: "Total number of workouts processed"
});

const requestDuration = new client.Histogram({
  name: "ridesense_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2]
});

module.exports = {
  client,
  httpRequestsTotal,
  httpErrorsTotal,
  coachingRequestsTotal,
  workoutsProcessedTotal,
  requestDuration
};