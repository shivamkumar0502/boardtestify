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
const seed = spawn(process.execPath, ["backend/src/manage.js", "seed"], {
  stdio: "inherit",
  env: process.env,
});
const seedExit = await new Promise((resolve, reject) => {
  seed.once("error", reject);
  seed.once("exit", resolve);
});
if (seedExit) process.exit(seedExit);
const { connect, User } = await import("../backend/src/models.js");
await connect(process.env.MONGODB_URI);
const bcrypt = await import("bcryptjs");
const passwordHash = await bcrypt.default.hash(
  "Fixture-admin-password-123",
  10,
);
await User.create([
  {
    name: "Fixture Author",
    email: "author@fixture.example",
    passwordHash,
    role: "ADMIN",
    classLevel: "10",
    stream: "GENERAL",
  },
  {
    name: "Fixture Reviewer",
    email: "reviewer@fixture.example",
    passwordHash,
    role: "ADMIN",
    classLevel: "10",
    stream: "GENERAL",
  },
]);
const { app } = await import("../backend/src/app.js");
const server = app.listen(4173, "127.0.0.1");
process.on("SIGTERM", () =>
  server.close(async () => {
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  }),
);
