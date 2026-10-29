import "dotenv/config";
import { z } from "zod";
export const env = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(4000),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(48),
    WEB_ORIGIN: z.string().url(),
    AI_BASE_URL: z
      .string()
      .url()
      .default("https://generativelanguage.googleapis.com/v1beta/openai/"),
    AI_API_KEY: z.string().default(""),
    AI_MODEL: z.string().default("gemini-3.8-flash"),
    SMTP_URL: z.string().default(""),
    MAIL_FROM: z.string().default(""),
    RAZORPAY_KEY_ID: z.string().default(""),
    RAZORPAY_KEY_SECRET: z.string().default(""),
    RAZORPAY_WEBHOOK_SECRET: z.string().default(""),
    PASS_PRICE_PAISE: z.coerce.number().int().positive().default(9900),
    S3_ENDPOINT: z.string().default(""),
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: z.string().default(""),
    S3_ACCESS_KEY_ID: z.string().default(""),
    S3_SECRET_ACCESS_KEY: z.string().default(""),
    DB_IP_FAMILY: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.coerce
        .number()
        .int()
        .refine((v) => v === 4 || v === 6, "Use 4 or 6")
        .optional(),
    ),
    DB_POOL_MAX: z.coerce.number().int().min(5).max(200).default(30),
    DB_SELECTION_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(120000)
      .default(30000),
    DB_WAIT_QUEUE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(60000)
      .default(5000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    API_CONCURRENCY: z.coerce.number().int().min(10).max(1000).default(150),
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
    RUN_WORKER: z.enum(["true", "false"]).default("true"),
    AI_VISION_ENABLED: z.enum(["true", "false"]).default("true"),
    OCR_API_KEY: z.string().default(""),
    TWILIO_ACCOUNT_SID: z.string().default(""),
    TWILIO_AUTH_TOKEN: z.string().default(""),
    TWILIO_VERIFY_SERVICE_SID: z.string().default(""),
    ATTACHMENT_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(7)
      .max(730)
      .default(90),
  })
  .parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (!env.WEB_ORIGIN.startsWith("https://") ||
    env.JWT_SECRET.includes("replace-with"))
)
  throw Error("Production requires HTTPS origin and a random JWT secret");
