import { StarterReview } from "./starter-review";
import { QuestionImport } from "./question-import";
import { tr, useLanguage } from "@boardtestify/i18n";
import { useState } from "react";
import { Plus, Shield, Upload, Check, Copy, Sparkles } from "lucide-react";
import { request } from "./api";
import { useLoad, useApp, Notice, Empty } from "./main";
import { QuestionForm, TestForm } from "./authoring";
import { ManagementPanel } from "./management-ui";
import { AttachmentGallery } from "./test";
const sampleQuestion = {
  academic: {
    session: "2026-27",
    classLevel: "10",
    stream: "GENERAL",
    subjectId: "REPLACE_WITH_SUBJECT_ID",
  },
  type: "SINGLE_CHOICE",
  language: "en",
  text: "Enter the question",
  options: [
    {
      id: "a",
      text: "Option A",
    },
    {
      id: "b",
      text: "Option B",
    },
  ],
  correct: ["a"],
  referenceAnswer: "",
  alternatives: [],
  explanation: "Explain the answer",
  maximumMarks: 1,
  negativeMarks: 0,
  difficulty: "EASY",
  source: "Original practice",
  isPYQ: false,
  rubric: [],
};
export function Admin() {
  useLanguage();
  const { user } = useApp();
  const tabs =
    user.role === "EVALUATOR"
      ? ["Reviews"]
      : [
          "Questions",
          "Tests",
          "Add questions",
          "Academics",
          "Import",
          "AI drafts",
          "Patterns",
          ...(["ADMIN", "SUPER_ADMIN"].includes(user.role)
            ? ["Reviews", "Users", "Announcements", "Plans", "Operations"]
            : []),
          ...(user.role === "SUPER_ADMIN" ? ["Audit"] : []),
        ];
  const [tab, setTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    return tabs.includes(requested) ? requested : tabs[0];
  });
  const [importJob, setImportJob] = useState("");
  const openImport = (id) => {
    setImportJob(id);
    setTab("Add questions");
  };
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">{tr("CONTENT WITH CARE")}</span>
        <h1>
          {tr("Administration")}
          <span className="accent">{tr(".")}</span>
        </h1>
        <p>
          {tr(
            "Create, verify and publish. Every official pattern needs an attributable source.",
          )}
        </p>
      </div>
      {user.role !== "EVALUATOR" && (
        <div className="toolbar">
          <button className="button primary" onClick={() => openImport("")}>
            {tr("Create test from photo or text")}
          </button>
        </div>
      )}
      <div className="tabs admin-tabs">
        {tr(
          tabs.map((t) => (
            <button
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
              key={t}
            >
              {tr(t)}
            </button>
          )),
        )}
      </div>
      {tab === "Questions" ? (
        <ContentEditor
          key="questions"
          kind="questions"
          onImportSource={openImport}
        />
      ) : tab === "Tests" ? (
        <ContentEditor key="tests" kind="tests" />
      ) : tab === "Add questions" ? (
        <QuestionImport
          key={importJob || "new"}
          initialJobId={importJob}
          onSaved={() => setTab("Tests")}
          onCSV={() => setTab("Import")}
        />
      ) : tab === "Academics" ? (
        <Academics />
      ) : tab === "Import" ? (
        <Import />
      ) : tab === "AI drafts" ? (
        <Drafts />
      ) : tab === "Reviews" ? (
        <Reviews />
      ) : tab === "Users" ? (
        <Users />
      ) : ["Patterns", "Announcements", "Plans", "Operations"].includes(tab) ? (
        <ManagementPanel section={tab} />
      ) : (
        <Audit />
      )}
    </>
  );
}
function ContentEditor({ kind, onImportSource }) {
  useLanguage();
  const { user } = useApp();
  const [page, setPage] = useState(1);
  const { data, error, reload } = useLoad(
    `/admin/${kind}${kind === "questions" ? `?page=${page}` : ""}`,
  );
  const [advanced, setAdvanced] = useState(false);
  const [editing, setEditing] = useState(null),
    [json, setJSON] = useState(""),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = kind === "questions" ? data?.rows : data;
  function create() {
    setEditing("new");
    setJSON(
      JSON.stringify(
        kind === "questions"
          ? sampleQuestion
          : {
              title: "New practice test",
              description: "",
              academic: sampleQuestion.academic,
              mode: "CBT",
              durationMinutes: 30,
              premium: false,
              randomize: false,
              patternVersion: "1",
              sections: [
                {
                  id: "section-1",
                  title: "Section A",
                  instructions: "",
                  questionIds: [],
                },
              ],
            },
        null,
        2,
      ),
    );
    setErr("");
  }
  async function save() {
    setBusy(true);
    setErr("");
    try {
      const body = JSON.parse(json);
      if (!/^[a-f0-9]{24}$/i.test(body.academic?.subjectId || ""))
        throw Error("Choose a subject before saving.");
      if (
        kind === "tests" &&
        (!body.sections?.length ||
          body.sections.some((s) => !s.questionIds?.length))
      )
        throw Error(
          "Add at least one question to every section before saving.",
        );
      await request(
        `/admin/${kind}${editing === "new" ? "" : `/${editing}`}`,
        body,
        editing === "new" ? "POST" : "PUT",
      );
      setMsg("Saved as draft.");
      setEditing(null);
      reload();
    } catch (e) {
      setErr(
        e.message === "Validation failed"
          ? "Check the subject, questions and marking fields before saving."
          : e.message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function publish(id) {
    setErr("");
    try {
      await request(`/admin/${kind}/${id}/publish`, {});
      setMsg("Published after review.");
      reload();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <>
      {kind === "tests" && ["ADMIN", "SUPER_ADMIN"].includes(user.role) && (
        <>
          <OfficialPaperImporter onImported={reload} />
          <PracticePackImporter onImported={reload} />
        </>
      )}
      <div className="toolbar">
        <div>
          <h2>
            {kind === "questions"
              ? tr("Question bank")
              : tr("Test configurations")}
          </h2>
          <p className="small muted">
            {kind === "questions"
              ? tr(
                  "Published questions need a second administrator’s approval.",
                )
              : tr(
                  "Published tests take immutable snapshots when students start.",
                )}
          </p>
        </div>
        <button className="button primary" onClick={create}>
          <Plus size={16} />
          {tr(" Create ")}
          {kind === "questions" ? tr("question") : tr("test")}
        </button>
      </div>
      <Notice error>{error || tr(err)}</Notice>
      <Notice>{tr(msg)}</Notice>
      {editing !== null && (
        <div className="panel editor-panel">
          <h3>{editing === "new" ? tr("Create draft") : tr("Edit draft")}</h3>
          <p className="small muted">
            {tr(
              "Choose your academic scope and fill the fields. Descriptive rubric marks must equal the question maximum.",
            )}
          </p>
          <button
            className="button ghost"
            onClick={() => {
              if (advanced) {
                try {
                  JSON.parse(json);
                } catch {
                  setErr(
                    "Fix invalid JSON before switching to the visual editor",
                  );
                  return;
                }
              }
              setAdvanced(!advanced);
            }}
          >
            {advanced ? tr("Use visual editor") : tr("Advanced JSON editor")}
          </button>
          {advanced ? (
            <label>
              {tr("Configuration JSON")}
              <textarea
                className="code-editor"
                value={json}
                onChange={(e) => setJSON(e.target.value)}
                spellCheck={false}
              />
            </label>
          ) : kind === "questions" ? (
            <QuestionForm
              value={JSON.parse(json)}
              onChange={(v) => setJSON(JSON.stringify(v, null, 2))}
            />
          ) : (
            <TestForm
              value={JSON.parse(json)}
              onChange={(v) => setJSON(JSON.stringify(v, null, 2))}
            />
          )}
          <div className="row">
            <button className="button primary" disabled={busy} onClick={save}>
              {busy ? tr("Saving…") : tr("Validate & save draft")}
            </button>
            <button className="button ghost" onClick={() => setEditing(null)}>
              {tr("Cancel")}
            </button>
          </div>
        </div>
      )}
      {tr(
        rows?.map((r) => (
          <div className="admin-row" key={r._id}>
            <div>
              <span className="tag">
                {tr(r.status)}
                {tr(" \xB7 v")}
                {tr(r.version)}
              </span>
              <h3>{r.data.title || tr(r.data.text)}</h3>
              {r.originJobId && onImportSource && (
                <button
                  className="button ghost"
                  onClick={() => onImportSource(r.originJobId)}
                >
                  {tr("View import source")}
                </button>
              )}
              {(r.data.sourceUrl || r.data.officialSource) && (
                <a
                  className="accent small"
                  target="_blank"
                  rel="noreferrer"
                  href={r.data.sourceUrl || r.data.officialSource}
                >
                  {tr("Open source paper")}
                </a>
              )}
              <button
                className="text-button muted small"
                onClick={() =>
                  navigator.clipboard
                    .writeText(r._id)
                    .then(() => setMsg("ID copied."))
                    .catch(() => setMsg(r._id))
                }
              >
                <Copy size={12} /> {tr(r._id)}
              </button>
            </div>
            <div className="row">
              <button
                className="button ghost"
                onClick={() => {
                  setEditing(r._id);
                  setJSON(JSON.stringify(r.data, null, 2));
                }}
              >
                {tr("Edit")}
              </button>
              {r.status !== "PUBLISHED" && (
                <button
                  className="button subtle"
                  onClick={() => publish(r._id)}
                >
                  <Check size={15} />
                  {tr(" Approve & publish")}
                </button>
              )}
            </div>
          </div>
        )),
      )}
      {rows?.length === 0 && (
        <Empty
          title="Start building your content library"
          detail="Create drafts, review source material and publish when ready."
        />
      )}
      {kind === "questions" && data && (
        <div className="toolbar">
          <button
            className="button ghost"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            {tr("Previous page")}
          </button>
          <span className="small muted">
            {tr("Page ")}
            {tr(page)}
            {tr(" \xB7 ")}
            {tr(data.total)}
            {tr(" questions")}
          </span>
          <button
            className="button ghost"
            disabled={page * 25 >= data.total}
            onClick={() => setPage(page + 1)}
          >
            {tr("Next page")}
          </button>
        </div>
      )}
    </>
  );
}
function Academics() {
  useLanguage();
  const { data, error, reload } = useLoad("/admin/academics");
  const [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    if (!body.parentId) delete body.parentId;
    if (!body.sourceUrl) delete body.sourceUrl;
    body.verified = !!body.sourceUrl;
    body.order = Number(body.order);
    try {
      await request("/admin/academics", body);
      form.reset();
      reload();
      setMsg("Academic record created.");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verifyAcademic(r) {
    try {
      await request(`/admin/academics/${r._id}/verify`, {});
      reload();
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }
  async function editAcademic(r) {
    const name = window.prompt(tr("Academic name"), r.name);
    if (name === null) return;
    const order = window.prompt(tr("Display order"), String(r.order));
    if (order === null) return;
    const sourceUrl = window.prompt(
      tr("Syllabus source URL"),
      r.sourceUrl || "",
    );
    if (sourceUrl === null) return;
    try {
      await request(
        `/admin/academics/${r._id}`,
        { name, order: Number(order), ...(sourceUrl ? { sourceUrl } : {}) },
        "PATCH",
      );
      reload();
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }
  async function toggle(r) {
    try {
      await request(
        `/admin/academics/${r._id}`,
        {
          active: !r.active,
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
      <Notice>{tr(msg)}</Notice>
      <form className="panel" onSubmit={submit}>
        <h2>{tr("Academic structure")}</h2>
        <p className="muted">
          {tr(
            "BSEB \u2192 session \u2192 class/stream \u2192 subject \u2192 chapter \u2192 topic. Add only verified syllabus content.",
          )}
        </p>
        <div className="grid-three">
          <label>
            {tr("Kind")}
            <select name="kind">
              <option value="SUBJECT">{tr("SUBJECT")}</option>
              <option value="CHAPTER">{tr("CHAPTER")}</option>
              <option value="TOPIC">{tr("TOPIC")}</option>
            </select>
          </label>
          <label>
            {tr("Name")}
            <input name="name" required />
          </label>
          <label>
            {tr("Academic session")}
            <input
              name="session"
              pattern="[0-9]{4}-[0-9]{2}"
              defaultValue="2026-27"
              required
            />
          </label>
          <label>
            {tr("Class")}
            <select name="classLevel">
              <option value="10">{tr("Class 10")}</option>
              <option value="12">{tr("Class 12")}</option>
            </select>
          </label>
          <label>
            {tr("Stream")}
            <select name="stream">
              {tr(
                ["GENERAL", "ARTS", "SCIENCE", "COMMERCE"].map((x) => (
                  <option key={x} value={x}>
                    {tr(x)}
                  </option>
                )),
              )}
            </select>
          </label>
          <label>
            {tr("Parent (chapter/topic only)")}
            <select name="parentId">
              <option value="">{tr("No parent \xB7 subject")}</option>
              {tr(
                data?.map((r) => (
                  <option key={r._id} value={r._id}>
                    {tr(r.name)}
                    {tr(" \xB7 ")}
                    {tr(r.kind)}
                    {tr(" \xB7 ")}
                    {tr(r.stream)}
                  </option>
                )),
              )}
            </select>
          </label>
          <label>
            {tr("Syllabus version")}
            <input name="syllabusVersion" defaultValue="1" required />
          </label>
          <label>
            {tr("Official syllabus source URL")}
            <input name="sourceUrl" type="url" />
          </label>
          <label>
            {tr("Display order")}
            <input type="number" name="order" defaultValue="0" min="0" />
          </label>
        </div>
        <button disabled={busy} className="button primary">
          <Plus size={16} />
          {tr(" Add record")}
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("Name / ID")}</th>
              <th>{tr("Scope")}</th>
              <th>{tr("Verification")}</th>
              <th>{tr("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {tr(
              data?.map((r) => (
                <tr key={r._id}>
                  <td>
                    {tr(r.name)}
                    <small>
                      {tr(r.kind)}
                      {tr(" \xB7 ")}
                      {tr(r._id)}
                    </small>
                  </td>
                  <td>
                    {tr(r.session)}
                    {tr(" \xB7 ")}
                    {tr(r.classLevel)}
                    {tr(" \xB7 ")}
                    {tr(r.stream)}
                  </td>
                  <td>
                    {r.verified ? tr("Source recorded") : tr("Unverified")}
                  </td>
                  <td>
                    <button
                      className="button ghost small"
                      onClick={() => editAcademic(r)}
                    >
                      {tr("Edit")}
                    </button>
                    {!r.verified && r.sourceUrl && (
                      <button
                        className="button subtle small"
                        onClick={() => verifyAcademic(r)}
                      >
                        {tr("Verify source")}
                      </button>
                    )}
                    <button
                      className="button ghost small"
                      onClick={() => toggle(r)}
                    >
                      {r.active ? tr("Deactivate") : tr("Activate")}
                    </button>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Import() {
  useLanguage();
  const [rows, setRows] = useState([]),
    [err, setErr] = useState(""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  async function upload(file) {
    setBusy(true);
    setErr("");
    setRows([]);
    try {
      if (file.size > 2_000_000) throw Error("Maximum file size: 2 MB");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await request("/admin/import/preview", {
        format: file.name.endsWith(".xlsx") ? "xlsx" : "csv",
        base64,
      });
      setRows(result);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      const result = await request(
        "/admin/import/confirm",
        rows.filter((r) => !r.error).map((r) => r.question),
      );
      setMsg(JSON.stringify(result, null, 2));
      setRows([]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel">
      <h2>{tr("Import question drafts")}</h2>
      <p className="muted">
        {tr("CSV or XLSX, maximum 100 rows / 2 MB. One column named")}
        {tr(" ")}
        <code>{tr("question_json")}</code>
        {tr(
          ", with a full question JSON object in each row. Formula cells are rejected.",
        )}
      </p>
      <button
        className="button ghost"
        onClick={async () => {
          try {
            const base =
              import.meta.env.VITE_API_URL || "http://localhost:4000/api";
            const csv =
              'question_json\r\n"' +
              JSON.stringify(sampleQuestion).replaceAll('"', '""') +
              '"';
            const url = URL.createObjectURL(
              new Blob([csv], {
                type: "text/csv",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "boardtestify-template.csv";
            link.click();
            URL.revokeObjectURL(url);
          } catch (e) {
            setErr(e.message);
          }
        }}
      >
        {tr("Download CSV template")}
      </button>
      <label className="upload-zone">
        <Upload />
        <span>{busy ? tr("Processing…") : tr("Choose CSV or Excel file")}</span>
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </label>
      <Notice error>{tr(err)}</Notice>
      {tr(
        rows.map((r) => (
          <div className="import-row" key={r.row}>
            <span>
              {tr("Row ")}
              {tr(r.row)}
            </span>
            <span className={r.error ? "accent" : "saved"}>
              {r.error || tr(r.question.text)}
            </span>
          </div>
        )),
      )}
      {rows.some((r) => !r.error) && (
        <button disabled={busy} className="button primary" onClick={confirm}>
          {tr("Import ")}
          {tr(rows.filter((r) => !r.error).length)}
          {tr(" valid drafts")}
        </button>
      )}
      {msg && <pre className="panel">{tr(msg)}</pre>}
    </div>
  );
}
function Drafts() {
  useLanguage();
  const [json, setJSON] = useState(
      JSON.stringify(
        {
          academic: sampleQuestion.academic,
          topic: "Linear equations",
          count: 2,
          language: "en",
          type: "SINGLE_CHOICE",
          maximumMarks: 1,
          sourceMaterial: "",
        },
        null,
        2,
      ),
    ),
    [drafts, setDrafts] = useState(null),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("");
  async function generate() {
    setErr("");
    setBusy(true);
    try {
      setDrafts(await request("/admin/ai-draft", JSON.parse(json)));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    try {
      const result = await request("/admin/import/confirm", drafts.questions);
      setMsg(JSON.stringify(result));
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <div className="panel">
      <h2>{tr("AI-assisted question drafts")}</h2>
      <p className="muted">
        {tr(
          "Set a valid subject ID. Generated content stays unverified and requires review. Your input is preserved if generation fails.",
        )}
      </p>
      <label>
        {tr("Draft request")}
        <textarea
          className="code-editor"
          value={json}
          onChange={(e) => setJSON(e.target.value)}
        />
      </label>
      <button className="button primary" disabled={busy} onClick={generate}>
        <Sparkles size={16} />
        {busy ? tr("Drafting…") : tr("Generate drafts")}
      </button>
      <Notice error>{tr(err)}</Notice>
      <Notice>{tr(msg)}</Notice>
      {drafts && (
        <>
          <label>
            {tr("Review and edit generated JSON")}
            <textarea
              className="code-editor"
              value={JSON.stringify(drafts, null, 2)}
              onChange={(e) => {
                try {
                  setDrafts(JSON.parse(e.target.value));
                } catch {
                  setErr("JSON must be valid before editing is applied");
                }
              }}
            />
          </label>
          <button className="button subtle" onClick={save}>
            {tr("Save as drafts")}
          </button>
        </>
      )}
    </div>
  );
}
function Reviews() {
  useLanguage();
  const { data, error, reload } = useLoad("/reviews");
  const [err, setErr] = useState(""),
    [msg, setMsg] = useState("");
  async function submit(e, a, q) {
    e.preventDefault();
    setErr("");
    const f = new FormData(e.currentTarget);
    try {
      const criteria = q.rubric.map((r) => ({
        id: r.id,
        awardedMarks: Number(f.get(r.id)),
        feedback: String(
          f.get(`feedback-${r.id}`) || "Reviewed against reference and rubric",
        ),
      }));
      await request(`/reviews/${a.id}`, {
        questionId: q._id,
        revision: a.revision,
        reason: f.get("reason"),
        criteria,
      });
      setMsg("Review saved with an audit history.");
      reload();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Notice error>{error || tr(err)}</Notice>
      <Notice>{tr(msg)}</Notice>
      {tr(
        data?.map((a) =>
          a.questions
            .filter((q) =>
              ["REVIEW", "PENDING"].includes(a.evaluations[q._id]?.status),
            )
            .map((q) => (
              <form
                className="panel review-card"
                key={`${a.id}-${q._id}`}
                onSubmit={(e) => submit(e, a, q)}
              >
                <span className="eyebrow">
                  {tr(a.title)}
                  {tr(" \xB7 ")}
                  {tr(a.evaluations[q._id].status)}
                </span>
                <h3>{tr(q.text)}</h3>
                <div className="answer-block">
                  <small>{tr("STUDENT ANSWER")}</small>
                  <p>{tr(a.answers[q._id]?.value)}</p>
                  <AttachmentGallery
                    ids={a.answers[q._id]?.attachmentIds || []}
                  />
                </div>
                <div className="answer-block">
                  <small>{tr("REFERENCE")}</small>
                  <p>{tr(q.referenceAnswer)}</p>
                </div>
                {tr(
                  q.rubric.map((r) => (
                    <div className="grid-two" key={r.id}>
                      <label>
                        {tr(r.name)}
                        {tr(" (0\u2013")}
                        {tr(r.maximumMarks)}
                        {tr(")")}
                        <input
                          name={r.id}
                          type="number"
                          step={q.scoringStep || 0.5}
                          min="0"
                          max={r.maximumMarks}
                          defaultValue={
                            a.evaluations[q._id].criteria?.find(
                              (c) => c.id === r.id,
                            )?.awardedMarks ?? 0
                          }
                          required
                        />
                      </label>
                      <label>
                        {tr("Feedback")}
                        <input name={`feedback-${r.id}`} required />
                      </label>
                    </div>
                  )),
                )}
                <label>
                  {tr("Reason for the review / mark change")}
                  <textarea name="reason" required minLength={10} />
                </label>
                <button className="button primary">
                  <Shield size={15} />
                  {tr(" Approve evaluation")}
                </button>
              </form>
            )),
        ),
      )}
      {data?.length === 0 && (
        <Empty
          title="Review queue is clear"
          detail="Answers that need human evaluation will appear here."
        />
      )}
    </>
  );
}
function Users() {
  useLanguage();
  const { user } = useApp();
  const { data, error, reload } = useLoad("/admin/users");
  const [err, setErr] = useState("");
  async function update(u, role) {
    try {
      await request(
        `/admin/users/${u._id}`,
        {
          role,
        },
        "PATCH",
      );
      reload();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <div className="panel">
      <h2>{tr("Student & staff accounts")}</h2>
      <Notice error>{error || tr(err)}</Notice>
      {tr(
        data?.map((u) => (
          <div className="admin-row" key={u._id}>
            <div>
              <strong>{tr(u.name)}</strong>
              <small>
                {tr(u.email)}
                {tr(" \xB7 Class ")}
                {tr(u.classLevel)}
                {tr(" \xB7 ")}
                {tr(u.stream)}
              </small>
            </div>
            {user.role === "SUPER_ADMIN" && u._id !== user.id ? (
              <select
                aria-label={tr("Role for {0}", [u.name])}
                value={u.role}
                onChange={(e) => update(u, e.target.value)}
              >
                {tr(
                  [
                    "STUDENT",
                    "CONTENT_EDITOR",
                    "EVALUATOR",
                    "ADMIN",
                    "SUPER_ADMIN",
                  ].map((r) => (
                    <option key={r} value={r}>
                      {tr(r)}
                    </option>
                  )),
                )}
              </select>
            ) : (
              <span className="tag">{tr(u.role)}</span>
            )}
          </div>
        )),
      )}
    </div>
  );
}
function Audit() {
  useLanguage();
  const { data, error } = useLoad("/admin/audit");
  return (
    <div className="panel">
      <h2>{tr("Audit log")}</h2>
      <Notice error>{tr(error)}</Notice>
      {tr(
        data?.map((r) => (
          <div className="admin-row" key={r._id}>
            <div>
              <strong>{tr(r.action)}</strong>
              <small>
                {tr("Actor: ")}
                {tr(r.actor)}
                {tr(" \xB7 Entity: ")}
                {tr(r.entityId)}
              </small>
            </div>
            <small>{tr(new Date(r.createdAt).toLocaleString())}</small>
          </div>
        )),
      )}
    </div>
  );
}


function OfficialPaperImporter({ onImported }) {
  useLanguage();
  const [classLevel, setClassLevel] = useState("10");
  const [stream, setStream] = useState("GENERAL");
  const [session, setSession] = useState("2026-27");
  const [language, setLanguage] = useState("en");
  const [subjectKey, setSubjectKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const query = new URLSearchParams({ classLevel, stream }).toString();
  const { data: subjects, error: catalogError } = useLoad(`/admin/bseb-papers/catalog?${query}`);
  async function importPaper() {
    if (!subjectKey) {
      setError("Choose a subject first.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const draft = await request("/admin/bseb-papers/import", {
        subjectKey,
        session,
        classLevel,
        stream,
        language,
      }, "POST");
      setResult(draft);
      onImported();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label={tr("Official BSEB PDF to CBT importer")}>
      <h2>{tr("Convert official BSEB PDF to CBT draft")}</h2>
      <p className="muted small">
        {tr("Downloads an official 2026 model-paper PDF and uses AI to create a timed CBT draft. Selectable-text and scanned/image-only PDFs (up to 30 pages) are supported when AI vision is enabled. Verify every question, answer key, marks, internal choice and rubric before publishing; the source is a 2026 reference, not a verified 2027 pattern.")}
      </p>
      <div className="grid-three">
        <label>
          {tr("Class")}
          <select value={classLevel} disabled={busy} onChange={(e) => {
            const next = e.target.value;
            setClassLevel(next);
            setStream(next === "10" ? "GENERAL" : "SCIENCE");
            setSubjectKey("");
            setResult(null);
          }}>
            <option value="10">{tr("Class 10")}</option>
            <option value="12">{tr("Class 12")}</option>
          </select>
        </label>
        <label>
          {tr("Stream")}
          <select value={stream} disabled={busy || classLevel === "10"} onChange={(e) => {
            setStream(e.target.value);
            setSubjectKey("");
            setResult(null);
          }}>
            {(classLevel === "10" ? ["GENERAL"] : ["SCIENCE", "ARTS", "COMMERCE"]).map((s) => (
              <option key={s} value={s}>{tr(s)}</option>
            ))}
          </select>
        </label>
        <label>
          {tr("Academic session")}
          <input value={session} disabled={busy} placeholder="2026-27" onChange={(e) => setSession(e.target.value)} />
        </label>
        <label>
          {tr("Official 2026 paper")}
          <select value={subjectKey} disabled={busy} onChange={(e) => setSubjectKey(e.target.value)}>
            <option value="">{tr("Choose a subject")}</option>
            {(subjects || []).map((s) => (
              <option key={s.key} value={s.key}>{s.name} · {s.theoryMarks ?? "marks n/a"} marks</option>
            ))}
          </select>
        </label>
        <label>
          {tr("Draft question language")}
          <select value={language} disabled={busy} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">{tr("English")}</option>
            <option value="hi">{tr("Hindi")}</option>
          </select>
        </label>
      </div>
      <Notice error>{error || catalogError}</Notice>
      <button className="button primary" disabled={busy || !subjectKey || !/^\d{4}-\d{2}$/.test(session)} onClick={importPaper}>
        {busy ? tr("Extracting paper with AI…") : tr("Create CBT draft from official PDF")}
      </button>
      {result && (
        <div className="panel question-preview">
          <h3>{tr(result.title)}</h3>
          <p>{tr("Created as {0}; {1} questions extracted from {2} PDF pages.", [result.status, result.questions, result.pageCount])}</p>
          {result.extractionMethod && (
            <p className="muted small">{tr("Extraction method: ")}{tr(result.extractionMethod === "scanned-page-vision" ? "AI vision (scanned pages)" : "Selectable PDF text")}</p>
          )}
          {result.validation && (
            <div className="panel">
              <h4>{tr("Draft completeness check")}</h4>
              <p>{tr("Listed-question marks: {0} · Reference theory marks: {1}", [result.validation.extractedListedMarks, result.validation.expectedTheoryMarks ?? "n/a"])}</p>
              <p>{tr("Question types: {0}", [Object.entries(result.validation.questionTypes || {}).map(([type, count]) => `${type}: ${count}`).join(" · ") || tr("None")])}</p>
              <p>{tr("Validation: {0}", [result.validation.status])}</p>
              <p className="muted small">{tr("Listed-question marks include offered alternatives; compare them with answer limits and internal choices in the source paper.")}</p>
            </div>
          )}
          <p className="muted small">{tr("Source: ")}<a href={result.sourceUrl} target="_blank" rel="noreferrer">{result.sourceUrl}</a></p>
          <Notice>{tr(result.message)}</Notice>
          {!!result.warnings?.length && (
            <details>
              <summary>{tr("Review warnings ({0})", [result.warnings.length])}</summary>
              <ul>{result.warnings.map((warning, i) => <li key={i}>{tr(warning)}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function PracticePackImporter({ onImported }) {
  useLanguage();
  const { data, error } = useLoad("/admin/practice-packs");
  const [reviewing, setReviewing] = useState("");
  const [busy, setBusy] = useState(""),
    [err, setError] = useState(""),
    [message, setMessage] = useState("");
  async function importPack(packId) {
    setBusy(packId);
    setError("");
    setMessage("");
    try {
      const result = await request("/admin/practice-packs/import", { packId });
      setMessage(
        tr(
          "Pack ready: {0} tests, {1} questions. Review drafts before publication.",
          [result.tests, result.questions],
        ),
      );
      onImported();
      if (packId.endsWith("-starter")) setReviewing(packId);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel" aria-label={tr("Practice pack library")}>
      <h2>{tr("Add practice tests")}</h2>
      <p className="muted small">
        {tr(
          "Import ready-to-review drafts. Re-importing preserves edits and does not duplicate content.",
        )}
      </p>
      <Notice error>{error || err}</Notice>
      <Notice>{message}</Notice>
      {[...(data || [])]
        .sort(
          (a, b) =>
            Number(
              b.id === new URLSearchParams(window.location.search).get("pack"),
            ) -
            Number(
              a.id === new URLSearchParams(window.location.search).get("pack"),
            ),
        )
        .map((pack) => (
          <div className="admin-row" key={pack.id}>
            <div>
              <h3>{tr(pack.title)}</h3>
              <p className="muted small">{tr(pack.note)}</p>
              <small>
                {tr("{0} tests · {1} questions · session {2}", [
                  pack.tests,
                  pack.questions,
                  pack.session,
                ])}
              </small>
            </div>
            <button
              className="button subtle"
              disabled={!!busy}
              onClick={() => importPack(pack.id)}
            >
              {busy === pack.id
                ? tr("Importing…")
                : pack.id.endsWith("-starter")
                  ? tr("Import actual tests & review")
                  : tr("Import draft pack")}
            </button>
            {pack.id.endsWith("-starter") && (
              <button
                className="button ghost"
                onClick={() => setReviewing(pack.id)}
              >
                {tr("Open starter test review")}
              </button>
            )}
          </div>
        ))}
      {reviewing && (
        <StarterReview
          key={reviewing}
          packId={reviewing}
          onPublished={onImported}
          onClose={() => setReviewing("")}
        />
      )}
    </section>
  );
}
