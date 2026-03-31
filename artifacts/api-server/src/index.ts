import app from "./app";
import { logger } from "./lib/logger";
import { startUwPoller } from "./lib/uwPoller.js";
import { startPositionMonitor } from "./lib/positionMonitor.js";

if (!process.env.ADMIN_PASSWORD) {
  logger.warn("ADMIN_PASSWORD is not set — login will be rejected for all attempts.");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
  startUwPoller();
  startPositionMonitor();
});
