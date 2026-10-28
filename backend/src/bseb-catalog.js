// Reference metadata transcribed from BSEB's official 2026 model papers.
// These are paper layouts, not a claim of a verified 2027 syllabus.
const base = "https://biharboardonline.com/files/";
const section = (
  id,
  title,
  offered,
  answerCount,
  marksEach,
  type = "SHORT_ANSWER",
) => ({
  id,
  title,
  offered,
  answerCount,
  marksEach,
  types: [type],
  negativeMarks: 0,
  instructions: `Answer ${answerCount} of ${offered}. Only the first ${answerCount} answered items in paper order are evaluated. Keep passage subparts together where applicable.`,
});
const objective = (n) =>
  section("objective", "Objective MCQs", n, n / 2, 1, "SINGLE_CHOICE");
const standard = (marks) => [
  objective(marks),
  section(
    "short",
    "Short answers",
    marks === 100 ? 30 : 20,
    marks === 100 ? 15 : 10,
    2,
  ),
  section(
    "long",
    "Long answers",
    marks === 100 ? 8 : 6,
    marks === 100 ? 4 : 3,
    5,
    "LONG_ANSWER",
  ),
];
const hindi = (level) =>
  level === "10"
    ? [
        objective(100),
        section("unseen", "Unseen passage with all subparts", 2, 1, 10),
        section("seen", "Textbook passage with all subparts", 2, 1, 10),
        section("essay", "Essay", 5, 1, 10, "LONG_ANSWER"),
        section("letter", "Letter or dialogue", 2, 1, 5, "LONG_ANSWER"),
        section("short", "Literature short answers", 10, 5, 2),
        section("long", "Literature long answer", 2, 1, 5, "LONG_ANSWER"),
      ]
    : [
        objective(100),
        section("essay", "Essay", 6, 1, 8, "LONG_ANSWER"),
        section("explain", "Contextual explanations", 4, 2, 4, "LONG_ANSWER"),
        section("letter", "Letter or application", 2, 1, 5, "LONG_ANSWER"),
        section("short", "Literature short answers", 10, 5, 2),
        section("long", "Literature long answers", 6, 3, 5, "LONG_ANSWER"),
        section("precis", "Precis", 2, 1, 4, "LONG_ANSWER"),
      ];
const english = (level) =>
  level === "10"
    ? [
        objective(100),
        section("unseen", "Unseen passage with all subparts", 2, 1, 7),
        section("prose", "Prose passage with all subparts", 2, 1, 7),
        section("poem", "Poem with all subparts", 2, 1, 6),
        section("short", "Literature short answers", 10, 5, 2),
        section("paragraph", "Paragraph", 5, 1, 5, "LONG_ANSWER"),
        section("writing", "Writing tasks (Q6–11)", 6, 3, 5, "LONG_ANSWER"),
      ]
    : [
        objective(100),
        section("essay", "Essay", 5, 1, 8, "LONG_ANSWER"),
        section("prose", "Prose explanation", 4, 1, 4, "LONG_ANSWER"),
        section("poem", "Poetry explanation", 4, 1, 4, "LONG_ANSWER"),
        section("letter", "Letter", 2, 1, 5, "LONG_ANSWER"),
        section("short", "Short answers", 10, 5, 2),
        section(
          "long",
          "Long tasks with internal choices",
          6,
          3,
          5,
          "LONG_ANSWER",
        ),
        section("reading", "Passage with subparts or precis", 2, 1, 4),
      ];
