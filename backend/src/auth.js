import { Router } from "express";
import { sharedLimit, concurrencyGate } from "./reliability.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { User, Session, Reset } from "./models.js";
import { env } from "./config.js";
import {
  accessToken,
  assert,
  auth,
  hash,
  publicUser,
  randomToken,
} from "./lib.js";
export const authRouter = Router();
authRouter.use(
  [
    "/register",
    "/login",
    "/mobile-login",
    "/forgot-password",
    "/reset-password",
  ],
  sharedLimit({ name: "auth-ip", windowMs: 15 * 60 * 1000, limit: 1000 }),
  concurrencyGate(8),
);
authRouter.use(
  ["/login", "/mobile-login", "/forgot-password"],
  sharedLimit({
    name: "auth-account",
    windowMs: 15 * 60 * 1000,
    limit: 12,
    key: (req) =>
      typeof req.body?.email === "string"
        ? req.body.email.slice(0, 254).toLowerCase()
        : "invalid",
  }),
);
const passwordSchema = z
  .string()
  .min(10)
  .max(72)
  .refine(
    (s) => Buffer.byteLength(s, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes",
  );
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: passwordSchema,
});
export async function signIn(res, u) {
  const token = randomToken();
  await Session.create({
    userId: u._id,
    authVersion: u.authVersion,
    hash: hash(token),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie("bt_session", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 86400000,
  });
  return { token: accessToken(u), user: publicUser(u) };
}
authRouter.post("/register", async (req, res) => {
  const d = credentials
    .extend({
      name: z.string().trim().min(2).max(100),
      language: z.enum(["hi", "en"]).default("en"),
      classLevel: z.enum(["10", "12"]),
      stream: z.enum(["GENERAL", "ARTS", "SCIENCE", "COMMERCE"]),
    })
    .parse(req.body);
  assert(
    (d.classLevel === "10") === (d.stream === "GENERAL"),
    400,
    "Select a valid class and stream",
  );
  const u = await User.create({
    ...d,
    password: undefined,
    passwordHash: await bcrypt.hash(d.password, 12),
  });
  res.status(201).json(await signIn(res, u));
});
authRouter.post("/login", async (req, res) => {
  const d = credentials.parse(req.body);
  const u = await User.findOne({ email: d.email });
  const ok = await bcrypt.compare(
    d.password,
    u?.passwordHash ||
      "$2b$12$wHhZ5Kx6rdC1lhSHFzd1ou6hzLUmz3qVjdQW3cnSXuZ0keJnnqhAu",
  );
  assert(ok && u?.active, 401, "Email or password is incorrect");
  res.json(await signIn(res, u));
});
authRouter.post("/refresh", async (req, res) => {
  assert(
    !req.headers.origin || req.headers.origin === env.WEB_ORIGIN,
    403,
    "Origin not allowed",
  );
  const s = await Session.findOne({
    hash: hash(req.cookies.bt_session || ""),
    expiresAt: { $gt: new Date() },
  });
  const u = s && (await User.findById(s.userId));
  assert(u?.active && s.authVersion === u.authVersion, 401, "Please sign in");
  res.json({ token: accessToken(u), user: publicUser(u) });
});
authRouter.post("/logout", async (req, res) => {
  await Session.deleteOne({ hash: hash(req.cookies.bt_session || "") });
  res.clearCookie("bt_session", {
    path: "/api/auth",
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
  });
  res.json({ ok: true });
});
authRouter.get("/me", auth, (req, res) => res.json(publicUser(req.user)));
authRouter.patch("/me", auth, async (req, res) => {
  const d = z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      classLevel: z.enum(["10", "12"]).optional(),
      stream: z.enum(["GENERAL", "SCIENCE", "ARTS", "COMMERCE"]).optional(),
      language: z.enum(["hi", "en"]).optional(),
    })
    .strict()
    .parse(req.body);
  const level = d.classLevel ?? req.user.classLevel,
    stream = d.stream ?? req.user.stream;
  assert(
    (level === "10") === (stream === "GENERAL"),
    400,
    "Select a valid class and stream",
  );
  assert(
    !(await import("./models.js").then((m) =>
      m.Attempt.exists({ userId: String(req.user._id), status: "ACTIVE" }),
    )) ||
      (!d.classLevel && !d.stream),
    409,
    "Finish active tests before changing class or stream",
  );
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: d },
    { returnDocument: "after" },
  );
  res.json(publicUser(user));
});
authRouter.post("/mobile-login", async (req, res) => {
  const d = credentials.parse(req.body);
  const u = await User.findOne({ email: d.email });
  assert(
    u?.active && (await bcrypt.compare(d.password, u.passwordHash)),
    401,
    "Email or password is incorrect",
  );
  const refreshToken = randomToken();
  await Session.create({
    userId: u._id,
    authVersion: u.authVersion,
    hash: hash(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.json({ token: accessToken(u), refreshToken, user: publicUser(u) });
});
authRouter.post("/mobile-refresh", async (req, res) => {
  const d = z.object({ refreshToken: z.string().length(64) }).parse(req.body);
  const old = await Session.findOneAndDelete({
    hash: hash(d.refreshToken),
    expiresAt: { $gt: new Date() },
  });
  const u = old && (await User.findById(old.userId));
  assert(
    u?.active && old.authVersion === u.authVersion,
    401,
    "Please sign in again",
  );
  const refreshToken = randomToken();
  await Session.create({
    userId: u._id,
    authVersion: u.authVersion,
    hash: hash(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.json({ token: accessToken(u), refreshToken, user: publicUser(u) });
});
authRouter.post("/mobile-logout", async (req, res) => {
  const d = z.object({ refreshToken: z.string().length(64) }).parse(req.body);
  await Session.deleteOne({ hash: hash(d.refreshToken) });
  res.json({ ok: true });
});
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = z
    .object({
      email: z
        .string()
        .email()
        .transform((s) => s.toLowerCase()),
    })
    .parse(req.body);
  assert(
    env.SMTP_URL && env.MAIL_FROM,
    503,
    "Password reset email is not configured",
  );
  const u = await User.findOne({ email, active: true });
  if (u) {
    const token = randomToken();
    await Reset.create({
      userId: u._id,
      authVersion: u.authVersion,
      hash: hash(token),
      expiresAt: new Date(Date.now() + 1800000),
    });
    await nodemailer.createTransport(env.SMTP_URL).sendMail({
      from: env.MAIL_FROM,
      to: u.email,
      subject: "Reset your BoardTestify password",
      text: `Use this link within 30 minutes: ${env.WEB_ORIGIN}/reset-password?token=${token}`,
    });
  }
  res.json({ message: "If that account exists, a reset link has been sent." });
});
authRouter.post("/reset-password", async (req, res) => {
  const d = z
    .object({
      token: z.string().length(64),
      password: passwordSchema,
    })
    .parse(req.body);
  const r = await Reset.findOneAndDelete({
    hash: hash(d.token),
    expiresAt: { $gt: new Date() },
  });
  assert(r, 400, "Reset link is invalid or expired");
  await User.updateOne(
    { _id: r.userId },
    {
      $set: { passwordHash: await bcrypt.hash(d.password, 12) },
      $inc: { authVersion: 1 },
    },
  );
  await Session.deleteMany({ userId: r.userId });
  res.json({ ok: true });
});
