import React, { useMemo } from "react";
import { canCreate, statusClass } from "../utils/permissions";

export default function DashboardPage({ user, documents, filters, setFilters, onOpen, onCreateDoc1, onCreateMaintenance }) {
  const stats = useMemo(() => [
    ["Pending Here", documents.filter((doc) => doc.currentDepartment === user.department && doc.status !== "Completed").length, "⌛"],
    ["Returned", documents.filter((doc) => doc.status.includes("Returned")).length, "↩"],
    ["Completed", documents.filter((doc) => doc.status === "Completed").length, "✓"],
    ["Total Visible", documents.length, "▦"],
  ], [documents, user.department]);

  return (
    <>
      <div className="topbar dashboard-topbar">
        <div className="page-title"><span className="eyebrow">Employee workspace</span><h1>Welcome back, {user.name}</h1><p>Here&apos;s what needs your attention today.</p></div>
        <div className="toolbar">
          {canCreate(user) && <button className="btn" onClick={onCreateDoc1}>New Onboarding</button>}
          {canCreate(user) && <button className="btn secondary" onClick={onCreateMaintenance}>New Maintenance</button>}
        </div>
      </div>
      <section className="stats">{stats.map(([label, value, icon]) => <div className="stat" key={label}><span className="stat-icon" aria-hidden="true">{icon}</span><span>{label}</span><b>{value}</b></div>)}</section>
      <section className="panel filters">
        <div className="filter-heading"><div><strong>Documents</strong><span>Find and process work assigned to your role</span></div></div>
        <input placeholder="Search number, client, status, department" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
        <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All types</option><option value="doc1">Document 1</option><option value="maintenance">Maintenance</option></select>
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{["Pending Sales", "Returned to Sales", "Pending Accounts", "Pending Store", "Pending Management", "Pending HOD", "Completed"].map((status) => <option key={status}>{status}</option>)}</select>
        <select value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })}><option value="">All departments</option>{["Engineer", "Sales", "Accounts", "Store", "Management", "HOD"].map((department) => <option key={department}>{department}</option>)}</select>
      </section>
      <DocumentTable user={user} documents={documents} onOpen={onOpen} />
    </>
  );
}

function DocumentTable({ user, documents, onOpen }) {
  if (!documents.length) return <div className="panel empty">No documents match this view.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Number</th><th>Type</th><th>Client</th><th>Status</th><th>Current Department</th><th>Action</th></tr></thead>
        <tbody>
          {documents.map((doc) => {
            const engineerTracking = user.role === "Engineer" && !["Draft", "Completed"].includes(doc.status);
            return (
              <React.Fragment key={doc.id}>
                <tr>
                  <td><strong>{doc.number}</strong></td>
                  <td>{doc.type === "doc1" ? "Onboarding & Stock" : "Maintenance"}</td>
                  <td>{doc.clientName}<br /><small>{doc.location}</small></td>
                  <td><span className={`status ${statusClass(doc.status)}`}>{doc.status}</span></td>
                  <td>{doc.currentDepartment}</td>
                  <td>{!engineerTracking && <button className="btn secondary" onClick={() => onOpen(doc.id)}>Open</button>}</td>
                </tr>
                {engineerTracking && <tr><td colSpan="6"><WorkflowTracker type={doc.type} status={doc.status} /></td></tr>}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowTracker({ type, status }) {
  const stages = type === "maintenance" ? [
    ["Engineer Section", null],
    ["HOD Approval", "Pending HOD"],
    ["Accounts Section", "Pending Accounts"],
  ] : [
    ["Engineer Section", null],
    ["Sales Section", "Pending Sales"],
    ["Accounts Section", "Pending Accounts"],
    ["Store Section", "Pending Store"],
    ["Management", "Pending Management"],
  ];
  const currentIndex = Math.max(1, stages.findIndex(([, pendingStatus]) => pendingStatus === status));
  return (
    <div className="workflow-tracker"><strong>Workflow Progress</strong>{stages.map(([label], index) => {
      const state = status === "Completed" || index < currentIndex ? "Completed" : index === currentIndex ? "Pending" : "Not Started";
      return <div className={`workflow-step ${state.toLowerCase().replace(" ", "-")}`} key={label}><span>{state === "Completed" ? "✓" : state === "Pending" ? "⏳" : "○"}</span><b>{label}</b><small>{state}</small></div>;
    })}</div>
  );
}