const science10 = [
  objective(80),
  ...["Physics", "Chemistry", "Biology"].map((name) =>
    section(`short-${name.toLowerCase()}`, `${name} · short answers`, 8, 4, 2),
  ),
  ...["Physics", "Chemistry", "Biology"].map((name, i) =>
    section(
      `long-${name.toLowerCase()}`,
      `${name} · long answer`,
      2,
      1,
      i === 0 ? 6 : 5,
      "LONG_ANSWER",
    ),
  ),
];
const social10 = [
  objective(80),
  ...[
    ["History", 6],
    ["Political Science", 4],
    ["Economics", 4],
    ["Geography", 6],
    ["Disaster Management", 4],
  ].map(([name, n], i) =>
    section(`short-${i}`, `${name} · short answers`, n, n / 2, 2),
  ),
  ...["History", "Political Science", "Economics", "Geography"].map((name, i) =>
    section(`long-${i}`, `${name} · long answer`, 2, 1, 4, "LONG_ANSWER"),
  ),
];
const sanskrit10 = [
  objective(100),
  section("passage-a", "Passage A with all subparts", 2, 1, 7),
  section("passage-b", "Passage B with all subparts", 2, 1, 6),
  section("letter", "Letters", 4, 2, 4, "LONG_ANSWER"),
  section("paragraph", "Paragraph", 5, 1, 7, "LONG_ANSWER"),
  section("translation", "Translation sentences", 12, 6, 1),
  section("short", "Short answers", 16, 8, 2),
];
function subject(
  key,
  name,
  classLevel,
  streams,
  file,
  theoryMarks,
  sections,
  paperQuestionLabel,
  role = "Elective",
) {
  return {
    key,
    name,
    classLevel,
    streams,
    sourceUrl: base + file.replaceAll(" ", "%20").replaceAll("&", "%26"),
    referenceYear: 2026,
    theoryMarks,
    otherAssessmentMarks: theoryMarks == null ? null : 100 - theoryMarks,
    totalMarks: theoryMarks == null ? null : 100,
    durationMinutes:
      theoryMarks == null
        ? null
        : classLevel === "10" && theoryMarks === 80
          ? 165
          : 195,
    writingMinutes:
      theoryMarks == null
        ? null
        : classLevel === "10" && theoryMarks === 80
          ? 150
          : 180,
    readingMinutes: theoryMarks == null ? null : 15,
    sections: sections || [],
    paperQuestionLabel:
      paperQuestionLabel ||
      "Check descriptive groups and internal choices in the source paper.",
    role,
  };
}
const all12 = ["SCIENCE", "ARTS", "COMMERCE"];
export const bsebSubjects = [
  subject(
    "10-hindi",
    "Hindi",
    "10",
    ["GENERAL"],
    "MatricModelPaper/2026/101_HIND.pdf",
    100,
    hindi("10"),
    "100 MCQs + 6 descriptive question groups",
    "First language (MIL) choice",
  ),
  subject(
    "10-sanskrit",
    "Sanskrit",
    "10",
    ["GENERAL"],
    "MatricModelPaper/2026/105_Sanskrit.pdf",
    100,
    sanskrit10,
    "100 MCQs + 5 descriptive question groups",
    "Second language (SIL) choice",
  ),
  subject(
    "10-math",
    "Mathematics",
    "10",
    ["GENERAL"],
    "MatricModelPaper/2026/110_Math.pdf",
    100,
    standard(100),
    "138 offered · 69 to answer",
    "Compulsory",
  ),
  subject(
    "10-science",
    "Science",
    "10",
    ["GENERAL"],
    "MatricModelPaper/2026/112_Science.pdf",
    80,
    science10,
    "110 offered · 55 to answer",
    "Compulsory · practical/internal separate",
  ),
  subject(
    "10-social",
    "Social Science",
    "10",
    ["GENERAL"],
    "MatricModelPaper/2026/111_Social Science.pdf",
    80,
    social10,
    "112 offered · 56 to answer",
    "Compulsory · internal/project separate",
  ),
  subject(
    "10-english",
    "English",
    "10",
    ["GENERAL"],
    "MatricModelPaper/2026/113_English.pdf",
    100,
    english("10"),
    "100 MCQs + 11 descriptive question groups",
    "Compulsory English · separate from five-subject aggregate",
  ),
  ...[
    ["urdu", "Urdu", "103_URDU.pdf"],
    ["bangla", "Bangla", "102_BANGLA.pdf"],
    ["maithili", "Maithili", "104_Maithili.pdf"],
  ].map(([key, name]) =>
    subject(
      `10-${key}`,
      name,
      "10",
      ["GENERAL"],
      "modelpapermatric.html",
      null,
      [],
      null,
      "Alternative language · add reviewed layout manually",
    ),
  ),
  subject(
    "12-hindi",
    "Hindi",
    "12",
    all12,
    "InterModelPaper/2026/106_Hindi_125_206_224.pdf",
    100,
    hindi("12"),
    "100 MCQs + 6 descriptive question groups",
    "Language choice",
  ),
  subject(
    "12-english",
    "English",
    "12",
    all12,
    "InterModelPaper/2026/105_English.pdf",
    100,
    english("12"),
    "100 MCQs + 7 descriptive question groups",
    "Language choice",
  ),
  ...[
    ["physics", "Physics", "117_Physics.pdf"],
    ["chemistry", "Chemistry", "118_Chemistry.pdf"],
    ["biology", "Biology", "119_Biology.pdf"],
    ["agriculture", "Agriculture", "120_Agriculture.pdf"],
  ].map(([key, name, file]) =>
    subject(
      `12-${key}`,
      name,
      "12",
      ["SCIENCE"],
      `InterModelPaper/2026/${file}`,
      70,
      standard(70),
      "96 offered · 48 to answer",
    ),
  ),
  subject(
    "12-math",
    "Mathematics",
    "12",
    ["SCIENCE", "ARTS"],
    "InterModelPaper/2026/121_327_MATH.pdf",
    100,
    standard(100),
    "138 offered · 69 to answer",
  ),
  ...[
    ["business", "Business Studies", "217_Business Studies.pdf", 100],
    ["entrepreneurship", "Entrepreneurship", "218_Entrepenureship.pdf", 70],
    ["accountancy", "Accountancy", "220_Accountancy.pdf", 100],
  ].map(([key, name, file, marks]) =>
    subject(
      `12-${key}`,
      name,
      "12",
      ["COMMERCE"],
      `InterModelPaper/2026/${file}`,
      marks,
      standard(marks),
      marks === 100
        ? "138 offered · 69 to answer"
        : "96 offered · 48 to answer",
    ),
  ),
  subject(
    "12-economics-commerce",
    "Economics",
    "12",
    ["COMMERCE"],
    "InterModelPaper/2026/219_Economics.pdf",
    100,
    standard(100),
    "138 offered · 69 to answer",
  ),
  ...[
    ["history", "History", "321_History.pdf", 100],
    ["political", "Political Science", "322_Political Science.pdf", 100],
    ["geography", "Geography", "323_Geography.pdf", 70],
    ["psychology", "Psychology", "324_Psychology.pdf", 70],
    ["sociology", "Sociology", "325_Sociology.pdf", 100],
    ["philosophy", "Philosophy", "320_Philosophy.pdf", 100],
    ["home", "Home Science", "319_Home science.pdf", 70],
    [
      "yoga",
      "Yoga & Physical Education",
      "317_Yoga & Physical Education.pdf",
      70,
    ],
  ].map(([key, name, file, marks]) =>
    subject(
      `12-${key}`,
      name,
      "12",
      ["ARTS"],
      `InterModelPaper/2026/${file}`,
      marks,
      standard(marks),
      marks === 100
        ? "138 offered · 69 to answer"
        : "96 offered · 48 to answer",
    ),
  ),
  subject(
    "12-economics-arts",
    "Economics",
    "12",
    ["ARTS"],
    "InterModelPaper/2026/326_Economics.pdf",
    100,
    standard(100),
    "138 offered · 69 to answer",
  ),
  subject(
    "12-computer",
    "Computer Science",
    "12",
    all12,
    "InterModelPaper/2026/122_Computer Science_221_328.pdf",
    70,
    standard(70),
    "96 offered · 48 to answer",
    "Subject availability depends on registered combination",
  ),
  subject(
    "12-multimedia",
    "Multimedia & Web Technology",
    "12",
    ["SCIENCE", "ARTS"],
    "InterModelPaper/2026/123_Multimedia & Web Technology.pdf",
    70,
    standard(70),
    "96 offered · 48 to answer",
    "Check school/registration eligibility",
  ),
  ...[
    "Urdu",
    "Maithili",
    "Sanskrit",
    "Prakrit",
    "Magahi",
    "Bhojpuri",
    "Arabic",
    "Persian",
    "Pali",
    "Bangla",
    "Music",
  ].map((name) =>
    subject(
      `12-${name.toLowerCase()}`,
      name,
      "12",
      name === "Music" ? ["ARTS"] : all12,
      "../modelpaperinter.html",
      null,
      [],
      null,
      "Alternative subject · add reviewed layout manually",
    ),
  ),
];
// Index links are deliberate for subjects whose detailed layouts are not yet transcribed.
for (const s of bsebSubjects)
  if (s.sourceUrl.includes("modelpaper"))
    s.sourceUrl = `https://biharboardonline.com/${s.classLevel === "10" ? "modelpapermatric.html" : "modelpaperinter.html"}`;
