import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
const run = promisify(execFile);
const toolsReady = ["mongodump", "mongorestore"].every(
  (tool) => spawnSync(tool, ["--version"]).status === 0,
);
test(
  "a real BSON archive restores to an isolated drill database without changing source data or overwriting backups",
  { skip: !toolsReady },
  async () => {
    const instance = await MongoMemoryServer.create({
      instance: { args: ["--nounixsocket"], dbName: "backup_fixture" },
    });
    const uri = instance.getUri("backup_fixture"),
      dir = await mkdtemp(join(tmpdir(), "bt-backup-test-"));
    const archive = join(dir, "fixture.archive.gz");
    const client = new mongoose.mongo.MongoClient(uri);
    try {
      await client.connect();
      const source = client.db("backup_fixture");
      const timestamp = new Date("2026-01-01T00:00:00Z");
      await source
        .collection("answers")
        .insertOne({ number: 1, text: "उत्तर", submittedAt: timestamp });
      await source
        .collection("answers")
        .createIndex({ number: 1 }, { unique: true });
      const invoke = (operation) =>
        run(process.execPath, ["scripts/database.mjs", operation, archive], {
          env: { ...process.env, MONGODB_URI: uri },
          timeout: 60000,
        });
      await invoke("backup");
      const original = await readFile(archive),
        manifest = JSON.parse(await readFile(archive + ".manifest.json"));
      assert.equal(manifest.database, "backup_fixture");
      if (process.platform !== "win32")
        assert.equal((await stat(archive)).mode & 0o777, 0o600);
      await assert.rejects(invoke("backup"));
      assert.deepEqual(await readFile(archive), original);
      await source
        .collection("answers")
        .insertOne({ number: 2, text: "Later live answer" });
      const { stdout } = await invoke("restore-drill");
      const report = JSON.parse(stdout);
      assert.match(report.restoredTo, /^bt_restore_/);
      assert.equal(report.sourceUnchanged, true);
      const restored = client.db(report.restoredTo);
      assert.equal(await source.collection("answers").countDocuments(), 2);
      assert.equal(await restored.collection("answers").countDocuments(), 1);
      const row = await restored.collection("answers").findOne({ number: 1 });
      assert.equal(row.text, "उत्तर");
      assert.deepEqual(row.submittedAt, timestamp);
      assert.ok(
        (await restored.collection("answers").indexes()).some((i) => i.unique),
      );
      await writeFile(
        archive,
        Buffer.concat([original, Buffer.from("corrupted")]),
      );
      await assert.rejects(invoke("restore-drill"));
      assert.equal(await source.collection("answers").countDocuments(), 2);
    } finally {
      await client.close();
      await instance.stop();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
