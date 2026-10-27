import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLoad, useApp, Notice, Empty } from "./main";
import { api, request, setToken } from "./api";
import { getLanguage, setLanguage, tr, useLanguage } from "@boardtestify/i18n";
export function AnnouncementsFeed() {
  useLanguage();
  const { data } = useLoad("/announcements");
  return data?.length ? (
    <section className="announcements" aria-label={tr("Announcements")}>
      {tr(
        data.map((a) => (
          <article className="notice" key={a._id}>
            <strong>{tr(a.title)}</strong>
            <p>{tr(a.body)}</p>
          </article>
        )),
      )}
    </section>
  ) : null;
}
export function ResourceLibrary() {
  useLanguage();
  const { data, error } = useLoad("/resources");
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">{tr("USE VERIFIED SOURCES")}</span>
        <h1>
          {tr("Official study references")}
          <span className="accent">{tr(".")}</span>
        </h1>
        <p>
          {tr(
            "Model papers are linked to the official board website. Check the examination year before using a pattern.",
          )}
        </p>
      </div>
      <Notice error>{tr(error)}</Notice>
      <div className="test-grid">
        {tr(
          data?.map((r) => (
            <article className="test-card" key={r._id}>
              <span className="tag">
                {tr("BSEB \xB7 ")}
                {tr(r.examYear)}
              </span>
              <h3>{tr(r.title)}</h3>
              <p>{tr(r.note)}</p>
              <small className="muted">
                {tr("Source checked: ")}
                {tr(new Date(r.sourceCheckedAt).toLocaleDateString())}
              </small>
              <a
                className="button subtle"
                target="_blank"
                rel="noreferrer"
                href={r.url}
              >
                {tr("Open official reference \u2197")}
              </a>
            </article>
          )),
        )}
      </div>
      {data?.length === 0 && (
        <Empty
          title="No source references yet"
          detail="Run the catalog seed or have administrators add verified content."
        />
      )}
    </>
  );
}
export function PhoneLogin() {
  useLanguage();
  const { setUser } = useApp(),
    nav = useNavigate();
  const [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function send() {
    setBusy(true);
    try {
      const d = await api("/auth/otp/request", {
        phone,
        purpose: "LOGIN",
      });
      setChallenge(d.challengeId);
      setMessage(d.message);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api("/auth/otp/check", {
        challengeId: challenge,
        code,
        client: "WEB",
      });
      setToken(d.token);
      setUser(d.user);
      nav("/app");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="reset-wrap">
      <Link to="/login">{tr("\u2190 Email sign in")}</Link>
      <div className="panel">
        <h2>{tr("Sign in with your phone")}</h2>
        <p>
          {tr("Use a phone number already verified in your student profile.")}
        </p>
        <form onSubmit={verify}>
          <label>
            {tr("International phone number")}
            <input
              type="tel"
              placeholder={tr("+919876543210")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!!challenge}
            />
          </label>
          {challenge ? (
            <label>
              {tr("Verification code")}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
          ) : null}
          <Notice>{tr(message)}</Notice>
          <Notice error>{tr(error)}</Notice>
          {challenge ? (
            <button className="button primary" disabled={busy}>
              {busy ? tr("Verifying…") : tr("Verify & sign in")}
            </button>
          ) : (
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={send}
            >
              {busy ? tr("Sending…") : tr("Send verification code")}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
export function PhoneLink() {
  useLanguage();
  const { user, setUser } = useApp();
  const features = useLoad("/features");
  const [phone, setPhone] = useState(user.phone || ""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      const d = await request("/auth/otp/request", {
        phone,
        purpose: "LINK",
      });
      setChallenge(d.challengeId);
      setMessage(d.message);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    try {
      const d = await request("/auth/otp/check", {
        challengeId: challenge,
        code,
      });
      setUser(d.user);
      setChallenge("");
      setMessage("Phone verified. You can now sign in with OTP.");
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="form-section">
      <h3>{tr("Phone verification")}</h3>
      <p className="small muted">
        {user.phoneVerified
          ? tr("Your phone is verified.")
          : tr("Link a phone to enable OTP sign-in.")}
      </p>
      {features.data?.phoneOTP ? (
        <>
          <label>
            {tr("International phone number")}
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={tr("+919876543210")}
            />
          </label>
          {challenge ? (
            <>
              <label>
                {tr("Verification code")}
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button
                className="button primary"
                disabled={busy}
                onClick={verify}
              >
                {tr("Verify phone")}
              </button>
            </>
          ) : (
            <button className="button subtle" disabled={busy} onClick={send}>
              {tr("Send verification code")}
            </button>
          )}
        </>
      ) : (
        <span className="tag">{tr("Phone OTP is not configured")}</span>
      )}
      <Notice>{tr(message)}</Notice>
      <Notice error>{tr(error)}</Notice>
    </div>
  );
}
export function AccountPanel() {
  useLanguage();
  const { user, setUser } = useApp();
  const [level, setLevel] = useState(user.classLevel),
    [stream, setStream] = useState(user.stream),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = Object.fromEntries(new FormData(e.currentTarget));
      const u = await request("/auth/me", d, "PATCH");
      setUser(u);
      setLanguage(u.language);
      setMessage("Profile saved.");
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="panel">
      <h2>{tr("Your profile")}</h2>
      <p className="muted">{tr(user.email)}</p>
      <form onSubmit={save}>
        <label>
          {tr("Full name")}
          <input name="name" defaultValue={user.name} required />
        </label>
        <div className="grid-two">
          <label>
            {tr("Class")}
            <select
              name="classLevel"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setStream(e.target.value === "10" ? "GENERAL" : "SCIENCE");
              }}
            >
              <option value="10">{tr("Class 10")}</option>
              <option value="12">{tr("Class 12")}</option>
            </select>
          </label>
          <label>
            {tr("Stream")}
            <select
              name="stream"
              value={stream}
              onChange={(e) => setStream(e.target.value)}
            >
              {tr(
                (level === "10"
                  ? ["GENERAL"]
                  : ["SCIENCE", "ARTS", "COMMERCE"]
                ).map((s) => (
                  <option value={s} key={s}>
                    {tr(s)}
                  </option>
                )),
              )}
            </select>
          </label>
        </div>
        <label>
          {tr("Interface language")}
          <select name="language" defaultValue={getLanguage()}>
            <option value="en">{tr("English")}</option>
            <option value="hi">
              {tr("\u0939\u093F\u0928\u094D\u0926\u0940")}
            </option>
          </select>
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? tr("Saving…") : tr("Save profile")}
        </button>
      </form>
      <Notice>{tr(message)}</Notice>
      <Notice error>{tr(error)}</Notice>
      <p className="small muted">
        {tr("Finish active tests before changing your class or stream.")}
      </p>
      <Link className="accent small" to="/forgot-password">
        {tr("Reset password \u2192")}
      </Link>
      <PhoneLink />
    </div>
  );
}
let checkoutPromise;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return (checkoutPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = () => {
      checkoutPromise = null;
      reject(Error("Unable to load checkout"));
    };
    document.head.appendChild(script);
  }));
}
export function BillingPanel() {
  useLanguage();
  const { user } = useApp();
  const { data, reload, error } = useLoad("/billing");
  const plans = useLoad("/billing/plans"),
    features = useLoad("/features");
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [err, setErr] = useState("");
  async function buy(plan) {
    setBusy(plan._id);
    setErr("");
    try {
      await loadCheckout();
      const recurring = plan.billingModel === "RECURRING";
      const order = await request(
        recurring ? "/billing/subscriptions" : "/billing/order",
        {
          planId: plan._id,
        },
      );
      new window.Razorpay({
        key: order.keyId,
        ...(recurring
          ? {
              subscription_id: order.subscriptionId,
            }
          : {
              order_id: order.orderId,
              amount: order.amount,
              currency: "INR",
            }),
        name: "BoardTestify",
        description: plan.name,
        prefill: {
          email: user.email,
          name: user.name,
        },
        theme: {
          color: "#f97316",
        },
        handler: async (r) => {
          try {
            const result = await request(
              recurring ? "/billing/subscriptions/verify" : "/billing/verify",
              recurring
                ? {
                    subscriptionId: order.subscriptionId,
                    paymentId: r.razorpay_payment_id,
                    signature: r.razorpay_signature,
                  }
                : {
                    orderId: order.orderId,
                    paymentId: r.razorpay_payment_id,
                    signature: r.razorpay_signature,
                  },
            );
            reload();
            setMessage(
              recurring && !result.accessActive
                ? "Subscription authorized. Access starts after a captured billing payment."
                : "Payment verified. Your study access is active.",
            );
          } catch (e) {
            setErr(e.message);
          }
        },
      }).open();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }
  async function cancel(s) {
    if (
      !window.confirm("Cancel renewal at the end of the current billing cycle?")
    )
      return;
    try {
      await request(`/billing/subscriptions/${s.providerId}/cancel`, {});
      reload();
      setMessage(
        "Cancellation requested. Already-paid access remains until its expiry.",
      );
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <div className="panel">
      <span className="eyebrow">{tr("YOUR STUDY ACCESS")}</span>
      <h2>
        {data?.entitlement
          ? tr("Your pass is active.")
          : tr("Choose your study plan.")}
      </h2>
      {data?.entitlement && (
        <p>
          {tr("Active until ")}
          {tr(new Date(data.entitlement.expiresAt).toLocaleDateString())}
        </p>
      )}
      <Notice error>{error || err || tr(plans.error)}</Notice>
      <Notice>{tr(message)}</Notice>
      {tr(
        plans.data?.map((p) => (
          <div className="plan-card" key={p._id}>
            <div>
              <h3>{tr(p.name)}</h3>
              <p className="small muted">{tr(p.description)}</p>
              <strong>
                {tr("\u20B9")}
                {tr(p.pricePaise / 100)}
              </strong>
              <small>
                {p.billingModel === "RECURRING"
                  ? tr("{0} {1} billing period \xB7 automatic renewal", [
                      p.interval,
                      p.period,
                    ])
                  : tr("{0} days \xB7 no automatic renewal", [p.durationDays])}
              </small>
            </div>
            <button
              className="button primary"
              disabled={!!busy || !features.data?.payments}
              onClick={() => buy(p)}
            >
              {busy === p._id
                ? tr("Opening…")
                : p.billingModel === "RECURRING"
                  ? tr("Subscribe")
                  : tr("Get study pass")}
            </button>
          </div>
        )),
      )}
      {!features.data?.payments && (
        <span className="tag">{tr("Payments are not enabled")}</span>
      )}
      {data?.subscriptions?.length > 0 && <h3>{tr("Your subscriptions")}</h3>}
      {tr(
        data?.subscriptions?.map((s) => (
          <div className="admin-row" key={s._id}>
            <div>
              <strong>{tr(s.plan.name)}</strong>
              <small>
                {tr(s.status)}
                {s.currentEnd
                  ? tr(" \xB7 {0}", [
                      new Date(s.currentEnd).toLocaleDateString(),
                    ])
                  : tr("")}
              </small>
            </div>
            {!["cancelled", "completed", "expired"].includes(s.status) && (
              <button className="button ghost" onClick={() => cancel(s)}>
                {tr("Cancel renewal")}
              </button>
            )}
          </div>
        )),
      )}
      {data?.payments?.length > 0 && (
        <details>
          <summary>{tr("Payment history")}</summary>
          {tr(
            data.payments.map((p) => (
              <div className="admin-row" key={p._id}>
                <span>{p.plan?.name || tr("Study pass")}</span>
                <span>
                  {tr("\u20B9")}
                  {tr(p.amount / 100)}
                  {tr(" \xB7 ")}
                  {tr(p.status)}
                </span>
              </div>
            )),
          )}
        </details>
      )}
    </div>
  );
}
