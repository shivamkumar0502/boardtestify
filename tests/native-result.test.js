import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import { transformWithEsbuild } from "vite";
const require = createRequire(import.meta.url);
const source = await readFile(
  new URL("../app/app/result/[id].jsx", import.meta.url),
  "utf8",
);
const compiled = await transformWithEsbuild(source, "result.jsx", {
  loader: "jsx",
  jsx: "automatic",
  format: "cjs",
});
function render(api) {
  const states = [],
    routes = [];
  const fixture = {
    title: "Fixture",
    provisional: false,
    awardedMarks: 0,
    maximumMarks: 1,
    questions: [
      {
        _id: "q",
        type: "SHORT_ANSWER",
        text: "Question",
        options: [],
        correct: [],
        rubric: [],
      },
    ],
    answers: { q: { value: "Answer", attachmentIds: ["page-id"] } },
    evaluations: { q: { status: "NOT_COUNTED" } },
  };
  const module = { exports: {} };
  const stubs = {
    react: {
      useState: (initial) => [
        initial === null ? fixture : initial,
        (value) => states.push(value),
      ],
      useRef: (current) => ({ current }),
      useEffect: () => {},
    },
    "react-native": { ScrollView: "ScrollView", Text: "Text", View: "View" },
    "expo-router": {
      useLocalSearchParams: () => ({ id: "attempt-id" }),
      useRouter: () => ({ replace: (route) => routes.push(route) }),
    },
    "../../src/api": { api },
    "../../src/extras": { NativeAttachment: "NativeAttachment" },
    "../../src/ui": { s: {}, Button: "Button", ErrorText: "ErrorText" },
    "@boardtestify/i18n": { tr: (v) => v, useLanguage: () => {} },
  };
  vm.runInNewContext(compiled.code, {
    module,
    exports: module.exports,
    require: (name) => stubs[name] || require(name),
  });
  const tree = module.exports.default();
  const elements = [];
  function walk(node) {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      elements.push(node);
      walk(node.props?.children);
    }
  }
  walk(tree);
  return { states, routes, elements };
}
test("native result retry buttons invoke the API and navigate; saved answer pages are rendered", async () => {
  const calls = [];
  const screen = render(async (path, body) => {
    calls.push({ path, filter: body.filter });
    return { id: "retry-id" };
  });
  for (const label of [
    "Retry incorrect questions",
    "Retry unanswered questions",
  ]) {
    const button = screen.elements.find(
      (n) => n.type === "Button" && n.props.children === label,
    );
    assert.ok(button);
    await button.props.onPress();
  }
  assert.deepEqual(
    calls.map((c) => c.filter),
    ["INCORRECT", "UNANSWERED"],
  );
  assert.ok(calls.every((c) => c.path === "/attempts/attempt-id/retry"));
  assert.deepEqual(screen.routes, ["/exam/retry-id", "/exam/retry-id"]);
  assert.ok(
    screen.elements.some(
      (n) => n.type === "NativeAttachment" && n.props.id === "page-id",
    ),
  );
  assert.ok(
    screen.elements.some((n) =>
      [n.props?.children].flat().includes("Not counted: section choice limit"),
    ),
  );
});
test("native retry suppresses duplicate taps and surfaces errors without navigating", async () => {
  let calls = 0,
    fail;
  const screen = render(() => {
    calls++;
    return new Promise((_r, reject) => {
      fail = reject;
    });
  });
  const retry = screen.elements.find(
    (n) =>
      n.type === "Button" && n.props.children === "Retry incorrect questions",
  ).props.onPress;
  const pending = retry();
  await retry();
  assert.equal(calls, 1);
  fail(Error("Temporary network failure"));
  await pending;
  assert.deepEqual(screen.routes, []);
  assert.ok(screen.states.includes("Temporary network failure"));
});
