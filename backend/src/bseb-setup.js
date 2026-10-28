import { Router } from "express";
import { z } from "zod";
import { patternSchema } from "@boardtestify/domain";
import { Academic, Pattern, Audit } from "./models.js";
import { auth, allow, assert, hash } from "./lib.js";
import { catalogFor, boardGuide } from "./bseb-catalog.js";
import { sharedLimit } from "./reliability.js";
export const bsebSetup = Router();
bsebSetup.use(
  "/admin/bseb",
  auth,
  allow("CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"),
);
const scope = z.object({
  session: z.string().regex(/^\d{4}-\d{2}$/),
  classLevel: z.enum(["10", "12"]),
  stream: z.enum(["GENERAL", "SCIENCE", "ARTS", "COMMERCE"]),
});
function selection(input) {
  const d = scope.parse(input);
  assert(
    (d.classLevel === "10") === (d.stream === "GENERAL"),
    400,
    "Choose a valid class and stream",
  );
  return d;
}
bsebSetup.get("/admin/bseb/catalog", (req, res) => {
  const d = selection(req.query);
  res.json(boardGuide(d.classLevel, d.stream));
});
bsebSetup.post(
  "/admin/bseb/setup",
  sharedLimit({
    name: "bseb-setup",
    limit: 5,
    windowMs: 60000,
    key: (req) => String(req.user._id),
  }),
  async (req, res) => {
    const d = selection(req.body);
    const catalog = catalogFor(d.classLevel, d.stream);
    const existing = await Academic.find({ ...d, kind: "SUBJECT" }).lean();
    const subjects = [],
      academicOps = [],
      patternOps = [];
    for (const [order, s] of catalog.entries()) {
      const match = existing.find(
        (r) =>
          r.boardSubjectKey === s.key ||
          r.name.toLowerCase() === s.name.toLowerCase(),
      );
      const subjectId = match
        ? String(match._id)
        : hash(
            `bseb-subject:${d.session}:${d.classLevel}:${d.stream}:${s.key}`,
          ).slice(0, 24);
      subjects.push({ id: subjectId, name: s.name });
      if (!match)
        academicOps.push({
          updateOne: {
            filter: { _id: subjectId },
            update: {
              $setOnInsert: {
                ...d,
                kind: "SUBJECT",
                name: s.name,
                boardSubjectKey: s.key,
                syllabusVersion: "Staff syllabus · 2026 model-paper reference",
                sourceUrl: s.sourceUrl,
                verified: false,
                active: true,
                order,
                creator: String(req.user._id),
              },
            },
            upsert: true,
          },
        });
      if (s.sections.length) {
        const data = patternSchema.parse({
          title: `${s.name} · 2026 reference layout`,
          academic: { ...d, subjectId },
          versionLabel: "BSEB model paper 2026 · review for selected session",
          officialSource: s.sourceUrl,
          verifiedAt: "2026-10-28T00:00:00.000Z",
          durationMinutes: s.durationMinutes,
          readingMinutes: s.readingMinutes,
          totalMarks: s.theoryMarks,
          sections: s.sections,
        });
        const patternId = hash(`bseb-pattern:2026:${subjectId}`).slice(0, 24);
        patternOps.push({
          updateOne: {
            filter: { _id: patternId },
            update: {
              $setOnInsert: {
                data,
                creator: String(req.user._id),
                status: "DRAFT",
                version: 1,
              },
            },
            upsert: true,
          },
        });
      }
    }
    const academics = academicOps.length
      ? await Academic.bulkWrite(academicOps)
      : null;
    const patterns = patternOps.length
      ? await Pattern.bulkWrite(patternOps)
      : null;
    await Audit.create({
      actor: String(req.user._id),
      action: "BSEB_SUBJECT_SETUP",
      entityId: `${d.session}:${d.classLevel}:${d.stream}`,
      details: {
        subjects: academics?.upsertedCount || 0,
        patterns: patterns?.upsertedCount || 0,
        referenceYear: 2026,
      },
    });
    res.json({
      subjects,
      createdSubjects: academics?.upsertedCount || 0,
      createdPatterns: patterns?.upsertedCount || 0,
      referenceYear: 2026,
    });
  },
);
