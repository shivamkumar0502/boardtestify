import { useState } from "react";
import { Plus, Shield, Upload, Check, Copy, Sparkles } from "lucide-react";
import { request } from "./api";
import { useLoad, useApp, Notice, Empty } from "./main";
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
    { id: "a", text: "Option A" },
    { id: "b", text: "Option B" },
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
  const { user } = useApp();
  const tabs =
    user.role === "EVALUATOR"
      ? ["Reviews"]
      : [
          "Questions",
          "Tests",
          "Academics",
          "Import",
          "AI drafts",
          ...(["ADMIN", "SUPER_ADMIN"].includes(user.role)
            ? ["Reviews", "Users"]
            : []),
          ...(user.role === "SUPER_ADMIN" ? ["Audit"] : []),
        ];
  const [tab, setTab] = useState(tabs[0]);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">CONTENT WITH CARE</span>
        <h1>
          Administration<span className="accent">.</span>
        </h1>
        <p>
          Create, verify and publish. Every official pattern needs an
          attributable source.
        </p>
      </div>
      <div className="tabs admin-tabs">
        {tabs.map((t) => (
          <button
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Questions" ? (
        <ContentEditor kind="questions" />
      ) : tab === "Tests" ? (
        <ContentEditor kind="tests" />
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
      ) : (
        <Audit />
      )}
    </>
  );
}
function ContentEditor({ kind }) {
  const { data, error, reload } = useLoad(`/admin/${kind}`);
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
                  questionIds: ["REPLACE_WITH_PUBLISHED_QUESTION_ID"],
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
      await request(
        `/admin/${kind}${editing === "new" ? "" : `/${editing}`}`,
        JSON.parse(json),
        editing === "new" ? "POST" : "PUT",
      );
      setMsg("Saved as draft.");
      setEditing(null);
      reload();
    } catch (e) {
      setErr(
        e.details ? `${e.message}: ${JSON.stringify(e.details)}` : e.message,
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
      <div className="toolbar">
        <div>
          <h2>
            {kind === "questions" ? "Question bank" : "Test configurations"}
          </h2>
          <p className="small muted">
            {kind === "questions"
              ? "Published questions need a second administrator’s approval."
              : "Published tests take immutable snapshots when students start."}
          </p>
        </div>
        <button className="button primary" onClick={create}>
          <Plus size={16} /> Create {kind === "questions" ? "question" : "test"}
        </button>
      </div>
      <Notice error>{error || err}</Notice>
      <Notice>{msg}</Notice>
      {editing !== null && (
        <div className="panel editor-panel">
          <h3>{editing === "new" ? "Create draft" : "Edit draft"}</h3>
          <p className="small muted">
            Use IDs from Academics and Question bank. Descriptive questions
            require a reference answer and rubric; rubric maxima must sum to
            maximumMarks.
          </p>
          <label>
            Configuration JSON
            <textarea
              className="code-editor"
              value={json}
              onChange={(e) => setJSON(e.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="row">
            <button className="button primary" disabled={busy} onClick={save}>
              {busy ? "Saving…" : "Validate & save draft"}
            </button>
            <button className="button ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {rows?.map((r) => (
        <div className="admin-row" key={r._id}>
          <div>
            <span className="tag">
              {r.status} · v{r.version}
            </span>
            <h3>{r.data.title || r.data.text}</h3>
            <button
              className="text-button muted small"
              onClick={() =>
                navigator.clipboard
                  .writeText(r._id)
                  .then(() => setMsg("ID copied."))
                  .catch(() => setMsg(r._id))
              }
            >
              <Copy size={12} /> {r._id}
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
              Edit
            </button>
            {r.status !== "PUBLISHED" && (
              <button className="button subtle" onClick={() => publish(r._id)}>
                <Check size={15} /> Approve & publish
              </button>
            )}
          </div>
        </div>
      ))}
      {rows?.length === 0 && (
        <Empty
          title="Start building your content library"
          detail="Create drafts, review source material and publish when ready."
        />
      )}
    </>
  );
}
function Academics() {
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
  async function toggle(r) {
    try {
      await request(
        `/admin/academics/${r._id}`,
        { active: !r.active },
        "PATCH",
      );
      reload();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Notice error>{error || err}</Notice>
      <Notice>{msg}</Notice>
      <form className="panel" onSubmit={submit}>
        <h2>Academic structure</h2>
        <p className="muted">
          BSEB → session → class/stream → subject → chapter → topic. Add only
          verified syllabus content.
        </p>
        <div className="grid-three">
          <label>
            Kind
            <select name="kind">
              <option>SUBJECT</option>
              <option>CHAPTER</option>
              <option>TOPIC</option>
            </select>
          </label>
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Academic session
            <input
              name="session"
              pattern="[0-9]{4}-[0-9]{2}"
              defaultValue="2026-27"
              required
            />
          </label>
          <label>
            Class
            <select name="classLevel">
              <option value="10">Class 10</option>
              <option value="12">Class 12</option>
            </select>
          </label>
          <label>
            Stream
            <select name="stream">
              {["GENERAL", "ARTS", "SCIENCE", "COMMERCE"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Parent (chapter/topic only)
            <select name="parentId">
              <option value="">No parent · subject</option>
              {data?.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name} · {r.kind} · {r.stream}
                </option>
              ))}
            </select>
          </label>
          <label>
            Syllabus version
            <input name="syllabusVersion" defaultValue="1" required />
          </label>
          <label>
            Official syllabus source URL
            <input name="sourceUrl" type="url" />
          </label>
          <label>
            Display order
            <input type="number" name="order" defaultValue="0" min="0" />
          </label>
        </div>
        <button disabled={busy} className="button primary">
          <Plus size={16} /> Add record
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name / ID</th>
              <th>Scope</th>
              <th>Verification</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r._id}>
                <td>
                  {r.name}
                  <small>
                    {r.kind} · {r._id}
                  </small>
                </td>
                <td>
                  {r.session} · {r.classLevel} · {r.stream}
                </td>
                <td>{r.verified ? "Source recorded" : "Unverified"}</td>
                <td>
                  <button
                    className="button ghost small"
                    onClick={() => toggle(r)}
                  >
                    {r.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Import() {
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
      <h2>Import question drafts</h2>
      <p className="muted">
        CSV or XLSX, maximum 100 rows / 2 MB. One column named{" "}
        <code>question_json</code>, with a full question JSON object in each
        row. Formula cells are rejected.
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
              new Blob([csv], { type: "text/csv" }),
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
        Download CSV template
      </button>
      <label className="upload-zone">
        <Upload />
        <span>{busy ? "Processing…" : "Choose CSV or Excel file"}</span>
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </label>
      <Notice error>{err}</Notice>
      {rows.map((r) => (
        <div className="import-row" key={r.row}>
          <span>Row {r.row}</span>
          <span className={r.error ? "accent" : "saved"}>
            {r.error || r.question.text}
          </span>
        </div>
      ))}
      {rows.some((r) => !r.error) && (
        <button disabled={busy} className="button primary" onClick={confirm}>
          Import {rows.filter((r) => !r.error).length} valid drafts
        </button>
      )}
      {msg && <pre className="panel">{msg}</pre>}
    </div>
  );
}
function Drafts() {
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
      <h2>AI-assisted question drafts</h2>
      <p className="muted">
        Set a valid subject ID. Generated content stays unverified and requires
        review. Your input is preserved if generation fails.
      </p>
      <label>
        Draft request
        <textarea
          className="code-editor"
          value={json}
          onChange={(e) => setJSON(e.target.value)}
        />
      </label>
      <button className="button primary" disabled={busy} onClick={generate}>
        <Sparkles size={16} />
        {busy ? "Drafting…" : "Generate drafts"}
      </button>
      <Notice error>{err}</Notice>
      <Notice>{msg}</Notice>
      {drafts && (
        <>
          <label>
            Review and edit generated JSON
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
            Save as drafts
          </button>
        </>
      )}
    </div>
  );
}
function Reviews() {
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
      <Notice error>{error || err}</Notice>
      <Notice>{msg}</Notice>
      {data?.map((a) =>
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
                {a.title} · {a.evaluations[q._id].status}
              </span>
              <h3>{q.text}</h3>
              <div className="answer-block">
                <small>STUDENT ANSWER</small>
                <p>{a.answers[q._id]?.value}</p>
              </div>
              <div className="answer-block">
                <small>REFERENCE</small>
                <p>{q.referenceAnswer}</p>
              </div>
              {q.rubric.map((r) => (
                <div className="grid-two" key={r.id}>
                  <label>
                    {r.name} (0–{r.maximumMarks})
                    <input
                      name={r.id}
                      type="number"
                      step="0.5"
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
                    Feedback
                    <input name={`feedback-${r.id}`} required />
                  </label>
                </div>
              ))}
              <label>
                Reason for the review / mark change
                <textarea name="reason" required minLength={10} />
              </label>
              <button className="button primary">
                <Shield size={15} /> Approve evaluation
              </button>
            </form>
          )),
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
  const { user } = useApp();
  const { data, error, reload } = useLoad("/admin/users");
  const [err, setErr] = useState("");
  async function update(u, role) {
    try {
      await request(`/admin/users/${u._id}`, { role }, "PATCH");
      reload();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <div className="panel">
      <h2>Student & staff accounts</h2>
      <Notice error>{error || err}</Notice>
      {data?.map((u) => (
        <div className="admin-row" key={u._id}>
          <div>
            <strong>{u.name}</strong>
            <small>
              {u.email} · Class {u.classLevel} · {u.stream}
            </small>
          </div>
          {user.role === "SUPER_ADMIN" && u._id !== user.id ? (
            <select
              aria-label={`Role for ${u.name}`}
              value={u.role}
              onChange={(e) => update(u, e.target.value)}
            >
              {[
                "STUDENT",
                "CONTENT_EDITOR",
                "EVALUATOR",
                "ADMIN",
                "SUPER_ADMIN",
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          ) : (
            <span className="tag">{u.role}</span>
          )}
        </div>
      ))}
    </div>
  );
}
function Audit() {
  const { data, error } = useLoad("/admin/audit");
  return (
    <div className="panel">
      <h2>Audit log</h2>
      <Notice error>{error}</Notice>
      {data?.map((r) => (
        <div className="admin-row" key={r._id}>
          <div>
            <strong>{r.action}</strong>
            <small>
              Actor: {r.actor} · Entity: {r.entityId}
            </small>
          </div>
          <small>{new Date(r.createdAt).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}
