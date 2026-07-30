import React, { useMemo, useState } from "react";
import { formatDate } from "../utils/formatters";
import { statusClass } from "../utils/permissions";

const PERIODS = [
  ["day", "1 Day"],
  ["week", "1 Week"],
  ["month", "1 Month"],
];

const METRICS = [
  ["all", "Request", "totalRequests"],
  ["approved", "Approved Requests", "approvedRequests"],
  ["pending", "Pending Requests", "pendingRequests"],
  ["successful", "Successful Requests", "successfulRequests"],
];

export default function ReportsPage({ reports }) {
  const [periodKey, setPeriodKey] = useState("week");
  const [detailKey, setDetailKey] = useState("all");
  const period = reports?.periods?.[periodKey];
  const rows = useMemo(() => {
    const requests = period?.requests || [];
    if (detailKey === "all") return requests;
    return requests.filter((request) => request[detailKey]);
  }, [period, detailKey]);

  if (!reports) return <div className="panel empty">Loading reports...</div>;

  return (
    <>
      <div className="topbar">
        <div className="page-title">
          <h1>Reports</h1>
          <p>Request totals and drill-down lists for daily, weekly, and monthly review.</p>
        </div>
      </div>

      <div className="report-tabs" role="tablist" aria-label="Report period">
        {PERIODS.map(([key, label]) => (
          <button
            className={periodKey === key ? "active" : ""}
            key={key}
            type="button"
            onClick={() => {
              setPeriodKey(key);
              setDetailKey("all");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="stats report-stats report-metrics" aria-label="Report request filters">
        {METRICS.map(([key, label, valueKey]) => (
          <button
            className={detailKey === key ? "stat active" : "stat"}
            aria-pressed={detailKey === key}
            key={key}
            type="button"
            onClick={() => setDetailKey(key)}
          >
            <span>{label}</span>
            <b>{period?.[valueKey] || 0}</b>
          </button>
        ))}
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>{METRICS.find(([key]) => key === detailKey)?.[1]} / {PERIODS.find(([key]) => key === periodKey)?.[1]}</h2>
          <span>{rows.length} request{rows.length === 1 ? "" : "s"}</span>
        </div>
        <ReportTable rows={rows} mode={detailKey} />
      </section>
    </>
  );
}

function ReportTable({ rows, mode }) {
  if (!rows.length) return <div className="empty">No requests match this report view.</div>;
  return (
    <div className="table-wrap reports-table-wrap">
      <table className="reports-table">
        <thead>
          <tr>
            <th>Number</th>
            <th>Type</th>
            <th>Client</th>
            <th>Status</th>
            <th>Department</th>
            <th>Created</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((request) => (
            <tr key={request.id}>
              <td data-label="Number"><strong>{request.number}</strong></td>
              <td data-label="Type">{request.type === "doc1" ? "Onboarding & Stock" : "Maintenance"}</td>
              <td data-label="Client">{request.clientName}<br /><small>{request.location}</small></td>
              <td data-label="Status"><span className={`status ${statusClass(request.status)}`}>{request.status}</span></td>
              <td data-label="Department">{request.currentDepartment}</td>
              <td data-label="Created">{formatDate(request.createdAt)}</td>
              <td data-label="Reason">{requestReason(request, mode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function requestReason(request, mode) {
  if (mode === "pending" || request.pending) return request.pendingReason || "-";
  if (mode === "successful" || request.successful) return "Workflow completed successfully.";
  if (mode === "approved" || request.approved) return request.successful ? "Final approval completed." : "Approved and waiting for the next workflow step.";
  return request.rejectionReason || request.pendingReason || "-";
}
