import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Timer,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Grid2X2,
  WifiOff,
  ArrowUpRight,
  Shield,
  BookOpen,
} from "lucide-react";
import { answerStatus, hasAnswer } from "@boardtestify/domain";
import { request } from "./api";
import { Notice, Empty, useLoad } from "./main";
export function Exam() {
  const { id } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState(null),
    [index, setIndex] = useState(0),
    [palette, setPalette] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [offline, setOffline] = useState(!navigator.onLine),
    [remaining, setRemaining] = useState(null),
    [confirm, setConfirm] = useState(false),
    [sending, setSending] = useState(false),
    [queueSize, setQueueSize] = useState(0),
    [conflict, setConflict] = useState(false),
    [bilingual, setBilingual] = useState(false);
  const aRef = useRef(null),
    queue = useRef({}),
    busy = useRef(false),
    clock = useRef({ server: 0, mono: 0 }),
    seq = useRef(0),
    conflicted = useRef(false),
    mounted = useRef(true);
  const cacheKey = `bt-attempt-${id}`,
    queueKey = `bt-queue-${id}`;
  const persist = useCallback(() => {
    localStorage.setItem(queueKey, JSON.stringify(queue.current));
    setQueueSize(Object.keys(queue.current).length);
  }, [queueKey]);
  const apply = useCallback(
    (data) => {
      aRef.current = data;
      setA({ ...data });
      clock.current = {
        server: Date.parse(data.serverNow),
        mono: performance.now(),
      };
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ ...data, cachedAt: Date.now() }),
      );
    },
    [cacheKey],
  );
  const flush = useCallback(async () => {
    if (busy.current || conflicted.current || !navigator.onLine) return false;
    busy.current = true;
    try {
      for (const [qid, snapshot] of Object.entries(queue.current)) {
        if (!aRef.current || aRef.current.status !== "ACTIVE") break;
        const result = await request(`/attempts/${id}/answer`, snapshot, "PUT");
        const current = queue.current[qid];
        aRef.current.answers[qid] = result.answer;
        clock.current = {
          server: Date.parse(result.serverNow),
          mono: performance.now(),
        };
        if (current?.generation === snapshot.generation)
          delete queue.current[qid];
        else if (current) current.version = result.answer.version;
        persist();
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            ...aRef.current,
            serverNow: result.serverNow,
            cachedAt: Date.now(),
          }),
        );
        if (mounted.current) setA({ ...aRef.current });
      }
      return Object.keys(queue.current).length === 0;
    } catch (e) {
      if (e.status === 409) {
        conflicted.current = true;
        setConflict(true);
        setError(
          "The server has a newer answer, or this attempt has ended. Your local changes are preserved. Reload the server version to continue.",
        );
      } else
        setMessage(
          navigator.onLine
            ? `Save failed: ${e.message}`
            : "Offline — answers saved on this device.",
        );
      return false;
    } finally {
      busy.current = false;
    }
  }, [id, persist, cacheKey]);
  useEffect(() => {
    mounted.current = true;
    try {
      queue.current = JSON.parse(localStorage.getItem(queueKey) || "{}");
      seq.current = Math.max(
        0,
        ...Object.values(queue.current).map((v) => v.generation),
      );
      persist();
    } catch {
      queue.current = {};
    }
    request(`/attempts/${id}`)
      .then((data) => {
        if (mounted.current) {
          apply(data);
          if (data.status !== "ACTIVE") nav(`/result/${id}`, { replace: true });
        }
      })
      .catch((e) => {
        const cache = localStorage.getItem(cacheKey);
        if (cache && !navigator.onLine) {
          const parsed = JSON.parse(cache);
          parsed.serverNow = new Date(
            Date.parse(parsed.serverNow) +
              Math.max(0, Date.now() - (parsed.cachedAt || Date.now())),
          ).toISOString();
          apply(parsed);
          setMessage(
            "Offline copy loaded. The server will verify the deadline when you reconnect.",
          );
        } else setError(e.message);
      });
    const online = () => {
      setOffline(false);
      void flush();
    };
    const off = () => setOffline(true);
    const unload = (e) => {
      if (Object.keys(queue.current).length) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", off);
    window.addEventListener("beforeunload", unload);
    return () => {
      mounted.current = false;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeunload", unload);
    };
  }, [id, apply, persist, flush, nav, cacheKey, queueKey]);
  useEffect(() => {
    if (!a) return;
    const save = setTimeout(() => void flush(), 700);
    return () => clearTimeout(save);
  }, [a, flush]);
  useEffect(() => {
    const autosave = setInterval(() => void flush(), 5000);
    const sync = setInterval(async () => {
      if (
        !navigator.onLine ||
        busy.current ||
        conflicted.current ||
        Object.keys(queue.current).length
      )
        return;
      try {
        const fresh = await request(`/attempts/${id}`);
        if (mounted.current) {
          apply(fresh);
          if (fresh.status !== "ACTIVE")
            nav(`/result/${id}`, { replace: true });
        }
      } catch {}
    }, 30000);
    const display = setInterval(() => {
      const current = aRef.current;
      if (!current?.deadline) return;
      const left = Math.max(
        0,
        Date.parse(current.deadline) -
          (clock.current.server + performance.now() - clock.current.mono),
      );
      setRemaining(left);
    }, 250);
    return () => {
      clearInterval(autosave);
      clearInterval(sync);
      clearInterval(display);
    };
  }, [id, flush, apply, nav]);
  useEffect(() => {
    if (
      remaining !== 0 ||
      !navigator.onLine ||
      !aRef.current ||
      aRef.current.status !== "ACTIVE"
    )
      return;
    setMessage(
      "Time is up. Finalizing the answers already saved on the server…",
    );
    request(`/attempts/${id}/submit`, {})
      .then(() => nav(`/result/${id}`, { replace: true }))
      .catch((e) => setError(e.message));
  }, [remaining, id, nav]);
  function change(value, review) {
    const current = aRef.current;
    if (!current || conflicted.current || remaining === 0) return;
    const q = current.questions[index];
    const local = queue.current[q._id] || current.answers[q._id];
    queue.current[q._id] = {
      questionId: q._id,
      version: local?.version ?? 0,
      value,
      review: review ?? local?.review ?? false,
      visited: true,
      generation: ++seq.current,
    };
    persist();
    setA({ ...current });
  }
  useEffect(() => {
    if (!a || a.status !== "ACTIVE") return;
    const q = a.questions[index];
    if (q && !queue.current[q._id] && !a.answers[q._id]?.visited)
      change(q.type.endsWith("CHOICE") ? [] : "");
  }, [index, a?.id]);
  async function submit() {
    setSending(true);
    setError("");
    try {
      const clean = await flush();
      if (!clean)
        throw Error(
          "Wait for all answers to save before submitting. Resolve any save conflict first.",
        );
      await request(`/attempts/${id}/submit`, {});
      localStorage.removeItem(queueKey);
      localStorage.removeItem(cacheKey);
      nav(`/result/${id}`, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }
  async function discard() {
    try {
      const fresh = await request(`/attempts/${id}`);
      queue.current = {};
      persist();
      conflicted.current = false;
      setConflict(false);
      setError("");
      apply(fresh);
      if (fresh.status !== "ACTIVE") nav(`/result/${id}`, { replace: true });
    } catch (e) {
      setError(e.message);
    }
  }
  if (!a)
    return (
      <div className="reset-wrap">
        <Link to="/app/tests">← Test library</Link>
        <Notice error>{error}</Notice>
        <p>Opening your saved attempt…</p>
      </div>
    );
  const q = a.questions[index],
    answer = queue.current[q._id] || a.answers[q._id],
    section = a.snapshot.sections.find((s) => s.id === q.sectionId);
  const count = a.questions.filter((q) =>
    hasAnswer((queue.current[q._id] || a.answers[q._id])?.value),
  ).length;
  const secs = remaining === null ? null : Math.ceil(remaining / 1000);
  const time =
    secs === null
      ? "Untimed"
      : `${Math.floor(secs / 3600)
          .toString()
          .padStart(2, "0")}:${Math.floor((secs % 3600) / 60)
          .toString()
          .padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;
  return (
    <div className="exam-shell">
      <header className="exam-header">
        <Link to="/app/attempts" className="exam-brand">
          <span className="logo-icon">
            B<span>✓</span>
          </span>
          <div>
            <strong>BoardTestify</strong>
            <small>{a.snapshot.title}</small>
          </div>
        </Link>
        <div className="row">
          <span
            className={`timer ${remaining !== null && remaining < 60000 ? "urgent" : ""}`}
          >
            <Timer size={19} />
            {time}
          </span>
          <button className="button primary" onClick={() => setConfirm(true)}>
            Submit test <ArrowUpRight size={16} />
          </button>
        </div>
      </header>
      <div className="exam-subbar">
        <span>
          <Shield size={14} /> Exam time is verified by the server
        </span>
        <span className={queueSize ? "accent" : "saved"}>
          {offline ? (
            <>
              <WifiOff size={14} /> Offline · {queueSize} pending
            </>
          ) : queueSize ? (
            `${queueSize} answer update(s) pending`
          ) : (
            <>
              <Check size={14} /> All answers saved
            </>
          )}
        </span>
      </div>
      <div className="exam-layout">
        <main className="exam-question">
          <div className="section-tabs">
            {a.snapshot.sections.map((s) => (
              <button
                className={s.id === q.sectionId ? "active" : ""}
                key={s.id}
                onClick={() =>
                  setIndex(a.questions.findIndex((q) => q.sectionId === s.id))
                }
              >
                {s.title}
              </button>
            ))}
          </div>
          <Notice error>{error}</Notice>
          <Notice>{message}</Notice>
          {conflict && (
            <button onClick={discard} className="button danger">
              Discard local changes and reload saved answers
            </button>
          )}
          <div className="question-top">
            <span className="eyebrow">
              QUESTION {String(index + 1).padStart(2, "0")} OF{" "}
              {a.questions.length}
            </span>
            <div className="row">
              <span className="tag">
                +{q.maximumMarks} / −{q.negativeMarks}
              </span>
              <button
                className="icon-button"
                aria-label="Show bilingual text"
                onClick={() => setBilingual(!bilingual)}
              >
                EN / हिं
              </button>
              <button
                aria-label="Toggle question palette"
                className="icon-button mobile-only"
                onClick={() => setPalette(!palette)}
              >
                <Grid2X2 size={18} />
              </button>
            </div>
          </div>
          {section.instructions && (
            <p className="section-instructions">
              {section.instructions}
              {section.maxAnswers
                ? ` · Attempt up to ${section.maxAnswers} questions.`
                : ""}
            </p>
          )}
          <h2 className="question-text">{q.text}</h2>
          {bilingual && q.translation && (
            <p className="question-text translation">{q.translation}</p>
          )}
          {q.imageKey && <QuestionImage imageKey={q.imageKey} attemptId={id} />}
          <fieldset
            className="answer-field"
            disabled={conflict || remaining === 0}
          >
            <legend className="sr-only">Your answer</legend>
            {q.type.endsWith("CHOICE") ? (
              <div className="options">
                {q.options.map((o, i) => {
                  const values = Array.isArray(answer?.value)
                    ? answer.value
                    : [];
                  return (
                    <label
                      className={`option ${values.includes(o.id) ? "chosen" : ""}`}
                      key={o.id}
                    >
                      <input
                        type={q.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                        name={q._id}
                        checked={values.includes(o.id)}
                        onChange={() =>
                          change(
                            q.type === "SINGLE_CHOICE"
                              ? [o.id]
                              : values.includes(o.id)
                                ? values.filter((v) => v !== o.id)
                                : [...values, o.id],
                          )
                        }
                      />
                      <span className="option-letter">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span>{o.text}</span>
                      {values.includes(o.id) && <Check size={18} />}
                    </label>
                  );
                })}
              </div>
            ) : (
              <>
                <label className="answer-label">
                  {q.type === "NUMERICAL"
                    ? "Your numerical answer"
                    : "Write your answer in Hindi or English"}
                  <textarea
                    rows={q.type === "LONG_ANSWER" ? 12 : 7}
                    value={
                      typeof answer?.value === "string" ? answer.value : ""
                    }
                    onChange={(e) => change(e.target.value)}
                    placeholder="Start your answer here…"
                    maxLength={20000}
                  />
                </label>
                <span className="small muted">
                  {typeof answer?.value === "string"
                    ? answer.value.trim().split(/\s+/u).filter(Boolean).length
                    : 0}{" "}
                  words{q.wordLimit ? ` / ${q.wordLimit} word limit` : ""} ·
                  Changes autosave
                </span>
              </>
            )}
          </fieldset>
          <div className="exam-controls">
            <button
              className="button ghost"
              onClick={() => change(q.type.endsWith("CHOICE") ? [] : "")}
            >
              Clear response
            </button>
            <button
              className={`button ${answer?.review ? "review-active" : "ghost"}`}
              onClick={() =>
                change(
                  answer?.value || (q.type.endsWith("CHOICE") ? [] : ""),
                  !answer?.review,
                )
              }
            >
              <Flag size={16} />{" "}
              {answer?.review ? "Unmark review" : "Mark for review"}
            </button>
            <div className="row">
              <button
                className="button subtle"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                <ChevronLeft size={17} /> Previous
              </button>
              <button
                className="button primary"
                onClick={async () => {
                  await flush();
                  if (index < a.questions.length - 1) setIndex(index + 1);
                  else setConfirm(true);
                }}
              >
                Save & next <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </main>
        <aside className={`exam-palette ${palette ? "visible" : ""}`}>
          <div className="palette-heading">
            <span className="list-icon">
              <BookOpen size={20} />
            </span>
            <div>
              <strong>Question navigator</strong>
              <small>
                {count} / {a.questions.length} answered
              </small>
            </div>
          </div>
          <div className="palette-grid">
            {a.questions.map((q, i) => (
              <button
                aria-label={`Question ${i + 1}: ${answerStatus(queue.current[q._id] || a.answers[q._id])}`}
                className={`${answerStatus(queue.current[q._id] || a.answers[q._id])} ${index === i ? "current" : ""}`}
                key={q._id}
                onClick={() => {
                  setIndex(i);
                  setPalette(false);
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="legend">
            {[
              ["NOT_VISITED", "Not visited"],
              ["NOT_ANSWERED", "Not answered"],
              ["ANSWERED", "Answered"],
              ["MARKED_FOR_REVIEW", "Marked for review"],
              ["ANSWERED_AND_MARKED_FOR_REVIEW", "Answered & marked"],
            ].map(([c, t]) => (
              <span key={c}>
                <i className={c} />
                {t}
              </span>
            ))}
          </div>
          <div className="palette-note">
            <Shield size={18} />
            <p>
              Keep this tab open while answers are saving. Your timer continues
              if you leave.
            </p>
          </div>
        </aside>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            className="modal"
          >
            <span className="eyebrow">READY TO FINISH?</span>
            <h2 id="submit-title">Submit your test?</h2>
            <p>
              {count} answered · {a.questions.length - count} unanswered.
              Submitted answers cannot be changed.
            </p>
            <p className="small muted">
              Marked-for-review answers are also included in your score.
            </p>
            <Notice error>{error}</Notice>
            <div className="row">
              <button
                className="button ghost"
                disabled={sending}
                onClick={() => setConfirm(false)}
              >
                Keep reviewing
              </button>
              <button
                className="button primary"
                disabled={sending || conflict}
                onClick={submit}
              >
                {sending ? "Submitting…" : "Submit test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function QuestionImage({ imageKey, attemptId }) {
  const { data, error } = useLoad(
    `/attempts/${attemptId}/image?key=${encodeURIComponent(imageKey)}`,
  );
  return data ? (
    <img className="question-image" src={data.url} alt="Question diagram" />
  ) : (
    <Notice error>{error}</Notice>
  );
}
export function Result() {
  const { id } = useParams();
  const { data: r, error, reload } = useLoad(`/attempts/${id}/result`);
  useEffect(() => {
    if (!r?.provisional) return;
    const t = setInterval(reload, 10000);
    return () => clearInterval(t);
  }, [r?.provisional]);
  return (
    <div className="result-wrap">
      <Link className="muted small" to="/app/attempts">
        ← Back to my attempts
      </Link>
      <Notice error>{error}</Notice>
      {r ? (
        <>
          <div className="result-hero">
            <span className="eyebrow">ANOTHER STEP FORWARD</span>
            <h1>{r.title}</h1>
            <span className="tag">
              {r.provisional
                ? "Provisional · evaluation in progress"
                : "Final result"}
            </span>
            <div className="result-score">
              {r.awardedMarks}
              <span>/ {r.maximumMarks}</span>
            </div>
            <p>
              {r.provisional
                ? "Descriptive answers awaiting AI or manual review are excluded from this score."
                : "Review your answers and use the feedback for your next attempt."}
            </p>
            <Link className="button primary" to="/app/tests">
              Keep practicing <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="result-answers">
            {r.questions.map((q, i) => {
              const e = r.evaluations[q._id],
                a = r.answers[q._id];
              return (
                <article className="panel" key={q._id}>
                  <div className="row between">
                    <span className="eyebrow">
                      QUESTION {i + 1} · {q.type.replaceAll("_", " ")}
                    </span>
                    <span className="tag">
                      {e?.status === "EVALUATED"
                        ? `${e.awardedMarks} / ${q.maximumMarks}`
                        : "Awaiting review"}
                    </span>
                  </div>
                  <h3>{q.text}</h3>
                  <div className="answer-block">
                    <small className="muted">YOUR ANSWER</small>
                    <p>
                      {Array.isArray(a?.value)
                        ? a.value
                            .map(
                              (v) =>
                                q.options.find((o) => o.id === v)?.text || v,
                            )
                            .join(", ")
                        : a?.value || "Unanswered"}
                    </p>
                  </div>
                  {q.correct.length > 0 && (
                    <p className="saved">
                      Correct answer:{" "}
                      {q.correct
                        .map(
                          (v) => q.options.find((o) => o.id === v)?.text || v,
                        )
                        .join(", ")}
                    </p>
                  )}
                  {q.referenceAnswer && (
                    <div className="answer-block">
                      <small className="muted">REFERENCE ANSWER</small>
                      <p>{q.referenceAnswer}</p>
                    </div>
                  )}
                  {q.explanation && <p className="muted">{q.explanation}</p>}
                  {e?.criteria?.map((c) => (
                    <div className="criterion" key={c.id}>
                      <strong>
                        {q.rubric.find((r) => r.id === c.id)?.name}{" "}
                        <span className="accent">{c.awardedMarks}</span>
                      </strong>
                      <p>{c.feedback}</p>
                    </div>
                  ))}
                  {e?.status === "REVIEW" && (
                    <Notice>
                      This answer requires manual review before marks are
                      finalized.
                    </Notice>
                  )}
                  {[
                    "strengths",
                    "missingPoints",
                    "errors",
                    "improvementAdvice",
                  ].map((key) =>
                    e?.[key]?.length ? (
                      <div key={key}>
                        <h4>
                          {
                            {
                              strengths: "Strengths",
                              missingPoints: "Missing points",
                              errors: "Corrections",
                              improvementAdvice: "For next time",
                            }[key]
                          }
                        </h4>
                        <ul>
                          {e[key].map((s, j) => (
                            <li key={j}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <Empty
          title="Loading your result…"
          detail="Your evaluation is saved with your attempt."
        />
      )}
    </div>
  );
}
