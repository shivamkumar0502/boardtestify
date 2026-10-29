import { env } from "./config.js";
import { pdfAvailable } from "./pdf.js";
import { integrationReadiness } from "./readiness.js";
import { Router } from "express";
import { z } from "zod";
import {
  id,
  patternSchema,
  planSchema,
  testSchema,
} from "@boardtestify/domain";
import {
  Academic,
  Announcement,
  Audit,
  Pattern,
  Plan,
  Resource,
  Attempt,
  Attachment,
} from "./models.js";
import { auth, allow, assert } from "./lib.js";
import { validateAcademic } from "./content.js";
export const management = Router();
management.use(auth);
const editors = allow("CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"),
  admins = allow("ADMIN", "SUPER_ADMIN");
const audit = (req, action, entityId, details) =>
  Audit.create({
    actor: String(req.user._id),
    action,
    entityId: String(entityId),
    details,
  });
management.post("/admin/academics/:id/verify", admins, async (req, res) => {
  const a = await Academic.findById(id.parse(req.params.id));
  assert(a?.sourceUrl, 400, "An attributable syllabus source is required");
  assert(
    a.creator !== String(req.user._id),
    400,
    "Another administrator must verify academic content",
  );
  a.verified = true;
  a.reviewer = String(req.user._id);
  a.verifiedAt = new Date();
  await a.save();
  await audit(req, "ACADEMIC_VERIFY", a._id, { sourceUrl: a.sourceUrl });
  res.json(a);
});
management.get("/announcements", async (req, res) => {
  const now = new Date();
  res.json(
    await Announcement.find({
      published: true,
      startsAt: { $lte: now },
      $and: [
        { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
        { $or: [{ classLevel: null }, { classLevel: req.user.classLevel }] },
        { $or: [{ stream: null }, { stream: req.user.stream }] },
      ],
    })
      .sort({ startsAt: -1 })
      .limit(20)
      .lean(),
  );
});
management.get("/resources", async (req, res) => {
  // Keep study references aligned with the student's saved class and stream.
  // Class 12 students should not see generic or other-stream subject resources.
  const subjects = await Academic.find({
    kind: "SUBJECT",
    active: true,
    classLevel: req.user.classLevel,
    stream: req.user.stream,
  })
    .select("name")
    .limit(100)
    .lean();
  const names = subjects.map((subject) => subject.name);
  const filter = {
    classLevel: req.user.classLevel,
    subject: { $in: names },
  };
  res.json(await Resource.find(filter).sort({ subject: 1 }).limit(100).lean());
});
management.get("/admin/announcements", admins, async (_req, res) =>
  res.json(await Announcement.find().sort({ createdAt: -1 }).limit(100).lean()),
);
const announcementSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    body: z.string().trim().min(2).max(5000),
    language: z.enum(["hi", "en"]),
    classLevel: z.enum(["10", "12"]).nullable().default(null),
    stream: z
      .enum(["GENERAL", "SCIENCE", "ARTS", "COMMERCE"])
      .nullable()
      .default(null),
    published: z.boolean().default(false),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().default(null),
  })
  .superRefine((a, c) => {
    if (a.endsAt && a.endsAt <= a.startsAt)
      c.addIssue({ code: "custom", message: "End must be after start" });
  });
