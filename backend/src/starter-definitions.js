import { starterContent } from "./starter-content.js";
import { class12Content } from "./class12-content.js";
import { assert } from "./lib.js";
export const starterDefinitions = [
  {
    id: "class10-starter",
    classLevel: "10",
    stream: "GENERAL",
    author: "boardtestify-starter-v1",
    title: "Class 10 · six-subject starter + full Maths mock",
    content: starterContent,
  },
  ...["SCIENCE", "ARTS", "COMMERCE"].map((stream) => ({
    id: `class12-${stream.toLowerCase()}-starter`,
    classLevel: "12",
    stream,
    author: `boardtestify-class12-${stream.toLowerCase()}-starter-v1`,
    title: `Class 12 ${stream} · six-subject starter${stream === "SCIENCE" ? " + full Physics mock" : ""}`,
    content: () => class12Content(stream),
  })),
];
export const starterIds = starterDefinitions.map((d) => d.id);
export function starterDefinition(id) {
  const d = starterDefinitions.find((d) => d.id === id);
  assert(d, 400, "Unknown starter pack");
  return d;
}
export function starterMetadata() {
  return starterDefinitions.map((d) => {
    const packs = d.content();
    return {
      id: d.id,
      title: d.title,
      classLevel: d.classLevel,
      stream: d.stream,
      session: "2026-27",
      tests: packs.length,
      questions: packs.reduce((n, p) => n + p.questions.length, 0),
      note: "Original foundation questions, keys and descriptive rubrics where applicable. Import, review and publish each test. Reference layouts require exam-year review.",
    };
  });
}
