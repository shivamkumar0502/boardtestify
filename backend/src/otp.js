import { Router } from "express";
import { z } from "zod";
import { env } from "./config.js";
import { OtpChallenge, User, Session } from "./models.js";
import {
  assert,
  auth,
  accessToken,
  publicUser,
  randomToken,
  hash,
} from "./lib.js";
import { signIn } from "./auth.js";
import { boundedJSON, sharedLimit } from "./reliability.js";
import { id } from "@boardtestify/domain";
export const otp = Router();
const phoneSchema = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Use an international phone number, e.g. +919876543210",
  );
async function twilio(path, body) {
  assert(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_VERIFY_SERVICE_SID,
    503,
    "Phone OTP is not configured",
  );
  const r = await fetch(
    `https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/${path}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
    },
  );
  assert(r.ok, 400, "Unable to verify this phone number. Try again later.");
  return boundedJSON(r, 50000);
}
otp.post(
  "/otp/request",
  sharedLimit({ name: "otp-ip", limit: 10, windowMs: 15 * 60000 }),
  sharedLimit({
    name: "otp-phone",
    limit: 1,
    windowMs: 60000,
    key: (req) => req.body?.phone || "unknown",
  }),
  async (req, res, next) => {
    const d = z
      .object({ phone: phoneSchema, purpose: z.enum(["LOGIN", "LINK"]) })
      .parse(req.body);
    async function run() {
      let user;
      if (d.purpose === "LINK") {
        user = req.user;
        assert(
          !(await User.exists({ phone: d.phone, _id: { $ne: user._id } })),
          400,
          "This phone number is already linked",
        );
      } else user = await User.findOne({ phone: d.phone, active: true });
      let providerSid;
      if (user) {
        const verification = await twilio("Verifications", {
          To: d.phone,
          Channel: "sms",
        });
        assert(
          verification.status === "pending",
          503,
          "OTP provider did not accept the request",
        );
        providerSid = verification.sid;
      } else
        assert(
          env.TWILIO_VERIFY_SERVICE_SID,
          503,
          "Phone OTP is not configured",
        );
      const challenge = await OtpChallenge.create({
        phone: d.phone,
        userId: user ? String(user._id) : null,
        purpose: d.purpose,
        providerSid,
        expiresAt: new Date(Date.now() + 5 * 60000),
      });
      res.status(202).json({
        challengeId: String(challenge._id),
        message:
          "If this phone is eligible, a verification code has been sent.",
      });
    }
    if (d.purpose === "LINK")
      return auth(req, res, (e) => (e ? next(e) : run().catch(next)));
    return run();
  },
);
otp.post(
  "/otp/check",
  sharedLimit({ name: "otp-check", limit: 20, windowMs: 15 * 60000 }),
  async (req, res, next) => {
    const d = z
      .object({
        challengeId: id,
        code: z.string().regex(/^\d{4,8}$/),
        client: z.enum(["WEB", "MOBILE"]).default("WEB"),
      })
      .parse(req.body);
    const row = await OtpChallenge.findOneAndUpdate(
      {
        _id: d.challengeId,
        used: false,
        attempts: { $lt: 5 },
        expiresAt: { $gt: new Date() },
      },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
    assert(
      row?.providerSid && row.userId,
      400,
      "Invalid or expired verification code",
    );
    async function run() {
      if (row.purpose === "LINK")
        assert(
          String(req.user._id) === row.userId,
          403,
          "Verification belongs to a different account",
        );
      const checked = await twilio("VerificationCheck", {
        VerificationSid: row.providerSid,
        Code: d.code,
      });
      assert(
        checked.status === "approved",
        400,
        "Invalid or expired verification code",
      );
      const claimed = await OtpChallenge.findOneAndUpdate(
        { _id: row._id, used: false },
        { $set: { used: true } },
        { returnDocument: "after" },
      );
      assert(claimed, 409, "Verification has already been used");
      let user = await User.findById(row.userId);
      assert(user?.active, 401, "Account is inactive");
      if (row.purpose === "LINK") {
        user = await User.findByIdAndUpdate(
          user._id,
          { $set: { phone: row.phone, phoneVerifiedAt: new Date() } },
          { returnDocument: "after" },
        );
        return res.json({ ok: true, user: publicUser(user) });
      }
      if (d.client === "MOBILE") {
        const refreshToken = randomToken();
        await Session.create({
          userId: user._id,
          authVersion: user.authVersion,
          hash: hash(refreshToken),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        });
        return res.json({
          token: accessToken(user),
          refreshToken,
          user: publicUser(user),
        });
      }
      res.json(await signIn(res, user));
    }
    if (row.purpose === "LINK")
      return auth(req, res, (e) => (e ? next(e) : run().catch(next)));
    return run();
  },
);
