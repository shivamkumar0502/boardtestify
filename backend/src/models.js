import mongoose, { Schema } from "mongoose";
import { env } from "./config.js";
mongoose.set("bufferTimeoutMS", 2000);
// Model compilation must not launch parallel collection/index jobs on connection.
mongoose.set("autoCreate", false);
mongoose.set("autoIndex", false);
// Application validation happens at every API boundary. Strict top-level persistence
// schemas keep immutable exam snapshots together in one atomically updated document.
const make = (name, fields, indexes = []) => {
  const s = new Schema(fields, {
    timestamps: true,
    optimisticConcurrency: true,
    strict: true,
  });
  for (const i of indexes) s.index(i[0], i[1]);
  return mongoose.model(name, s);
};
export const User = make("User", {
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: {
    type: String,
    enum: ["STUDENT", "CONTENT_EDITOR", "EVALUATOR", "ADMIN", "SUPER_ADMIN"],
    default: "STUDENT",
  },
  classLevel: String,
  stream: String,
  active: { type: Boolean, default: true },
  authVersion: { type: Number, default: 0 },
  phone: { type: String, unique: true, sparse: true },
  phoneVerifiedAt: Date,
  language: { type: String, enum: ["hi", "en"], default: "en" },
});
export const Session = make(
  "Session",
  {
    userId: Schema.Types.ObjectId,
    authVersion: Number,
    hash: { type: String, unique: true },
    expiresAt: Date,
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Reset = make(
  "Reset",
  {
    userId: Schema.Types.ObjectId,
    authVersion: Number,
    hash: { type: String, unique: true },
    expiresAt: Date,
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Academic = make("Academic", {
  boardSubjectKey: String,
  kind: String,
  name: String,
  session: String,
  classLevel: String,
  stream: String,
  parentId: String,
  syllabusVersion: String,
  sourceUrl: String,
  verified: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  creator: String,
  reviewer: String,
  verifiedAt: Date,
});
export const QuestionModel = make("Question", {
  originJobId: String,
  data: Schema.Types.Mixed,
  hash: { type: String, unique: true },
  status: { type: String, default: "DRAFT" },
  version: { type: Number, default: 1 },
  creator: String,
  reviewer: String,
});
export const TestModel = make("Test", {
  data: Schema.Types.Mixed,
  status: { type: String, default: "DRAFT" },
  version: { type: Number, default: 1 },
  creator: String,
  reviewer: String,
});
export const Attempt = make(
  "Attempt",
  {
    userId: String,
    testId: String,
    testVersion: Number,
    snapshot: Schema.Types.Mixed,
    questions: [Schema.Types.Mixed],
    answers: { type: Schema.Types.Mixed, default: {} },
    startedAt: Date,
    deadline: Date,
    readUntil: Date,
    status: {
      type: String,
      enum: ["ACTIVE", "SUBMITTED", "EXPIRED"],
      default: "ACTIVE",
    },
    revision: { type: Number, default: 0 },
    evaluations: { type: Schema.Types.Mixed, default: {} },
    evaluationState: String,
    leaseUntil: Date,
    submittedAt: Date,
    summary: Schema.Types.Mixed,
    retryOf: String,
    answeredIds: { type: [String], default: [] },
    answerBytes: { type: Number, default: 0 },
    uploadCounts: { type: Schema.Types.Mixed, default: {} },
    leaseToken: String,
  },
  [
    [
      { userId: 1, testId: 1 },
      { unique: true, partialFilterExpression: { status: "ACTIVE" } },
    ],
    [{ status: 1, deadline: 1 }, {}],
    [{ evaluationState: 1, leaseUntil: 1 }, {}],
    [{ userId: 1, createdAt: -1 }, {}],
    [{ userId: 1, status: 1, submittedAt: -1 }, {}],
  ],
);
export const StudyPlan = make(
  "StudyPlan",
  {
    userId: { type: String },
    plan: Schema.Types.Mixed,
    completedTasks: { type: [String], default: [] },
    language: { type: String, enum: ["hi", "en"], default: "en" },
    generatedAt: Date,
  },
  [[{ userId: 1 }, { unique: true }]],
);
export const Audit = make("Audit", {
  actor: String,
  action: String,
  entityId: String,
  details: Schema.Types.Mixed,
});
export const Payment = make("Payment", {
  orderId: { type: String, unique: true },
  userId: String,
  amount: Number,
  currency: String,
  status: String,
  paymentId: String,
  expiresAt: Date,
  plan: Schema.Types.Mixed,
  subscriptionId: String,
  providerCreatedAt: Date,
});
export const RateBucket = make(
  "RateBucket",
  { _id: String, count: Number, expiresAt: Date },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Announcement = make(
  "Announcement",
  {
    title: String,
    body: String,
    language: String,
    classLevel: String,
    stream: String,
    published: Boolean,
    startsAt: Date,
    endsAt: Date,
    creator: String,
  },
  [[{ published: 1, startsAt: -1 }, {}]],
);
export const Plan = make("Plan", {
  name: String,
  description: String,
  pricePaise: Number,
  durationDays: Number,
  billingModel: String,
  providerPlanId: String,
  period: String,
  interval: Number,
  totalCount: Number,
  classLevels: [String],
  streams: [String],
  active: Boolean,
  creator: String,
});
export const Subscription = make(
  "Subscription",
  {
    providerId: { type: String, unique: true },
    userId: String,
    plan: Schema.Types.Mixed,
    status: String,
    currentEnd: Date,
    cancelAtCycleEnd: Boolean,
  },
  [[{ userId: 1, createdAt: -1 }, {}]],
);
export const Attachment = make(
  "Attachment",
  {
    ownerId: String,
    attemptId: String,
    questionId: String,
    key: { type: String, unique: true },
    mime: String,
    size: Number,
    checksum: String,
    status: String,
    text: String,
    confidence: Number,
    error: String,
    deleteAfter: Date,
  },
  [
    [{ ownerId: 1, attemptId: 1, questionId: 1 }, {}],
    [{ deleteAfter: 1 }, {}],
  ],
);
export const OtpChallenge = make(
  "OtpChallenge",
  {
    phone: String,
    userId: String,
    purpose: String,
    providerSid: String,
    attempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false },
    expiresAt: Date,
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Pattern = make("Pattern", {
  data: Schema.Types.Mixed,
  status: { type: String, default: "DRAFT" },
  version: { type: Number, default: 1 },
  creator: String,
  reviewer: String,
});
export const Resource = make("Resource", {
  title: String,
  url: { type: String, unique: true },
  classLevel: String,
  subject: String,
  examYear: Number,
  kind: String,
  sourceCheckedAt: Date,
  syllabusSessions: [String],
  note: String,
});
export const AuthoringJob = make(
  "AuthoringJob",
  {
    ownerId: String,
    slot: Number,
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "READY", "FAILED", "SAVED"],
      default: "PENDING",
    },
    method: String,
    input: Schema.Types.Mixed,
    result: Schema.Types.Mixed,
    commitInput: Schema.Types.Mixed,
    savedTestId: String,
    attempts: { type: Number, default: 0 },
    leaseToken: String,
    leaseUntil: Date,
    error: String,
    deleteAfter: Date,
  },
  [
    [{ ownerId: 1, createdAt: -1 }, {}],
    [{ status: 1, leaseUntil: 1, createdAt: 1 }, {}],
    [{ deleteAfter: 1 }, {}],
    [
      { ownerId: 1, slot: 1 },
      {
        unique: true,
        partialFilterExpression: { status: { $in: ["PENDING", "PROCESSING"] } },
      },
    ],
  ],
);
const indexedModels = [
  AuthoringJob,
  User,
  Session,
  Reset,
  Academic,
  QuestionModel,
  TestModel,
  Attempt,
  StudyPlan,
  Payment,
  RateBucket,
  Announcement,
  Plan,
  Subscription,
  Attachment,
  OtpChallenge,
  Pattern,
  Resource,
];
export async function connect(uri) {
  await mongoose.connect(uri, {
    ...(env.DB_IP_FAMILY ? { family: env.DB_IP_FAMILY } : {}),
    maxPoolSize: env.DB_POOL_MAX,
    minPoolSize: 2,
    serverSelectionTimeoutMS: env.DB_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: 30000,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: env.DB_WAIT_QUEUE_TIMEOUT_MS,
    autoCreate: false,
    autoIndex: false,
  });
  // Development still gets all uniqueness/attempt indexes before serving requests.
  // Production DDL belongs to the explicit migration, never every API replica.
  if (env.NODE_ENV !== "production") await migrateIndexes();
}
export async function migrateIndexes() {
  for (const m of indexedModels) {
    await m.createCollection();
    await m.createIndexes();
  }
}
Academic.schema.index({
  active: 1,
  session: 1,
  classLevel: 1,
  stream: 1,
  kind: 1,
});
QuestionModel.schema.index({
  status: 1,
  "data.academic.subjectId": 1,
  createdAt: -1,
});
TestModel.schema.index({
  status: 1,
  "data.academic.classLevel": 1,
  "data.academic.stream": 1,
  createdAt: -1,
});
Payment.schema.index({ userId: 1, status: 1, expiresAt: -1 });

TestModel.schema.index({
  status: 1,
  "data.academic.classLevel": 1,
  "data.academic.stream": 1,
  "data.academic.subjectId": 1,
  _id: -1,
});

Attempt.schema.index({ userId: 1, testId: 1, createdAt: -1 });

TestModel.schema.index({
  status: 1,
  "data.academic.classLevel": 1,
  "data.academic.stream": 1,
  "data.academic.subjectId": 1,
  "data.academic.chapterId": 1,
  _id: -1,
});
