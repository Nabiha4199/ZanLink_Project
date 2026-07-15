import React from "react";

export default function ReportsPage({ reports }) {
  if (!reports) return <div className="panel empty">Loading reports...</div>;
  return (
    <>
      <div className="topbar"><div className="page-title"><h1>Reports</h1><p>Operational totals for management review.</p></div></div>
      <section className="stats"><div className="stat"><b>{reports.totalDocuments}</b><span>Total Documents</span></div><div className="stat"><b>{reports.totalSummaries}</b><span>Client Summaries</span></div><div className="stat"><b>{reports.unreadNotifications}</b><span>Unread Notifications</span></div></section>
      <section className="panel"><h2>Status Breakdown</h2><div className="table-wrap"><table><tbody>{Object.entries(reports.statusCounts).map(([status, count]) => <tr key={status}><td>{status}</td><td>{count}</td></tr>)}</tbody></table></div></section>
    </>
  );
}
