import { pdfAvailable } from "./pdf.js";
import { Router } from "express";
import { env } from "./config.js";
import { storageEnabled } from "./storage.js";
import { paymentsEnabled, validSignature, billingWebhook } from "./billing.js";
export const validHmac = validSignature;
export const webhook = billingWebhook;
export const integrations = Router();
integrations.get("/features", async (_req, res) =>
  res.json({
    ai: !!(env.AI_API_KEY && env.AI_MODEL),
    aiVision: env.AI_VISION_ENABLED === "true",
    handwritingOCR: !!env.OCR_API_KEY,
    storage: storageEnabled(),
    questionPhotoImport:
      storageEnabled() &&
      !!(
        env.OCR_API_KEY ||
        (env.AI_API_KEY && env.AI_MODEL && env.AI_VISION_ENABLED === "true")
      ),
    pdfSheets: storageEnabled() && (await pdfAvailable()),
    payments: paymentsEnabled(),
    passwordReset: !!(env.SMTP_URL && env.MAIL_FROM),
    phoneOTP: !!(
      env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_VERIFY_SERVICE_SID
    ),
    passPricePaise: env.PASS_PRICE_PAISE,
  }),
);
