import { readFile } from "node:fs/promises";
import { questionSchema, testSchema } from "@boardtestify/domain";
import { Academic, QuestionModel, TestModel } from "./models.js";
import { hash } from "./lib.js";
import { seedCatalog } from "./catalog.js";
export const packs = JSON.parse(
  await readFile(
    new URL("./data/bseb-2026-mini.json", import.meta.url),
    "utf8",
  ),
);
export async function seedBSEB() {
  await seedCatalog();
  const result = { tests: 0, questions: 0, status: "DRAFT" };
  for (const pack of packs) {
    const subject = await Academic.findOne({
      kind: "SUBJECT",
      name: pack.subject,
      session: pack.session,
      classLevel: pack.classLevel,
      stream: pack.stream,
    });
    if (!subject) throw Error(`Missing subject for ${pack.id}`);
    const academic = {
      session: pack.session,
      classLevel: pack.classLevel,
      stream: pack.stream,
      subjectId: String(subject._id),
    };
    const questionIds = [];
    for (const [index, entry] of pack.questions.entries()) {
      const data = questionSchema.parse({
        academic,
        type: "SINGLE_CHOICE",
        language: "en",
        text: entry.text,
        translation: entry.translation,
        options: entry.options.map((text, i) => ({
          id: String.fromCharCode(97 + i),
          text,
        })),
        correct: [String.fromCharCode(97 + entry.answer)],
        maximumMarks: 1,
        negativeMarks: 0,
        explanation: entry.explanation,
        difficulty: "EASY",
        isPYQ: false,
        source: `Adapted practice from BSEB 2026 model, question ${entry.sourceQuestion}, PDF page ${entry.sourcePage}. Suggested key; not an official answer key. Teacher review required.`,
        sourceUrl: pack.sourceUrl + `#page=${entry.sourcePage}`,
        sourceYear: pack.examYear,
      });
      const q = await QuestionModel.findOneAndUpdate(
        { hash: hash(`bseb-mini:${pack.id}:${index}`) },
        {
          $setOnInsert: {
            data,
            status: "DRAFT",
            version: 1,
            creator: "bseb-mini-import",
          },
        },
        { upsert: true, returnDocument: "after" },
      );
      questionIds.push(String(q._id));
      result.questions++;
    }
    const data = testSchema.parse({
      title: `${pack.subject} · BSEB 2026 source-based mini practice`,
      description:
        "3 adapted bilingual MCQs with suggested explanations. Based on historical 2026 model-paper topics, not an official full paper or a verified 2027 pattern. Teacher review required before publication.",
      academic,
      mode: "PRACTICE",
      durationMinutes: 10,
      premium: false,
      randomize: false,
      patternVersion: "adapted-mini-v1",
      officialSource: pack.sourceUrl,
      feedbackMode: "IMMEDIATE",
      sections: [
        {
          id: "objective",
          title: "Model-paper topic practice",
          questionIds,
          instructions:
            "Answer all three. One mark each, no negative marks. These are practice settings, not official board-paper timing or distribution.",
        },
      ],
    });
    await TestModel.updateOne(
      { _id: hash(`bseb-mini-test:${pack.id}`).slice(0, 24) },
      {
        $setOnInsert: {
          data,
          status: "DRAFT",
          version: 1,
          creator: "bseb-mini-import",
        },
      },
      { upsert: true },
    );
    result.tests++;
  }
  return result;
}
