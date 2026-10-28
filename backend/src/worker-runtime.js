import { authoringTick, cleanupAuthoringJobs } from "./authoring-jobs.js";
import { tick } from "./attempts.js";
import { cleanupAttachments } from "./attachments.js";
import { env } from "./config.js";
export function startWorkers(logger) {
  let stopping = false;
  const active = new Set();
  let authoringJob = null;
  let cleanupAt = 0;
  let cleanupJob = null;
  const schedule = () => {
    if (stopping) return;
    while (active.size < env.WORKER_CONCURRENCY) {
      const job = tick()
        .catch((err) => logger.error({ err }, "Evaluation worker failed"))
        .finally(() => active.delete(job));
      active.add(job);
    }
    if (!authoringJob)
      authoringJob = authoringTick()
        .catch((err) =>
          logger.error({ err }, "Question extraction worker failed"),
        )
        .finally(() => {
          authoringJob = null;
        });
    if (!cleanupJob && Date.now() > cleanupAt) {
      cleanupAt = Date.now() + 300000;
      cleanupJob = cleanupAttachments()
        .then(() => cleanupAuthoringJobs())
        .catch((err) =>
          logger.error({ err }, "Attachment retention sweep failed"),
        )
        .finally(() => {
          cleanupJob = null;
        });
    }
  };
  const interval = setInterval(schedule, 3000);
  schedule();
  return async () => {
    stopping = true;
    clearInterval(interval);
    await Promise.allSettled([
      ...active,
      ...(cleanupJob ? [cleanupJob] : []),
      ...(authoringJob ? [authoringJob] : []),
    ]);
  };
}
