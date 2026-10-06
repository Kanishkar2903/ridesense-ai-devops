const {
  httpRequestsTotal,
  httpErrorsTotal,
  requestDuration
} = require("./metrics");

function monitoringMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);

    const duration =
      diff[0] + diff[1] / 1e9;

    const route =
      req.route && req.route.path
        ? req.route.path
        : req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status: res.statusCode
    });

    requestDuration.observe(
      {
        method: req.method,
        route,
        status: res.statusCode
      },
      duration
    );

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc({
        method: req.method,
        route,
        status: res.statusCode
      });
    }
  });

  next();
}

module.exports = monitoringMiddleware;