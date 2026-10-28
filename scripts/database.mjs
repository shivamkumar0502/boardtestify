import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  open,
  chmod,
  stat,
  access,
  unlink,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import mongoose from "mongoose";
const run = promisify(execFile);
const [command, filename] = process.argv.slice(2);
if (!["backup", "restore-drill"].includes(command) || !filename)
  throw Error(
    "Usage: npm run db:backup -- /secure/backup.archive.gz OR npm run db:restore-drill -- /secure/backup.archive.gz",
  );
const uri = process.env.MONGODB_URI || "";
const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri);
const database = match ? decodeURIComponent(match[1]) : "";
if (
  !/^[A-Za-z0-9_-]{1,63}$/.test(database) ||
  ["admin", "config", "local"].includes(database)
)
  throw Error("MONGODB_URI must name the application database explicitly");
const archive = resolve(filename),
  manifestPath = `${archive}.manifest.json`;
const digest = async () => {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(archive)) hash.update(bytes);
  return hash.digest("hex");
};
const dir = await mkdtemp(join(tmpdir(), "bt-db-tool-"));
const config = join(dir, "tool.yml");
// Mongo tools read credentials from a private file, not command-line arguments.
await writeFile(config, `uri: ${JSON.stringify(uri)}\n`, { mode: 0o600 });
const tool = async (name, args) => {
  try {
    await run(name, ["--config", config, ...args], {
      timeout: 30 * 60 * 1000,
      maxBuffer: 8_000_000,
    });
  } catch {
    throw Error(
      `${name} failed. Check MongoDB tools, permissions, disk space and connectivity. Provider details are omitted to protect credentials.`,
    );
  }
};
let createdArchive = false,
  createdManifest = false;
try {
  if (command === "backup") {
    // Never overwrite a previous backup, including dangling symlinks.
    const handle = await open(archive, "wx", 0o600);
    await handle.close();
    createdArchive = true;
    try {
      await access(manifestPath);
      throw Error("Manifest already exists; choose a new backup filename");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await tool("mongodump", [
      "--db",
      database,
      "--archive=" + archive,
      "--gzip",
    ]);
    await chmod(archive, 0o600);
    const manifest = {
      version: 1,
      database,
      createdAt: new Date().toISOString(),
      bytes: (await stat(archive)).size,
      sha256: await digest(),
      consistency:
        "logical dump; use managed snapshots/PITR for production point-in-time recovery",
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    createdManifest = true;
    console.log(
      JSON.stringify({
        backup: archive,
        manifest: manifestPath,
        bytes: manifest.bytes,
        sha256: manifest.sha256,
      }),
    );
  } else {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (
      manifest.version !== 1 ||
      manifest.database !== database ||
      !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
      manifest.sha256 !== (await digest())
    )
      throw Error(
        "Backup manifest, source database or archive checksum does not match",
      );
    const target = `bt_restore_${Date.now()}_${randomBytes(6).toString("hex")}`;
    // Namespace mapping always uses a new drill database; never --drop or the source namespace.
    await tool("mongorestore", [
      "--archive=" + archive,
      "--gzip",
      "--stopOnError",
      "--nsInclude=" + database + ".*",
      "--nsFrom=" + database + ".*",
      "--nsTo=" + target + ".*",
    ]);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 2,
    });
    const db = mongoose.connection.getClient().db(target);
    const collections = [];
    for await (const c of db.listCollections({}, { nameOnly: true })) {
      collections.push({
        name: c.name,
        documents: await db
          .collection(c.name)
          .countDocuments({}, { maxTimeMS: 30000 }),
      });
    }
    if (!collections.length)
      throw Error(
        "Restore produced no collections; inspect the drill before release",
      );
    console.log(
      JSON.stringify(
        {
          restoredTo: target,
          sourceUnchanged: true,
          collections,
          note: "Drill database retained for inspection. Application-level acceptance and private S3 object restore remain required.",
        },
        null,
        2,
      ),
    );
  }
} catch (e) {
  if (command === "backup" && createdArchive && !createdManifest)
    await unlink(archive).catch(() => {});
  // Never print exception details that may contain a credential-bearing URI.
  console.error(
    "Database operation failed. Check input files, MongoDB tools, permissions, checksum, configuration and connectivity; existing backups and source data were not overwritten.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  await rm(dir, { recursive: true, force: true });
}
