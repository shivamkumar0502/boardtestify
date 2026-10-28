import mongoose from "mongoose";
import { env } from "./config.js";
import { connect, migrateIndexes, Attempt } from "./models.js";
import { summaryFor } from "./attempts.js";
import { answerPresent } from "@boardtestify/domain";
await connect(env.MONGODB_URI);
await migrateIndexes();
const cursor = Attempt.find({
  $or: [{ summary: { $exists: false } }, { answerBytes: { $exists: false } }],
})
  .lean()
  .cursor({ batchSize: 25 });
let updated = 0;
for await (const a of cursor) {
  const answeredIds = Object.entries(a.answers || {})
    .filter(([, v]) => answerPresent(v))
    .map(([k]) => k);
  const answerBytes = Object.values(a.answers || {}).reduce(
    (n, v) => n + Buffer.byteLength(JSON.stringify(v), "utf8"),
    0,
  );
  const summary = a.status === "ACTIVE" ? undefined : summaryFor(a);
  const change = await Attempt.updateOne(
    { _id: a._id, revision: a.revision },
    { $set: { answeredIds, answerBytes, ...(summary ? { summary } : {}) } },
  );
  updated += change.modifiedCount;
}
console.log(
  `Indexes verified; ${updated} attempt summaries/tracking records updated. Live answers were not changed.`,
);
await mongoose.disconnect();
