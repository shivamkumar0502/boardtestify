import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BookOpen, Target, TrendingUp, RefreshCw, Sparkles, Clock3, CalendarDays, Flame, Trophy } from "lucide-react";
import { tr, useLanguage } from "@boardtestify/i18n";
import { request } from "./api";
import "./performance.css";

function Metric({ label, value, detail, icon: Icon }) {
  return <article className="stat">
    <span className="row muted small"><Icon size={16} /> {tr(label)}</span>
    <strong>{value}</strong>
    <small className="muted">{tr(detail)}</small>
  </article>;
}

function ScoreBar({ value }) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return <div className="score-track" role="img" aria-label={`${safe}%`}>
    <span style={{ width: `${safe}%` }} />
  </div>;
}

export function Performance() {
  const language = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [planBusy, setPlanBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(await request("/analytics/detailed"));
    } catch (e) {
      setError(e.message || "Could not load analytics");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function generatePlan() {
    setPlanBusy(true);
    setPlanError("");
    try {
      setPlan(await request("/study-plan", { language }, "POST"));
    } catch (e) {
      setPlanError(e.message || "Could not generate your study plan");
    } finally {
      setPlanBusy(false);
    }
  }

  return <section className="performance-page">
    <div className="page-heading">
      <span className="eyebrow">{tr("REFLECT. REFINE. REPEAT.")}</span>
      <div className="row between">
        <div>
          <h1>{tr("Performance analytics")}<span className="accent">.</span></h1>
          <p>{tr("Use finalized results to find strengths and decide what to practise next.")}</p>
        </div>
        <button className="button ghost" onClick={load} disabled={busy}>
          <RefreshCw size={16} /> {tr("Refresh")}
        </button>
      </div>
    </div>

    {error && <div className="notice error" role="alert">{tr(error)}</div>}
    {busy && !data && <p className="muted">{tr("Loading your performance…")}</p>}

    {data && <>
      <section className="panel streak-panel" aria-label={tr("Study streak")}>
        <div className="streak-summary">
          <div className="streak-current">
            <span className="streak-flame"><Flame size={22} /></span>
            <div>
              <span className="eyebrow">{tr("BUILD YOUR HABIT")}</span>
              <h2>{data.streak?.current ?? 0} {tr("day streak")}</h2>
              <p className="muted">{tr("Submit at least one test each day to keep your streak going.")}</p>
            </div>
          </div>
          <div className="streak-best">
            <Trophy size={19} />
            <div><strong>{data.streak?.longest ?? 0} {tr("days")}</strong><small className="muted">{tr("Longest streak")}</small></div>
          </div>
        </div>
        <div className="streak-week" aria-label={tr("Study activity for the last seven days")}>
          {(data.streak?.activeDays || []).map((day) => {
            const date = new Date(`${day.date}T12:00:00+05:30`);
            const weekday = new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(date);
            return <div className={`streak-day ${day.active ? "is-active" : ""}`} key={day.date} title={day.date}>
              <span>{weekday}</span>
              <strong>{date.getDate()}</strong>
              <span className="streak-day-mark" aria-label={day.active ? tr("Studied") : tr("No submitted test")}>{day.active ? "✓" : "·"}</span>
            </div>;
          })}
        </div>
        <p className="muted small">{tr("A day counts when you submit a test. Dates use India Standard Time; opening the app alone does not count.")}</p>
      </section>

      <div className="stats-grid">
        <Metric icon={BookOpen} label="Completed attempts" value={data.completed} detail="Submitted tests, including pending reviews" />
        <Metric icon={Target} label="Finalized results" value={data.finalized} detail="Scores with all evaluations complete" />
        <Metric icon={TrendingUp} label="Average final score" value={data.averagePercent === null ? "—" : `${data.averagePercent}%`} detail="Provisional results are excluded" />
        <Metric icon={Activity} label="Awaiting review" value={data.pending} detail="Some marks are not final yet" />
      </div>

      <div className="performance-grid">
        <section className="panel">
          <div className="row between">
            <h2>{tr("Subject performance")}</h2>
            <span className="muted small">{tr("Finalized attempts only")}</span>
          </div>
          {!data.subjects.length ? <p className="muted">{tr("Complete a test to see subject analytics.")}</p> :
            <div className="analytics-list">{data.subjects.map((subject) =>
              <article className="analytics-row" key={subject.id}>
                <div className="row between">
                  <strong>{tr(subject.name)}</strong>
                  <strong>{subject.averagePercent === null ? "—" : `${subject.averagePercent}%`}</strong>
                </div>
                <ScoreBar value={subject.averagePercent ?? 0} />
                <small className="muted">{tr(subject.attempts)} {tr("attempts")} · {tr(subject.questions)} {tr("evaluated questions")}</small>
              </article>
            )}</div>
          }
        </section>

        <section className="panel">
          <h2>{tr("Focus areas")}</h2>
          <p className="muted small">{tr("Chapters and topics with the lowest evaluated scores appear first.")}</p>
          {!data.weakAreas.length ? <p className="muted">{tr("More evaluated chapter-level answers are needed to identify focus areas.")}</p> :
            <div className="analytics-list">{data.weakAreas.map((area) =>
              <article className="analytics-row" key={area.id}>
                <div className="row between">
                  <strong>{tr(area.name)}</strong>
                  <strong>{area.percent}%</strong>
                </div>
                <small className="muted">{tr(area.subject)} · {tr(area.missed)} {tr("answers below full marks")}</small>
                <ScoreBar value={area.percent} />
              </article>
            )}</div>
          }
          <Link className="button ghost" to="/app/tests">{tr("Find practice tests")} →</Link>
        </section>
      </div>

      <section className="panel study-plan-panel">
        <div className="row between">
          <div>
            <span className="eyebrow">{tr("YOUR NEXT 7 DAYS")}</span>
            <h2>{tr("AI revision plan")}</h2>
            <p className="muted">{tr("A practical plan generated from your finalized, evaluated answers and weakest tagged topics.")}</p>
          </div>
          <button className="button primary" onClick={generatePlan} disabled={planBusy || !data.finalized}>
            <Sparkles size={16} /> {tr(planBusy ? "Building your plan…" : "Generate my plan")}
          </button>
        </div>
        {!data.finalized && <p className="muted">{tr("Finalize at least one test with evaluated chapter/topic answers to generate a personalized plan.")}</p>}
        {planError && <div className="notice error" role="alert">{tr(planError)}</div>}
        {plan && <>
          <div className="study-plan-intro">
            <h3>{plan.title}</h3>
            <p>{plan.summary}</p>
          </div>
          <div className="study-plan-days">
            {plan.days.map((day) => <article className="study-day" key={day.day}>
              <div className="study-day-heading">
                <span className="study-day-number"><CalendarDays size={16} /> {tr("Day")} {day.day}</span>
                <strong>{day.theme}</strong>
              </div>
              <div className="study-plan-tasks">
                {day.tasks.map((task, index) => {
                  const area = plan.evidence.find((item) => item.id === task.areaId);
                  const activity = {
                    READ_CONCEPT: "Revise concepts",
                    SOLVE_PRACTICE: "Solve practice questions",
                    REVIEW_MISTAKES: "Review mistakes",
                    RETAKE_TEST: "Retake a short test",
                  }[task.activity] || "Study session";
                  return <div className="study-task" key={`${day.day}-${index}`}>
                    <div className="row between">
                      <strong>{tr(activity)}</strong>
                      <span className="study-duration"><Clock3 size={14} /> {task.durationMinutes} {tr("min")}</span>
                    </div>
                    <span className="muted small">{tr(area?.subject || "Subject")} · {tr(area?.area || "Focus area")}</span>
                    <p>{task.goal}</p>
                  </div>;
                })}
              </div>
            </article>)}
          </div>
          <p className="muted small">{plan.disclaimer}</p>
        </>}
      </section>

      <section className="panel">
        <h2>{tr("Recent score trend")}</h2>
        <p className="muted small">{tr("Only finalized scores are plotted. Pending evaluations are labelled separately.")}</p>
        {!data.trend.length ? <p className="muted">{tr("Your submitted test history will appear here.")}</p> :
          <div className="trend-list">{data.trend.map((item) =>
            <Link className="trend-item" to={`/result/${item.id}`} key={item.id}>
              <span className="trend-date">{item.date ? new Date(item.date).toLocaleDateString() : "—"}</span>
              <span className="trend-title">{tr(item.title)}{item.provisional && <small className="muted">{tr("Awaiting final evaluation")}</small>}</span>
              <span className="trend-score">{item.percent === null ? "—" : `${item.percent}%`}</span>
              <ScoreBar value={item.percent ?? 0} />
            </Link>
          )}</div>
        }
      </section>
      <p className="muted small">{tr("Analytics are based on saved attempts and evaluated questions. They are study guidance, not an official BSEB result or predicted board score.")}</p>
    </>}
  </section>;
}
