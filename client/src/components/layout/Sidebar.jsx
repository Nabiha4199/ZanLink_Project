import React from "react";
import { canCreate } from "../../utils/permissions";

export default function Sidebar({ user, view, onNavigate, onLogout, onStartTour }) {
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">Z</div><strong>Zanlink Flow</strong></div>
      <div className="user-box" data-tour="account">
        <div className="user-avatar">{initials}</div>
        <div><strong>{user.name}</strong><span>{user.role} / {user.department}</span></div>
      </div>
      <nav className="nav">
        <button data-tour="dashboard" className={view === "dashboard" ? "active" : ""} onClick={() => onNavigate("dashboard")}><span className="nav-icon">⌂</span>Dashboard</button>
        {canCreate(user) && <button data-tour="create" className={view === "doc1" ? "active" : ""} onClick={() => onNavigate("doc1")}><span className="nav-icon">＋</span>New Onboarding</button>}
        {canCreate(user) && <button className={view === "maintenance" ? "active" : ""} onClick={() => onNavigate("maintenance")}><span className="nav-icon">◇</span>New Maintenance</button>}
        <button data-tour="summaries" className={view === "summaries" ? "active" : ""} onClick={() => onNavigate("summaries")}><span className="nav-icon">▤</span>Client Summaries</button>
        <button data-tour="reports" className={view === "reports" ? "active" : ""} onClick={() => onNavigate("reports")}><span className="nav-icon">▦</span>Reports</button>
      </nav>
      <button className="tour-launch" onClick={onStartTour}><span className="nav-icon">?</span>Guided tour</button>
      <button className="logout" onClick={onLogout}><span className="nav-icon">↪</span>Sign out</button>
    </aside>
  );
}
