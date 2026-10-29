import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BookOpen, Target, TrendingUp, RefreshCw } from "lucide-react";
import { tr, useLanguage } from "@boardtestify/i18n";
import { request } from "./api";

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
  useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

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
