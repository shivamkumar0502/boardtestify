import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BookOpen, CalendarDays, CheckCircle2, CircleHelp, ClipboardCheck, RefreshCw, Sparkles, Target, Trophy } from "lucide-react";
import { tr, useLanguage } from "@boardtestify/i18n";
import { request } from "./api";

function HubCard({ icon: Icon, title, detail, to, action }) {
  return <article className="hub-card">
    <span className="hub-icon"><Icon size={20} /></span>
    <h3>{tr(title)}</h3>
    <p>{tr(detail)}</p>
    <Link className="button ghost" to={to}>{tr(action)} <span aria-hidden="true">→</span></Link>
  </article>;
}

export function StudyHub() {
  const language = useLanguage();
  const [analytics, setAnalytics] = useState(null);
  const [plan, setPlan] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planBusy, setPlanBusy] = useState(false);
  const [taskBusy, setTaskBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [a, p, m] = await Promise.all([
        request("/analytics/detailed"),
        request("/study-plan/current"),
        request("/analytics/mistakes")
      ]);
      setAnalytics(a);
      setPlan(p.plan || null);
      setCompleted(p.completedTasks || []);
      setMistakes(Array.isArray(m) ? m : []);
    } catch (e) {
      setError(e.message || "Could not load your study hub");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function generatePlan() {
    setPlanBusy(true);
    setError("");
    try {
      const p = await request("/study-plan", { language }, "POST");
      setPlan(p);
      setCompleted(p.completedTasks || []);
    } catch (e) {
      setError(e.message || "Could not create your study plan");
    } finally {
      setPlanBusy(false);
    }
  }
  async function toggleTask(day, taskIndex, checked) {
    const key = `day:${day}:task:${taskIndex}`;
    setTaskBusy(key);
    setError("");
    try {
      const result = await request("/study-plan/task", { day, taskIndex, completed: checked }, "PATCH");
      setCompleted(result.completedTasks || []);
    } catch (e) {
      setError(e.message || "Could not save task progress");
    } finally {
      setTaskBusy("");
    }
  }
  const tasks = (plan?.days || []).flatMap((day, dayIndex) =>
    (day.tasks || []).map((task, taskIndex) => ({
      day: day.day ?? dayIndex + 1,
      taskIndex,
      task,
      key: `day:${day.day ?? dayIndex + 1}:task:${taskIndex}`
    }))
  );
  const done = tasks.filter((t) => completed.includes(t.key)).length;
  const percent = tasks.length ? Math.round(done * 100 / tasks.length) : 0;

  return <section className="study-hub">
    <div className="page-heading">
      <span className="eyebrow">{tr("YOUR PERSONAL STUDY SPACE")}</span>
      <div className="row between hub-heading-row">
        <div><h1>{tr("Study hub")}<span className="accent">.</span></h1>
          <p>{tr("Practice, plan, and review your Bihar Board preparation in one place.")}</p></div>
        <button className="button ghost" onClick={load} disabled={loading}><RefreshCw size={16}/>{tr("Refresh")}</button>
      </div>
    </div>
    {error && <div className="notice error" role="alert">{tr(error)}</div>}
    <section className="hub-welcome panel">
      <div><span className="eyebrow">{tr("SMALL STEPS, REAL PROGRESS")}</span>
        <h2>{tr("Make today count.")}</h2>
        <p>{tr("Use your results to choose what to practise next. Your scores reflect completed tests; predictions are not guarantees.")}</p>
        <Link className="button primary" to="/app/tests">{tr("Start practice")} <span aria-hidden="true">→</span></Link>
      </div>
      <div className="hub-welcome-mark"><Target size={76} strokeWidth={1.1}/></div>
    </section>
    <div className="hub-metrics">
      <article className="hub-metric"><span><ClipboardCheck size={17}/>{tr("Completed tests")}</span><strong>{loading ? "—" : analytics?.completed ?? 0}</strong></article>
      <article className="hub-metric"><span><Trophy size={17}/>{tr("Finalized results")}</span><strong>{loading ? "—" : analytics?.finalized ?? 0}</strong></article>
      <article className="hub-metric"><span><Activity size={17}/>{tr("Average score")}</span><strong>{loading ? "—" : analytics?.averagePercent == null ? "—" : `${analytics.averagePercent}%`}</strong></article>
      <article className="hub-metric"><span><CheckCircle2 size={17}/>{tr("Plan completion")}</span><strong>{plan ? `${percent}%` : "—"}</strong></article>
    </div>
    <div className="hub-feature-grid">
      <HubCard icon={BookOpen} title="Smart PYQ practice" detail="Browse published tests by class, stream, subject, and chapter. Only approved content appears in your library." to="/app/tests" action="Explore question practice"/>
      <HubCard icon={CircleHelp} title="Ask a doubt" detail="Open the supported study and answer-review tools. AI explanations should be checked against trusted course material." to="/app/performance" action="Review answers"/>
      <HubCard icon={Activity} title="Performance insights" detail="See finalized scores, subject trends, mistakes, and areas to revisit." to="/app/performance" action="View analytics"/>
      <HubCard icon={CalendarDays} title="Study planner" detail="Generate a personal plan from your preparation data and mark tasks complete." to="#study-plan" action="Go to my plan"/>
    </div>
    <section id="study-plan" className="panel hub-plan">
      <div className="row between hub-plan-heading">
        <div><span className="eyebrow">{tr("YOUR NEXT STEPS")}</span><h2>{tr("Personal study plan")}</h2>
          <p>{tr("Tasks are saved to your account so you can continue later.")}</p></div>
        <button className="button primary" onClick={generatePlan} disabled={planBusy}>{planBusy ? tr("Creating…") : plan ? tr("Refresh plan") : tr("Create my plan")} <Sparkles size={16}/></button>
      </div>
      {plan && <><div className="hub-plan-progress"><span style={{width:`${percent}%`}}/></div>
        <p className="small muted">{tr("{0} of {1} tasks complete", [done, tasks.length])}</p>
        {tasks.length ? <div className="hub-task-list">{tasks.map(({day,taskIndex,task,key}) =>
          <label className="hub-task" key={key}>
            <input type="checkbox" checked={completed.includes(key)} disabled={taskBusy===key} onChange={e=>toggleTask(day,taskIndex,e.target.checked)}/>
            <span><small>{tr("DAY")} {day}</small>{tr(typeof task === "string" ? task : task.title || task.label || task.description || "Study task")}</span>
          </label>
        )}</div> : <p className="muted">{tr("Your plan has no tasks yet. Refresh it to generate a new plan.")}</p>}
      </>}
      {!plan && !loading && <p className="muted">{tr("Create a plan to get a manageable set of study tasks.")}</p>}
    </section>
    <section className="panel hub-review">
      <div className="row between"><div><span className="eyebrow">{tr("LEARN FROM MISTAKES")}</span><h2>{tr("Review queue")}</h2></div><Link className="small accent" to="/app/performance">{tr("Open full review →")}</Link></div>
      {mistakes.length ? <p>{tr("{0} items are ready for review.", [mistakes.length])}</p> : <p className="muted">{tr("Your incorrect and unanswered practice items will appear here when available.")}</p>}
    </section>
  </section>;
}
