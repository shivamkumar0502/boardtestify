import { env } from "../backend/src/config.js";
import { integrationReadiness } from "../backend/src/readiness.js";
import { pdfAvailable } from "../backend/src/pdf.js";
const report = integrationReadiness(env, await pdfAvailable());
console.log(
  JSON.stringify(
    {
      environment: env.NODE_ENV,
      ...report,
      note: "Configuration presence only. No provider requests, payments, SMS or deployment were performed.",
    },
    null,
    2,
  ),
);
if (
  process.argv.includes("--strict") &&
  report.integrations.some((i) => i.required && i.status !== "CONFIGURED")
)
  process.exitCode = 1;
