import mongoose from "mongoose";
import { app, logger } from "./app.js";
import { connect } from "./models.js";
import { env } from "./config.js";
import { startWorkers } from "./worker-runtime.js";
await connect(env.MONGODB_URI);
const server = app.listen(env.PORT, () =>
  logger.info({ port: env.PORT }, "BoardTestify API ready"),
);
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.keepAliveTimeout = 5000;
const stopWorkers =
  env.RUN_WORKER === "true" ? startWorkers(logger) : async () => {};
let shutting = false;
async function shutdown() {
  if (shutting) return;
  shutting = true;
  server.close(async () => {
    await stopWorkers();
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 30000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
