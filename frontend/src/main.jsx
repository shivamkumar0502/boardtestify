import { SeriesLibrary } from "./series";
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
import {
  AnnouncementsFeed,
  ResourceLibrary,
  AccountPanel,
  BillingPanel,
  PhoneLogin,
} from "./student-extras";
import { getLanguage, setLanguage, useLanguage, tr } from "@boardtestify/i18n";
import "./style.css";
export const Context = createContext(null);
export const useApp = () => useContext(Context);
export function Notice({ children, error = false }) {
  useLanguage();
  return children ? (
    <div
      role={error ? "alert" : "status"}
      className={`notice ${error ? "error" : ""}`}
    >
      {tr(children)}
    </div>
  ) : null;
}
export function Empty({ title, detail }) {
  useLanguage();
  return (
    <div className="empty">
      <BookOpen size={30} />
      <h3>{tr(title)}</h3>
      <p>{tr(detail)}</p>
    </div>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false);
  const lang = useLanguage();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (user?.language) setLanguage(user.language);
  }, [user?.id]);
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
    setLanguage(next);
    if (user)
      request(
        "/auth/me",
        {
          language: next,
        },
        "PATCH",
      )
        .then(setUser)
        .catch(() => {});
    document.documentElement.lang = next;
  }
  if (!ready)
    return (
      <div className="loading">
        <span className="logo-icon">
          {tr("B")}
          <span>{tr("\u2713")}</span>
        </span>
        {tr(" ")}
        {tr("Opening BoardTestify\u2026")}
      </div>
    );
  return (
    <Context.Provider
      value={{
        user,
        setUser,
        lang,
        language,
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth register />} />
          <Route path="/phone-login" element={<PhoneLogin />} />
          <Route path="/reset-password" element={<Reset />} />
          <Route path="/forgot-password" element={<Reset forgot />} />
          <Route path="/app/*" element={user ? <Shell /> : <Auth />} />
          <Route path="/exam/:id" element={user ? <Exam /> : <Auth />} />
          <Route path="/result/:id" element={user ? <Result /> : <Auth />} />
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>{tr("Page not found")}</h1>
                <Link to="/">{tr("Back home")}</Link>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </Context.Provider>
  );
}
function Logo() {
  useLanguage();
  return (
    <Link to="/" className="brand">
      <span className="logo-icon">
        {tr("B")}
        <span>{tr("\u2713")}</span>
      </span>
      {tr("Board")}
      <span className="muted">{tr("Testify")}</span>
      <span className="brand-dot">{tr(".")}</span>
    </Link>
  );
}
function Landing() {
  useLanguage();
  const { user, lang, language } = useApp();
  const hi = lang === "hi";
  return (
    <>
      <header className="public-nav">
        <Logo />
        <nav>
          <a href="#paths">{hi ? tr("पाठ्यक्रम") : tr("Learning paths")}</a>
          <a href="#experience">
            {hi ? tr("कैसे काम करता है") : tr("The experience")}
          </a>
        </nav>
        <div className="row">
          <button
            className="icon-button"
            onClick={language}
            aria-label={tr("Change language")}
          >
            <Languages size={18} />
          </button>
          <Link className="button ghost" to={user ? "/app" : "/login"}>
            {user ? tr("Dashboard") : tr("Log in")}
          </Link>
          <Link className="button primary" to={user ? "/app" : "/register"}>
            {tr("Get started ")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="live-dot" />
              {tr(" BUILT FOR BIHAR BOARD STUDENTS")}
            </span>
            <h1>
              {hi ? (
                <>
                  {tr(
                    "\u0924\u0948\u092F\u093E\u0930\u0940 \u0910\u0938\u0940,",
                  )}
                  <br />
                  {tr(
                    "\u0915\u093F \u0939\u0930 \u092A\u0930\u0940\u0915\u094D\u0937\u093E \u092E\u0947\u0902",
                  )}
                  <br />
                  <em>
                    {tr(
                      "\u0916\u0941\u0926 \u092A\u0930 \u092D\u0930\u094B\u0938\u093E \u0939\u094B\u0964",
                    )}
                  </em>
                </>
              ) : (
                <>
                  {tr("Your next chapter.")}
                  <br />
                  {tr("Your best score.")}
                  <br />
                  <em>{tr("Starts here.")}</em>
                </>
              )}
            </h1>
            <p>
              {hi
                ? tr(
                    "कक्षा 10वीं और 12वीं के लिए विषयवार अभ्यास, वास्तविक CBT अनुभव और उत्तरों पर उपयोगी फीडबैक।",
                  )
                : tr(
                    "A focused space for Class 10 & 12. Build your concepts, experience real mock tests, and turn every answer into a better one.",
                  )}
            </p>
            <div className="row hero-actions">
              <Link
                className="button primary large"
                to={user ? "/app" : "/register"}
              >
                {hi ? tr("अभ्यास शुरू करें") : tr("Start your preparation")}
                {tr(" ")}
                <ArrowUpRight size={19} />
              </Link>
              <a className="button ghost large" href="#experience">
                {tr("Explore the experience ")}
                <ArrowRight size={17} />
              </a>
            </div>
            <div className="hero-trust">
              <span>
                <Check size={15} />
                {tr(" Hindi & English")}
              </span>
              <span>
                <Check size={15} />
                {tr(" Every stream, one space")}
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label={tr("Illustration of the BoardTestify exam interface")}
          >
            <div className="visual-orbit" />
            <div className="mini-window">
              <div className="mini-top">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>{tr("boardtestify / practice")}</span>
                <Shield size={14} />
              </div>
              <div className="mini-body">
                <div className="row between">
                  <span className="tag">{tr("MATHEMATICS \xB7 SAMPLE")}</span>
                  <span className="mini-time">
                    <Timer size={13} />
                    {tr(" 09:42")}
                  </span>
                </div>
                <div className="mini-progress">
                  <span />
                </div>
                <span className="muted small">{tr("Question 01 / 02")}</span>
                <h3>
                  {tr("If 2x + 3 = 11,")}
                  <br />
                  {tr("what is the value of x?")}
                </h3>
                <div className="mini-answer">
                  <span>{tr("A")}</span>
                  {tr(" 2")}
                </div>
                <div className="mini-answer selected">
                  <span>{tr("B")}</span>
                  {tr(" 4 ")}
                  <Check size={16} />
                </div>
                <div className="mini-answer">
                  <span>{tr("C")}</span>
                  {tr(" 7")}
                </div>
                <div className="mini-footer">
                  <span className="muted small">
                    {tr("\u2713 Answer saved")}
                  </span>
                  <span className="fake-button">
                    {tr("Save & next ")}
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </div>
            <div className="float-badge">
              <span className="badge-icon">
                <Zap size={19} />
              </span>
              <div>
                <strong>{tr("Every attempt counts")}</strong>
                <small>{tr("Practice. Reflect. Improve.")}</small>
              </div>
            </div>
            <span className="visual-caption">
              {tr("A little more prepared. Every single day.")}
            </span>
          </div>
        </section>
        <div className="feature-strip">
          <span>
            <BookOpen />
            {tr(" Chapter-wise practice")}
          </span>
          <span>
            <Timer />
            {tr(" Real CBT experience")}
          </span>
          <span>
            <Target />
            {tr(" Rubric-based feedback")}
          </span>
          <span>
            <ChartNoAxesCombined />
            {tr(" Progress that matters")}
          </span>
        </div>
        <section id="paths" className="section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{tr("CHOOSE YOUR DIRECTION")}</span>
              <h2>{tr("One board. Every ambition.")}</h2>
            </div>
            <p>
              {tr("Pick your class and stream.")}
              <br />
              {tr("Make the next step yours.")}
            </p>
          </div>
          <div className="path-grid">
            {tr(
              [
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
                      {tr(p.n)}
                      <small>{tr("TH")}</small>
                    </span>
                    <ArrowUpRight size={23} />
                  </div>
                  <span className="eyebrow">{tr(p.s)}</span>
                  <h3>{tr(p.title)}</h3>
                  <p>{tr(p.desc)}</p>
                  <div className="path-bottom">{tr(p.list)}</div>
                </Link>
              )),
            )}
          </div>
          <p className="small muted">
            {tr(
              "Subject availability depends on your selected syllabus and approved content. This is an independent preparation platform.",
            )}
          </p>
        </section>
        <section id="experience" className="section experience">
          <div>
            <span className="eyebrow">{tr("MORE THAN A TEST SERIES")}</span>
            <h2>
              {tr("Don\u2019t just check answers.")}
              <br />
              <span className="muted">{tr("Understand your progress.")}</span>
            </h2>
            <p>
              {tr(
                "From your first practice question to your full mock test, keep your preparation in one place.",
              )}
            </p>
            <Link className="button primary" to={user ? "/app" : "/register"}>
              {tr("Find your starting point ")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="steps">
            {tr(
              [
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
                  <span>{tr(n)}</span>
                  <div>
                    <h3>{tr(t)}</h3>
                    <p>{tr(d)}</p>
                  </div>
                </div>
              )),
            )}
          </div>
        </section>
      </main>
      <footer>
        <Logo />
        <span>{tr("Practice Smart. Prepare Better. Score Higher.")}</span>
        <small>
          {tr("Independent platform \xB7 Not affiliated with BSEB")}
        </small>
      </footer>
    </>
  );
}
function Auth({ register = false }) {
  useLanguage();
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
    if (register) d.language = getLanguage();
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
          <span className="eyebrow">{tr("ONE STEP CLOSER")}</span>
          <h1>
            {tr("Your effort.")}
            <br />
            {tr("Your future.")}
            <br />
            <em>{tr("Your space.")}</em>
          </h1>
          <p>{tr("Focused preparation for Bihar Board Class 10 & 12.")}</p>
        </div>
        <small className="muted">
          {tr("Practice Smart. Prepare Better. Score Higher.")}
        </small>
      </aside>
      <main>
        <Link to="/" className="muted small">
          {tr("\u2190 Back to home")}
        </Link>
        <div className="auth-form">
          <span className="eyebrow">{tr("LET\u2019S GET YOU READY")}</span>
          <h2>
            {register
              ? tr("Start your next chapter.")
              : tr("Good to see you again.")}
          </h2>
          <p>
            {register
              ? tr("Create your BoardTestify account.")
              : tr("Sign in and pick up where you left off.")}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                {tr("Full name")}
                <input name="name" autoComplete="name" required minLength={2} />
              </label>
            )}
            <label>
              {tr("Email address")}
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              {tr("Password")}
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={10}
                maxLength={72}
                placeholder={tr("At least 10 characters")}
              />
            </label>
            {register && (
              <div className="grid-two">
                <label>
                  {tr("Class")}
                  <select
                    name="classLevel"
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                  >
                    <option value="10">{tr("Class 10")}</option>
                    <option value="12">{tr("Class 12")}</option>
                  </select>
                </label>
                <label>
                  {tr("Stream")}
                  <select key={level} name="stream">
                    {level === "10" ? (
                      <option value="GENERAL">{tr("General")}</option>
                    ) : (
                      tr(
                        ["SCIENCE", "ARTS", "COMMERCE"].map((s) => (
                          <option key={s} value={s}>
                            {tr(s)}
                          </option>
                        )),
                      )
                    )}
                  </select>
                </label>
              </div>
            )}
            <Notice error>{tr(error)}</Notice>
            <button disabled={busy} className="button primary full">
              {busy
                ? tr("Please wait…")
                : register
                  ? tr("Create account")
                  : tr("Sign in")}
              {tr(" ")}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <p className="small">
            {register
              ? tr("Already have an account?")
              : tr("New to BoardTestify?")}
            {tr(" ")}
            <Link to={register ? "/login" : "/register"}>
              {register ? tr("Sign in") : tr("Create an account")}
            </Link>
          </p>
          {!register && (
            <Link className="muted small" to="/phone-login">
              {tr("Sign in with phone OTP \u2192")}
            </Link>
          )}
          {!register && (
            <Link className="muted small" to="/forgot-password">
              {tr("Forgot password?")}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
function Reset({ forgot = false }) {
  useLanguage();
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
        <h2>
          {forgot ? tr("Reset your password") : tr("Choose a new password")}
        </h2>
        <form onSubmit={submit}>
          <label>
            {forgot ? tr("Email") : tr("New password")}
            <input
              name={forgot ? "email" : "password"}
              type={forgot ? "email" : "password"}
              required
              minLength={forgot ? undefined : 10}
            />
          </label>
          <button disabled={busy} className="button primary">
            {busy ? tr("Please wait…") : tr("Continue")}
          </button>
        </form>
        <Notice>{tr(msg)}</Notice>
        <Notice error>{tr(error)}</Notice>
        <Link to="/login">{tr("Return to sign in")}</Link>
      </div>
    </div>
  );
}
function Shell() {
  useLanguage();
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
        <div className="workspace-label">{tr("YOUR LEARNING SPACE")}</div>
        <nav>
          {tr(
            [
              [
                LayoutDashboard,
                "/app",
                lang === "hi" ? "डैशबोर्ड" : "Overview",
              ],
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
                {tr(label)}
              </NavLink>
            )),
          )}
          <NavLink to="/app/resources">
            <BookOpen size={19} />
            {tr("Official references")}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="student-chip">
            <span className="avatar">{tr(user.name[0])}</span>
            <div>
              <strong>{tr(user.name)}</strong>
              <small>
                {tr("Class ")}
                {tr(user.classLevel)}
                {tr(" \xB7 ")}
                {tr(user.stream)}
              </small>
            </div>
          </div>
          <button className="text-button muted" onClick={logout}>
            <LogOut size={16} />
            {tr(" Sign out")}
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="app-header">
          <button
            className="icon-button mobile-only"
            aria-label={tr("Toggle menu")}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <span className="muted small">
            {tr("Your preparation, one day at a time.")}
          </span>
          <div className="row">
            <button
              className="icon-button"
              aria-label={tr("Change language")}
              onClick={language}
            >
              <Languages size={18} />
            </button>
            <span className="tag">
              {tr("BSEB \xB7 CLASS ")}
              {tr(user.classLevel)}
            </span>
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="tests" element={<Tests />} />
            <Route path="resources" element={<ResourceLibrary />} />
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
  const [state, setState] = useState({ path: "", data: null, error: "" }),
    [version, reload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    request(path)
      .then((data) => {
        if (!cancelled) setState({ path, data, error: "" });
      })
      .catch((e) => {
        if (!cancelled) setState({ path, data: null, error: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);
  return {
    data: state.path === path ? state.data : null,
    error: state.path === path ? state.error : "",
    reload: () => reload((v) => v + 1),
  };
}
function Overview() {
  useLanguage();
  const { user } = useApp();
  const { data, error } = useLoad("/attempts");
  const done = data?.filter((a) => a.status !== "ACTIVE") || [];
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">{tr("YOUR JOURNEY, YOUR PACE")}</span>
        <h1>
          {tr("Let\u2019s make progress, ")}
          {tr(user.name.split(" ")[0])}
          <span className="accent">{tr(".")}</span>
        </h1>
        <p>
          {tr("A little practice today. A little more confidence tomorrow.")}
        </p>
      </div>
      <AnnouncementsFeed />
      <div className="dashboard-banner">
        <div>
          <span className="tag">
            {tr("CLASS ")}
            {tr(user.classLevel)}
            {tr(" \xB7 ")}
            {tr(user.stream)}
          </span>
          <h2>
            {tr("Your next milestone")}
            <br />
            {tr("starts with one attempt.")}
          </h2>
          <p>
            {tr("Explore available practice tests and build your momentum.")}
          </p>
          <Link className="button primary" to="/app/tests">
            {tr("Explore tests ")}
            <ArrowUpRight size={17} />
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
        <h2>{tr("Continue your journey")}</h2>
        <Link className="small accent" to="/app/attempts">
          {tr("View all attempts \u2192")}
        </Link>
      </div>
      <Notice error>{tr(error)}</Notice>
      {!data ? (
        <p className="muted">{tr("Loading your activity\u2026")}</p>
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
  useLanguage();
  return (
    <div className="stat">
      <span className="muted small">{tr(label)}</span>
      <strong>{tr(value)}</strong>
      <small className="muted">{tr(detail)}</small>
    </div>
  );
}
function Tests() {
  return <SeriesLibrary />;
}

function AttemptRows({ rows }) {
  useLanguage();
  return (
    <div className="attempt-list">
      {tr(
        rows.map((a) => (
          <Link
            key={a.id}
            to={a.status === "ACTIVE" ? `/exam/${a.id}` : `/result/${a.id}`}
            className="attempt-row"
          >
            <span className="list-icon">
              <BookOpen size={20} />
            </span>
            <div>
              <strong>{tr(a.title)}</strong>
              <small>
                {tr(new Date(a.startedAt).toLocaleDateString())}
                {tr(" \xB7")}
                {tr(" ")}
                {a.status === "ACTIVE"
                  ? tr("In progress")
                  : a.evaluationState === "COMPLETE"
                    ? tr("Result ready")
                    : tr("Evaluation pending")}
              </small>
            </div>
            <span className="tag">
              {a.status === "ACTIVE" ? tr("Resume") : tr("View result")}
            </span>
            <ChevronRight size={17} />
          </Link>
        )),
      )}
    </div>
  );
}
function Attempts() {
  useLanguage();
  const { data, error } = useLoad("/attempts");
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">{tr("EVERY ATTEMPT COUNTS")}</span>
        <h1>
          {tr("My attempts")}
          <span className="accent">{tr(".")}</span>
        </h1>
        <p>{tr("Resume your tests or take a closer look at your results.")}</p>
      </div>
      <Notice error>{tr(error)}</Notice>
      {data?.length ? (
        <AttemptRows rows={data} />
      ) : (
        <Empty
          title={data ? tr("A clean slate") : tr("Loading attempts…")}
          detail="Your practice history will appear here."
        />
      )}
    </>
  );
}
function Progress() {
  useLanguage();
  const { data, error } = useLoad("/analytics");
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">{tr("REFLECT. REFINE. REPEAT.")}</span>
        <h1>
          {tr("See how far you\u2019ve come")}
          <span className="accent">{tr(".")}</span>
        </h1>
        <p>
          {tr(
            "Finalized results show the full picture. Pending descriptive marks remain provisional.",
          )}
        </p>
      </div>
      <Notice error>{tr(error)}</Notice>
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
            <h2>{tr("Recent results")}</h2>
            {data.results.length ? (
              tr(
                data.results.map((r) => (
                  <Link
                    to={`/result/${r.id}`}
                    className="progress-row"
                    key={r.id}
                  >
                    <div>
                      <strong>{tr(r.title)}</strong>
                      <small>
                        {r.provisional
                          ? tr("Provisional · awaiting evaluation")
                          : tr("Final result")}
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
                      {tr(r.awardedMarks)}
                      {tr("/")}
                      {tr(r.maximumMarks)}
                    </strong>
                  </Link>
                )),
              )
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
  useLanguage();
  return (
    <>
      <div className="page-heading">
        <h1>
          {tr("Your learning profile")}
          <span className="accent">{tr(".")}</span>
        </h1>
        <p>{tr("Your account and study access.")}</p>
      </div>
      <div className="grid-two">
        <AccountPanel />
        <BillingPanel />
      </div>
    </>
  );
}
class UiBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="reset-wrap">
        <div className="panel">
          <h2>{tr("Something went wrong")}</h2>
          <p>
            {tr("Your saved answers remain on the server. Reload to continue.")}
          </p>
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            {tr("Reload page")}
          </button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UiBoundary>
      <App />
    </UiBoundary>
  </React.StrictMode>,
);