export function catalogFor(classLevel, stream) {
  return bsebSubjects.filter(
    (s) => s.classLevel === classLevel && s.streams.includes(stream),
  );
}
export function referenceFor(subject) {
  return (
    catalogFor(subject.classLevel, subject.stream).find(
      (s) =>
        s.key === subject.boardSubjectKey ||
        s.name.toLowerCase() === subject.name.toLowerCase(),
    ) || null
  );
}
export function boardGuide(classLevel, stream) {
  return {
    referenceYear: 2026,
    title: classLevel === "10" ? "Class X · Matric" : `Class XII · ${stream}`,
    summary:
      classLevel === "10"
        ? "Five aggregate subjects: first language, second language, Mathematics, Science and Social Science (500 marks). Compulsory English is separate; an optional additional subject may also be registered. Language alternatives are choices, not extra compulsory papers."
        : "Five main subjects: two languages (200 marks) and three electives (300 marks), total 500. One language is Hindi or English; the second must be different. An optional sixth subject is separate. Follow the student's registered combination and school availability.",
    note: "2026 official model-paper reference. Check the selected exam year's notice before publishing full mocks. Practical/internal marks are separate from online theory tests. Chapters and topics are entered by staff; no syllabus completion is claimed.",
    schemeSource:
      classLevel === "10"
        ? "https://biharboardonline.com/modelpapermatric.html"
        : "https://inter.biharboardonline.com/pdf/Arts%20Compartmental.pdf",
    subjects: catalogFor(classLevel, stream),
  };
}
