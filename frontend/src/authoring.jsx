import { PaperGuide } from "./paper-guide";
import { tr, useLanguage } from "@boardtestify/i18n";
import { useState } from "react";
import { useLoad, Notice } from "./main";
import { request, uploadFile } from "./api";
export const types = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "NUMERICAL",
];
export const typeLabels = {
  SINGLE_CHOICE: "Single-choice MCQ",
  MULTIPLE_CHOICE: "Multiple-choice MCQ",
  SHORT_ANSWER: "Short answer",
  LONG_ANSWER: "Long answer",
  NUMERICAL: "Numerical answer",
};
export function AcademicPicker({
  value,
  onChange,
  onSetup,
  showPattern = false,
}) {
  useLanguage();
  const { data, error, reload } = useLoad(
    `/admin/academics?${new URLSearchParams({ session: value.session, classLevel: value.classLevel, stream: value.stream })}`,
  );
  const [adding, setAdding] = useState(""),
    [newName, setNewName] = useState(""),
    [saving, setSaving] = useState(false),
    [setupError, setSetupError] = useState(""),
    [setupMessage, setSetupMessage] = useState("");
  async function setup() {
    setSaving(true);
    setSetupError("");
    try {
      await request("/admin/bseb/setup", {
        session: value.session,
        classLevel: value.classLevel,
        stream: value.stream,
      });
      reload();
      onSetup?.();
      setSetupMessage(
        "Subjects and draft paper layouts are ready. Select your subject; add chapters and topics yourself. Layouts need review before publication.",
      );
    } catch (e) {
      setSetupError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function addRecord() {
    if (!newName.trim()) {
      setSetupError("Enter a name.");
      return;
    }
    setSaving(true);
    setSetupError("");
    try {
      const record = await request("/admin/academics", {
        session: value.session,
        classLevel: value.classLevel,
        stream: value.stream,
        kind: adding,
        name: newName.trim(),
        ...(adding === "CHAPTER" ? { parentId: value.subjectId } : {}),
        syllabusVersion: `Staff-entered ${value.session}`,
        verified: false,
        active: true,
      });
      onChange(
        adding === "SUBJECT"
          ? { ...value, subjectId: record._id, chapterId: undefined, topic: "" }
          : { ...value, chapterId: record._id, topic: "" },
      );
      reload();
      setAdding("");
      setNewName("");
    } catch (e) {
      setSetupError(e.message);
    } finally {
      setSaving(false);
    }
  }
  const records = data || [];
  function set(key, v) {
    const next = {
      ...value,
      [key]: v,
    };
    if (["classLevel", "stream", "session"].includes(key)) {
      next.subjectId = "";
      delete next.chapterId;
      delete next.topic;
    }
    if (key === "classLevel") next.stream = v === "10" ? "GENERAL" : "SCIENCE";
    if (key === "subjectId") {
      delete next.chapterId;
      delete next.topic;
    }
    onChange(next);
  }
  const subjects = records.filter(
    (r) =>
      r.kind === "SUBJECT" &&
      r.active &&
      r.session === value.session &&
      r.classLevel === value.classLevel &&
      r.stream === value.stream,
  );
  return (
    <>
      <Notice error>{tr(error)}</Notice>
      <div className="grid-three">
        <label>
          {tr("Academic session")}
          <input
            value={value.session}
            onChange={(e) => set("session", e.target.value)}
            placeholder={tr("2025-26")}
          />
        </label>
        <label>
          {tr("Class")}
          <select
            value={value.classLevel}
            onChange={(e) => set("classLevel", e.target.value)}
          >
            <option value="10">{tr("Class 10")}</option>
            <option value="12">{tr("Class 12")}</option>
          </select>
        </label>
        <label>
          {tr("Stream")}
          <select
            value={value.stream}
            onChange={(e) => set("stream", e.target.value)}
          >
            {tr(
              (value.classLevel === "10"
                ? ["GENERAL"]
                : ["SCIENCE", "ARTS", "COMMERCE"]
              ).map((s) => (
                <option key={s} value={s}>
                  {tr(s)}
                </option>
              )),
            )}
          </select>
        </label>
        <label>
          {tr("Subject")}
          <select
            value={
              subjects.some((s) => s._id === value.subjectId)
                ? value.subjectId
                : ""
            }
            onChange={(e) => set("subjectId", e.target.value)}
          >
            <option value="">{tr("Choose a subject")}</option>
            {tr(
              subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {tr(s.name)}
                </option>
              )),
            )}
          </select>
        </label>
        <label>
          {tr("Chapter")}
          <select
            value={value.chapterId || ""}
            onChange={(e) =>
              onChange({
                ...value,
                chapterId: e.target.value || undefined,
              })
            }
          >
            <option value="">{tr("All chapters / not specified")}</option>
            {tr(
              records
                .filter(
                  (r) =>
                    r.kind === "CHAPTER" &&
                    r.active &&
                    r.parentId === value.subjectId,
                )
                .map((r) => (
                  <option key={r._id} value={r._id}>
                    {tr(r.name)}
                  </option>
                )),
            )}
          </select>
        </label>
        <label>
          {tr("Topic")}
          <input
            value={value.topic || ""}
            onChange={(e) =>
              onChange({
                ...value,
                topic: e.target.value,
              })
            }
          />
        </label>
      </div>
      {showPattern &&
        value.subjectId &&
        /^\d{4}-\d{2}$/.test(value.session) && (
          <AcademicReference
            academic={value}
            subject={subjects.find((s) => s._id === value.subjectId)}
          />
        )}
      <div className="academic-quick-add">
        {!subjects.length && (
          <p className="notice">
            {tr(
              "No subjects exist for this session, class and stream. Add them below to continue.",
            )}
          </p>
        )}
        <div className="row wrap">
          <button
            type="button"
            className="button subtle"
            disabled={saving}
            onClick={setup}
          >
            {tr("Set up BSEB subjects & paper layouts")}
          </button>
          <button
            type="button"
            className="button ghost"
            disabled={saving}
            onClick={() => {
              setAdding("SUBJECT");
              setNewName("");
            }}
          >
            {tr("+ Add subject")}
          </button>
          <button
            type="button"
            className="button ghost"
            disabled={saving || !value.subjectId}
            onClick={() => {
              setAdding("CHAPTER");
              setNewName("");
            }}
          >
            {tr("+ Add chapter")}
          </button>
        </div>
        {adding && (
          <div className="panel inline-academic-form">
            <label>
              {tr(
                adding === "SUBJECT" ? "New subject name" : "New chapter name",
              )}
              <input
                autoFocus
                maxLength={200}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <div className="row wrap">
              <button
                type="button"
                className="button primary"
                disabled={saving}
                onClick={addRecord}
              >
                {tr("Save and select")}
              </button>
              <button
                type="button"
                className="button ghost"
                disabled={saving}
                onClick={() => setAdding("")}
              >
                {tr("Cancel")}
              </button>
            </div>
          </div>
        )}
        <Notice error>{setupError}</Notice>
        <Notice>{setupMessage}</Notice>
      </div>
    </>
  );
}
function AcademicReference({ academic, subject }) {
  const { data } = useLoad(
    `/admin/bseb/catalog?${new URLSearchParams({ session: academic.session, classLevel: academic.classLevel, stream: academic.stream })}`,
  );
  const reference = data?.subjects.find(
    (s) =>
      s.key === subject?.boardSubjectKey ||
      s.name.toLowerCase() === subject?.name.toLowerCase(),
  );
  return <PaperGuide paper={reference} />;
}
export function QuestionForm({ value: q, onChange, hideAcademic = false }) {
  useLanguage();
  const [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const set = (key, v) =>
    onChange({
      ...q,
      [key]: v,
    });
  const descriptive = ["SHORT_ANSWER", "LONG_ANSWER"].includes(q.type);
  async function image(file) {
    setUploading(true);
    try {
      const r = await uploadFile("/admin/question-image", file);
      set("imageKey", r.key);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="authoring-form">
      {!hideAcademic && (
        <AcademicPicker
          value={q.academic}
          onChange={(academic) => set("academic", academic)}
        />
      )}
      <div className="grid-three">
        <label>
          {tr("Question type")}
          <select
            value={q.type}
            onChange={(e) => {
              const type = e.target.value;
              onChange({
                ...q,
                type,
                correct:
                  type === "SINGLE_CHOICE"
                    ? (q.correct || []).slice(0, 1)
                    : q.correct,
                rubric:
                  ["SHORT_ANSWER", "LONG_ANSWER"].includes(type) &&
                  !q.rubric?.length
                    ? [
                        {
                          id: "criterion-1",
                          name: "Relevant concepts and reasoning",
                          maximumMarks: q.maximumMarks,
                        },
                      ]
                    : q.rubric,
              });
            }}
          >
            {tr(
              types.map((type) => (
                <option key={type} value={type}>
                  {tr(typeLabels[type])}
                </option>
              )),
            )}
          </select>
        </label>
        <label>
          {tr("Question language")}
          <select
            value={q.language}
            disabled={hideAcademic}
            onChange={(e) => set("language", e.target.value)}
          >
            <option value="en">{tr("English")}</option>
            <option value="hi">
              {tr("\u0939\u093F\u0928\u094D\u0926\u0940")}
            </option>
          </select>
        </label>
        <label>
          {tr("Difficulty")}
          <select
            value={q.difficulty || "MEDIUM"}
            onChange={(e) => set("difficulty", e.target.value)}
          >
            {tr(
              ["EASY", "MEDIUM", "HARD"].map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              )),
            )}
          </select>
        </label>
      </div>
      <label>
        {tr("Question text")}
        <textarea
          value={q.text}
          onChange={(e) => set("text", e.target.value)}
          rows={4}
        />
      </label>
      <label>
        {tr("Bilingual translation (optional)")}
        <textarea
          value={q.translation || ""}
          onChange={(e) => set("translation", e.target.value)}
          rows={3}
        />
      </label>
      <div className="grid-three">
        <label>
          {tr("Maximum marks")}
          <input
            type="number"
            min="0.25"
            max="100"
            step="0.25"
            value={q.maximumMarks}
            onChange={(e) => {
              const maximumMarks = Number(e.target.value);
              onChange({
                ...q,
                maximumMarks,
                rubric:
                  q.rubric?.length === 1
                    ? [
                        {
                          ...q.rubric[0],
                          maximumMarks,
                        },
                      ]
                    : q.rubric,
              });
            }}
          />
        </label>
        <label>
          {tr("Negative marks")}
          <input
            type="number"
            min="0"
            step="0.25"
            value={q.negativeMarks || 0}
            onChange={(e) => set("negativeMarks", Number(e.target.value))}
          />
        </label>
        <label>
          {tr("Scoring increment")}
          <select
            value={q.scoringStep || 0.5}
            onChange={(e) => set("scoringStep", Number(e.target.value))}
          >
            {tr(
              [1, 0.5, 0.25].map((v) => (
                <option value={v} key={v}>
                  {tr(v)}
                </option>
              )),
            )}
          </select>
        </label>
      </div>
      {q.type.endsWith("CHOICE") && (
        <div className="form-section">
          <h3>{tr("Answer options")}</h3>
          <p className="small muted">
            {tr("Select the correct option or options before saving.")}
          </p>
          {tr(
            (q.options || []).map((o, i) => (
              <div className="option-editor" key={o.id}>
                <input
                  aria-label={tr("Correct option {0}", [i + 1])}
                  type={q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                  name="answer-key"
                  checked={(q.correct || []).includes(o.id)}
                  onChange={() =>
                    set(
                      "correct",
                      q.type === "SINGLE_CHOICE"
                        ? [o.id]
                        : (q.correct || []).includes(o.id)
                          ? q.correct.filter((v) => v !== o.id)
                          : [...(q.correct || []), o.id],
                    )
                  }
                />
                <input
                  aria-label={tr("Option {0} text", [i + 1])}
                  value={o.text}
                  onChange={(e) =>
                    set(
                      "options",
                      q.options.map((x) =>
                        x.id === o.id
                          ? {
                              ...x,
                              text: e.target.value,
                            }
                          : x,
                      ),
                    )
                  }
                />
                <button
                  className="button ghost"
                  onClick={() =>
                    onChange({
                      ...q,
                      options: q.options.filter((x) => x.id !== o.id),
                      correct: q.correct.filter((x) => x !== o.id),
                    })
                  }
                >
                  {tr("Remove")}
                </button>
              </div>
            )),
          )}
          <button
            className="button subtle"
            disabled={q.options?.length >= 8}
            onClick={() =>
              set("options", [
                ...(q.options || []),
                {
                  id: `o${Date.now().toString(36).slice(-8)}`,
                  text: "",
                },
              ])
            }
          >
            {tr("Add option")}
          </button>
        </div>
      )}
      {q.type === "NUMERICAL" && (
        <label>
          {tr("Accepted answers (one per line)")}
          <textarea
            value={(q.correct || []).join("\n")}
            onChange={(e) => set("correct", e.target.value.split("\n"))}
          />
        </label>
      )}
      {descriptive && (
        <>
          <label>
            {tr("Reference answer")}
            <textarea
              value={q.referenceAnswer}
              onChange={(e) => set("referenceAnswer", e.target.value)}
              rows={6}
            />
          </label>
          <label>
            {tr("Accepted alternative answers (one per line)")}
            <textarea
              value={(q.alternatives || []).join("\n")}
              onChange={(e) =>
                set("alternatives", e.target.value.split("\n").filter(Boolean))
              }
            />
          </label>
          <div className="form-section">
            <h3>{tr("Marking rubric")}</h3>
            {tr(
              (q.rubric || []).map((r, i) => (
                <div className="grid-three" key={r.id}>
                  <label>
                    {tr("Criterion description")}
                    <input
                      value={r.name}
                      onChange={(e) =>
                        set(
                          "rubric",
                          q.rubric.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  name: e.target.value,
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    {tr("Criterion marks")}
                    <input
                      type="number"
                      min="0.25"
                      step={q.scoringStep || 0.5}
                      value={r.maximumMarks}
                      onChange={(e) =>
                        set(
                          "rubric",
                          q.rubric.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  maximumMarks: Number(e.target.value),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    className="button ghost"
                    onClick={() =>
                      set(
                        "rubric",
                        q.rubric.filter((_, j) => j !== i),
                      )
                    }
                  >
                    {tr("Remove criterion")}
                  </button>
                </div>
              )),
            )}
            <div className="toolbar">
              <span className="small muted">
                {tr("Rubric total: ")}
                {tr((q.rubric || []).reduce((s, r) => s + r.maximumMarks, 0))}
                {tr(" / ")}
                {tr(q.maximumMarks)}
              </span>
              <button
                className="button subtle"
                onClick={() =>
                  set("rubric", [
                    ...(q.rubric || []),
                    {
                      id: `r${Date.now()}`,
                      name: "",
                      maximumMarks: 1,
                    },
                  ])
                }
              >
                {tr("Add criterion")}
              </button>
            </div>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={!!q.requiresDiagram}
              onChange={(e) => set("requiresDiagram", e.target.checked)}
            />
            {tr("This answer requires a diagram")}
          </label>
        </>
      )}
      <label>
        {tr("Explanation / learning feedback")}
        <textarea
          value={q.explanation || ""}
          onChange={(e) => set("explanation", e.target.value)}
        />
      </label>
      <div className="grid-two">
        <label>
          {tr("Question image (JPEG, PNG, WebP)")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && image(e.target.files[0])}
          />
          {q.imageKey && <small>{tr("Image uploaded and validated.")}</small>}
        </label>
        <label>
          {tr("Source / attribution")}
          <input
            value={q.source}
            readOnly={hideAcademic}
            onChange={(e) => set("source", e.target.value)}
          />
        </label>
        <label>
          {tr("Source URL")}
          <input
            type="url"
            value={q.sourceUrl || ""}
            onChange={(e) => set("sourceUrl", e.target.value || undefined)}
          />
        </label>
        <label>
          {tr("Source year")}
          <input
            type="number"
            min="1900"
            max="2200"
            value={q.sourceYear || ""}
            onChange={(e) =>
              set(
                "sourceYear",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          />
        </label>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={!!q.isPYQ}
          disabled={hideAcademic}
          onChange={(e) => set("isPYQ", e.target.checked)}
        />
        {tr(
          "Verified previous-year question (source must be checked by reviewer)",
        )}
      </label>
      <Notice error>{tr(error)}</Notice>
      <div className="panel question-preview">
        <span className="eyebrow">{tr("QUESTION PREVIEW")}</span>
        <h3>{tr(q.text)}</h3>
        {q.translation && <p>{tr(q.translation)}</p>}
        {tr(
          q.options?.map((o) => (
            <p key={o.id}>
              {(q.correct || []).includes(o.id) ? tr("✓ ") : tr("○ ")}
              {tr(o.text)}
            </p>
          )),
        )}
      </div>
    </div>
  );
}
export function TestForm({ value: d, onChange }) {
  useLanguage();
  const [page, setPage] = useState(1),
    [sectionIndex, setSection] = useState(0);
  const set = (key, v) =>
    onChange({
      ...d,
      [key]: v,
    });
  const { data: patterns, reload: reloadPatterns } = useLoad("/admin/patterns");
  const { data: bank, error } = useLoad(
    `/admin/questions?status=PUBLISHED&page=${page}${d.academic.subjectId ? `&subjectId=${d.academic.subjectId}` : ""}`,
  );
  const sections = d.sections || [];
  const chosen = sections[Math.min(sectionIndex, sections.length - 1)];
  function section(patch) {
    set(
      "sections",
      sections.map((s, i) =>
        i === sectionIndex
          ? {
              ...s,
              ...patch,
            }
          : s,
      ),
    );
  }
  function applyPattern(pid) {
    const p = patterns.find((p) => p._id === pid);
    if (!p) return;
    onChange({
      ...d,
      mode: "BOARD",
      patternId: pid,
      patternVersion: p.data.versionLabel,
      officialSource: p.data.officialSource,
      verifiedAt: p.data.verifiedAt,
      durationMinutes: p.data.durationMinutes,
      readingMinutes: p.data.readingMinutes,
      sections: p.data.sections.map((s) => ({
        id: s.id,
        title: s.title,
        instructions: s.instructions,
        questionIds: [],
        drawCount: s.offered,
        maxAnswers: s.answerCount,
        allowedTypes: s.types,
        wordLimit: s.wordLimit,
        choicePolicy: "FIRST_IN_PAPER",
      })),
    });
    setSection(0);
  }
  return (
    <>
      <label>
        {tr("Test title")}
        <input value={d.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <label>
        {tr("Description")}
        <textarea
          value={d.description || ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <AcademicPicker
        showPattern
        onSetup={reloadPatterns}
        value={d.academic}
        onChange={(academic) =>
          onChange({
            ...d,
            academic,
            patternId: undefined,
            sections: sections.map((s) => ({
              ...s,
              questionIds: [],
            })),
          })
        }
      />
      <div className="grid-three">
        <label>
          {tr("Test mode")}
          <select
            value={d.mode}
            onChange={(e) =>
              onChange({
                ...d,
                mode: e.target.value,
                feedbackMode: "AFTER_SUBMISSION",
              })
            }
          >
            {tr(
              ["PRACTICE", "CBT", "BOARD"].map((v) => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              )),
            )}
          </select>
        </label>
        <label>
          {tr("Duration (minutes; empty for untimed practice)")}
          <input
            type="number"
            min="1"
            max="360"
            value={d.durationMinutes ?? ""}
            onChange={(e) =>
              set(
                "durationMinutes",
                e.target.value ? Number(e.target.value) : null,
              )
            }
          />
        </label>
        <label>
          {tr("Feedback")}
          <select
            value={d.feedbackMode || "AFTER_SUBMISSION"}
            onChange={(e) => set("feedbackMode", e.target.value)}
          >
            <option value="AFTER_SUBMISSION">{tr("After submission")}</option>
            {d.mode === "PRACTICE" && (
              <option value="IMMEDIATE">
                {tr("Immediately after saving an answer")}
              </option>
            )}
          </select>
        </label>
      </div>
      {d.mode === "BOARD" && (
        <label>
          {tr("Paper layout · drafts need independent approval")}
          <select
            value={d.patternId || ""}
            onChange={(e) => applyPattern(e.target.value)}
          >
            <option value="">{tr("Select a verified pattern")}</option>
            {tr(
              patterns
                ?.filter(
                  (p) =>
                    ["PUBLISHED", "DRAFT"].includes(p.status) &&
                    p.data.academic.subjectId === d.academic.subjectId,
                )
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {tr(p.data.title)}
                    {tr(" \xB7 ")}
                    {tr(p.data.versionLabel)} · {tr(p.status)}
                  </option>
                )),
            )}
          </select>
        </label>
      )}
      <div className="row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={!!d.premium}
            onChange={(e) => set("premium", e.target.checked)}
          />
          {tr("Study pass required")}
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={!!d.randomize}
            onChange={(e) => set("randomize", e.target.checked)}
          />
          {tr("Randomize question selection")}
        </label>
      </div>
      <div className="tabs">
        {tr(
          sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSection(i)}
              className={sectionIndex === i ? "active" : ""}
            >
              {tr(s.title)}
              {tr(" (")}
              {tr(s.questionIds.length)}
              {tr(")")}
            </button>
          )),
        )}
      </div>
      {chosen && (
        <div className="form-section">
          <div className="grid-two">
            <label>
              {tr("Section title")}
              <input
                value={chosen.title}
                onChange={(e) =>
                  section({
                    title: e.target.value,
                  })
                }
              />
            </label>
            <label>
              {tr("Section instructions")}
              <input
                value={chosen.instructions || ""}
                onChange={(e) =>
                  section({
                    instructions: e.target.value,
                  })
                }
              />
            </label>
          </div>
          <div className="grid-three">
            <label>
              {tr("Number of questions to draw (optional)")}
              <input
                type="number"
                min="1"
                value={chosen.drawCount ?? ""}
                onChange={(e) =>
                  section({
                    drawCount: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </label>
            <label>
              {tr("Maximum answers (internal choice)")}
              <input
                type="number"
                min="1"
                value={chosen.maxAnswers ?? ""}
                onChange={(e) =>
                  section({
                    maxAnswers: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </label>
            <label>
              {tr("Word limit (optional)")}
              <input
                type="number"
                min="1"
                value={chosen.wordLimit ?? ""}
                onChange={(e) =>
                  section({
                    wordLimit: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </label>
          </div>
          <label>
            {tr("When too many questions are answered")}
            <select
              value={chosen.choicePolicy || "LIMIT_ANSWERS"}
              onChange={(e) =>
                section({
                  choicePolicy: e.target.value,
                })
              }
            >
              <option value="LIMIT_ANSWERS">
                {tr("Prevent additional answers")}
              </option>
              <option value="FIRST_IN_PAPER">
                {tr("Score the first permitted answers in paper order")}
              </option>
            </select>
          </label>
          <h3>{tr("Choose published questions")}</h3>
          <Notice error>{tr(error)}</Notice>
          {tr(
            bank?.rows.map((q) => (
              <label className="question-checkbox" key={q._id}>
                <input
                  type="checkbox"
                  checked={chosen.questionIds.includes(q._id)}
                  onChange={() =>
                    section({
                      questionIds: chosen.questionIds.includes(q._id)
                        ? chosen.questionIds.filter((x) => x !== q._id)
                        : [...chosen.questionIds, q._id],
                    })
                  }
                />
                <span>
                  {tr(q.data.text)}
                  <small>
                    {tr(typeLabels[q.data.type])}
                    {tr(" \xB7 ")}
                    {tr(q.data.maximumMarks)}
                    {tr(" marks")}
                  </small>
                </span>
              </label>
            )),
          )}
          {bank?.rows.length === 0 && (
            <p className="muted">
              {tr(
                "No published questions for this subject. Review question drafts first.",
              )}
            </p>
          )}
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
              {bank?.total || 0}
              {tr(" questions")}
            </span>
            <button
              className="button ghost"
              disabled={page * 25 >= (bank?.total || 0)}
              onClick={() => setPage(page + 1)}
            >
              {tr("Next page")}
            </button>
          </div>
          <button
            className="button ghost"
            disabled={sections.length === 1 || d.mode === "BOARD"}
            onClick={() => {
              set(
                "sections",
                sections.filter((_, i) => i !== sectionIndex),
              );
              setSection(0);
            }}
          >
            {tr("Remove section")}
          </button>
        </div>
      )}
      <button
        className="button subtle"
        disabled={sections.length >= 10 || d.mode === "BOARD"}
        onClick={() =>
          set("sections", [
            ...sections,
            {
              id: `section-${Date.now()}`,
              title: "New section",
              instructions: "",
              questionIds: [],
            },
          ])
        }
      >
        {tr("Add section")}
      </button>
    </>
  );
}
