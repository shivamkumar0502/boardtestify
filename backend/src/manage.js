import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "./config.js";
import { connect, User, Academic, QuestionModel, TestModel } from "./models.js";
import { hash } from "./lib.js";
import { seedBSEB } from "./seed-bseb.js";
await connect(env.MONGODB_URI);
try {
  if (process.argv[2] === "admin") {
    const email = process.env.ADMIN_EMAIL?.toLowerCase(),
      password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 12)
      throw Error(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) only for this command",
      );
    await User.updateOne(
      { email },
      {
        $setOnInsert: {
          name: "BoardTestify Administrator",
          email,
          classLevel: "10",
          stream: "GENERAL",
          active: true,
        },
        $set: {
          role: "SUPER_ADMIN",
          passwordHash: await bcrypt.hash(password, 12),
        },
        $inc: { authVersion: 1 },
      },
      { upsert: true },
    );
    console.log("Administrator created/updated. No credentials were logged.");
  } else if (process.argv[2] === "seed:bseb") {
    console.log(JSON.stringify(await seedBSEB()));
  } else if (process.argv[2] === "seed") {
    await seedBSEB();
    // Original examples, not official BSEB syllabus, papers, or exam configurations.
    const subject = await Academic.findOneAndUpdate(
      {
        name: "Mathematics · sample practice",
        session: "2026-27",
        classLevel: "10",
        stream: "GENERAL",
        kind: "SUBJECT",
      },
      {
        $setOnInsert: {
          syllabusVersion: "demo-1",
          verified: false,
          active: true,
          order: 1,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    const academic = {
      session: "2026-27",
      classLevel: "10",
      stream: "GENERAL",
      subjectId: String(subject._id),
    };
    const seeds = [
      {
        type: "SINGLE_CHOICE",
        text: "If 2x + 3 = 11, what is x?",
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "4" },
          { id: "c", text: "7" },
          { id: "d", text: "8" },
        ],
        correct: ["b"],
        maximumMarks: 1,
        explanation: "2x = 8, therefore x = 4.",
        referenceAnswer: "",
        rubric: [],
      },
      {
        type: "SHORT_ANSWER",
        text: "Solve 3x − 6 = 9. Show each step.",
        options: [],
        correct: [],
        maximumMarks: 3,
        referenceAnswer:
          "Add 6 to both sides: 3x = 15. Divide both sides by 3: x = 5.",
        rubric: [
          {
            id: "rearrange",
            name: "Adds 6 to both sides to get 3x = 15",
            maximumMarks: 1,
          },
          { id: "method", name: "Divides both sides by 3", maximumMarks: 1 },
          { id: "result", name: "Concludes x = 5", maximumMarks: 1 },
        ],
        explanation: "Equal operations on both sides preserve equality.",
      },
    ];
    const ids = [];
    for (const s of seeds) {
      const data = {
        ...s,
        academic,
        language: "en",
        negativeMarks: 0,
        difficulty: "EASY",
        source: "Original illustrative practice; not an official BSEB question",
        isPYQ: false,
        alternatives: [],
      };
      const q = await QuestionModel.findOneAndUpdate(
        { hash: hash(JSON.stringify([academic, data.text, "en"])) },
        {
          $setOnInsert: {
            data,
            status: "PUBLISHED",
            version: 1,
            creator: "seed",
            reviewer: "illustrative-content",
          },
        },
        { upsert: true, returnDocument: "after" },
      );
      ids.push(String(q._id));
    }
    await TestModel.updateOne(
      { "data.title": "Getting started · sample practice" },
      {
        $setOnInsert: {
          data: {
            title: "Getting started · sample practice",
            description:
              "An original two-question demonstration. Not an official board paper.",
            academic,
            mode: "PRACTICE",
            durationMinutes: 10,
            premium: false,
            randomize: false,
            patternVersion: "demo-1",
            sections: [
              {
                id: "sample",
                title: "Algebra practice",
                instructions:
                  "Attempt both questions. Descriptive marks require AI or manual review.",
                questionIds: ids,
              },
            ],
          },
          status: "PUBLISHED",
          version: 1,
          creator: "seed",
          reviewer: "illustrative-content",
        },
      },
      { upsert: true },
    );
    console.log(
      "Illustrative demo is ready; five BSEB-2026 source-based mini tests are DRAFT and need teacher review.",
    );
  } else throw Error("Use seed, seed:bseb or admin");
} finally {
  await mongoose.disconnect();
}
