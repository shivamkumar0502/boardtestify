import { test } from "node:test";
import assert from "node:assert/strict";
import { NativeSeriesModel } from "../app/src/series-model.js";
const group = { id: "subject", title: "Physics", session: "2026-27" };
const page = (rows, nextCursor = null) => ({
  rows,
  nextCursor,
  chapters: [{ id: "chapter", title: "Optics" }],
  paper: { sections: [], theoryMarks: 70 },
});
test("native series uses scoped APIs, tolerates billing errors and paginates filtered tests", async () => {
  const calls = [];
  const model = new NativeSeriesModel(
    async (path) => {
      calls.push(path);
      if (path === "/test-series") return [group];
      if (path === "/billing") throw Error("Billing unavailable");
      if (path.includes("cursor="))
        return page([{ id: "two" }, { id: "three" }]);
      return page([{ id: "one" }, { id: "two" }], "next");
    },
    () => {},
  );
  await model.refresh();
  assert.equal(model.state.groups.length, 1);
  assert.equal(model.state.entitlement, null);
  await model.select(group);
  await model.filter("kind", "FULL_MOCK");
  await model.filter("q", "wave & optics");
  await Promise.all([model.more(), model.more()]);
  assert.deepEqual(
    model.state.rows.map((r) => r.id),
    ["one", "two", "three"],
  );
  assert.equal(calls.filter((p) => p.includes("cursor=")).length, 1);
  assert.ok(calls.at(-1).includes("kind=FULL_MOCK"));
  assert.ok(calls.at(-1).includes("q=wave%20%26%20optics"));
});
test("native series ignores stale filter/page replies and unmounted updates", async () => {
  let resolveOld;
  const updates = [];
  const model = new NativeSeriesModel(
    async (path) => {
      if (path.includes("kind=CHAPTER"))
        return new Promise((resolve) => {
          resolveOld = resolve;
        });
      return page([{ id: "current" }]);
    },
    (s) => updates.push(s),
  );
  await model.select(group);
  const pending = model.filter("kind", "CHAPTER");
  await model.filter("kind", "TOPIC");
  resolveOld(page([{ id: "stale" }]));
  await pending;
  assert.equal(model.state.rows[0].id, "current");
  const pending2 = model.filter("kind", "CHAPTER");
  model.dispose();
  const before = updates.length;
  resolveOld(page([{ id: "after-unmount" }]));
  await pending2;
  assert.equal(updates.length, before);
});
test("native series suppresses duplicate starts, resumes without POST and surfaces errors", async () => {
  let resolveStart,
    calls = 0;
  const routes = [];
  const model = new NativeSeriesModel(
    () => {
      calls++;
      return new Promise((resolve) => {
        resolveStart = resolve;
      });
    },
    () => {},
  );
  const first = model.start({ id: "test" }, (p) => routes.push(p));
  await model.start({ id: "test" }, (p) => routes.push(p));
  assert.equal(calls, 1);
  resolveStart({ id: "attempt" });
  await first;
  assert.deepEqual(routes, ["/exam/attempt"]);
  await model.start({ id: "test", activeAttemptId: "saved" }, (p) =>
    routes.push(p),
  );
  await model.start({ id: "test", activeAttemptId: "saved" }, (p) =>
    routes.push(p),
  );
  assert.equal(calls, 1);
  assert.equal(routes.length, 2);
  const failing = new NativeSeriesModel(
    async () => {
      throw Error("Connection unavailable");
    },
    () => {},
  );
  await failing.start({ id: "test" }, (p) => routes.push(p));
  assert.equal(failing.state.error, "Connection unavailable");
  assert.equal(failing.state.busy, false);
});
