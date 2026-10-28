import { randomUUID } from "node:crypto";
import { AuthoringJob } from "./models.js";
import { extractQuestionJob } from "./question-extraction.js";
import { deleteImage } from "./storage.js";
export async function authoringTick() {
  const now = new Date();
  await AuthoringJob.updateMany(
    { status: "PROCESSING", leaseUntil: { $lt: now }, attempts: { $gte: 3 } },
    {
      $set: {
        status: "FAILED",
        error: "Processing interrupted repeatedly. Create a new import.",
      },
      $unset: { leaseToken: 1, leaseUntil: 1 },
    },
  );
  const token = randomUUID();
  const job = await AuthoringJob.findOneAndUpdate(
    {
      attempts: { $lt: 3 },
      $or: [
        { status: "PENDING" },
        { status: "PROCESSING", leaseUntil: { $lt: now } },
      ],
    },
    {
      $set: {
        status: "PROCESSING",
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 120000),
      },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, returnDocument: "after" },
  ).lean();
  if (!job) return false;
  const lease = { _id: job._id, status: "PROCESSING", leaseToken: token };
  const heartbeat = setInterval(
    () =>
      AuthoringJob.updateOne(lease, {
        $set: { leaseUntil: new Date(Date.now() + 120000) },
      }).catch(() => {}),
    20000,
  );
  try {
    const result = await extractQuestionJob(job);
    await AuthoringJob.updateOne(lease, {
      $set: { status: "READY", result, error: null },
      $unset: { leaseToken: 1, leaseUntil: 1 },
    });
  } catch (e) {
    const message = e.status
      ? e.message
      : "Extraction could not be validated. Retry or use the paste template.";
    await AuthoringJob.updateOne(lease, {
      $set: { status: "FAILED", error: message },
      $unset: { leaseToken: 1, leaseUntil: 1 },
    });
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
export async function cleanupAuthoringJobs() {
  const jobs = await AuthoringJob.find({
    deleteAfter: { $lte: new Date() },
    status: { $ne: "PROCESSING" },
  })
    .limit(25)
    .lean();
  for (const job of jobs) {
    if (job.input?.sourceKey) await deleteImage(job.input.sourceKey);
    await AuthoringJob.deleteOne({ _id: job._id, status: job.status });
  }
}
