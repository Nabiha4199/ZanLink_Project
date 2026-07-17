import React, { useEffect, useRef, useState } from "react";
import zanlinkLogo from "../assets/zanlink-logo.png";
import { api } from "../services/api";

const defaultGoogleClientId = "72716325306-vco86obca8h85qeoadsc9gbntqimu85u.apps.googleusercontent.com";
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || defaultGoogleClientId;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client?hl=en"]');
    const script = existingScript || document.createElement("script");
    const handleLoad = () => resolve(window.google);
    const handleError = () => reject(new Error("Google sign-in could not be loaded"));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existingScript) {
      script.src = "https://accounts.google.com/gsi/client?hl=en";
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

function GoogleSignIn({ onLogin, showError }) {
  const buttonRef = useRef(null);
  const onLoginRef = useRef(onLogin);
  const showErrorRef = useRef(showError);
  onLoginRef.current = onLogin;
  showErrorRef.current = showError;

  useEffect(() => {
    if (!googleClientId) return undefined;
    let active = true;

    loadGoogleIdentity()
      .then((google) => {
        if (!active || !buttonRef.current) return;
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              onLoginRef.current(await api.googleLogin(response.credential));
            } catch (error) {
              showErrorRef.current(error);
            }
          },
        });
        google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "signin_with",
          width: Math.min(buttonRef.current.offsetWidth || 320, 400),
        });
      })
      .catch((error) => showErrorRef.current(error));

    return () => {
      active = false;
    };
  }, []);

  if (!googleClientId) {
    return <button className="google-disabled" type="button" disabled title="Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in">Sign in with Google</button>;
  }

  return <div className="google-button" ref={buttonRef} />;
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

const registerRoles = [
  ["Engineer", "Engineer"],
  ["Sales", "Sales"],
  ["Accounts", "Accounts"],
  ["Store", "Store"],
  ["Management", "Management"],
  ["HOD", "Head of Department"],
];

export default function LoginPage({ onLogin, showError }) {
  const resetToken = new URLSearchParams(window.location.search).get("reset_token") || "";
  const [mode, setMode] = useState(resetToken ? "reset-password" : "login");
  const [selectedRole, setSelectedRole] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", role: "Engineer", password: "", confirmPassword: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotRole, setForgotRole] = useState("");
  const [resetForm, setResetForm] = useState({ newPassword: "", confirmPassword: "" });
  const [notice, setNotice] = useState("");
  const [authError, setAuthError] = useState("");

  function reportAuthError(error) {
    setNotice("");
    setAuthError(error?.message || String(error));
  }

  function selectRole(role) {
    setSelectedRole(role);
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setNotice("");
    setAuthError("");
  }

  async function submitLogin(event) {
    event.preventDefault();
    setAuthError("");
    try {
      onLogin(await api.login({ ...loginForm, role: selectedRole }));
    } catch (error) {
      reportAuthError(error);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      reportAuthError(new Error("Passwords do not match"));
      return;
    }
    try {
      onLogin(await api.register(registerForm));
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
        <h1>Zanlink Document Flow System</h1>
        <p>Sign in with your Zanlink account.</p>

        {notice && <div className="auth-notice">{notice}</div>}
        {authError && <div className="auth-notice auth-error" role="alert">{authError}</div>}

        {mode === "login" && (
          <>
            <div className="role-step">
              <label htmlFor="role">Select role
                <select id="role" value={selectedRole} onChange={(event) => selectRole(event.target.value)}>
                  <option value="" disabled>Choose your role</option>
                  {demoUsers.map(([role, label]) => <option value={role} key={role}>{label}</option>)}
                </select>
              </label>
            </div>
            <form className="login-form" onSubmit={submitLogin}>
              <label>Email<input autoComplete="email" required type="email" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} /></label>
              <PasswordField label="Password" autoComplete="current-password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} />
              <button className="btn">Sign in</button>
            </form>
            <div className="auth-divider"><span>or</span></div>
            <GoogleSignIn onLogin={onLogin} showError={reportAuthError} />
            <div className="auth-bottom-links">
              <button type="button" onClick={() => switchMode("register")}>Don't have an account?</button>
              <button type="button" onClick={() => switchMode("forgot")}>Forgot password?</button>
            </div>
          </>
        )}

        {mode === "register" && (
          <form className="login-form" onSubmit={submitRegister}>
            <label>Full name<input autoComplete="name" required value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })} /></label>
            <label>Email<input autoComplete="email" required type="email" value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} /></label>
            <label>Role
              <select required value={registerForm.role} onChange={(event) => setRegisterForm({ ...registerForm, role: event.target.value })}>
                {registerRoles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <PasswordField label="Password" autoComplete="new-password" value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} helper="Use at least 8 characters." />
            <PasswordField label="Confirm password" autoComplete="new-password" value={registerForm.confirmPassword} onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })} />
            <button className="btn">Create account</button>
            <button type="button" className="auth-back-link" onClick={() => switchMode("login")}>Back to sign in</button>
          </form>
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
