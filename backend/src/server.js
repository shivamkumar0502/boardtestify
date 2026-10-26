import mongoose from "mongoose";
import { app, logger } from "./app.js";
import { connect } from "./models.js";
import { env } from "./config.js";
import { tick } from "./attempts.js";
await connect(env.MONGODB_URI);
const server = app.listen(env.PORT, () =>
  logger.info({ port: env.PORT }, "BoardTestify API ready"),
);
let busy = false;
const timer = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await tick();
  } catch (err) {
    logger.error({ err }, "Queue tick failed");
  } finally {
    busy = false;
  }
}, 3000);
async function shutdown() {
  clearInterval(timer);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
