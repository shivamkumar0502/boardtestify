import { seedStarter, starterReview, publishStarter } from "./starter-pack.js";
import { Router } from "express";
import { z } from "zod";
import { auth, allow } from "./lib.js";
import { concurrencyGate, sharedLimit } from "./reliability.js";
import { seedBSEB } from "./seed-bseb.js";
import { seedOriginalPractice } from "./practice-packs.js";
import { Audit } from "./models.js";
export const packRoutes = Router();
packRoutes.use("/admin/practice-packs", auth, allow("ADMIN", "SUPER_ADMIN"));
packRoutes.get("/admin/practice-packs", (_req, res) =>
  res.json([
    {
      id: "class10-starter",
      title: "Class 10 · six-subject starter + full Maths mock",
      tests: 7,
      questions: 198,
      session: "2026-27",
      note: "Actual original questions and keys: six 10-question practice tests plus a 138-question Maths mock. Import, review and publish here.",
    },
    {
      id: "bseb-2026",
      title: "BSEB 2026 source-based mini pack",
      tests: 5,
      questions: 15,
      session: "2025-26",
      note: "Adapted practice with source PDFs; suggested keys require review.",
    },
    {
      id: "original-v1",
      title: "Original academic practice pack",
      tests: 8,
      questions: 80,
      session: "2026-27",
      note: "Original illustrative questions; not an official paper or verified syllabus.",
    },
  ]),
);
packRoutes.post(
  "/admin/practice-packs/import",
  sharedLimit({
    name: "pack-import",
    limit: 10,
    windowMs: 60000,
    key: (req) => String(req.user._id),
  }),
  concurrencyGate(1),
  async (req, res) => {
    const { packId } = z
      .object({
        packId: z.enum(["bseb-2026", "original-v1", "class10-starter"]),
      })
      .strict()
      .parse(req.body);
    const result = await (packId === "class10-starter"
      ? seedStarter()
      : packId === "bseb-2026"
        ? seedBSEB()
        : seedOriginalPractice());
    await Audit.create({
      actor: String(req.user._id),
      action: "PRACTICE_PACK_IMPORT",
      entityId: packId,
      details: result,
    });
    res.json(result);
  },
);

packRoutes.get(
  "/admin/practice-packs/class10-starter/review",
  concurrencyGate(2),
  async (_req, res) => res.json(await starterReview()),
);
packRoutes.post(
  "/admin/practice-packs/class10-starter/publish",
  sharedLimit({
    name: "starter-publish",
    limit: 20,
    windowMs: 60000,
    key: (req) => String(req.user._id),
  }),
  concurrencyGate(1),
  async (req, res) => {
    const input = z
      .object({
        reviewToken: z.string().regex(/^[a-f0-9]{64}$/),
        testId: z.string().regex(/^[a-f0-9]{24}$/),
        confirmed: z.literal(true),
      })
      .strict()
      .parse(req.body);
    res.json(await publishStarter(req, input));
  },
);
