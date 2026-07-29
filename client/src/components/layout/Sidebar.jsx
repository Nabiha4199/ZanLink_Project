import React from "react";
import zanlinkLogo from "../../assets/zanlink-logo.png";
import { canCreate } from "../../utils/permissions";

const icons = {
  dashboard: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
  clients: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 7.5v7" />
      <path d="M8.5 12h7" />
      <path d="M9 21h6" />
      <path d="M10 14.5 8 21" />
      <path d="m14 14.5 2 6.5" />
    </>
  ),
  onboarding: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  maintenance: (
    <>
      <path d="m12 4 8 8-8 8-8-8Z" />
      <path d="m12 8 4 4-4 4-4-4Z" />
    </>
  ),
  users: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M12 11v9" />
      <path d="M8 15a4 4 0 0 0 8 0" />
      <path d="M7 20h10" />
    </>
  ),
  summaries: (
    <>
      <path d="M5 5h14v14H5Z" />
      <path d="M5 10h14" />
      <path d="M9 5v14" />
      <path d="M13 5v14" />
    </>
  ),
  reports: (
    <>
      <path d="M5 5h14v14H5Z" />
      <path d="M5 9h14" />
      <path d="M5 13h14" />
      <path d="M9 5v14" />
      <path d="M13 5v14" />
      <path d="M17 5v14" />
    </>
  ),
  tour: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.1 9a3 3 0 1 1 5.2 2c-.9.8-1.8 1.3-2.1 2.5" />
      <path d="M12 17h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
};

function NavIcon({ name }) {
  return (
    <span className="nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">{icons[name]}</svg>
    </span>
  );
}

export default function Sidebar({ user, view, onNavigate, onLogout, onStartTour }) {
  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return (
    <aside className="sidebar">
      <div className="brand"><img className="sidebar-brand-logo" src={zanlinkLogo} alt="Zanlink" /></div>
      <div className="user-box" data-tour="account">
        <div className="user-avatar">{initials}</div>
        <div><strong>{user.name}</strong><span>{user.role} / {user.department}</span></div>
      </div>
      <nav className="nav">
        <button data-tour="dashboard" className={view === "dashboard" ? "active" : ""} onClick={() => onNavigate("dashboard")}><NavIcon name="dashboard" />Dashboard</button>
        <button className={view === "clients" ? "active" : ""} onClick={() => onNavigate("clients")}><NavIcon name="clients" />Clients</button>
        {canCreate(user) && <button data-tour="create" className={view === "doc1" ? "active" : ""} onClick={() => onNavigate("doc1")}><NavIcon name="onboarding" />New Onboarding</button>}
        {canCreate(user) && <button className={view === "maintenance" ? "active" : ""} onClick={() => onNavigate("maintenance")}><NavIcon name="maintenance" />New Maintenance</button>}
        {user.role === "System Admin" && <button className={view === "users" ? "active" : ""} onClick={() => onNavigate("users")}><NavIcon name="users" />User Management</button>}
        <button data-tour="summaries" className={view === "summaries" ? "active" : ""} onClick={() => onNavigate("summaries")}><NavIcon name="summaries" />Client Summaries</button>
        <button data-tour="reports" className={view === "reports" ? "active" : ""} onClick={() => onNavigate("reports")}><NavIcon name="reports" />Reports</button>
      </nav>
      <button className="tour-launch" onClick={onStartTour}><NavIcon name="tour" />Guided tour</button>
      <button className="logout" onClick={onLogout}><NavIcon name="logout" />Sign out</button>
    </aside>
  );
}
