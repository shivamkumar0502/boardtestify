import { test } from "node:test";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/parser";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "parser-fixture-secret-".repeat(4);
const { parsePastedMCQ } =
  await import("../backend/src/question-extraction.js");
test("paste parser preserves multiline Hindi/math and does not invent missing answer keys", () => {
  const rows = parsePastedMCQ(
    "1. 2x + 3 = 7\nहल करें।\nA) 1\nB) 2\nउत्तर: B\n\n2. Pick a value.\nA) 3\nB) 4",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].text, "2x + 3 = 7 हल करें।");
  assert.deepEqual(rows[0].correct, ["b"]);
  assert.deepEqual(rows[1].correct, []);
});
test("paste parser rejects duplicate letters, oversized imports and invalid keys", () => {
  for (const text of [
    "1. Q\nA) One\nA) Two",
    "1. Q\nA) One\nB) Two\nAnswer: D",
    Array.from({ length: 101 }, (_, i) => `${i + 1}. Q\nA) One\nB) Two`).join(
      "\n",
    ),
    "A) no question",
    "1. Q\nA) One\nB) Two\nE) Five",
    "1. Q\nA) One\nB) Two\nAnswer: E",
  ]) {
    assert.throws(() => parsePastedMCQ(text));
  }
});

test("book OCR parser accepts Devanagari numbering, inline options and descriptive drafts", () => {
  const rows = parsePastedMCQ(
    "प्रश्न १- सही विकल्प चुनें।\n(क) एक (ख) दो (ग) तीन (घ) चार\nउत्तर: (ख)\n२. प्रकाश का परावर्तन समझाइए।",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].options.length, 4);
  assert.deepEqual(rows[0].correct, ["b"]);
  assert.equal(rows[1].type, "SHORT_ANSWER");
  assert.equal(rows[1].referenceAnswer, "");
});

test("book options may share a line with the question and use Hindi or English markers", () => {
  const rows = parsePastedMCQ(
    "Q. (1)Choose a city. A) New Delhi B) Patna C) Ranchi D) Jaipur\nAnswer: B\nप्रश्न २.सही संख्या चुनिए।\nक) एक ख) दो\nग) तीन घ) चार\nउत्तर: ख",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].text, "Choose a city.");
  assert.deepEqual(
    rows[0].options.map((o) => o.text),
    ["New Delhi", "Patna", "Ranchi", "Jaipur"],
  );
  assert.deepEqual(
    rows[1].options.map((o) => o.id),
    ["a", "b", "c", "d"],
  );
  assert.deepEqual(rows[1].correct, ["b"]);
  assert.throws(() => parsePastedMCQ("1. Q A) First A) Repeated"));
});

test("paste parser accepts a full paper-sized set of 100 questions", () => {
  const text = Array.from(
    { length: 100 },
    (_, i) => `${i + 1}. Question ${i + 1}\nA) Option one\nB) Option two\nC) Option three\nD) Option four\nAnswer: A`,
  ).join("\n\n");
  const rows = parsePastedMCQ(text);
  assert.equal(rows.length, 100);
  assert.deepEqual(rows[99].correct, ["a"]);
});
