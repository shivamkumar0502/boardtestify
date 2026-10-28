import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { tr, useLanguage } from "@boardtestify/i18n";
import { useLoad, Notice, Empty } from "./main";
import { request } from "./api";
export function SeriesLibrary() {
  useLanguage();
  const { data: groups, error } = useLoad("/test-series");
  const billing = useLoad("/billing");
  const [params, setParams] = useSearchParams(),
    selected = params.get("series") || "";
  const [chapter, setChapter] = useState("");
  const [chapters, setChapters] = useState([]);
  useEffect(() => setChapter(""), [selected]);
  const [mode, setMode] = useState(""),
    [access, setAccess] = useState(""),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState("");
  const [rows, setRows] = useState([]),
    [next, setNext] = useState(null),
    [loading, setLoading] = useState(false),
    [err, setError] = useState(""),
    [busy, setBusy] = useState("");
  const nav = useNavigate(),
    generation = useRef(0),
    moreBusy = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const path = selected
    ? `/test-series/${encodeURIComponent(selected)}/tests?${new URLSearchParams({ ...(mode ? { mode } : {}), ...(chapter ? { chapterId: chapter } : {}), ...(access ? { access } : {}), ...(search ? { q: search } : {}) })}`
    : "";
  useEffect(() => {
    const version = ++generation.current;
    setRows([]);
    setNext(null);
    setError("");
    moreBusy.current = false;
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    request(path)
      .then((d) => {
        if (version === generation.current) {
          setRows(d.rows);
          setChapters(d.chapters || []);
          setNext(d.nextCursor);
        }
      })
      .catch((e) => {
        if (version === generation.current) setError(e.message);
      })
      .finally(() => {
        if (version === generation.current) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [path]);
  async function more() {
    if (!next || moreBusy.current) return;
    moreBusy.current = true;
    setLoading(true);
    const version = generation.current;
    try {
      const d = await request(`${path}&cursor=${next}`);
      if (version === generation.current) {
        setRows((old) => [...old, ...d.rows]);
        setNext(d.nextCursor);
      }
    } catch (e) {
      if (version === generation.current) setError(e.message);
    } finally {
      if (version === generation.current) {
        moreBusy.current = false;
        setLoading(false);
      }
    }
  }
  async function start(t) {
    if (t.activeAttemptId) {
      nav(`/exam/${t.activeAttemptId}`);
      return;
    }
    setBusy(t.id);
    setError("");
    try {
      const a = await request(`/tests/${t.id}/start`, {});
      nav(`/exam/${a.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  const group = groups?.find((g) => g.id === selected);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">{tr("YOUR BOARD. YOUR TEST SERIES.")}</span>
        <h1>
          {selected
            ? group?.title || tr("Test series")
            : tr("Find your next challenge")}
          <span className="accent">.</span>
        </h1>
        <p>{tr("Choose a subject, pick a test and start practicing.")}</p>
      </div>
      <Notice error>{error || err}</Notice>
      {!selected ? (
        <div className="test-grid">
          {groups?.map((g) => (
            <article className="test-card series-card" key={g.id}>
              <div className="row between">
                <span className="tag orange-tag">
                  {tr("Class {0}", [g.classLevel])}
                </span>
                <span className="small muted">{g.session}</span>
              </div>
              <h3>{g.title}</h3>
              <p>{tr("{0} tests · {1} free", [g.testCount, g.freeTests])}</p>
              <div className="series-tags">
                {g.modes.map((m) => (
                  <span className="tag" key={m}>
                    {tr(m)}
                  </span>
                ))}
              </div>
              <p className="small muted">
                {tr("Practice, mocks and results in one place.")}
              </p>
              <button
                className="button primary"
                onClick={() => {
                  setMode("");
                  setAccess("");
                  setQuery("");
                  setSearch("");
                  setParams({ series: g.id });
                }}
              >
                {tr("View tests")}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <>
          <button className="button ghost" onClick={() => setParams({})}>
            {tr("← All test series")}
          </button>
          <div className="series-summary panel">
            <strong>
              {tr("{0} tests · {1} free", [
                group?.testCount ?? 0,
                group?.freeTests ?? 0,
              ])}
            </strong>
            <span className="muted">
              {group?.session} · {tr("Hindi / English where available")}
            </span>
          </div>
          <div className="toolbar">
            <div className="tabs">
              {[
                ["", "All tests"],
                ["PRACTICE", "Practice"],
                ["CBT", "CBT mocks"],
                ["BOARD", "Board mocks"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  className={mode === v ? "active" : ""}
                  onClick={() => setMode(v)}
                >
                  {tr(label)}
                </button>
              ))}
            </div>
            <input
              aria-label={tr("Search tests")}
              placeholder={tr("Search tests…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {chapters.length > 0 && (
              <select
                aria-label={tr("Chapter")}
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
              >
                <option value="">{tr("All chapters")}</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label={tr("Test access")}
              value={access}
              onChange={(e) => setAccess(e.target.value)}
            >
              <option value="">{tr("Free and premium")}</option>
              <option value="FREE">{tr("Free practice")}</option>
              <option value="PREMIUM">{tr("Study pass")}</option>
            </select>
          </div>
          <div className="series-test-list">
            {rows.map((t) => (
              <article className="test-card series-test" key={t.id}>
                <div>
                  <span className="tag orange-tag">{tr(t.mode)}</span>{" "}
                  <span className="small muted">
                    {t.premium ? tr("Study pass") : tr("Free practice")}
                  </span>
                  <h3>{t.title}</h3>
                  <p>{t.description}</p>
                  <div className="test-meta">
                    <span>{tr("{0} questions", [t.questions])}</span>
                    <span>
                      {t.durationMinutes
                        ? tr("{0} min", [t.durationMinutes])
                        : tr("Untimed")}
                    </span>
                  </div>
                </div>
                <div className="series-actions">
                  {t.premium &&
                  !billing.data?.entitlement &&
                  !t.activeAttemptId ? (
                    <Link className="button primary" to="/app/profile">
                      {tr("Get study pass")}
                    </Link>
                  ) : (
                    <button
                      className="button primary"
                      disabled={!!busy}
                      onClick={() => start(t)}
                    >
                      {busy === t.id
                        ? tr("Starting…")
                        : t.activeAttemptId
                          ? tr("Resume test")
                          : tr("Start test")}
                    </button>
                  )}
                  {t.resultAttemptId && (
                    <Link
                      className="button subtle"
                      to={`/result/${t.resultAttemptId}`}
                    >
                      {tr("View result")}
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          {next && (
            <button className="button subtle" disabled={loading} onClick={more}>
              {tr("Load more tests")}
            </button>
          )}
          {!loading && !rows.length && (
            <Empty
              title="No tests match your filters"
              detail="Try another mode or clear your search."
            />
          )}
        </>
      )}
      {!groups?.length && !selected && groups && (
        <Empty
          title="More practice is on the way"
          detail="No approved tests match this selection yet. Administrators can publish verified content."
        />
      )}
      {loading && <p role="status">{tr("Loading available tests…")}</p>}
    </>
  );
}
