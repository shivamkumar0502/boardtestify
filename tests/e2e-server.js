import { MongoMemoryServer } from "mongodb-memory-server";
import http from "node:http";
import { spawn } from "node:child_process";
import mongoose from "mongoose";
process.env.NODE_ENV = "test";
process.env.S3_BUCKET = "fixture";
process.env.S3_REGION = "us-east-1";
process.env.S3_ACCESS_KEY_ID = "test";
process.env.S3_SECRET_ACCESS_KEY = "test";
process.env.S3_ENDPOINT = "http://127.0.0.1:4173/fixture-storage";
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
    name: "Fixture Mobile Author",
    email: "author-mobile@fixture.example",
    passwordHash,
    role: "ADMIN",
    classLevel: "10",
    stream: "GENERAL",
  },
  {
    name: "Fixture Mobile Reviewer",
    email: "reviewer-mobile@fixture.example",
    passwordHash,
    role: "ADMIN",
    classLevel: "10",
    stream: "GENERAL",
  },
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
const { authoringTick } = await import("../backend/src/authoring-jobs.js");
let extraction = null;
const authoringTimer = setInterval(() => {
  if (!extraction)
    extraction = authoringTick().finally(() => {
      extraction = null;
    });
}, 200);
// Disposable S3 adapter on the same origin, so browser CSP and previews are exercised.
const images = new Map();
const server = http
  .createServer(async (req, res) => {
    const path = new URL(req.url, "http://fixture").pathname;
    if (!path.startsWith("/fixture-storage/")) return app(req, res);
    if (req.method === "PUT") {
      const chunks = [];
      for await (const bytes of req) chunks.push(bytes);
      images.set(path, Buffer.concat(chunks));
      res.writeHead(200, { ETag: '"fixture"' });
      return res.end();
    }
    if (req.method === "DELETE") {
      images.delete(path);
      res.statusCode = 204;
      return res.end();
    }
    const bytes = images.get(path);
    if (!bytes) {
      res.statusCode = 404;
      return res.end();
    }
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": bytes.length,
    });
    res.end(bytes);
  })
  .listen(4173, "127.0.0.1");
process.on("SIGTERM", () =>
  server.close(async () => {
    clearInterval(authoringTimer);
    if (extraction) await extraction;
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  }),
);
