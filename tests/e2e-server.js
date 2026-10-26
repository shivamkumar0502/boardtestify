import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import mongoose from "mongoose";
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "";
process.env.WEB_ORIGIN = "http://127.0.0.1:4173";
process.env.JWT_SECRET = "e2e-only-secret-".repeat(5);
const mongo = await MongoMemoryServer.create({
  instance: { args: ["--nounixsocket"] },
});
process.env.MONGODB_URI = mongo.getUri();
const seed = spawn(process.execPath, ["apps/api/src/manage.js", "seed"], {
  stdio: "inherit",
  env: process.env,
});
const seedExit = await new Promise((resolve, reject) => {
  seed.once("error", reject);
  seed.once("exit", resolve);
});
if (seedExit) process.exit(seedExit);
const { connect } = await import("../apps/api/src/models.js");
await connect(process.env.MONGODB_URI);
const { app } = await import("../apps/api/src/app.js");
const server = app.listen(4173, "127.0.0.1");
process.on("SIGTERM", () =>
  server.close(async () => {
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  }),
);