management.post("/admin/announcements", admins, async (req, res) => {
  const d = announcementSchema.parse(req.body);
  const a = await Announcement.create({ ...d, creator: String(req.user._id) });
  await audit(req, "ANNOUNCEMENT_CREATE", a._id);
  res.status(201).json(a);
});
management.put("/admin/announcements/:id", admins, async (req, res) => {
  const d = announcementSchema.parse(req.body);
  const a = await Announcement.findByIdAndUpdate(
    id.parse(req.params.id),
    { $set: d },
    { returnDocument: "after" },
  );
  assert(a, 404, "Announcement not found");
  await audit(req, "ANNOUNCEMENT_UPDATE", a._id);
  res.json(a);
});
management.get("/admin/patterns", editors, async (_req, res) =>
  res.json(await Pattern.find().sort({ createdAt: -1 }).limit(200).lean()),
);
management.post("/admin/patterns", editors, async (req, res) => {
  const d = patternSchema.parse(req.body);
  await validateAcademic(d.academic);
  const p = await Pattern.create({ data: d, creator: String(req.user._id) });
  await audit(req, "PATTERN_CREATE", p._id);
  res.status(201).json(p);
});
management.put("/admin/patterns/:id", editors, async (req, res) => {
  const d = patternSchema.parse(req.body);
  await validateAcademic(d.academic);
  const p = await Pattern.findById(id.parse(req.params.id));
  assert(p, 404, "Pattern not found");
  p.data = d;
  p.status = "DRAFT";
  p.version++;
  p.creator = String(req.user._id);
  p.reviewer = undefined;
  await p.save();
  await audit(req, "PATTERN_UPDATE", p._id);
  res.json(p);
});
management.post("/admin/patterns/:id/publish", admins, async (req, res) => {
  const p = await Pattern.findById(id.parse(req.params.id));
  assert(p, 404, "Pattern not found");
  const data = patternSchema.parse(p.data);
  assert(
    p.creator !== String(req.user._id),
    400,
    "Another administrator must verify this pattern",
  );
  assert(
    Date.parse(data.verifiedAt) <= Date.now(),
    400,
    "Verification date cannot be in the future",
  );
  p.status = "PUBLISHED";
  p.reviewer = String(req.user._id);
  await p.save();
  await audit(req, "PATTERN_PUBLISH", p._id, { source: data.officialSource });
  res.json(p);
});
export async function validatePatternForTest(d, questions) {
  if (d.mode !== "BOARD") return;
  assert(d.patternId, 400, "Select an approved subject/session pattern");
  const p = await Pattern.findOne({
    _id: d.patternId,
    status: "PUBLISHED",
  }).lean();
  assert(p, 400, "Pattern must be approved");
  const pattern = p.data;
  // Copy the approved threshold into the test data so each attempt keeps an immutable snapshot.
  if (pattern.minimumPassingMarks !== undefined)
    d.minimumPassingMarks = pattern.minimumPassingMarks;
  assert(
    ["session", "classLevel", "stream", "subjectId"].every(
      (k) => pattern.academic[k] === d.academic[k],
    ),
    400,
    "Pattern does not match selected subject/session",
  );
  assert(
    d.durationMinutes === pattern.durationMinutes &&
      d.sections.length === pattern.sections.length,
    400,
    "Test duration/sections must match approved pattern",
  );
  for (const s of pattern.sections) {
    const section = d.sections.find((x) => x.id === s.id);
    assert(
      section &&
        (section.drawCount ?? section.questionIds.length) === s.offered &&
        (section.maxAnswers ?? section.questionIds.length) === s.answerCount,
      400,
      "Section choices/counts do not match pattern",
    );
    if (
      pattern.versionLabel ===
      "BSEB model paper 2026 · review for selected session"
    )
      assert(
        section.choicePolicy === "FIRST_IN_PAPER",
        400,
        "BSEB reference layouts evaluate the first answered items in paper order",
      );
    const rows = questions.filter((q) =>
      section.questionIds.includes(String(q._id)),
    );
    assert(
      rows.every(
        (q) =>
          s.types.includes(q.data.type) &&
          q.data.maximumMarks === s.marksEach &&
          q.data.negativeMarks === s.negativeMarks,
      ),
      400,
      "Question types/marks do not match pattern",
    );
    assert(
      (section.wordLimit ?? null) === (s.wordLimit ?? null),
      400,
      "Word limit does not match pattern",
    );
  }
  d.officialSource = pattern.officialSource;
  d.verifiedAt = pattern.verifiedAt;
  d.patternVersion = pattern.versionLabel;
  d.readingMinutes = pattern.readingMinutes || 0;
}
management.get("/billing/plans", async (req, res) =>
  res.json(
    await Plan.find({
      active: true,
      classLevels: req.user.classLevel,
      streams: req.user.stream,
    })
      .select("-creator")
      .sort({ pricePaise: 1 })
      .limit(50)
      .lean(),
  ),
);
management.get("/admin/plans", admins, async (_req, res) =>
  res.json(await Plan.find().sort({ createdAt: -1 }).limit(100).lean()),
);
management.post("/admin/plans", admins, async (req, res) => {
  const d = planSchema.parse(req.body);
  if (d.billingModel === "RECURRING")
    assert(
      d.providerPlanId,
      400,
      "Razorpay plan ID is required for recurring billing",
    );
  const p = await Plan.create({ ...d, creator: String(req.user._id) });
  await audit(req, "PLAN_CREATE", p._id);
  res.status(201).json(p);
});
management.patch("/admin/plans/:id", admins, async (req, res) => {
  const d = z.object({ active: z.boolean() }).strict().parse(req.body);
  const p = await Plan.findByIdAndUpdate(
    id.parse(req.params.id),
    { $set: d },
    { returnDocument: "after" },
  );
  assert(p, 404, "Plan not found");
  await audit(req, "PLAN_AVAILABILITY", p._id, d);
  res.json(p);
});
management.get("/admin/operations", admins, async (_req, res) => {
  const [pending, review, expired, assets] = await Promise.all([
    Attempt.countDocuments({ evaluationState: "PENDING" }),
    Attempt.countDocuments({ evaluationState: "REVIEW" }),
    Attempt.countDocuments({ status: "ACTIVE", deadline: { $lt: new Date() } }),
    Attachment.countDocuments({ status: "READY" }),
  ]);
  res.json({
    pendingEvaluations: pending,
    manualReviews: review,
    expiredAwaitingFinalization: expired,
    storedAttachments: assets,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMiB: Math.round(process.memoryUsage().rss / 1048576),
  });
});

management.get("/admin/readiness", admins, async (_req, res) => {
  res.json(integrationReadiness(env, await pdfAvailable()));
});
