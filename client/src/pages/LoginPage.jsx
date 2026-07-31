import React, { useEffect, useState } from "react";
import zanlinkLogo from "../assets/zanlink-logo.png";
import { api } from "../services/api";

const apiUrl = import.meta.env.VITE_API_URL || "";

function MicrosoftSignIn() {
  return (
    <button className="microsoft-sign-in" type="button" onClick={() => window.location.assign(`${apiUrl}/api/auth/microsoft/login`)}>
      <span aria-hidden="true" className="microsoft-mark"><i /><i /><i /><i /></span>
      <span>Sign in with Microsoft</span>
    </button>
  );
}

function EyeIcon({ hidden }) {
  return (
    <svg aria-hidden="true" className="password-eye-icon" viewBox="0 0 24 24">
      <path d="M2.1 12s3.4-6 9.9-6 9.9 6 9.9 6-3.4 6-9.9 6-9.9-6-9.9-6Z" />
      <circle cx="12" cy="12" r="3" />
      {hidden && <path className="password-eye-slash" d="M4 4l16 16" />}
    </svg>
  );
}

function PasswordField({ label, value, onChange, autoComplete, helper }) {
  const [visible, setVisible] = useState(false);

  return (
    <label>{label}
      <span className="password-input-wrap">
        <input
          autoComplete={autoComplete}
          required
          minLength="8"
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          className="password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
        >
          <EyeIcon hidden={visible} />
        </button>
      </span>
      {helper && <small>{helper}</small>}
    </label>
  );
}

const demoUsers = [
  ["Engineer", "Engineer"],
  ["Sales", "Sales"],
  ["Accounts", "Accounts"],
  ["Store", "Store"],
  ["Management", "Management"],
  ["HOD", "Head of Department"],
  ["System Admin", "System Admin"],
];

export default function LoginPage({ onLogin, showError }) {
  const resetToken = new URLSearchParams(window.location.search).get("reset_token") || "";
  const microsoftAuthCode = new URLSearchParams(window.location.search).get("microsoft_auth_code") || "";
  const microsoftError = new URLSearchParams(window.location.search).get("microsoft_error") || "";
  const [mode, setMode] = useState(resetToken ? "reset-password" : "login");
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotRole, setForgotRole] = useState("");
  const [resetForm, setResetForm] = useState({ newPassword: "", confirmPassword: "" });
  const [notice, setNotice] = useState("");
  const [authError, setAuthError] = useState("");

  function reportAuthError(error) {
    const message = error?.message || String(error);
    if (message.includes("System Admin approval")) {
      setNotice(message);
      setAuthError("");
      return;
    }
    setNotice("");
    setAuthError(message);
  }

  useEffect(() => {
    if (microsoftError) {
      setAuthError(microsoftError);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!microsoftAuthCode) return;
    api.microsoftComplete(microsoftAuthCode)
      .then(onLogin)
      .catch(reportAuthError)
      .finally(() => window.history.replaceState({}, "", window.location.pathname));
  }, []);

  function switchMode(nextMode) {
    setMode(nextMode);
    setNotice("");
    setAuthError("");
  }

  async function submitLogin(event) {
    event.preventDefault();
    setAuthError("");
    try {
      onLogin(await api.login(loginForm));
    } catch (error) {
      reportAuthError(error);
    }
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    try {
      const response = await api.forgotPassword({ email: forgotEmail, role: forgotRole });
      setNotice(response.message);
      setAuthError("");
      setForgotEmail("");
      setForgotRole("");
      setMode("login");
    } catch (error) {
      reportAuthError(error);
    }
  }

  async function submitResetPassword(event) {
    event.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      reportAuthError(new Error("Passwords do not match"));
      return;
    }
    try {
      const response = await api.resetPassword({ token: resetToken, ...resetForm });
      setNotice(response.message);
      setAuthError("");
      setResetForm({ newPassword: "", confirmPassword: "" });
      window.history.replaceState({}, "", window.location.pathname);
      setMode("login");
    } catch (error) {
      reportAuthError(error);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <img className="login-brand-logo" src={zanlinkLogo} alt="Zanlink" />

        {notice && <div className="auth-notice">{notice}</div>}
        {authError && <div className="auth-notice auth-error" role="alert">{authError}</div>}

        {mode === "login" && (
          <>
            <form className="login-form" onSubmit={submitLogin}>
              <label>Username or email<input autoComplete="username" required value={loginForm.identifier} onChange={(event) => setLoginForm({ ...loginForm, identifier: event.target.value })} /></label>
              <PasswordField label="Password" autoComplete="current-password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} />
              <button className="btn">Sign in</button>
            </form>
            <div className="auth-divider"><span>or</span></div>
            <MicrosoftSignIn />
            <div className="auth-bottom-links">
              <button type="button" onClick={() => switchMode("forgot")}>Forgot password?</button>
            </div>
            <p className="form-helper">Accounts are created by a System Admin.</p>
          </>
        )}

        {mode === "forgot" && (
          <form className="login-form" onSubmit={submitForgotPassword}>
            <h2>Reset your password</h2>
            <p>Select your role and enter the email address connected to that account. We will send you a secure reset link.</p>
            <label>Role
              <select required value={forgotRole} onChange={(event) => setForgotRole(event.target.value)}>
                <option value="" disabled>Choose your role</option>
                {demoUsers.map(([role, label]) => <option value={role} key={role}>{label}</option>)}
              </select>
            </label>
            <label>Email<input autoComplete="email" required type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} /></label>
            <button className="btn">Send reset link</button>
            <button type="button" className="auth-back-link" onClick={() => switchMode("login")}>Back to sign in</button>
          </form>
        )}

        {mode === "reset-password" && (
          <form className="login-form" onSubmit={submitResetPassword}>
            <h2>Choose a new password</h2>
            <PasswordField label="New password" autoComplete="new-password" value={resetForm.newPassword} onChange={(event) => setResetForm({ ...resetForm, newPassword: event.target.value })} helper="Use at least 8 characters." />
            <PasswordField label="Confirm new password" autoComplete="new-password" value={resetForm.confirmPassword} onChange={(event) => setResetForm({ ...resetForm, confirmPassword: event.target.value })} />
            <button className="btn">Reset password</button>
            <button type="button" className="auth-back-link" onClick={() => switchMode("login")}>Back to sign in</button>
          </form>
        )}
      </section>
      <section className="hero-art">
        <div className="employee-welcome">
          <span>Welcome to Zanlink</span>
          <h2>Powering Zanzibar&apos;s digital future, together.</h2>
          <p>Customer service&nbsp;&nbsp;/&nbsp;&nbsp;Teamwork&nbsp;&nbsp;/&nbsp;&nbsp;Innovation&nbsp;&nbsp;/&nbsp;&nbsp;Professionalism</p>
        </div>
      </section>
    </main>
  );
}
