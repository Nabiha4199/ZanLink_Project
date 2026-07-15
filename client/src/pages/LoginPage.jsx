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

export default function LoginPage({ onLogin, showError }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [form, setForm] = useState({ username: "", password: "demo123" });

  function selectRole(username) {
    setSelectedRole(username);
    setForm({ username, password: "demo123" });
  }

  async function submit(event) {
    event.preventDefault();
    try {
      onLogin(await api.login(form));
    } catch (error) {
      showError(error);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">Z</div>
        <h1>Zanlink Document Flow System</h1>
        <div className="role-step">
          <label htmlFor="role">Select your role
            <select id="role" value={selectedRole} onChange={(event) => selectRole(event.target.value)}>
              <option value="" disabled>Choose your role</option>
              {demoUsers.map(([username, label]) => <option value={username} key={username}>{label}</option>)}
            </select>
          </label>
        </div>
        {selectedRole && (
          <form className="login-form" onSubmit={submit}>
            <label>Username<input autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
            <label>Password<input autoComplete="current-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            <button className="btn">Sign in</button>
          </form>
        )}
      </section>
      <section className="hero-art">
        <div className="employee-welcome">
          <span>Welcome to Zanlink</span>
          <h2>Powering Zanzibar&apos;s digital future, together.</h2>
          <p>Customer service&nbsp;&nbsp;•&nbsp;&nbsp;Teamwork&nbsp;&nbsp;•&nbsp;&nbsp;Innovation&nbsp;&nbsp;•&nbsp;&nbsp;Professionalism</p>
        </div>
      </section>
    </main>
  );
}
