import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "./config.js";
import { User } from "./models.js";
export class HttpError extends Error {
  status;
  details;
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export function assert(value, status, message) {
  if (!value) throw new HttpError(status, message);
}
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export const randomToken = () => randomBytes(32).toString("hex");
export function accessToken(user) {
  return jwt.sign(
    { sub: String(user._id), v: user.authVersion },
    env.JWT_SECRET,
    {
      expiresIn: "15m",
      issuer: "boardtestify",
      audience: "boardtestify-client",
    },
  );
}
export async function auth(req, _, next) {
  try {
    const t = req.headers.authorization?.replace(/^Bearer /, "");
    assert(t, 401, "Please sign in");
    let payload;
    try {
      payload = jwt.verify(t, env.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: "boardtestify",
        audience: "boardtestify-client",
      });
    } catch {
      throw new HttpError(401, "Session expired");
    }
    const user = await User.findById(payload.sub);
    assert(
      user?.active && user.authVersion === payload.v,
      401,
      "Session expired",
    );
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
export const allow =
  (...roles) =>
  (req, _, next) => {
    try {
      assert(roles.includes(req.user.role), 403, "Insufficient permission");
      next();
    } catch (e) {
      next(e);
    }
  };
export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  classLevel: u.classLevel,
  stream: u.stream,
});
