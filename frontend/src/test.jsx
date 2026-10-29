import { tr, useLanguage } from "@boardtestify/i18n";
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
import {
  answerStatus,
  hasAnswer,
  answerPresent,
  isDescriptive,
} from "@boardtestify/domain";
import { request, uploadFile } from "./api";
import { Notice, Empty, useLoad } from "./main";
export function Exam() {
  useLanguage();
  const { id } = useParams();
  const features = useLoad("/features");
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
  const [uploading, setUploading] = useState(false),
    [readingLeft, setReadingLeft] = useState(0);
  const aRef = useRef(null),
    queue = useRef({}),
    busy = useRef(false),
    clock = useRef({
      server: 0,
      mono: 0,
    }),
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
      setA({
        ...data,
      });
      clock.current = {
        server: Date.parse(data.serverNow),
        mono: performance.now(),
      };
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          ...data,
          cachedAt: Date.now(),
        }),
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
        if (result.feedback)
          aRef.current.feedback = {
            ...(aRef.current.feedback || {}),
            [qid]: result.feedback,
          };
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
        if (mounted.current)
          setA({
            ...aRef.current,
          });
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
          if (data.status !== "ACTIVE")
            nav(`/result/${id}`, {
              replace: true,
            });
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
            nav(`/result/${id}`, {
              replace: true,
            });
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
      setReadingLeft(
        current.readUntil
          ? Math.max(
              0,
              Date.parse(current.readUntil) -
                (clock.current.server + performance.now() - clock.current.mono),
            )
          : 0,
      );
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
      .then(() =>
        nav(`/result/${id}`, {
          replace: true,
        }),
      )
      .catch((e) => setError(e.message));
  }, [remaining, id, nav]);
  function change(value, review, attachmentIds) {
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
      attachmentIds: attachmentIds ?? local?.attachmentIds ?? [],
    };
    persist();
    setA({
      ...current,
    });
  }
  async function uploadSheet(file) {
    const target = aRef.current.questions[index];
    if (!target || !isDescriptive(target.type)) {
      setError("Photos can only be attached to short or long answer questions.");
      return;
    }
    if (readingLeft > 0) {
      setError("You can upload answers after the reading period ends.");
      return;
    }
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      setError("Choose an image or PDF answer sheet.");
      return;
    }
    if (isPdf && !features.data?.pdfSheets) {
      setError("PDF uploads are currently unavailable. Please upload photos instead.");
      return;
    }
    if (isImage && file.size > 5_000_000) {
      setError("Each photo must be smaller than 5 MB.");
      return;
    }
    if (isPdf && file.size > 10_000_000) {
      setError("PDF must be smaller than 10 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadFile(`/attempts/${id}/sheets`, file, {
        questionId: target._id,
        maxPages:
          4 -
          ((queue.current[target._id] || aRef.current.answers[target._id])
            ?.attachmentIds?.length || 0),
      });
      const local =
        queue.current[target._id] || aRef.current.answers[target._id];
      queue.current[target._id] = {
        questionId: target._id,
        version: local?.version ?? 0,
        value: local?.value || "",
        review: local?.review ?? false,
        visited: true,
        attachmentIds: [
          ...(local?.attachmentIds || []),
          ...(uploaded.pages || [uploaded]).map((page) => page.id),
        ],
        generation: ++seq.current,
      };
      persist();
      setA({
        ...aRef.current,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
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
      nav(`/result/${id}`, {
        replace: true,
      });
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
      if (fresh.status !== "ACTIVE")
        nav(`/result/${id}`, {
          replace: true,
        });
    } catch (e) {
      setError(e.message);
    }
  }
  if (!a)
    return (
      <div className="reset-wrap">
        <Link to="/app/tests">{tr("\u2190 Test library")}</Link>
        <Notice error>{tr(error)}</Notice>
        <p>{tr("Opening your saved attempt\u2026")}</p>
      </div>
    );
  const q = a.questions[index],
    answer = queue.current[q._id] || a.answers[q._id],
    section = a.snapshot.sections.find((s) => s.id === q.sectionId);
  const count = a.questions.filter((q) =>
    answerPresent(queue.current[q._id] || a.answers[q._id]),
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
            {tr("B")}
            <span>{tr("\u2713")}</span>
          </span>
          <div>
            <strong>{tr("BoardTestify")}</strong>
            <small>{tr(a.snapshot.title)}</small>
          </div>
        </Link>
        <div className="row">
          <span
            className={`timer ${remaining !== null && remaining < 60000 ? "urgent" : ""}`}
          >
            <Timer size={19} />
            {tr(time)}
          </span>
          <button className="button primary" onClick={() => setConfirm(true)}>
            {tr("Submit test ")}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </header>
      <div className="exam-subbar">
        <span>
          <Shield size={14} />
          {tr(" Exam time is verified by the server")}
        </span>
        <span className={queueSize ? "accent" : "saved"}>
          {offline ? (
            <>
              <WifiOff size={14} />
              {tr(" Offline \xB7 ")}
              {tr(queueSize)}
              {tr(" pending")}
            </>
          ) : queueSize ? (
            tr("{0} answer update(s) pending", [queueSize])
          ) : (
            <>
              <Check size={14} />
              {tr(" All answers saved")}
            </>
          )}
        </span>
      </div>
      <div className="exam-layout">
        <main className="exam-question">
          <div className="section-tabs">
            {tr(
              a.snapshot.sections.map((s) => (
                <button
                  className={s.id === q.sectionId ? "active" : ""}
                  key={s.id}
                  onClick={() =>
                    setIndex(a.questions.findIndex((q) => q.sectionId === s.id))
                  }
                >
                  {tr(s.title)}
                </button>
              )),
            )}
          </div>
          <Notice error>{tr(error)}</Notice>
          <Notice>{tr(message)}</Notice>
          {readingLeft > 0 && (
            <Notice>
              {tr("Reading time: ")}
              {tr(Math.ceil(readingLeft / 60000))}
              {tr(
                " minute(s) remaining. Answers unlock after the reading period.",
              )}
            </Notice>
          )}
          {conflict && (
            <button onClick={discard} className="button danger">
              {tr("Discard local changes and reload saved answers")}
            </button>
          )}
          <div className="question-top">
            <span className="eyebrow">
              {tr("QUESTION ")}
              {tr(String(index + 1).padStart(2, "0"))}
              {tr(" OF")}
              {tr(" ")}
              {tr(a.questions.length)}
            </span>
            <div className="row">
              <span className="tag">
                {tr("+")}
                {tr(q.maximumMarks)}
                {tr(" / \u2212")}
                {tr(q.negativeMarks)}
              </span>
              <button
                className="icon-button"
                aria-label={tr("Show bilingual text")}
                onClick={() => setBilingual(!bilingual)}
              >
                {tr("EN / \u0939\u093F\u0902")}
              </button>
              <button
                aria-label={tr("Toggle question palette")}
                className="icon-button mobile-only"
                onClick={() => setPalette(!palette)}
              >
                <Grid2X2 size={18} />
              </button>
            </div>
          </div>
          {section.instructions && (
            <p className="section-instructions">
              {tr(section.instructions)}
              {section.maxAnswers
                ? tr(" \xB7 Attempt up to {0} questions.", [section.maxAnswers])
                : tr("")}
            </p>
          )}
          <h2 className="question-text">{tr(q.text)}</h2>
          {bilingual && q.translation && (
            <p className="question-text translation">{tr(q.translation)}</p>
          )}
          {q.imageKey && <QuestionImage imageKey={q.imageKey} attemptId={id} />}
          <fieldset
            className="answer-field"
            disabled={conflict || remaining === 0 || readingLeft > 0}
          >
            <legend className="sr-only">{tr("Your answer")}</legend>
            {q.type.endsWith("CHOICE") || q.type === "IMAGE_BASED" ? (
              <div className="options">
                {tr(
                  q.options.map((o, i) => {
                    const values = Array.isArray(answer?.value)
                      ? answer.value
                      : [];
                    return (
                      <label
                        className={`option ${values.includes(o.id) ? "chosen" : ""}`}
                        key={o.id}
                      >
                        <input
                          type={
                            ["SINGLE_CHOICE", "IMAGE_BASED"].includes(q.type) ? "radio" : "checkbox"
                          }
                          name={q._id}
                          checked={values.includes(o.id)}
                          onChange={() =>
                            change(
                              ["SINGLE_CHOICE", "IMAGE_BASED"].includes(q.type)
                                ? [o.id]
                                : values.includes(o.id)
                                  ? values.filter((v) => v !== o.id)
                                  : [...values, o.id],
                            )
                          }
                        />
                        <span className="option-letter">
                          {tr(String.fromCharCode(65 + i))}
                        </span>
                        <span className="option-text">{tr(o.text)}</span>
                        {values.includes(o.id) && <Check size={18} />}
                      </label>
                    );
                  }),
                )}
              </div>
            ) : (
              <>
                <label className="answer-label">
                  {q.type === "NUMERICAL"
                    ? tr("Your numerical answer")
                    : tr("Write your answer in Hindi or English")}
                  <textarea
                    rows={q.type === "LONG_ANSWER" ? 12 : 7}
                    value={
                      typeof answer?.value === "string" ? answer.value : ""
                    }
                    onChange={(e) => change(e.target.value)}
                    placeholder={tr("Start your answer here…")}
                    maxLength={20000}
                  />
                </label>
                <span className="small muted">
                  {typeof answer?.value === "string"
                    ? tr(
                        answer.value.trim().split(/\s+/u).filter(Boolean)
                          .length,
                      )
                    : 0}
                  {tr(" ")}
                  {tr("words")}
                  {q.wordLimit
                    ? tr(" / {0} word limit", [q.wordLimit])
                    : tr("")}
                  {tr(" \xB7 Changes autosave")}
                </span>
              </>
            )}
          </fieldset>
          {isDescriptive(q.type) && (
            <div className="form-section">
              <h3>{tr("Upload handwritten answer pages")}</h3>
              <p className="small muted">
                {tr(
                  "Photos: up to 5 MB. PDF: up to 10 MB. Maximum four attached pages per answer. Save before the exam deadline.",
                )}
              </p>
              <div className="answer-upload-actions">
                <label className="button ghost upload-picker">
                  <span>{tr("Choose photo / file")}</span>
                  <input
                    aria-label={tr("Upload answer sheet")}
                    type="file"
                    accept={
                      features.data?.pdfSheets
                        ? "image/*,application/pdf"
                        : "image/*"
                    }
                    disabled={
                      uploading ||
                      conflict ||
                      remaining === 0 ||
                      readingLeft > 0 ||
                      (answer?.attachmentIds?.length || 0) >= 4
                    }
                    onChange={(e) => {
                      if (e.target.files?.[0]) uploadSheet(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="button subtle upload-picker camera-picker">
                  <span>{tr("Take photo")}</span>
                  <input
                    aria-label={tr("Take a photo of handwritten answer")}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={
                      uploading ||
                      conflict ||
                      remaining === 0 ||
                      readingLeft > 0 ||
                      (answer?.attachmentIds?.length || 0) >= 4
                    }
                    onChange={(e) => {
                      if (e.target.files?.[0]) uploadSheet(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {uploading && (
                <p className="accent small">
                  {tr("Uploading and validating page\u2026")}
                </p>
              )}
              <AttachmentGallery
                ids={answer?.attachmentIds || []}
                remove={(assetId) =>
                  change(
                    answer?.value || "",
                    answer?.review,
                    (answer.attachmentIds || []).filter((x) => x !== assetId),
                  )
                }
              />
            </div>
          )}
          {a.feedback?.[q._id] && (
            <div className="notice">
              <strong>
                {tr("Practice feedback \xB7 ")}
                {tr(a.feedback[q._id].awardedMarks)}
                {tr(" / ")}
                {tr(q.maximumMarks)}
              </strong>
              <p>
                {tr("Correct answer: ")}
                {tr(
                  a.feedback[q._id].correct
                    .map((v) => q.options.find((o) => o.id === v)?.text || v)
                    .join(", "),
                )}
              </p>
              <p>{tr(a.feedback[q._id].explanation)}</p>
            </div>
          )}
          <div className="exam-controls">
            <button
              className="button ghost"
              onClick={() =>
                change(q.type.endsWith("CHOICE") ? [] : "", false, [])
              }
            >
              {tr("Clear response")}
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
              <Flag size={16} />
              {tr(" ")}
              {answer?.review ? tr("Unmark review") : tr("Mark for review")}
            </button>
            <div className="row">
              <button
                className="button subtle"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                <ChevronLeft size={17} />
                {tr(" Previous")}
              </button>
              <button
                className="button primary"
                onClick={async () => {
                  await flush();
                  if (index < a.questions.length - 1) setIndex(index + 1);
                  else setConfirm(true);
                }}
              >
                {tr("Save & next ")}
                <ChevronRight size={17} />
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
              <strong>{tr("Question navigator")}</strong>
              <small>
                {tr(count)}
                {tr(" / ")}
                {tr(a.questions.length)}
                {tr(" answered")}
              </small>
            </div>
          </div>
          <div className="palette-grid">
            {tr(
              a.questions.map((q, i) => (
                <button
                  aria-label={tr("Question {0}: {1}", [
                    i + 1,
                    answerStatus(queue.current[q._id] || a.answers[q._id]),
                  ])}
                  className={`${answerStatus(queue.current[q._id] || a.answers[q._id])} ${index === i ? "current" : ""}`}
                  key={q._id}
                  onClick={() => {
                    setIndex(i);
                    setPalette(false);
                  }}
                >
                  {tr(i + 1)}
                </button>
              )),
            )}
          </div>
          <div className="legend">
            {tr(
              [
                ["NOT_VISITED", "Not visited"],
                ["NOT_ANSWERED", "Not answered"],
                ["ANSWERED", "Answered"],
                ["MARKED_FOR_REVIEW", "Marked for review"],
                ["ANSWERED_AND_MARKED_FOR_REVIEW", "Answered & marked"],
              ].map(([c, t]) => (
                <span key={c}>
                  <i className={c} />
                  {tr(t)}
                </span>
              )),
            )}
          </div>
          <div className="palette-note">
            <Shield size={18} />
            <p>
              {tr(
                "Keep this tab open while answers are saving. Your timer continues if you leave.",
              )}
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
            <span className="eyebrow">{tr("READY TO FINISH?")}</span>
            <h2 id="submit-title">{tr("Submit your test?")}</h2>
            <p>
              {tr(count)}
              {tr(" answered \xB7 ")}
              {tr(a.questions.length - count)}
              {tr(" unanswered. Submitted answers cannot be changed.")}
            </p>
            <p className="small muted">
              {tr("Marked-for-review answers are also included in your score.")}
            </p>
            <Notice error>{tr(error)}</Notice>
            <div className="row">
              <button
                className="button ghost"
                disabled={sending}
                onClick={() => setConfirm(false)}
              >
                {tr("Keep reviewing")}
              </button>
              <button
                className="button primary"
                disabled={sending || conflict || uploading}
                onClick={submit}
              >
                {sending ? tr("Submitting…") : tr("Submit test")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function QuestionImage({ imageKey, attemptId }) {
  useLanguage();
  const { data, error } = useLoad(
    `/attempts/${attemptId}/image?key=${encodeURIComponent(imageKey)}`,
  );
  return data ? (
    <img
      className="question-image"
      src={data.url}
      alt={tr("Question diagram")}
    />
  ) : (
    <Notice error>{tr(error)}</Notice>
  );
}
export function AttachmentGallery({ ids, remove }) {
  useLanguage();
  return ids.length ? (
    <div className="attachment-grid">
      {tr(
        ids.map((id, i) => (
          <AttachmentPage key={id} assetId={id} index={i} remove={remove} />
        )),
      )}
    </div>
  ) : null;
}
function AttachmentPage({ assetId, index, remove }) {
  useLanguage();
  const { data, error } = useLoad(`/attachments/${assetId}`);
  return (
    <div className="attachment-page">
      <small>
        {tr("Answer page ")}
        {tr(index + 1)}
      </small>
      {data && (
        <a href={data.url} target="_blank" rel="noreferrer">
          <img src={data.url} alt={tr("Answer-sheet page {0}", [index + 1])} />
        </a>
      )}
      {data?.text && (
        <details>
          <summary>{tr("OCR transcription (check against image)")}</summary>
          <p className="small">{tr(data.text)}</p>
        </details>
      )}
      <Notice error>{tr(error)}</Notice>
      {remove && (
        <button className="button ghost" onClick={() => remove(assetId)}>
          {tr("Remove page")}
        </button>
      )}
    </div>
  );
}
export function Result() {
  useLanguage();
  const { id } = useParams();
  const nav = useNavigate();
  const [retryError, setRetryError] = useState(""),
    [retryBusy, setRetryBusy] = useState(false);
  async function retry(filter) {
    setRetryBusy(true);
    try {
      const a = await request(`/attempts/${id}/retry`, {
        filter,
        feedbackMode: "IMMEDIATE",
      });
      nav(`/exam/${a.id}`);
    } catch (e) {
      setRetryError(e.message);
    } finally {
      setRetryBusy(false);
    }
  }
  const { data: r, error, reload } = useLoad(`/attempts/${id}/result`);
  useEffect(() => {
    if (!r?.provisional) return;
    const t = setInterval(reload, 10000);
    return () => clearInterval(t);
  }, [r?.provisional]);
  return (
    <div className="result-wrap">
      <Link className="muted small" to="/app/attempts">
        {tr("\u2190 Back to my attempts")}
      </Link>
      <Notice error>{tr(error)}</Notice>
      {r ? (
        <>
          <div className="result-hero">
            <span className="eyebrow">{tr("ANOTHER STEP FORWARD")}</span>
            <h1>{tr(r.title)}</h1>
            <span className="tag">
              {r.provisional
                ? tr("Provisional · evaluation in progress")
                : tr("Final result")}
            </span>
            {!r.provisional && r.passStatus && (
              <span className="tag">
                {r.passStatus === "PASS" ? tr("Passing threshold met") : tr("Below passing threshold")}
                {r.minimumPassingMarks != null && tr(" · minimum {0}", [r.minimumPassingMarks])}
              </span>
            )}
            <div className="result-score">
              {tr(r.awardedMarks)}
              <span>
                {tr("/ ")}
                {tr(r.maximumMarks)}
              </span>
            </div>
            <p>
              {r.provisional
                ? tr(
                    "Descriptive answers awaiting AI or manual review are excluded from this score.",
                  )
                : tr(
                    "Review your answers and use the feedback for your next attempt.",
                  )}
            </p>
            <Link className="button primary" to="/app/tests">
              {tr("Keep practicing ")}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="toolbar">
            <button
              className="button subtle"
              disabled={retryBusy}
              onClick={() => retry("INCORRECT")}
            >
              {tr("Retry incorrect questions")}
            </button>
            <button
              className="button subtle"
              disabled={retryBusy}
              onClick={() => retry("UNANSWERED")}
            >
              {tr("Retry unanswered questions")}
            </button>
          </div>
          <Notice error>{tr(retryError)}</Notice>
          <div className="result-answers">
            {tr(
              r.questions.map((q, i) => {
                const e = r.evaluations[q._id],
                  a = r.answers[q._id];
                return (
                  <article className="panel" key={q._id}>
                    <div className="row between">
                      <span className="eyebrow">
                        {tr("QUESTION ")}
                        {tr(i + 1)}
                        {tr(" \xB7 ")}
                        {tr(q.type.replaceAll("_", " "))}
                      </span>
                      <span className="tag">
                        {e?.status === "EVALUATED"
                          ? tr("{0} / {1}", [e.awardedMarks, q.maximumMarks])
                          : e?.status === "NOT_COUNTED"
                            ? tr("Not counted: section choice limit")
                            : tr("Awaiting review")}
                      </span>
                    </div>
                    <h3>{tr(q.text)}</h3>
                    <div className="answer-block">
                      <small className="muted">{tr("YOUR ANSWER")}</small>
                      <p>
                        {Array.isArray(a?.value)
                          ? tr(
                              a.value
                                .map(
                                  (v) =>
                                    q.options.find((o) => o.id === v)?.text ||
                                    v,
                                )
                                .join(", "),
                            )
                          : a?.value || tr("Unanswered")}
                      </p>
                    </div>
                    <AttachmentGallery ids={a?.attachmentIds || []} />
                    {q.correct.length > 0 && (
                      <p className="saved">
                        {tr("Correct answer:")}
                        {tr(" ")}
                        {tr(
                          q.correct
                            .map(
                              (v) =>
                                q.options.find((o) => o.id === v)?.text || v,
                            )
                            .join(", "),
                        )}
                      </p>
                    )}
                    {q.referenceAnswer && (
                      <div className="answer-block">
                        <small className="muted">
                          {tr("REFERENCE ANSWER")}
                        </small>
                        <p>{tr(q.referenceAnswer)}</p>
                      </div>
                    )}
                    {q.explanation && (
                      <p className="muted">{tr(q.explanation)}</p>
                    )}
                    {tr(
                      e?.criteria?.map((c) => (
                        <div className="criterion" key={c.id}>
                          <strong>
                            {tr(q.rubric.find((r) => r.id === c.id)?.name)}
                            {tr(" ")}
                            <span className="accent">{tr(c.awardedMarks)}</span>
                          </strong>
                          <p>{tr(c.feedback)}</p>
                        </div>
                      )),
                    )}
                    {e?.status === "REVIEW" && (
                      <Notice>
                        {tr(
                          "This answer requires manual review before marks are finalized.",
                        )}
                      </Notice>
                    )}
                    {tr(
                      [
                        "strengths",
                        "missingPoints",
                        "errors",
                        "improvementAdvice",
                      ].map((key) =>
                        e?.[key]?.length ? (
                          <div key={key}>
                            <h4>
                              {tr(
                                {
                                  strengths: "Strengths",
                                  missingPoints: "Missing points",
                                  errors: "Corrections",
                                  improvementAdvice: "For next time",
                                }[key],
                              )}
                            </h4>
                            <ul>
                              {tr(
                                e[key].map((s, j) => <li key={j}>{tr(s)}</li>),
                              )}
                            </ul>
                          </div>
                        ) : null,
                      ),
                    )}
                  </article>
                );
              }),
            )}
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
