import { useEffect, useRef, useState } from "react";
import { tr, useLanguage } from "@boardtestify/i18n";
import { questionSchema } from "@boardtestify/domain";
import { AcademicPicker, QuestionForm } from "./authoring";
import { useLoad, Notice } from "./main";
import { request, uploadFile } from "./api";
const template = "1. What is 2 + 2?\nA) 3\nB) 4\nC) 5\nD) 6\nAnswer: B";
export function QuestionImport({ onSaved, onCSV, initialJobId = "" }) {
  useLanguage();
  const features = useLoad("/features"),
    history = useLoad("/admin/question-imports");
  const [method, setMethod] = useState("TEXT"),
    [academic, setAcademic] = useState({
      session: "2026-27",
      classLevel: "10",
      stream: "GENERAL",
      subjectId: "",
    }),
    [language, setLanguage] = useState("en"),
    [sourceTitle, setSource] = useState(""),
    [text, setText] = useState(template),
    [file, setFile] = useState(null);
  const [jobId, setJobId] = useState(initialJobId),
    [job, setJob] = useState(null),
    [questions, setQuestions] = useState([]),
    [index, setIndex] = useState(0),
    [title, setTitle] = useState("Imported practice test"),
    [duration, setDuration] = useState(15),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [advancedQuestion, setAdvancedQuestion] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const loaded = useRef("");
  useEffect(() => setAdvancedQuestion(false), [index, jobId]);
  function editQuestion(patch) {
    setQuestions((old) =>
      old.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }
  useEffect(() => {
    let active = true,
      timer;
    loaded.current = "";
    setJob(null);
    setQuestions([]);
    setIndex(0);
    if (!jobId) return;
    async function poll() {
      try {
        const d = await request(`/admin/question-imports/${jobId}`);
        if (!active) return;
        setJob(d);
        if (loaded.current !== jobId) {
          setAcademic(d.input.academic);
          setLanguage(d.input.language);
          setSource(d.input.sourceTitle);
          if (d.input.text) setText(d.input.text);
          if (d.status === "READY" || d.status === "SAVED") {
            setQuestions(d.reviewed?.questions || d.result?.questions || []);
            if (d.reviewed) {
              setTitle(d.reviewed.title);
              setDuration(d.reviewed.durationMinutes);
            } else {
              setTitle(`${d.input.sourceTitle} · Practice test`.slice(0, 150));
              setDuration(15);
            }
            if ((d.reviewed?.questions || d.result?.questions || []).length)
              setShowSource(false);
            history.reload();
            loaded.current = jobId;
          }
        }
        if (["PENDING", "PROCESSING"].includes(d.status))
          timer = setTimeout(poll, 2000);
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId, refresh]);
  async function extract() {
    setError("");
    setMessage("");
    if (!/^[a-f0-9]{24}$/i.test(academic.subjectId)) {
      setError("Choose a subject before saving.");
      return;
    }
    if (sourceTitle.trim().length < 2) {
      setError("Enter the book or source name.");
      return;
    }
    if (method === "PHOTO" && !file) {
      setError("Choose a photo");
      return;
    }
    if (file && method === "PHOTO" && file.size > 5000000) {
      setError("Photo must be smaller than 5 MB");
      return;
    }
    setBusy(true);
    try {
      const meta = { academic, language, sourceTitle };
      const d =
        method === "PHOTO"
          ? await uploadFile("/admin/question-imports/photo", file, {
              meta: JSON.stringify(meta),
            })
          : await request("/admin/question-imports/text", { ...meta, text });
      setJobId(d.id);
      setRefresh((v) => v + 1);
      history.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    setBusy(true);
    try {
      await request(`/admin/question-imports/${jobId}/retry`, {});
      setRefresh((v) => v + 1);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setError("");
    if (!job.commitPending)
      for (const [i, q] of questions.entries()) {
        const parsed = questionSchema.safeParse(q);
        if (!parsed.success) {
          setError(`Question ${i + 1}: ${parsed.error.issues[0].message}`);
          setIndex(i);
          return;
        }
      }
    setBusy(true);
    try {
      const d = await request(`/admin/question-imports/${jobId}/commit`, {
        title,
        durationMinutes: duration,
        questions,
      });
      setJob({ ...job, status: "SAVED", savedTestId: d.testId });
      setMessage(
        "Saved as draft. Review and publish the questions before publishing the test.",
      );
      history.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!showSource && (
        <button className="button subtle" onClick={() => setShowSource(true)}>
          {tr("New import / edit source")}
        </button>
      )}
      <div
        className="panel"
        style={{ display: showSource ? undefined : "none" }}
      >
        <span className="eyebrow">{tr("PHOTO → REVIEW → DRAFT TEST")}</span>
        <h2>{tr("Add questions the simple way")}</h2>
        <p className="muted">
          {tr(
            "Upload a clear book-page photo or paste questions. Check the result before saving. Nothing is published automatically.",
          )}
        </p>
        <div className="tabs">
          <button
            className={method === "TEXT" ? "active" : ""}
            onClick={() => setMethod("TEXT")}
          >
            {tr("Paste questions")}
          </button>
          <button
            className={method === "PHOTO" ? "active" : ""}
            onClick={() => setMethod("PHOTO")}
          >
            {tr("Book photo")}
          </button>
          <button onClick={onCSV}>{tr("CSV / Excel")}</button>
        </div>
        <AcademicPicker value={academic} onChange={setAcademic} />
        <div className="grid-two">
          <label>
            {tr("Source / book name")}
            <input
              value={sourceTitle}
              onChange={(e) => setSource(e.target.value)}
              maxLength={300}
            />
          </label>
          <label>
            {tr("Question language")}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </label>
        </div>
        {method === "PHOTO" ? (
          <>
            <p className="small muted">
              {tr(
                "JPEG, PNG or WebP · up to 5 MB · crop to at most ten questions. Diagrams need a separate cropped question image.",
              )}
            </p>
            <input
              aria-label={tr("Book page photo")}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {!features.data?.questionPhotoImport && (
              <Notice>
                {tr(
                  "Photo extraction needs private storage plus OCR or vision AI. Pasted questions work without AI keys.",
                )}
              </Notice>
            )}
          </>
        ) : (
          <label>
            {tr("Paste question text")}
            <textarea
              className="paste-question-text"
              value={text}
              maxLength={20000}
              onChange={(e) => setText(e.target.value)}
            />
            <small className="muted">
              {tr(
                "Use 1. question, then A), B), C), D) on separate lines. Answer: B is optional; missing keys must be filled during review.",
              )}
            </small>
          </label>
        )}
        <button
          className="button primary"
          disabled={
            busy || (method === "PHOTO" && !features.data?.questionPhotoImport)
          }
          onClick={extract}
        >
          {busy ? tr("Working…") : tr("Extract questions")}
        </button>
      </div>
      <Notice error>{error || job?.error}</Notice>
      <Notice>{message}</Notice>
      {job && (
        <section className="panel">
          <h2>{tr("Review extracted questions")}</h2>
          <p className="muted small">{job.input?.sourceTitle}</p>
          <span className="tag">{tr(job.status)}</span>
          {["PENDING", "PROCESSING"].includes(job.status) && (
            <p role="status">
              {tr(
                "Your import is queued or processing. You can leave this page and open it from recent imports.",
              )}
            </p>
          )}
          {job.sourceURL && (
            <details>
              <summary>{tr("View source photo")}</summary>
              <img
                className="source-photo-preview"
                src={job.sourceURL}
                alt={tr("Uploaded book page")}
              />
            </details>
          )}
          {job.result?.warnings?.map((warning, i) => (
            <Notice key={i}>{tr(warning)}</Notice>
          ))}
          {job.result?.ocrText && (
            <details>
              <summary>{tr("Extracted source text")}</summary>
              <pre className="source-ocr-text">{job.result.ocrText}</pre>
              <button
                className="button subtle"
                onClick={() => {
                  setText(job.result.ocrText);
                  setMethod("TEXT");
                }}
              >
                {tr("Use this text in paste mode")}
              </button>
            </details>
          )}
          {job.status === "FAILED" && job.canEdit && (
            <button className="button subtle" disabled={busy} onClick={retry}>
              {tr("Retry extraction")}
            </button>
          )}
          {job.status === "READY" && job.canEdit && questions.length > 0 && (
            <>
              <div className="grid-two">
                <label>
                  {tr("Test title")}
                  <input
                    value={title}
                    maxLength={150}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  {tr("Duration (minutes)")}
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="tabs">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    className={index === i ? "active" : ""}
                    onClick={() => setIndex(i)}
                  >
                    {tr("Question {0}", [i + 1])}
                  </button>
                ))}
              </div>
              {job.commitPending && (
                <Notice>
                  {tr(
                    "A save was interrupted. Finish saving the previously reviewed version; edits are frozen.",
                  )}
                </Notice>
              )}
              <fieldset
                disabled={busy || job.commitPending}
                className="import-question-editor"
              >
                {advancedQuestion ||
                !questions[index].type.endsWith("CHOICE") ||
                questions[index].requiresDiagram ? (
                  <QuestionForm
                    hideAcademic
                    value={questions[index]}
                    onChange={(q) =>
                      setQuestions((old) =>
                        old.map((v, i) => (i === index ? q : v)),
                      )
                    }
                  />
                ) : (
                  <div className="authoring-form">
                    <label>
                      {tr("Question text")}
                      <textarea
                        rows={4}
                        value={questions[index].text}
                        onChange={(e) => editQuestion({ text: e.target.value })}
                      />
                    </label>
                    <h3>{tr("Answer options")}</h3>
                    {(questions[index].options || []).map((option, i) => (
                      <label key={option.id}>
                        {tr("Option {0}", [i + 1])}
                        <input
                          value={option.text}
                          onChange={(e) =>
                            editQuestion({
                              options: questions[index].options.map((o) =>
                                o.id === option.id
                                  ? { ...o, text: e.target.value }
                                  : o,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                    {(questions[index].options?.length || 0) < 4 && (
                      <button
                        className="button subtle"
                        onClick={() => {
                          const id = [..."abcd"].find(
                            (v) =>
                              !questions[index].options.some((o) => o.id === v),
                          );
                          editQuestion({
                            options: [
                              ...questions[index].options,
                              { id, text: "" },
                            ],
                          });
                        }}
                      >
                        {tr("Add option")}
                      </button>
                    )}
                    {questions[index].type === "SINGLE_CHOICE" ? (
                      <label>
                        {tr("Correct answer")}
                        <select
                          value={questions[index].correct?.[0] || ""}
                          onChange={(e) =>
                            editQuestion({
                              correct: e.target.value ? [e.target.value] : [],
                            })
                          }
                        >
                          <option value="">
                            {tr("Choose the correct option")}
                          </option>
                          {questions[index].options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.id.toUpperCase()}: {o.text}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      questions[index].options.map((o, i) => (
                        <label className="checkbox-label" key={o.id}>
                          <input
                            type="checkbox"
                            checked={questions[index].correct.includes(o.id)}
                            onChange={(e) =>
                              editQuestion({
                                correct: e.target.checked
                                  ? [...questions[index].correct, o.id]
                                  : questions[index].correct.filter(
                                      (v) => v !== o.id,
                                    ),
                              })
                            }
                          />
                          {tr("Correct option {0}", [i + 1])}
                        </label>
                      ))
                    )}
                    <label>
                      {tr("Maximum marks")}
                      <input
                        type="number"
                        min={0.25}
                        max={100}
                        step={0.25}
                        value={questions[index].maximumMarks}
                        onChange={(e) =>
                          editQuestion({ maximumMarks: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                )}
                {questions[index].type.endsWith("CHOICE") &&
                  !questions[index].requiresDiagram && (
                    <button
                      className="button ghost"
                      onClick={() => setAdvancedQuestion((v) => !v)}
                    >
                      {advancedQuestion
                        ? tr("Simple editor")
                        : tr("More fields: images, translations and rubrics")}
                    </button>
                  )}
              </fieldset>
              <button className="button primary" disabled={busy} onClick={save}>
                {tr("Save draft test")}
              </button>
            </>
          )}
          {job.status === "SAVED" && (
            <button className="button primary" onClick={onSaved}>
              {tr("Open test drafts")}
            </button>
          )}
        </section>
      )}
      <section className="panel">
        <h3>{tr("Recent imports")}</h3>
        <Notice error>{history.error}</Notice>
        {history.data?.map((r) => (
          <button
            key={r._id}
            className="button ghost import-history-row"
            onClick={() => {
              setJobId(r._id);
              setRefresh((v) => v + 1);
              setError("");
            }}
          >
            {r.input?.sourceTitle} · {tr(r.status)}
          </button>
        ))}
      </section>
    </>
  );
}
