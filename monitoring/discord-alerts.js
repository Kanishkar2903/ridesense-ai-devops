const http = require("http");

const PORT = Number(process.env.PORT || 9094);

const discordWebhookUrl =
  process.env.DISCORD_WEBHOOK_URL;

if (!discordWebhookUrl) {
  console.error(
    "DISCORD_WEBHOOK_URL environment variable is required."
  );

  process.exit(1);
}

function buildDiscordMessage(payload) {
  const status =
    String(payload.status || "unknown").toUpperCase();

  const alerts =
    Array.isArray(payload.alerts)
      ? payload.alerts
      : [];

  const isResolved =
    status === "RESOLVED";

  const icon =
    isResolved
      ? "✅"
      : "🚨";

  const heading =
    isResolved
      ? `${icon} RideSense Alert Resolved`
      : `${icon} RideSense Monitoring Alert`;

  const lines = [
    heading,
    "",
    `Status: ${status}`,
    ""
  ];

  for (const alert of alerts) {
    const labels =
      alert.labels || {};

    const annotations =
      alert.annotations || {};

    lines.push(
      `Alert: ${labels.alertname || "Unknown"}`
    );

    lines.push(
      `Severity: ${labels.severity || "unknown"}`
    );

    if (annotations.summary) {
      lines.push(
        `Summary: ${annotations.summary}`
      );
    }

    if (annotations.description) {
      lines.push(
        `Description: ${annotations.description}`
      );
    }

    if (alert.startsAt) {
      lines.push(
        `Started: ${alert.startsAt}`
      );
    }

    if (
      isResolved &&
      alert.endsAt
    ) {
      lines.push(
        `Resolved: ${alert.endsAt}`
      );
    }

    lines.push("");
  }

  lines.push(
    "Service: RideSense AI"
  );

  let message =
    lines.join("\n");

  // Discord messages have a 2000-character limit.
  if (message.length > 1900) {
    message =
      message.substring(0, 1900) +
      "\n...";
  }

  return message;
}

async function sendToDiscord(payload) {
  const message =
    buildDiscordMessage(payload);

  const response =
    await fetch(
      discordWebhookUrl,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          username:
            "RideSense Monitoring",

          content:
            message,

          allowed_mentions: {
            parse: []
          }
        })
      }
    );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `Discord returned ${response.status}: ${body}`
    );
  }
}

const server =
  http.createServer(
    async (req, res) => {

      if (
        req.method === "GET" &&
        req.url === "/health"
      ) {
        res.writeHead(
          200,
          {
            "Content-Type":
              "application/json"
          }
        );

        res.end(
          JSON.stringify({
            status: "healthy",
            service:
              "ridesense-discord-alerts"
          })
        );

        return;
      }

      if (
        req.method !== "POST" ||
        req.url !== "/alerts"
      ) {
        res.writeHead(
          404,
          {
            "Content-Type":
              "application/json"
          }
        );

        res.end(
          JSON.stringify({
            error: "Not found"
          })
        );

        return;
      }

      let body = "";

      req.on(
        "data",
        (chunk) => {
          body += chunk;

          if (
            body.length >
            1024 * 1024
          ) {
            req.destroy();
          }
        }
      );

      req.on(
        "end",
        async () => {

          try {
            const payload =
              JSON.parse(body);

            await sendToDiscord(
              payload
            );

            console.log(
              `Discord notification sent: ${payload.status}`
            );

            res.writeHead(
              200,
              {
                "Content-Type":
                  "application/json"
              }
            );

            res.end(
              JSON.stringify({
                delivered: true
              })
            );

          } catch (error) {

            console.error(
              "Discord alert delivery failed:",
              error.message
            );

            res.writeHead(
              500,
              {
                "Content-Type":
                  "application/json"
              }
            );

            res.end(
              JSON.stringify({
                delivered: false,
                error:
                  error.message
              })
            );
          }
        }
      );
    }
  );

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `RideSense Discord alert adapter running on port ${PORT}`
    );
  }
);