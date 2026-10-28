import mongoose from "mongoose";
import pino from "pino";
import { env } from "./config.js";
import { connect } from "./models.js";
import { startWorkers } from "./worker-runtime.js";
await connect(env.MONGODB_URI);
const logger = pino();
const stop = startWorkers(logger);
logger.info("BoardTestify evaluation worker ready");
let shutting = false;
async function shutdown() {
  if (shutting) return;
  shutting = true;
  const force = setTimeout(() => process.exit(1), 30000);
  force.unref();
  await stop();
  await mongoose.disconnect();
  clearTimeout(force);
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
