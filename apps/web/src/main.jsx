import React, { createContext, useContext, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  LayoutDashboard,
  Timer,
  ChartNoAxesCombined,
  Shield,
  LogOut,
  GraduationCap,
  ChevronRight,
  Check,
  Menu,
  X,
  Languages,
  Target,
  Zap,
  ArrowRight,
} from "lucide-react";
import { api, request, setToken } from "./api";
import { Exam, Result } from "./test";
import { Admin } from "./admin";
import "./style.css";
export const Context = createContext(null);
export const useApp = () => useContext(Context);
export function Notice({ children, error = false }) {
  return children ? (
    <div
      role={error ? "alert" : "status"}
      className={`notice ${error ? "error" : ""}`}
    >
      {children}
    </div>
  ) : null;
}
export function Empty({ title, detail }) {
  return (
    <div className="empty">
      <BookOpen size={30} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [lang, setLang] = useState(localStorage.getItem("bt-lang") || "en");
  useEffect(() => {
    api("/auth/refresh", {})
      .then((d) => {
        setToken(d.token);
        setUser(d.user);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  function language() {
    const next = lang === "en" ? "hi" : "en";
    setLang(next);
    localStorage.setItem("bt-lang", next);
    document.documentElement.lang = next;
  }
  if (!ready)
    return (
      <div className="loading">
        <span className="logo-icon">
          B<span>✓</span>
        </span>{" "}
        Opening BoardTestify…
      </div>
    );
  return (
    <Context.Provider value={{ user, setUser, lang, language }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route path="/reset-password" element={<Reset />} />
          <Route path="/forgot-password" element={<Reset forgot />} />
          <Route path="/app/*" element={user ? <Shell /> : <Auth />} />
          <Route path="/exam/:id" element={user ? <Exam /> : <Auth />} />
          <Route path="/result/:id" element={user ? <Result /> : <Auth />} />
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>Page not found</h1>
                <Link to="/">Back home</Link>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </Context.Provider>
  );
}
function Logo() {
  return (
    <Link to="/" className="brand">
      <span className="logo-icon">
        B<span>✓</span>
      </span>
      Board<span className="muted">Testify</span>
      <span className="brand-dot">.</span>
    </Link>
  );
}
function Landing() {
  const { user, lang, language } = useApp();
  const hi = lang === "hi";
  return (
    <>
      <header className="public-nav">
        <Logo />
        <nav>
          <a href="#paths">{hi ? "पाठ्यक्रम" : "Learning paths"}</a>
          <a href="#experience">{hi ? "कैसे काम करता है" : "The experience"}</a>
        </nav>
        <div className="row">
          <button
            className="icon-button"
            onClick={language}
            aria-label="Change language"
          >
            <Languages size={18} />
          </button>
          <Link className="button ghost" to={user ? "/app" : "/login"}>
            {user ? "Dashboard" : "Log in"}
          </Link>
          <Link className="button primary" to={user ? "/app" : "/register"}>
            Get started <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" /> BUILT FOR BIHAR BOARD STUDENTS
            </span>
            <h1>
              {hi ? (
                <>
                  तैयारी ऐसी,
                  <br />
                  कि हर परीक्षा में
                  <br />
                  <em>खुद पर भरोसा हो।</em>
                </>
              ) : (
                <>
                  Your next chapter.
                  <br />
                  Your best score.
                  <br />
                  <em>Starts here.</em>
                </>
              )}
            </h1>
            <p>
              {hi
                ? "कक्षा 10वीं और 12वीं के लिए विषयवार अभ्यास, वास्तविक CBT अनुभव और उत्तरों पर उपयोगी फीडबैक।"
                : "A focused space for Class 10 & 12. Build your concepts, experience real mock tests, and turn every answer into a better one."}
            </p>
            <div className="row hero-actions">
              <Link
                className="button primary large"
                to={user ? "/app" : "/register"}
              >
                {hi ? "अभ्यास शुरू करें" : "Start your preparation"}{" "}
                <ArrowUpRight size={19} />
              </Link>
              <a className="button ghost large" href="#experience">
                Explore the experience <ArrowRight size={17} />
              </a>
            </div>
            <div className="hero-trust">
              <span>
                <Check size={15} /> Hindi & English
              </span>
              <span>
                <Check size={15} /> Every stream, one space
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Illustration of the BoardTestify exam interface"
          >
            <div className="visual-orbit" />
            <div className="mini-window">
              <div className="mini-top">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>boardtestify / practice</span>
                <Shield size={14} />
              </div>
              <div className="mini-body">
                <div className="row between">
                  <span className="tag">MATHEMATICS · SAMPLE</span>
                  <span className="mini-time">
                    <Timer size={13} /> 09:42
                  </span>
                </div>
                <div className="mini-progress">
                  <span />
                </div>
                <span className="muted small">Question 01 / 02</span>
                <h3>
                  If 2x + 3 = 11,
                  <br />
                  what is the value of x?
                </h3>
                <div className="mini-answer">
                  <span>A</span> 2
                </div>
                <div className="mini-answer selected">
                  <span>B</span> 4 <Check size={16} />
                </div>
                <div className="mini-answer">
                  <span>C</span> 7
                </div>
                <div className="mini-footer">
                  <span className="muted small">✓ Answer saved</span>
                  <span className="fake-button">
                    Save & next <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </div>
            <div className="float-badge">
              <span className="badge-icon">
                <Zap size={19} />
              </span>
              <div>
                <strong>Every attempt counts</strong>
                <small>Practice. Reflect. Improve.</small>
              </div>
            </div>
            <span className="visual-caption">
              A little more prepared. Every single day.
            </span>
          </div>
        </section>
        <div className="feature-strip">
          <span>
            <BookOpen /> Chapter-wise practice
          </span>
          <span>
            <Timer /> Real CBT experience
          </span>
          <span>
            <Target /> Rubric-based feedback
          </span>
          <span>
            <ChartNoAxesCombined /> Progress that matters
          </span>
        </div>
        <section id="paths" className="section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CHOOSE YOUR DIRECTION</span>
              <h2>One board. Every ambition.</h2>
            </div>
            <p>
              Pick your class and stream.
              <br />
              Make the next step yours.
            </p>
          </div>
          <div className="path-grid">
            {[
              {
                n: "10",
                title: "Class 10",
                s: "MATRIC",
                desc: "Build a strong foundation for what comes next.",
                list: "Maths · Science · Social Science",
                c: "orange",
              },
              {
                n: "12",
                title: "Science",
                s: "INTERMEDIATE",
                desc: "Understand the why. Master the how.",
                list: "Physics · Chemistry · Biology · Maths",
                c: "blue",
              },
              {
                n: "12",
                title: "Arts",
                s: "INTERMEDIATE",
                desc: "Explore ideas. Express with clarity.",
                list: "History · Geography · Political Science",
                c: "purple",
              },
              {
                n: "12",
                title: "Commerce",
                s: "INTERMEDIATE",
                desc: "Think analytically. Prepare confidently.",
                list: "Accountancy · Business Studies · Economics",
                c: "green",
              },
            ].map((p) => (
              <Link
                className={`path-card ${p.c}`}
                to={user ? "/app/tests" : "/register"}
                key={p.title}
              >
                <div className="row between">
                  <span className="class-number">
                    {p.n}
                    <small>TH</small>
                  </span>
                  <ArrowUpRight size={23} />
                </div>
                <span className="eyebrow">{p.s}</span>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
                <div className="path-bottom">{p.list}</div>
              </Link>
            ))}
          </div>
          <p className="small muted">
            Subject availability depends on your selected syllabus and approved
            content. This is an independent preparation platform.
          </p>
        </section>
        <section id="experience" className="section experience">
          <div>
            <span className="eyebrow">MORE THAN A TEST SERIES</span>
            <h2>
              Don’t just check answers.
              <br />
              <span className="muted">Understand your progress.</span>
            </h2>
            <p>
              From your first practice question to your full mock test, keep
              your preparation in one place.
            </p>
            <Link className="button primary" to={user ? "/app" : "/register"}>
              Find your starting point <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="steps">
            {[
              [
                "01",
                "Practice with purpose",
                "Choose approved tests for your class, subject and chapter.",
              ],
              [
                "02",
                "Get the real exam feel",
                "Navigate sections, mark for review and stay on top of your time.",
              ],
              [
                "03",
                "Learn from every answer",
                "Review objective scores and descriptive feedback, with manual review when needed.",
              ],
            ].map(([n, t, d]) => (
              <div className="step" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer>
        <Logo />
        <span>Practice Smart. Prepare Better. Score Higher.</span>
        <small>Independent platform · Not affiliated with BSEB</small>
      </footer>
    </>
  );
}
function Auth({ register = false }) {
  const { setUser } = useApp();
  const nav = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [level, setLevel] = useState("10");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await api(`/auth/${register ? "register" : "login"}`, d);
      setToken(r.token);
      setUser(r.user);
      nav("/app");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside>
        <Logo />
        <div>
          <span className="eyebrow">ONE STEP CLOSER</span>
          <h1>
            Your effort.
            <br />
            Your future.
            <br />
            <em>Your space.</em>
          </h1>
          <p>Focused preparation for Bihar Board Class 10 & 12.</p>
        </div>
        <small className="muted">
          Practice Smart. Prepare Better. Score Higher.
        </small>
      </aside>
      <main>
        <Link to="/" className="muted small">
          ← Back to home
        </Link>
        <div className="auth-form">
          <span className="eyebrow">LET’S GET YOU READY</span>
          <h2>
            {register ? "Start your next chapter." : "Good to see you again."}
          </h2>
          <p>
            {register
              ? "Create your BoardTestify account."
              : "Sign in and pick up where you left off."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Full name
                <input name="name" autoComplete="name" required minLength={2} />
              </label>
            )}
            <label>
              Email address
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={10}
                maxLength={72}
                placeholder="At least 10 characters"
              />
            </label>
            {register && (
              <div className="grid-two">
                <label>
                  Class
                  <select
                    name="classLevel"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="10">Class 10</option>
                    <option value="12">Class 12</option>
                  </select>
                </label>
                <label>
                  Stream
                  <select key={level} name="stream">
                    {level === "10" ? (
                      <option value="GENERAL">General</option>
                    ) : (
                      ["SCIENCE", "ARTS", "COMMERCE"].map((s) => (
                        <option key={s}>{s}</option>
                      ))
                    )}
                  </select>
                </label>
              </div>
            )}
            <Notice error>{error}</Notice>
            <button disabled={busy} className="button primary full">
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}{" "}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <p className="small">
            {register ? "Already have an account?" : "New to BoardTestify?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          {!register && (
            <Link className="muted small" to="/forgot-password">
              Forgot password?
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
function Reset({ forgot = false }) {
  const [msg, setMsg] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(e.currentTarget));
      if (!forgot)
        body.token = new URLSearchParams(location.search).get("token") || "";
      const d = await api(
        `/auth/${forgot ? "forgot-password" : "reset-password"}`,
        body,
      );
      setMsg(d.message || "Password updated. You can now sign in.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="reset-wrap">
      <Logo />
      <div className="panel">
        <h2>{forgot ? "Reset your password" : "Choose a new password"}</h2>
        <form onSubmit={submit}>
          <label>
            {forgot ? "Email" : "New password"}
            <input
              name={forgot ? "email" : "password"}
              type={forgot ? "email" : "password"}
              required
              minLength={forgot ? undefined : 10}
            />
          </label>
          <button disabled={busy} className="button primary">
            {busy ? "Please wait…" : "Continue"}
          </button>
        </form>
        <Notice>{msg}</Notice>
        <Notice error>{error}</Notice>
        <Link to="/login">Return to sign in</Link>
      </div>
    </div>
  );
}
function Shell() {
  const { user, setUser, language, lang } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  async function logout() {
    await api("/auth/logout", {});
    setToken(null);
    setUser(null);
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Logo />
        <div className="workspace-label">YOUR LEARNING SPACE</div>
        <nav>
          {[
            [LayoutDashboard, "/app", lang === "hi" ? "डैशबोर्ड" : "Overview"],
            [
              BookOpen,
              "/app/tests",
              lang === "hi" ? "टेस्ट लाइब्रेरी" : "Test library",
            ],
            [
              Timer,
              "/app/attempts",
              lang === "hi" ? "मेरे टेस्ट" : "My attempts",
            ],
            [ChartNoAxesCombined, "/app/progress", "My progress"],
            [GraduationCap, "/app/profile", "Profile & pass"],
            ...(user.role !== "STUDENT"
              ? [[Shield, "/app/admin", "Administration"]]
              : []),
          ].map(([Icon, path, label]) => (
            <NavLink key={path} end={path === "/app"} to={path}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="student-chip">
            <span className="avatar">{user.name[0]}</span>
            <div>
              <strong>{user.name}</strong>
              <small>
                Class {user.classLevel} · {user.stream}
              </small>
            </div>
          </div>
          <button className="text-button muted" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="app-header">
          <button
            className="icon-button mobile-only"
            aria-label="Toggle menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <span className="muted small">
            Your preparation, one day at a time.
          </span>
          <div className="row">
            <button
              className="icon-button"
              aria-label="Change language"
              onClick={language}
            >
              <Languages size={18} />
            </button>
            <span className="tag">BSEB · CLASS {user.classLevel}</span>
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="tests" element={<Tests />} />
            <Route path="attempts" element={<Attempts />} />
            <Route path="progress" element={<Progress />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin/*" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
export function useLoad(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const [version, reload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError("");
    request(path)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);
  return { data, error, reload: () => reload((x) => x + 1) };
}
function Overview() {
  const { user } = useApp();
  const { data, error } = useLoad("/attempts");
  const done = data?.filter((a) => a.status !== "ACTIVE") || [];
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">YOUR JOURNEY, YOUR PACE</span>
        <h1>
          Let’s make progress, {user.name.split(" ")[0]}
          <span className="accent">.</span>
        </h1>
        <p>A little practice today. A little more confidence tomorrow.</p>
      </div>
      <div className="dashboard-banner">
        <div>
          <span className="tag">
            CLASS {user.classLevel} · {user.stream}
          </span>
          <h2>
            Your next milestone
            <br />
            starts with one attempt.
          </h2>
          <p>Explore available practice tests and build your momentum.</p>
          <Link className="button primary" to="/app/tests">
            Explore tests <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="banner-symbol">
          <Target size={130} strokeWidth={0.7} />
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label="Tests completed"
          value={String(done.length)}
          detail="Every attempt is a step forward"
        />
        <Stat
          label="In progress"
          value={String(data?.filter((a) => a.status === "ACTIVE").length || 0)}
          detail="Resume right where you stopped"
        />
        <Stat
          label="Learning focus"
          value={`Class ${user.classLevel}`}
          detail={
            user.stream === "GENERAL"
              ? "Matric preparation"
              : `${user.stream.toLowerCase()} stream`
          }
        />
      </div>
      <div className="row between">
        <h2>Continue your journey</h2>
        <Link className="small accent" to="/app/attempts">
          View all attempts →
        </Link>
      </div>
      <Notice error>{error}</Notice>
      {!data ? (
        <p className="muted">Loading your activity…</p>
      ) : data.length ? (
        <AttemptRows rows={data.slice(0, 4)} />
      ) : (
        <Empty
          title="Your story starts here"
          detail="Take your first practice test. Your saved attempts will appear here."
        />
      )}
    </>
  );
}
function Stat({ label, value, detail }) {
  return (
    <div className="stat">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
      <small className="muted">{detail}</small>
    </div>
  );
}
function Tests() {
  const { data, error } = useLoad("/tests");
  const [filter, setFilter] = useState("ALL"),
    [query, setQuery] = useState("");
  const [busy, setBusy] = useState(""),
    [err, setErr] = useState("");
  const nav = useNavigate();
  async function start(id) {
    setBusy(id);
    setErr("");
    try {
      const a = await request(`/tests/${id}/start`, {});
      nav(`/exam/${a.id}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">PREPARE WITH PURPOSE</span>
        <h1>
          Find your next challenge<span className="accent">.</span>
        </h1>
        <p>
          Approved content for your class and stream. One focused attempt at a
          time.
        </p>
      </div>
      <div className="toolbar">
        <div className="tabs">
          {["ALL", "PRACTICE", "CBT", "BOARD"].map((t) => (
            <button
              onClick={() => setFilter(t)}
              className={filter === t ? "active" : ""}
              key={t}
            >
              {t === "ALL"
                ? "All tests"
                : t === "BOARD"
                  ? "Board mocks"
                  : t === "PRACTICE"
                    ? "Practice"
                    : "CBT mocks"}
            </button>
          ))}
        </div>
        <input
          aria-label="Search tests"
          placeholder="Search tests…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <Notice error>{error || err}</Notice>
      {data ? (
        <div className="test-grid">
          {data
            .filter(
              (t) =>
                (filter === "ALL" || t.mode === filter) &&
                t.title.toLowerCase().includes(query.toLowerCase()),
            )
            .map((t) => (
              <article className="test-card" key={t.id}>
                <div className="row between">
                  <span className="tag orange-tag">
                    {t.mode === "BOARD" ? "BOARD MOCK" : t.mode}
                  </span>
                  <BookOpen size={21} className="muted" />
                </div>
                <h3>{t.title}</h3>
                <p>{t.description}</p>
                <div className="test-meta">
                  <span>
                    <Timer size={15} />
                    {t.durationMinutes ? `${t.durationMinutes} min` : "Untimed"}
                  </span>
                  <span>
                    {t.sections.reduce((s, x) => s + x.count, 0)} questions
                  </span>
                </div>
                <div className="row between card-foot">
                  <small className={t.premium ? "accent" : "muted"}>
                    {t.premium ? "Study pass" : "Free practice"}
                  </small>
                  <button
                    disabled={!!busy}
                    onClick={() => start(t.id)}
                    className="button subtle"
                  >
                    {busy === t.id ? "Starting…" : "Start test"}{" "}
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </article>
            ))}
        </div>
      ) : (
        <p>Loading available tests…</p>
      )}
      {data &&
        !data.filter(
          (t) =>
            (filter === "ALL" || t.mode === filter) &&
            t.title.toLowerCase().includes(query.toLowerCase()),
        ).length && (
          <Empty
            title="More practice is on the way"
            detail="No approved tests match this selection yet. Administrators can publish verified content."
          />
        )}
    </>
  );
}
function AttemptRows({ rows }) {
  return (
    <div className="attempt-list">
      {rows.map((a) => (
        <Link
          key={a.id}
          to={a.status === "ACTIVE" ? `/exam/${a.id}` : `/result/${a.id}`}
          className="attempt-row"
        >
          <span className="list-icon">
            <BookOpen size={20} />
          </span>
          <div>
            <strong>{a.title}</strong>
            <small>
              {new Date(a.startedAt).toLocaleDateString()} ·{" "}
              {a.status === "ACTIVE"
                ? "In progress"
                : a.evaluationState === "COMPLETE"
                  ? "Result ready"
                  : "Evaluation pending"}
            </small>
          </div>
          <span className="tag">
            {a.status === "ACTIVE" ? "Resume" : "View result"}
          </span>
          <ChevronRight size={17} />
        </Link>
      ))}
    </div>
  );
}
function Attempts() {
  const { data, error } = useLoad("/attempts");
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">EVERY ATTEMPT COUNTS</span>
        <h1>
          My attempts<span className="accent">.</span>
        </h1>
        <p>Resume your tests or take a closer look at your results.</p>
      </div>
      <Notice error>{error}</Notice>
      {data?.length ? (
        <AttemptRows rows={data} />
      ) : (
        <Empty
          title={data ? "A clean slate" : "Loading attempts…"}
          detail="Your practice history will appear here."
        />
      )}
    </>
  );
}
function Progress() {
  const { data, error } = useLoad("/analytics");
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">REFLECT. REFINE. REPEAT.</span>
        <h1>
          See how far you’ve come<span className="accent">.</span>
        </h1>
        <p>
          Finalized results show the full picture. Pending descriptive marks
          remain provisional.
        </p>
      </div>
      <Notice error>{error}</Notice>
      {data && (
        <>
          <div className="stats-grid">
            <Stat
              label="Completed attempts"
              value={String(data.completed)}
              detail="Includes provisional evaluations"
            />
            <Stat
              label="Finalized results"
              value={String(data.finalized)}
              detail="All required evaluations complete"
            />
            <Stat
              label="Average final score"
              value={data.average === null ? "—" : `${data.average}%`}
              detail="Across finalized tests only"
            />
          </div>
          <div className="panel">
            <h2>Recent results</h2>
            {data.results.length ? (
              data.results.map((r) => (
                <Link
                  to={`/result/${r.id}`}
                  className="progress-row"
                  key={r.id}
                >
                  <div>
                    <strong>{r.title}</strong>
                    <small>
                      {r.provisional
                        ? "Provisional · awaiting evaluation"
                        : "Final result"}
                    </small>
                  </div>
                  <div className="score-track">
                    <span
                      style={{
                        width: `${Math.max(0, (r.awardedMarks / r.maximumMarks) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {r.awardedMarks}/{r.maximumMarks}
                  </strong>
                </Link>
              ))
            ) : (
              <Empty
                title="Your progress is waiting"
                detail="Complete a test to see your results here."
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
function Profile() {
  const { user } = useApp();
  const { data, reload, error } = useLoad("/billing");
  const features = useLoad("/features");
  const [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  async function buy() {
    setBusy(true);
    setMsg("");
    try {
      const order = await request("/billing/order", {});
      if (!window.Razorpay)
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () => reject(Error("Unable to load checkout"));
          document.body.appendChild(s);
        });
      new window.Razorpay({
        ...order,
        key: order.keyId,
        order_id: order.orderId,
        prefill: { email: user.email, name: user.name },
        handler: async (r) => {
          try {
            await request("/billing/verify", {
              orderId: r.razorpay_order_id,
              paymentId: r.razorpay_payment_id,
              signature: r.razorpay_signature,
            });
            reload();
            setMsg("Your pass is active.");
          } catch (e) {
            setMsg(e.message);
          }
        },
        theme: { color: "#f97316" },
      }).open();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <h1>
          Your learning profile<span className="accent">.</span>
        </h1>
        <p>Your account and study access.</p>
      </div>
      <div className="grid-two">
        <div className="panel">
          <span className="avatar big">{user.name[0]}</span>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <div className="tag">
            Class {user.classLevel} · {user.stream}
          </div>
          <p className="small muted">Role: {user.role}</p>
          <Link to="/forgot-password">Reset password →</Link>
        </div>
        <div className="panel">
          <span className="eyebrow">STUDY PASS</span>
          <h2>
            {data?.entitlement ? "You’re all set." : "Keep your momentum."}
          </h2>
          <p>
            {data?.entitlement
              ? `Active until ${new Date(data.entitlement.expiresAt).toLocaleDateString()}`
              : "Unlock tests marked “Study pass” for 30 days."}
          </p>
          <Notice error>{error}</Notice>
          <Notice>{msg}</Notice>
          {features.data?.payments ? (
            <button className="button primary" disabled={busy} onClick={buy}>
              {busy
                ? "Opening…"
                : `Get 30 days · ₹${features.data.passPricePaise / 100}`}{" "}
              <ArrowUpRight size={16} />
            </button>
          ) : (
            <span className="tag">Payments are not enabled</span>
          )}
          <p className="small muted">One-time pass. No automatic renewal.</p>
        </div>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
