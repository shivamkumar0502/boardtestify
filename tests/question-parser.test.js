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
    Array.from({ length: 11 }, (_, i) => `${i + 1}. Q\nA) One\nB) Two`).join(
      "\n",
    ),
    "A) no question",
    "1. Q\nA) One\nB) Two\nE) Five",
    "1. Q\nA) One\nB) Two\nAnswer: E",
  ]) {
    assert.throws(() => parsePastedMCQ(text));
  }
});
