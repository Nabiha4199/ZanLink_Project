import React, { useState } from "react";
import { api } from "../services/api";

const demoUsers = [
  ["engineer", "Engineer"],
  ["sales", "Sales"],
  ["accounts", "Accounts"],
  ["store", "Store"],
  ["management", "Management"],
  ["hod", "Head of Department"],
  ["admin", "System Admin"],
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
  const [mode, setMode] = useState("login");
  const [selectedRole, setSelectedRole] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "demo123" });
  const [registerForm, setRegisterForm] = useState({ name: "", username: "", role: "Engineer", password: "", confirmPassword: "" });
  const [resetForm, setResetForm] = useState({ username: "", newPassword: "", confirmPassword: "" });
  const [notice, setNotice] = useState("");

  function selectRole(username) {
    setSelectedRole(username);
    setLoginForm({ username, password: "demo123" });
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setNotice("");
  }

  async function submitLogin(event) {
    event.preventDefault();
    try {
      onLogin(await api.login(loginForm));
    } catch (error) {
      showError(error);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      showError(new Error("Passwords do not match"));
      return;
    }
    try {
      onLogin(await api.register(registerForm));
    } catch (error) {
      showError(error);
    }
  }

  async function submitReset(event) {
    event.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      showError(new Error("Passwords do not match"));
      return;
    }
    try {
      const response = await api.forgotPassword(resetForm);
      setNotice(response.message || "Password updated. You can sign in now.");
      setLoginForm({ username: resetForm.username, password: "" });
      setResetForm({ username: "", newPassword: "", confirmPassword: "" });
      setMode("login");
    } catch (error) {
      showError(error);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">Z</div>
        <h1>Zanlink Document Flow System</h1>
        <p>Sign in with your Zanlink account.</p>

        {notice && <div className="auth-notice">{notice}</div>}

        {mode === "login" && (
          <>
            <div className="role-step">
              <label htmlFor="role">Select demo role
                <select id="role" value={selectedRole} onChange={(event) => selectRole(event.target.value)}>
                  <option value="" disabled>Choose your role</option>
                  {demoUsers.map(([username, label]) => <option value={username} key={username}>{label}</option>)}
                </select>
              </label>
            </div>
            <form className="login-form" onSubmit={submitLogin}>
              <label>Username<input autoComplete="username" required value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} /></label>
              <label>Password<input autoComplete="current-password" required type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} /></label>
              <button className="btn">Sign in</button>
            </form>
            <div className="auth-bottom-links">
              <button type="button" onClick={() => switchMode("register")}>Don't have an account?</button>
              <button type="button" onClick={() => switchMode("reset")}>Forget password?</button>
            </div>
          </>
        )}

        {mode === "register" && (
          <form className="login-form" onSubmit={submitRegister}>
            <label>Full name<input autoComplete="name" required value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })} /></label>
            <label>Username<input autoComplete="username" required value={registerForm.username} onChange={(event) => setRegisterForm({ ...registerForm, username: event.target.value })} /></label>
            <label>Role
              <select required value={registerForm.role} onChange={(event) => setRegisterForm({ ...registerForm, role: event.target.value })}>
                {registerRoles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label>Password<input autoComplete="new-password" required minLength="6" type="password" value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} /></label>
            <label>Confirm password<input autoComplete="new-password" required minLength="6" type="password" value={registerForm.confirmPassword} onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })} /></label>
            <button className="btn">Create account</button>
            <button type="button" className="auth-back-link" onClick={() => switchMode("login")}>Back to sign in</button>
          </form>
        )}

        {mode === "reset" && (
          <form className="login-form" onSubmit={submitReset}>
            <label>Username<input autoComplete="username" required value={resetForm.username} onChange={(event) => setResetForm({ ...resetForm, username: event.target.value })} /></label>
            <label>New password<input autoComplete="new-password" required minLength="6" type="password" value={resetForm.newPassword} onChange={(event) => setResetForm({ ...resetForm, newPassword: event.target.value })} /></label>
            <label>Confirm new password<input autoComplete="new-password" required minLength="6" type="password" value={resetForm.confirmPassword} onChange={(event) => setResetForm({ ...resetForm, confirmPassword: event.target.value })} /></label>
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
