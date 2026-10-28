import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/pending";
process.env.JWT_SECRET = "startup-fixture-secret-".repeat(4);
process.env.WEB_ORIGIN = "http://localhost:5173";
const { connect, User, Attempt } = await import("../backend/src/models.js");
const { env } = await import("../backend/src/config.js");
test("startup creates required indexes without concurrent DDL, preserves records and production skips DDL", async () => {
  const server = await MongoMemoryServer.create({
    instance: { args: ["--nounixsocket"] },
  });
  let active = 0,
    peak = 0,
    jobs = 0;
  const client = mongoose.connection;
  // Command monitoring observes actual database traffic, including automatic jobs.
  const observe = () => {
    const driver = client.getClient();
    driver.on("commandStarted", (event) => {
      if (["create", "createIndexes"].includes(event.commandName)) {
        jobs++;
        active++;
        peak = Math.max(peak, active);
      }
    });
    const complete = (event) => {
      if (["create", "createIndexes"].includes(event.commandName)) active--;
    };
    driver.on("commandSucceeded", complete);
    driver.on("commandFailed", complete);
  };
  // Enable observation without adding application connection configuration.
  const original = mongoose.connect.bind(mongoose);
  mongoose.connect = (uri, options) =>
    original(uri, { ...options, monitorCommands: true });
  client.on("connected", observe);
  try {
    await connect(server.getUri());
    assert.ok(jobs > 0);
    assert.equal(peak, 1);
    assert.ok(
      (await User.collection.indexes()).some(
        (i) => i.unique && i.key.email === 1,
      ),
    );
    assert.ok(
      (await Attempt.collection.indexes()).some(
        (i) => i.unique && i.partialFilterExpression?.status === "ACTIVE",
      ),
    );
    await User.create({
      email: "startup@example.com",
      name: "Preserved fixture",
    });
    await assert.rejects(User.create({ email: "startup@example.com" }), {
      code: 11000,
    });
    await mongoose.disconnect();
    env.NODE_ENV = "production";
    jobs = 0;
    peak = 0;
    active = 0;
    await connect(server.getUri());
    assert.equal(jobs, 0);
    assert.equal(
      (await User.findOne({ email: "startup@example.com" })).name,
      "Preserved fixture",
    );
  } finally {
    env.NODE_ENV = "test";
    mongoose.connect = original;
    client.off("connected", observe);
    await mongoose.disconnect();
    await server.stop();
  }
});
