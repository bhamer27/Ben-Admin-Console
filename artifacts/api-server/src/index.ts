import app from "./app";
import { logger } from "./lib/logger";

// Warn at startup if ADMIN_USER_ID is not configured.
// BenAdmin is a private single-user console — without this, the first user
// through OIDC can claim admin via the setup flow.
if (!process.env.ADMIN_USER_ID) {
  logger.warn(
    "ADMIN_USER_ID is not set. The first user to authenticate will be able to claim admin ownership. " +
    "Set ADMIN_USER_ID to your Replit user ID to lock access before the first login. " +
    "Optionally set SETUP_SECRET to require a passphrase during the claim step.",
  );
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
});
