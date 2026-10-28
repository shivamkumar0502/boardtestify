import { questionSchema, testSchema } from "@boardtestify/domain";
import { Academic, QuestionModel, TestModel } from "./models.js";
import { hash } from "./lib.js";

// Original illustrative practice. Never represents an official syllabus/PYQ/paper.
const mcq = (text, translation, right, wrong, explanation, index) => {
  const values = [String(right), ...wrong.map(String)];
  if (new Set(values).size !== 4) throw Error("Duplicate generated options");
  const offset = index % 4;
  const ordered = [...values.slice(offset), ...values.slice(0, offset)];
  return {
    text,
    translation,
    options: ordered.map((text, i) => ({ id: "abcd"[i], text })),
    correct: ["abcd"[ordered.indexOf(String(right))]],
    explanation,
  };
};
const numeric = (text, hi, answer, explanation, i) =>
  mcq(
    text,
    hi,
    answer,
    [...new Set([answer * 2, answer / 2, answer + 5, answer - 1])]
      .filter((x) => x !== answer)
      .slice(0, 3),
    explanation,
    i,
  );
export function originalPracticePacks() {
  const pack = (id, subject, classLevel, stream, title, questions) => ({
    id: `original-v1-${id}`,
    subject,
    classLevel,
    stream,
    title,
    questions,
  });
  const ten = (f) => Array.from({ length: 10 }, (_, i) => f(i + 1));
  const history = [
    ["Dandi march / दांडी मार्च", 1930],
    ["Champaran satyagraha / चंपारण सत्याग्रह", 1917],
    ["Quit India movement / भारत छोड़ो आंदोलन", 1942],
    ["Indian independence / भारत की स्वतंत्रता", 1947],
    ["Republic of India / भारतीय गणतंत्र", 1950],
    ["Constitution adoption / संविधान अंगीकरण", 1949],
    [
      "Gandhi returned from South Africa / गांधी की दक्षिण अफ्रीका से वापसी",
      1915,
    ],
    ["Jallianwala Bagh massacre / जलियाँवाला बाग हत्याकांड", 1919],
    ["First Constituent Assembly meeting / संविधान सभा की पहली बैठक", 1946],
    ["Non-Cooperation movement launch / असहयोग आंदोलन का आरंभ", 1920],
  ];
  return [
    pack(
      "linear",
      "Mathematics",
      "10",
      "GENERAL",
      "Linear equations",
      ten((i) => {
        const a = i + 2,
          x = i + 1,
          b = i * 3;
        return numeric(
          `Solve ${a}x + ${b} = ${a * x + b}.`,
          `${a}x + ${b} = ${a * x + b} हल करें।`,
          x,
          `Subtract ${b}, then divide by ${a}. x = ${x}.`,
          i,
        );
      }),
    ),
    pack(
      "quadratic",
      "Mathematics",
      "10",
      "GENERAL",
      "Quadratic root sums",
      ten((i) => {
        const r = i,
          s = i + 3;
        return numeric(
          `Find the sum of roots: x² − ${r + s}x + ${r * s} = 0.`,
          `x² − ${r + s}x + ${r * s} = 0 के मूलों का योग?`,
          r + s,
          `For ax²+bx+c=0, the root sum is −b/a = ${r + s}.`,
          i,
        );
      }),
    ),
    pack(
      "circles",
      "Mathematics",
      "10",
      "GENERAL",
      "Circle areas",
      ten((i) => {
        const r = 7 * i,
          area = 154 * i * i;
        return numeric(
          `Circle radius is ${r} cm. Find its area in cm² using π = 22/7.`,
          `वृत्त की त्रिज्या ${r} cm है। π = 22/7 से क्षेत्रफल (cm²)?`,
          area,
          `πr² = (22/7) × ${r}² = ${area} cm².`,
          i,
        );
      }),
    ),
    pack(
      "current",
      "Science",
      "10",
      "GENERAL",
      "Ohm's law",
      ten((i) => {
        const r = i + 2,
          current = i + 1,
          v = r * current;
        return numeric(
          `An ohmic resistor is ${r} Ω across ${v} V. Current in amperes?`,
          `${r} Ω के ओमीय प्रतिरोध पर ${v} V है। धारा (A)?`,
          current,
          `I = V/R = ${v}/${r} = ${current} A.`,
          i,
        );
      }),
    ),
    pack(
      "parallel-capacitance",
      "Physics",
      "12",
      "SCIENCE",
      "Capacitors in parallel",
      ten((i) => {
        const a = i + 2,
          b = i + 5;
        return numeric(
          `Capacitors ${a} μF and ${b} μF are parallel. Equivalent capacitance in μF?`,
          `${a} μF और ${b} μF समांतर हैं। तुल्य धारिता (μF)?`,
          a + b,
          `Parallel capacitances add: ${a}+${b} = ${a + b} μF.`,
          i,
        );
      }),
    ),
    pack(
      "series-capacitance",
      "Physics",
      "12",
      "SCIENCE",
      "Capacitors in series",
      ten((i) => {
        const c = 4 * i;
        return numeric(
          `Two identical ${c} μF capacitors are in series. Equivalent capacitance in μF?`,
          `दो समान ${c} μF संधारित्र श्रेणी में हैं। तुल्य धारिता (μF)?`,
          c / 2,
          `For two identical series capacitors, C_eq = C/2 = ${c / 2} μF.`,
          i,
        );
      }),
    ),
    pack(
      "profit-sharing",
      "Accountancy",
      "12",
      "COMMERCE",
      "Partnership profit shares",
      ten((i) => {
        const a = i + 1,
          b = i + 2,
          profit = (a + b) * 1000;
        return numeric(
          `A:B profit ratio is ${a}:${b}. Profit is ₹${profit}. A's share in rupees?`,
          `A:B का लाभ अनुपात ${a}:${b}, लाभ ₹${profit}। A का हिस्सा (₹)?`,
          a * 1000,
          `A receives ${a}/(${a}+${b}) × ${profit} = ₹${a * 1000}.`,
          i,
        );
      }),
    ),
    pack(
      "history-dates",
      "History",
      "12",
      "ARTS",
      "Modern India dates",
      history.map(([event, year], i) =>
        mcq(
          `Choose the year: ${event.split(" / ")[0]}.`,
          `वर्ष चुनें: ${event.split(" / ")[1]}।`,
          year,
          [year - 2, year - 1, year + 1],
          `${event}: ${year}. Suggested practice key; verify with your course text.`,
          i,
        ),
      ),
    ),
  ];
}
export async function seedOriginalPractice() {
  const result = { tests: 0, questions: 0, status: "DRAFT" };
  for (const p of originalPracticePacks()) {
    const scope = {
      kind: "SUBJECT",
      name: p.subject,
      session: "2026-27",
      classLevel: p.classLevel,
      stream: p.stream,
    };
    const subject =
      (await Academic.findOne(scope)) ||
      (await Academic.findOneAndUpdate(
        { _id: hash(`practice-subject:${JSON.stringify(scope)}`).slice(0, 24) },
        {
          $setOnInsert: {
            ...scope,
            active: true,
            verified: false,
            syllabusVersion: "original-practice-v1",
            creator: "original-practice-import",
          },
        },
        { upsert: true, returnDocument: "after" },
      ));
    const academic = {
      session: "2026-27",
      subjectId: String(subject._id),
      classLevel: p.classLevel,
      stream: p.stream,
    };
    const rows = p.questions.map((entry, i) => ({
      hash: hash(`${p.id}:${i}`),
      data: questionSchema.parse({
        ...entry,
        academic,
        language: "en",
        type: "SINGLE_CHOICE",
        maximumMarks: 1,
        source:
          "Original illustrative academic practice; not an official BSEB question or verified current-session syllabus. Teacher review required.",
        isPYQ: false,
      }),
    }));
    // One bounded batch per test avoids 80 serial network round-trips to Atlas.
    await QuestionModel.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { hash: row.hash },
          update: {
            $setOnInsert: {
              ...row,
              status: "DRAFT",
              version: 1,
              creator: "original-practice-import",
            },
          },
          upsert: true,
        },
      })),
      { ordered: true },
    );
    const stored = await QuestionModel.find({
      hash: { $in: rows.map((r) => r.hash) },
    })
      .select("_id hash")
      .lean();
    const byHash = new Map(stored.map((q) => [q.hash, String(q._id)]));
    const ids = rows.map((row) => byHash.get(row.hash));
    if (ids.some((id) => !id))
      throw Error("Practice import incomplete; retry the pack import.");
    result.questions += ids.length;
    const data = testSchema.parse({
      title: `${p.subject} · ${p.title} · original practice`,
      academic,
      mode: "PRACTICE",
      durationMinutes: 15,
      description:
        "10 original bilingual questions. Suggested practice keys require teacher review; this is not an official BSEB paper or verified syllabus.",
      feedbackMode: "IMMEDIATE",
      sections: [
        {
          id: "practice",
          title: p.title,
          questionIds: ids,
          instructions:
            "Answer all ten. One mark per question, no negative marks. Original practice settings.",
        },
      ],
    });
    await TestModel.updateOne(
      { _id: hash(`practice-test:${p.id}`).slice(0, 24) },
      {
        $setOnInsert: {
          data,
          status: "DRAFT",
          version: 1,
          creator: "original-practice-import",
        },
      },
      { upsert: true },
    );
    result.tests++;
  }
  return result;
}
