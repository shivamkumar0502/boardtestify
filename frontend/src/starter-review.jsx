import { useState, useEffect, useRef } from "react";
import { tr, useLanguage } from "@boardtestify/i18n";
import { useLoad, Notice } from "./main";
import { request } from "./api";
export function StarterReview({
  onPublished,
  onClose,
  packId = "class10-starter",
}) {
  useLanguage();
  const panel = useRef(null);
  const { data, error, reload } = useLoad(
    `/admin/practice-packs/${encodeURIComponent(packId)}/review`,
  );
  const [selected, setSelected] = useState(""),
    [limit, setLimit] = useState(20),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [err, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (data)
      panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data?.reviewToken]);
  const test = data?.tests.find((t) => t._id === selected) || data?.tests[0];
  const ids = test?.data.sections.flatMap((s) => s.questionIds) || [];
  const byId = new Map(data?.questions.map((q) => [q._id, q]) || []);
  const rows = ids.map((id) => byId.get(id)).filter(Boolean);
  const layout = data?.patterns.find((p) => p._id === test?.data.patternId);
  async function publish() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(
        `/admin/practice-packs/${encodeURIComponent(packId)}/publish`,
        {
          testId: test._id,
          reviewToken: data.reviewToken,
          confirmed: true,
        },
      );
      setMessage("Published. Students can now start this test.");
      setConfirmed(false);
      reload();
      onPublished();
    } catch (e) {
      setError(e.message);
      reload();
      setConfirmed(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      ref={panel}
      className="panel starter-review"
      aria-label={tr("Review starter tests")}
    >
      <div className="row between">
        <h2>{tr("Review questions, then publish")}</h2>
        <button className="button ghost" onClick={onClose}>
          {tr("Close review")}
        </button>
      </div>
      <p>
        {tr(
          "Original foundation questions with suggested keys and marking rubrics. Review each test before student publication. Full mocks use a 2026 reference layout and separate theory marks from practical/internal assessment. They do not establish complete syllabus coverage.",
        )}
      </p>
      <Notice error>{error || err}</Notice>
      <Notice>{message}</Notice>
      <div className="tabs starter-test-tabs">
        {data?.tests.map((t) => (
          <button
            key={t._id}
            className={test?._id === t._id ? "active" : ""}
            onClick={() => {
              setSelected(t._id);
              setLimit(20);
              setConfirmed(false);
              setMessage("");
            }}
          >
            {t.data.title} ·{" "}
            {t.status === "PUBLISHED" ? tr("Published") : tr("Draft")}
          </button>
        ))}
      </div>
      {test && (
        <>
          <h3>{test.data.title}</h3>
          <p className="small muted">
            {rows.length} {tr("questions")} · {test.data.durationMinutes}{" "}
            {tr("min")} · {test.data.academic.session}
          </p>
          {layout && (
            <div className="notice">
              <strong>
                {tr(
                  "Full mock: {0} theory marks · {1} min total · {2} min reading",
                  [
                    layout.data.totalMarks,
                    layout.data.durationMinutes,
                    layout.data.readingMinutes,
                  ],
                )}
              </strong>
              <p>
                {layout.data.sections
                  .map(
                    (s) =>
                      `${s.title}: ${s.answerCount}/${s.offered} × ${s.marksEach}`,
                  )
                  .join(" · ")}
              </p>
              <a
                href={layout.data.officialSource}
                target="_blank"
                rel="noreferrer"
              >
                {tr("Read official model paper")}
              </a>
              <p>
                {tr(
                  "Publishing this mock also approves the displayed source-linked reference layout. Your own edited content requires a different administrator.",
                )}
              </p>
            </div>
          )}
          {rows.slice(0, limit).map((q, i) => (
            <article className="starter-question" key={q._id}>
              <span className="tag">
                {tr("Question {0}", [i + 1])} · {q.data.maximumMarks}{" "}
                {tr("marks")}
              </span>
              <h4>{q.data.text}</h4>
              {q.data.translation && <p>{q.data.translation}</p>}
              {q.data.options?.map((o) => (
                <p
                  className={q.data.correct.includes(o.id) ? "accent" : ""}
                  key={o.id}
                >
                  {o.id.toUpperCase()}) {o.text}
                  {q.data.correct.includes(o.id) ? " ✓" : ""}
                </p>
              ))}
              <details>
                <summary>{tr("Answer explanation and marking")}</summary>
                <p>{q.data.referenceAnswer || q.data.explanation}</p>
                {q.data.rubric?.map((r) => (
                  <p key={r.id}>
                    {r.name} · {r.maximumMarks}
                  </p>
                ))}
              </details>
            </article>
          ))}
          {limit < rows.length && (
            <button
              className="button subtle"
              onClick={() => setLimit((n) => n + 20)}
            >
              {tr("Show next questions for review")}
            </button>
          )}
          {test.status !== "PUBLISHED" ? (
            <>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={limit < rows.length || busy}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                {tr(
                  "I reviewed all questions, answer keys and marking shown for this test.",
                )}
              </label>
              {limit < rows.length && (
                <p className="small muted">
                  {tr("Open all questions before confirming the review.")}
                </p>
              )}
              <button
                className="button primary"
                disabled={!confirmed || busy}
                onClick={publish}
              >
                {busy
                  ? tr("Publishing…")
                  : tr("Publish this test for students")}
              </button>
            </>
          ) : (
            <Notice>
              {tr(
                "This test is published and available in the student's matching subject series.",
              )}
            </Notice>
          )}
        </>
      )}
    </section>
  );
}
