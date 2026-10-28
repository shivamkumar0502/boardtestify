import { tr, useLanguage } from "@boardtestify/i18n";
import { useState } from "react";
import { useLoad, Notice, Empty } from "./main";
import { request } from "./api";
import { AcademicPicker, types, typeLabels } from "./authoring";
export function ManagementPanel({ section }) {
  useLanguage();
  if (section === "Patterns") return <Patterns />;
  if (section === "Announcements") return <Announcements />;
  if (section === "Plans") return <Plans />;
  return <Operations />;
}
function Operations() {
  useLanguage();
  const { data, error, reload } = useLoad("/admin/operations");
  return (
    <div className="panel">
      <h2>{tr("Platform operations")}</h2>
      <Notice error>{tr(error)}</Notice>
      <p className="muted">
        {tr(
          "Monitor the evaluation queue and manual-review backlog. This view contains no provider secrets.",
        )}
      </p>
      {data && (
        <div className="stats-grid">
          {tr(
            [
              ["Pending evaluations", data.pendingEvaluations],
              ["Manual reviews", data.manualReviews],
              [
                "Expired awaiting finalization",
                data.expiredAwaitingFinalization,
              ],
              ["Stored answer pages", data.storedAttachments],
              ["API uptime (seconds)", data.uptimeSeconds],
              ["API memory (MiB)", data.memoryMiB],
            ].map(([label, v]) => (
              <div className="stat" key={label}>
                <span className="muted small">{tr(label)}</span>
                <strong>{tr(v)}</strong>
              </div>
            )),
          )}
        </div>
      )}
      <button className="button subtle" onClick={reload}>
        {tr("Refresh")}
      </button>
    </div>
  );
}
function Announcements() {
  useLanguage();
  const { data, error, reload } = useLoad("/admin/announcements");
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(null);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = Object.fromEntries(new FormData(e.currentTarget));
      d.published = d.published === "on";
      d.classLevel = d.classLevel || null;
      d.stream = d.stream || null;
      d.startsAt = new Date(d.startsAt).toISOString();
      d.endsAt = d.endsAt ? new Date(d.endsAt).toISOString() : null;
      await request(
        `/admin/announcements${editing ? `/${editing._id}` : ""}`,
        d,
        editing ? "PUT" : "POST",
      );
      setEditing(null);
      reload();
      setErr("");
      e.target.reset();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const local = (iso) =>
    iso
      ? new Date(Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <>
      <Notice error>{error || tr(err)}</Notice>
      <form className="panel" onSubmit={save} key={editing?._id || "new"}>
        <h2>{editing ? tr("Edit announcement") : tr("New announcement")}</h2>
        <label>
          {tr("Title")}
          <input name="title" required defaultValue={editing?.title} />
        </label>
        <label>
          {tr("Message")}
          <textarea name="body" required defaultValue={editing?.body} />
        </label>
        <div className="grid-three">
          <label>
            {tr("Language")}
            <select name="language" defaultValue={editing?.language || "hi"}>
              <option value="hi">
                {tr("\u0939\u093F\u0928\u094D\u0926\u0940")}
              </option>
              <option value="en">{tr("English")}</option>
            </select>
          </label>
          <label>
            {tr("Class")}
            <select name="classLevel" defaultValue={editing?.classLevel || ""}>
              <option value="">{tr("All classes")}</option>
              <option value="10">{tr("Class 10")}</option>
              <option value="12">{tr("Class 12")}</option>
            </select>
          </label>
          <label>
            {tr("Stream")}
            <select name="stream" defaultValue={editing?.stream || ""}>
              <option value="">{tr("All streams")}</option>
              {tr(
                ["GENERAL", "SCIENCE", "ARTS", "COMMERCE"].map((v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                )),
              )}
            </select>
          </label>
          <label>
            {tr("Starts at")}
            <input
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={local(
                editing?.startsAt || new Date().toISOString(),
              )}
            />
          </label>
          <label>
            {tr("Ends at (optional)")}
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={local(editing?.endsAt)}
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="published"
            defaultChecked={editing?.published}
          />
          {tr("Publish this announcement")}
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? tr("Saving…") : tr("Save announcement")}
        </button>
      </form>
      {tr(
        data?.map((a) => (
          <div className="panel" key={a._id}>
            <div className="row between">
              <h3>{tr(a.title)}</h3>
              <span className="tag">
                {a.published ? tr("PUBLISHED") : tr("DRAFT")}
              </span>
            </div>
            <p>{tr(a.body)}</p>
            <button className="button ghost" onClick={() => setEditing(a)}>
              {tr("Edit")}
            </button>
          </div>
        )),
      )}
    </>
  );
}
function Plans() {
  useLanguage();
  const { data, error, reload } = useLoad("/admin/plans");
  const [model, setModel] = useState("ONE_TIME"),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      const values = new FormData(form),
        d = Object.fromEntries(values);
      for (const k of ["pricePaise", "durationDays", "interval", "totalCount"])
        d[k] = Number(d[k]);
      d.classLevels = values.getAll("classLevels");
      d.streams = values.getAll("streams");
      d.active = true;
      if (!d.providerPlanId) delete d.providerPlanId;
      await request("/admin/plans", d);
      form.reset();
      reload();
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(p) {
    try {
      await request(
        `/admin/plans/${p._id}`,
        {
          active: !p.active,
        },
        "PATCH",
      );
      reload();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Notice error>{error || tr(err)}</Notice>
      <form className="panel" onSubmit={save}>
        <h2>{tr("Study plans and subscriptions")}</h2>
        <p className="small muted">
          {tr(
            "Plan prices are immutable after creation. Deactivate a plan and create a new one to change its price; existing paid grants keep their original terms.",
          )}
        </p>
        <div className="grid-two">
          <label>
            {tr("Plan name")}
            <input name="name" required />
          </label>
          <label>
            {tr("Price (paise)")}
            <input
              name="pricePaise"
              type="number"
              min="100"
              defaultValue="9900"
              required
            />
          </label>
        </div>
        <label>
          {tr("Description")}
          <textarea name="description" />
        </label>
        <div className="grid-three">
          <label>
            {tr("Billing model")}
            <select
              name="billingModel"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="ONE_TIME">{tr("One-time study pass")}</option>
              <option value="RECURRING">{tr("Recurring subscription")}</option>
            </select>
          </label>
          <label>
            {tr("Pass duration (days)")}
            <input
              name="durationDays"
              type="number"
              min="1"
              max="730"
              defaultValue="30"
            />
          </label>
          <label>
            {tr("Provider plan ID (recurring only)")}
            <input
              name="providerPlanId"
              required={model === "RECURRING"}
              placeholder={tr("plan_…")}
            />
          </label>
          <label>
            {tr("Billing period")}
            <select name="period">
              <option value="monthly">{tr("Monthly")}</option>
              <option value="yearly">{tr("Yearly")}</option>
              <option value="weekly">{tr("Weekly")}</option>
              <option value="daily">{tr("Daily")}</option>
            </select>
          </label>
          <label>
            {tr("Interval")}
            <input
              name="interval"
              type="number"
              min="1"
              max="12"
              defaultValue="1"
            />
          </label>
          <label>
            {tr("Total billing cycles")}
            <input
              name="totalCount"
              type="number"
              min="1"
              max="120"
              defaultValue="12"
            />
          </label>
        </div>
        <p className="small muted">
          {tr("Select permitted classes and streams.")}
        </p>
        <div className="row">
          {tr(
            ["10", "12"].map((v) => (
              <label className="checkbox-label" key={v}>
                <input
                  type="checkbox"
                  name="classLevels"
                  value={v}
                  defaultChecked
                />
                {tr("Class ")}
                {tr(v)}
              </label>
            )),
          )}
        </div>
        <div className="row">
          {tr(
            ["GENERAL", "SCIENCE", "ARTS", "COMMERCE"].map((v) => (
              <label className="checkbox-label" key={v}>
                <input
                  type="checkbox"
                  name="streams"
                  value={v}
                  defaultChecked
                />
                {tr(v)}
              </label>
            )),
          )}
        </div>
        <button className="button primary" disabled={busy}>
          {busy ? tr("Saving…") : tr("Create plan")}
        </button>
      </form>
      {tr(
        data?.map((p) => (
          <div className="admin-row" key={p._id}>
            <div>
              <h3>
                {tr(p.name)}
                {tr(" \xB7 \u20B9")}
                {tr(p.pricePaise / 100)}
              </h3>
              <small>
                {tr(p.billingModel)}
                {tr(" \xB7 ")}
                {p.active ? tr("ACTIVE") : tr("INACTIVE")}
              </small>
            </div>
            <button className="button ghost" onClick={() => toggle(p)}>
              {p.active ? tr("Deactivate") : tr("Activate")}
            </button>
          </div>
        )),
      )}
    </>
  );
}
const blank = {
  title: "",
  academic: {
    session: "2025-26",
    classLevel: "10",
    stream: "GENERAL",
    subjectId: "",
  },
  versionLabel: "1",
  officialSource: "",
  verifiedAt: new Date().toISOString(),
  durationMinutes: 195,
  readingMinutes: 15,
  totalMarks: 100,
  sections: [
    {
      id: "objective",
      title: "Objective",
      offered: 100,
      answerCount: 50,
      marksEach: 1,
      negativeMarks: 0,
      types: ["SINGLE_CHOICE"],
      instructions: "",
    },
  ],
};
function Patterns() {
  useLanguage();
  const { data, error, reload } = useLoad("/admin/patterns");
  const [draft, setDraft] = useState(null),
    [editing, setEditing] = useState(null),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (k, v) =>
    setDraft({
      ...draft,
      [k]: v,
    });
  async function save() {
    setBusy(true);
    try {
      await request(
        `/admin/patterns${editing ? `/${editing}` : ""}`,
        draft,
        editing ? "PUT" : "POST",
      );
      setDraft(null);
      setEditing(null);
      reload();
      setErr("");
    } catch (e) {
      setErr(
        e.details ? `${e.message}: ${JSON.stringify(e.details)}` : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function approve(p) {
    try {
      await request(`/admin/patterns/${p._id}/publish`, {});
      reload();
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <>
      <div className="toolbar">
        <h2>{tr("Subject examination patterns")}</h2>
        <button
          className="button primary"
          onClick={() => {
            setDraft(structuredClone(blank));
            setEditing(null);
          }}
        >
          {tr("New pattern")}
        </button>
      </div>
      <Notice error>{error || tr(err)}</Notice>
      <p className="small muted">
        {tr(
          "Official 2026 model patterns are historical references, not a declaration of 2027 rules. A second administrator must verify each source and approve the pattern.",
        )}
      </p>
      {draft && (
        <div className="panel">
          <label>
            {tr("Pattern title")}
            <input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <AcademicPicker
            value={draft.academic}
            onChange={(academic) => set("academic", academic)}
          />
          <div className="grid-three">
            <label>
              {tr("Version label")}
              <input
                value={draft.versionLabel}
                onChange={(e) => set("versionLabel", e.target.value)}
              />
            </label>
            <label>
              {tr("Total duration, including reading (minutes)")}
              <input
                type="number"
                value={draft.durationMinutes}
                onChange={(e) => set("durationMinutes", Number(e.target.value))}
              />
            </label>
            <label>
              {tr("Initial reading time (minutes)")}
              <input
                type="number"
                value={draft.readingMinutes || 0}
                onChange={(e) => set("readingMinutes", Number(e.target.value))}
              />
            </label>
            <label>
              {tr("Total marks")}
              <input
                type="number"
                value={draft.totalMarks}
                onChange={(e) => set("totalMarks", Number(e.target.value))}
              />
            </label>
            <label>
              {tr("Official source URL")}
              <input
                type="url"
                value={draft.officialSource}
                onChange={(e) => set("officialSource", e.target.value)}
              />
            </label>
            <label>
              {tr("Verification date")}
              <input
                type="date"
                value={draft.verifiedAt.slice(0, 10)}
                onChange={(e) =>
                  set("verifiedAt", `${e.target.value}T00:00:00.000Z`)
                }
              />
            </label>
          </div>
          {tr(
            draft.sections.map((s, i) => {
              const update = (key, v) =>
                set(
                  "sections",
                  draft.sections.map((x, j) =>
                    i === j
                      ? {
                          ...x,
                          [key]: v,
                        }
                      : x,
                  ),
                );
              return (
                <div className="form-section" key={s.id}>
                  <label>
                    {tr("Section title")}
                    <input
                      value={s.title}
                      onChange={(e) => update("title", e.target.value)}
                    />
                  </label>
                  <div className="grid-three">
                    {tr(
                      [
                        ["offered", "Questions offered"],
                        ["answerCount", "Questions to answer"],
                        ["marksEach", "Marks per answer"],
                        ["negativeMarks", "Negative marks"],
                        ["wordLimit", "Word limit (optional)"],
                      ].map(([key, label]) => (
                        <label key={key}>
                          {tr(label)}
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={s[key] ?? ""}
                            onChange={(e) =>
                              update(
                                key,
                                e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              )
                            }
                          />
                        </label>
                      )),
                    )}
                  </div>
                  <div className="row">
                    {tr(
                      types.map((type) => (
                        <label className="checkbox-label" key={type}>
                          <input
                            type="checkbox"
                            checked={s.types.includes(type)}
                            onChange={() =>
                              update(
                                "types",
                                s.types.includes(type)
                                  ? s.types.filter((x) => x !== type)
                                  : [...s.types, type],
                              )
                            }
                          />
                          {tr(typeLabels[type])}
                        </label>
                      )),
                    )}
                  </div>
                  <label>
                    {tr("Section instructions")}
                    <textarea
                      value={s.instructions || ""}
                      onChange={(e) => update("instructions", e.target.value)}
                    />
                  </label>
                  <button
                    className="button ghost"
                    disabled={draft.sections.length === 1}
                    onClick={() =>
                      set(
                        "sections",
                        draft.sections.filter((_, j) => i !== j),
                      )
                    }
                  >
                    {tr("Remove section")}
                  </button>
                </div>
              );
            }),
          )}
          <div className="toolbar">
            <button
              className="button subtle"
              onClick={() =>
                set("sections", [
                  ...draft.sections,
                  {
                    id: `s${Date.now()}`,
                    title: "New section",
                    offered: 2,
                    answerCount: 1,
                    marksEach: 1,
                    negativeMarks: 0,
                    types: ["SHORT_ANSWER"],
                    instructions: "",
                  },
                ])
              }
            >
              {tr("Add section")}
            </button>
            <span>
              {tr("Calculated marks: ")}
              {tr(
                draft.sections.reduce(
                  (n, s) => n + s.answerCount * s.marksEach,
                  0,
                ),
              )}
            </span>
          </div>
          <button className="button primary" disabled={busy} onClick={save}>
            {busy ? tr("Saving…") : tr("Save pattern draft")}
          </button>
        </div>
      )}
      {tr(
        data?.map((p) => (
          <div className="admin-row" key={p._id}>
            <div>
              <span className="tag">{tr(p.status)}</span>
              <h3>{tr(p.data.title)}</h3>
              <small>
                {tr(p.data.academic.session)}
                {tr(" \xB7 ")}
                {tr(p.data.totalMarks)}
                {tr(" marks \xB7 ")}
                {tr(p.data.durationMinutes)}
                {tr(" min")}
              </small>
              <a
                href={p.data.officialSource}
                target="_blank"
                rel="noreferrer"
                className="accent small"
              >
                {tr("Open source \u2197")}
              </a>
            </div>
            <div className="row">
              <button
                className="button ghost"
                onClick={() => {
                  setDraft(structuredClone(p.data));
                  setEditing(p._id);
                }}
              >
                {tr("Edit")}
              </button>
              {p.status !== "PUBLISHED" && (
                <button className="button subtle" onClick={() => approve(p)}>
                  {tr("Verify & approve")}
                </button>
              )}
            </div>
          </div>
        )),
      )}
    </>
  );
}
