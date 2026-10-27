import { Academic, Resource, Pattern, Plan } from "./models.js";
const checked = "2026-10-26T00:00:00.000Z";
// Metadata checked against official BSEB 2026 model-paper listings/instructions.
// No model-paper question text, answer keys, or unverified chapter names are seeded.
const matric = "https://biharboardonline.com/modelpapermatric.html",
  inter = "https://biharboardonline.com/modelpaperinter.html";
export async function seedCatalog() {
  const subjects = [
    [
      "10",
      "GENERAL",
      [
        "Mathematics",
        "Science",
        "Social Science",
        "Hindi",
        "English",
        "Sanskrit",
        "Urdu",
      ],
    ],
    [
      "12",
      "SCIENCE",
      ["Physics", "Chemistry", "Biology", "Mathematics", "Hindi", "English"],
    ],
    [
      "12",
      "ARTS",
      [
        "History",
        "Political Science",
        "Geography",
        "Economics",
        "Psychology",
        "Sociology",
        "Philosophy",
        "Hindi",
        "English",
      ],
    ],
    [
      "12",
      "COMMERCE",
      [
        "Accountancy",
        "Business Studies",
        "Entrepreneurship",
        "Economics",
        "Mathematics",
        "Hindi",
        "English",
      ],
    ],
  ];
  const lookup = {};
  for (const [classLevel, stream, names] of subjects)
    for (const name of names) {
      const a = await Academic.findOneAndUpdate(
        { kind: "SUBJECT", name, session: "2025-26", classLevel, stream },
        {
          $setOnInsert: {
            syllabusVersion: "2026-model-paper-catalog",
            sourceUrl: classLevel === "10" ? matric : inter,
            verified: false,
            active: true,
            order: names.indexOf(name),
          },
        },
        { upsert: true, returnDocument: "after" },
      );
      lookup[`${classLevel}:${stream}:${name}`] = a;
    }
  const refs = [
    [
      "10",
      "Mathematics",
      "https://biharboardonline.com/files/MatricModelPaper/2026/110_Math.pdf",
    ],
    [
      "10",
      "Science",
      "https://biharboardonline.com/files/MatricModelPaper/2026/112_Science.pdf",
    ],
    [
      "12",
      "Physics",
      "https://biharboardonline.com/files/InterModelPaper/2026/117_Physics.pdf",
    ],
    [
      "12",
      "Accountancy",
      "https://biharboardonline.com/files/InterModelPaper/2026/220_Accountancy.pdf",
    ],
    [
      "12",
      "History",
      "https://biharboardonline.com/files/InterModelPaper/2026/321_History.pdf",
    ],
    ["10", "All subjects", matric],
    ["12", "All subjects", inter],
  ];
  for (const [classLevel, subject, url] of refs)
    await Resource.updateOne(
      { url },
      {
        $setOnInsert: {
          title: `BSEB 2026 · ${subject}`,
          url,
          classLevel,
          subject,
          examYear: 2026,
          kind: url.endsWith(".pdf") ? "MODEL_PAPER" : "OFFICIAL_CATALOG",
          sourceCheckedAt: new Date(checked),
          syllabusSessions: ["2025-26"],
          note: "Official 2026 model-paper reference. This does not establish the 2027 pattern or make every subject compulsory.",
        },
      },
      { upsert: true },
    );
  const sec = (id, title, offered, answerCount, marksEach, type) => ({
    id,
    title,
    offered,
    answerCount,
    marksEach,
    negativeMarks: 0,
    types: [type],
    instructions: `Answer ${answerCount} of ${offered} questions.`,
  });
  const standard = [
    sec("objective", "Objective", 100, 50, 1, "SINGLE_CHOICE"),
    sec("short", "Short answers", 30, 15, 2, "SHORT_ANSWER"),
    sec("long", "Long answers", 8, 4, 5, "LONG_ANSWER"),
  ];
  const specs = [
    ["10", "GENERAL", "Mathematics", 195, 100, standard, refs[0][2]],
    [
      "10",
      "GENERAL",
      "Science",
      165,
      80,
      [
        sec("objective", "Objective", 80, 40, 1, "SINGLE_CHOICE"),
        ...["Physics", "Chemistry", "Biology"].map((n, i) =>
          sec(`short-${i}`, `${n} · short`, 8, 4, 2, "SHORT_ANSWER"),
        ),
        ...["Physics", "Chemistry", "Biology"].map((n, i) =>
          sec(`long-${i}`, `${n} · long`, 2, 1, i === 0 ? 6 : 5, "LONG_ANSWER"),
        ),
      ],
      refs[1][2],
    ],
    [
      "12",
      "SCIENCE",
      "Physics",
      195,
      70,
      [
        sec("objective", "Objective", 70, 35, 1, "SINGLE_CHOICE"),
        sec("short", "Short answers", 20, 10, 2, "SHORT_ANSWER"),
        sec("long", "Long answers", 6, 3, 5, "LONG_ANSWER"),
      ],
      refs[2][2],
    ],
    ["12", "COMMERCE", "Accountancy", 195, 100, standard, refs[3][2]],
    ["12", "ARTS", "History", 195, 100, standard, refs[4][2]],
  ];
  for (const [
    classLevel,
    stream,
    name,
    durationMinutes,
    totalMarks,
    sections,
    officialSource,
  ] of specs) {
    const academic = {
      session: "2025-26",
      classLevel,
      stream,
      subjectId: String(lookup[`${classLevel}:${stream}:${name}`]._id),
    };
    await Pattern.updateOne(
      {
        "data.academic.subjectId": academic.subjectId,
        "data.versionLabel": "BSEB-2026-model-v1",
      },
      {
        $setOnInsert: {
          data: {
            title: `${name} · official 2026 model pattern`,
            academic,
            versionLabel: "BSEB-2026-model-v1",
            officialSource,
            verifiedAt: checked,
            durationMinutes,
            readingMinutes: 15,
            totalMarks,
            sections,
          },
          status: "DRAFT",
          version: 1,
          creator: "official-catalog-import",
        },
      },
      { upsert: true },
    );
  }
  await Plan.updateOne(
    { name: "30-day Bihar Board study pass" },
    {
      $setOnInsert: {
        name: "30-day Bihar Board study pass",
        description:
          "Access to approved premium tests for your selected class and stream.",
        pricePaise: 9900,
        durationDays: 30,
        billingModel: "ONE_TIME",
        classLevels: ["10", "12"],
        streams: ["GENERAL", "SCIENCE", "ARTS", "COMMERCE"],
        active: true,
        creator: "seed",
      },
    },
    { upsert: true },
  );
}
