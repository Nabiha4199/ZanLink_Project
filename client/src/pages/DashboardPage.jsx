import React, { useMemo, useState } from "react";
import { canCreate, statusClass } from "../utils/permissions";

export default function DashboardPage({ user, documents, filters, setFilters, onOpen, onCreateDoc1, onCreateMaintenance }) {
  const [workflowDoc, setWorkflowDoc] = useState(null);
  const [statFilter, setStatFilter] = useState("all");
  const stats = useMemo(() => [
    ["pending", "Pending", documents.filter((doc) => doc.status.startsWith("Pending")).length, "⌛"],
    ["returned", "Returned", documents.filter((doc) => doc.status.includes("Returned")).length, "↩"],
    ["completed", "Completed", documents.filter((doc) => doc.status === "Completed").length, "✓"],
    ["all", "Total Visible", documents.length, "▦"],
  ], [documents]);
  const visibleDocuments = useMemo(() => {
    if (statFilter === "pending") return documents.filter((doc) => doc.status.startsWith("Pending"));
    if (statFilter === "returned") return documents.filter((doc) => doc.status.includes("Returned"));
    if (statFilter === "completed") return documents.filter((doc) => doc.status === "Completed");
    return documents;
  }, [documents, statFilter]);
  const activeStatLabel = stats.find(([key]) => key === statFilter)?.[1] || "Documents";

  return (
    <>
      <div className="topbar dashboard-topbar">
        <div className="page-title"><span className="eyebrow">Employee workspace</span><h1>Welcome, {user.name}</h1><p>Here&apos;s what needs your attention today.</p></div>
        <div className="toolbar">
          {canCreate(user) && <button className="btn" onClick={onCreateDoc1}>New Onboarding</button>}
          {canCreate(user) && <button className="btn secondary" onClick={onCreateMaintenance}>New General Maintenance</button>}
        </div>
      </div>
      <section className="stats dashboard-stats" data-tour="stats">{stats.map(([key, label, value, icon]) => (
        <button
          aria-pressed={statFilter === key}
          className={statFilter === key ? "stat active" : "stat"}
          key={key}
          type="button"
          onClick={() => setStatFilter(key)}
        >
          <span className="stat-icon" aria-hidden="true">{icon}</span><span>{label}</span><b>{value}</b>
        </button>
      ))}</section>
      <section className="panel filters" data-tour="documents">
        <div className="filter-heading"><div><strong>{activeStatLabel}</strong><span>Find and process work assigned to your role</span></div></div>
        <input placeholder="Search number, client, status, department" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
        <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}><option value="">All types</option><option value="doc1">Document 1</option><option value="maintenance">General Maintenance</option></select>
        <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{["Pending Sales", "Returned to Sales", "Pending Client Confirmation", "Pending HOC", "Pending Accounts", "Pending Store", "Pending Management", "Pending HOD", "Completed"].map((status) => <option key={status}>{status}</option>)}</select>
        <select value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })}><option value="">All departments</option>{["Engineer", "Sales", "HOC", "Accounts", "Store", "Management", "HOD"].map((department) => <option key={department}>{department}</option>)}</select>
      </section>
      <DocumentTable user={user} documents={visibleDocuments} onOpen={onOpen} onShowWorkflow={setWorkflowDoc} />
      {workflowDoc && <WorkflowModal doc={workflowDoc} onClose={() => setWorkflowDoc(null)} />}
    </>
  );
}

function DocumentTable({ user, documents, onOpen, onShowWorkflow }) {
  if (!documents.length) return <div className="panel empty">No documents match this view.</div>;
  return (
    <div className="table-wrap dashboard-table-wrap">
      <table>
        <thead><tr><th>Number</th><th>Type</th><th>Client</th><th>Status</th><th>Current Department</th><th>Action</th></tr></thead>
        <tbody>
          {documents.map((doc) => {
            return (
              <tr key={doc.id}>
                <td data-label="Number"><strong>{doc.number}</strong></td>
                <td data-label="Type">{doc.type === "doc1" ? "Onboarding & Stock" : "General Maintenance"}</td>
                <td data-label="Client">{doc.clientName}<br /><small>{doc.location}</small></td>
                <td data-label="Status"><span className={`status ${statusClass(doc.status)}`}>{doc.status}</span></td>
                <td data-label="Current Department">{doc.currentDepartment}</td>
                <td data-label="Action">
                  <div className="table-actions">
                    <button className="btn secondary" onClick={() => onOpen(doc.id)}>Open</button>
                    <button className="btn secondary" type="button" onClick={() => onShowWorkflow(doc)}>Progress</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowModal({ doc, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="section-title">
          <div>
            <h2 id="workflow-modal-title">Workflow Progress</h2>
            <p>{doc.number} / {doc.clientName}</p>
          </div>
          <button className="btn secondary" type="button" onClick={onClose}>Close</button>
        </div>
        <WorkflowTracker doc={doc} />
      </section>
    </div>
  );
}

function WorkflowTracker({ doc }) {
  const { type, status } = doc;
  const stages = type === "maintenance" ? [
    ["Engineer Section", null],
    ["HOD Approval", "Pending HOD"],
    ["Accounts Section", "Pending Accounts"],
  ] : [
    ["Engineer Section", null],
    ["Sales Section", "Pending Sales"],
    ["Client Confirmation", "Pending Client Confirmation"],
    ...(doc.serviceType === "new_installation" ? [["Head of Commercial Approval", "Pending HOC"]] : []),
    ["Accounts Section", "Pending Accounts"],
    ["Store Section", "Pending Store"],
    ["Management", "Pending Management"],
  ];
  const currentIndex = Math.max(1, stages.findIndex(([, pendingStatus]) => pendingStatus === status));
  return (
    <div className="workflow-tracker"><strong>Workflow Progress</strong><div className="workflow-stages" role="list">{stages.map(([label], index) => {
      const state = status === "Completed" || index < currentIndex ? "Completed" : index === currentIndex ? "Pending" : "Not Started";
      const icon = state === "Completed" ? "✓" : state === "Pending" ? "◷" : "○";
      return <div className={`workflow-step ${state.toLowerCase().replace(" ", "-")}`} key={label} role="listitem"><span className="workflow-icon" aria-hidden="true">{icon}</span><b>{label}</b><small>{state}</small></div>;
    })}</div></div>
  );
}
