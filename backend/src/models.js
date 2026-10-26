import mongoose, { Schema } from "mongoose";
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
    hash: { type: String, unique: true },
    expiresAt: Date,
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Academic = make("Academic", {
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
});
export const QuestionModel = make("Question", {
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
  },
  [
    [
      { userId: 1, testId: 1 },
      { unique: true, partialFilterExpression: { status: "ACTIVE" } },
    ],
    [{ status: 1, deadline: 1 }, {}],
    [{ evaluationState: 1, leaseUntil: 1 }, {}],
  ],
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
});
export async function connect(uri) {
  await mongoose.connect(uri);
  await Promise.all(
    [
      User,
      Session,
      Reset,
      Academic,
      QuestionModel,
      TestModel,
      Attempt,
      Payment,
    ].map((m) => m.init()),
  );
}
