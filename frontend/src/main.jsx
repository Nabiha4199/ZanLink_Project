import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import "./styles.css";

const demoUsers = [
  ["engineer", "Engineer"],
  ["sales", "Sales"],
  ["accounts", "Accounts"],
  ["store", "Store"],
  ["management", "Management"],
  ["hod", "Head of Department"],
  ["admin", "System Admin"],
];

const emptyItem = { name: "", requestedQty: 1, issuedQty: 0, serialNumber: "", purpose: "", unitCost: 0 };
const engineerStockItems = [
  { id: "NET-001", description: "UTP Network Cable CAT6" },
  { id: "FIB-001", description: "Fibre Optic Drop Cable" },
  { id: "RTR-001", description: "Network Router" },
];
const serviceTypes = [
  ["new_installation", "New Installation"],
  ["reconnection", "Reconnection"],
  ["wifi_extension", "WiFi Extension"],
];

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("zanlink-user") || "null"));
  const [view, setView] = useState("dashboard");
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [reports, setReports] = useState(null);
  const [filters, setFilters] = useState({ q: "", type: "", status: "", department: "" });
  const [message, setMessage] = useState("");

  const selected = documents.find((doc) => doc.id === selectedId);

  async function refresh(nextFilters = filters) {
    if (!user) return;
    const [docs, summaryData, reportData] = await Promise.all([
      api.documents(user, nextFilters),
      api.summaries(user),
      api.reports(user),
    ]);
    setDocuments(docs);
    setSummaries(summaryData);
    setReports(reportData);
  }

  useEffect(() => {
    if (user) {
      localStorage.setItem("zanlink-user", JSON.stringify(user));
      refresh().catch(showError);
    }
  }, [user]);

  function showError(error) {
    setMessage(error.message || String(error));
    setTimeout(() => setMessage(""), 3200);
  }

  async function run(action, success) {
    try {
      await action();
      await refresh();
      setSelectedId(null);
      setView("dashboard");
      setMessage(success);
      setTimeout(() => setMessage(""), 2600);
    } catch (error) {
      showError(error);
    }
  }

  if (!user) return <Login onLogin={setUser} showError={showError} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">Z</div><strong>Zanlink Flow</strong></div>
        <div className="user-box"><strong>{user.name}</strong><span>{user.role} / {user.department}</span></div>
        <nav className="nav">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => { setView("dashboard"); setSelectedId(null); }}>Dashboard</button>
          {canCreate(user) && <button className={view === "doc1" ? "active" : ""} onClick={() => setView("doc1")}>New Onboarding</button>}
          {canCreate(user) && <button className={view === "maintenance" ? "active" : ""} onClick={() => setView("maintenance")}>New Maintenance</button>}
          <button className={view === "summaries" ? "active" : ""} onClick={() => setView("summaries")}>Client Summaries</button>
          <button className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}>Reports</button>
        </nav>
        <button className="logout" onClick={() => { localStorage.removeItem("zanlink-user"); setUser(null); }}>Sign out</button>
      </aside>
      <main className="main">
        {selected ? (
          <DocumentDetail user={user} doc={selected} onBack={() => setSelectedId(null)} run={run} />
        ) : view === "doc1" ? (
          <Doc1Form onCancel={() => setView("dashboard")} onSubmit={(payload) => run(() => api.createDoc1(user, payload), "Document submitted to Sales.")} />
        ) : view === "maintenance" ? (
          <MaintenanceForm onCancel={() => setView("dashboard")} onSubmit={(payload) => run(() => api.createMaintenance(user, payload), "Maintenance request submitted to HOD.")} />
        ) : view === "summaries" ? (
          <Summaries user={user} summaries={summaries} documents={documents} refresh={refresh} showError={showError} />
        ) : view === "reports" ? (
          <Reports reports={reports} />
        ) : (
          <Dashboard
            user={user}
            documents={documents}
            filters={filters}
            setFilters={(next) => {
              setFilters(next);
              refresh(next).catch(showError);
            }}
            onOpen={setSelectedId}
            onCreateDoc1={() => setView("doc1")}
            onCreateMaintenance={() => setView("maintenance")}
          />
        )}
      </main>
      {message && <div className="toast">{message}</div>}
    </div>
  );
}

function Login({ onLogin, showError }) {
  const [form, setForm] = useState({ username: "engineer", password: "demo123" });

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
        <p>Controlled movement for onboarding, stock requisition, client summaries, and maintenance requests.</p>
        <form className="login-form" onSubmit={submit}>
          <label>Username<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
          <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <button className="btn">Sign in</button>
        </form>
        <div className="demo-grid">
          {demoUsers.map(([username, label]) => (
            <button className="demo-pill" key={username} onClick={() => setForm({ username, password: "demo123" })}>{label}: {username}</button>
          ))}
        </div>
      </section>
      <section className="hero-art"><div><h2>Documents move to the right department, with every action recorded.</h2><p>Engineer to Sales to Accounts to Store to Management, with corrections, summaries, and maintenance approvals routed automatically.</p></div></section>
    </main>
  );
}

function Dashboard({ user, documents, filters, setFilters, onOpen, onCreateDoc1, onCreateMaintenance }) {
  const stats = useMemo(() => [
    ["Pending Here", documents.filter((doc) => doc.currentDepartment === user.department && doc.status !== "Completed").length],
    ["Returned", documents.filter((doc) => doc.status.includes("Returned")).length],
    ["Completed", documents.filter((doc) => doc.status === "Completed").length],
    ["Total Visible", documents.length],
  ], [documents, user.department]);

  return (
    <>
      <div className="topbar">
        <div className="page-title"><h1>Dashboard</h1><p>Search, filter, and process documents assigned to your role.</p></div>
        <div className="toolbar">
          {canCreate(user) && <button className="btn" onClick={onCreateDoc1}>New Onboarding</button>}
          {canCreate(user) && <button className="btn secondary" onClick={onCreateMaintenance}>New Maintenance</button>}
        </div>
      </div>
      <section className="stats">{stats.map(([label, value]) => <div className="stat" key={label}><b>{value}</b><span>{label}</span></div>)}</section>
      <section className="panel filters">
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

function Doc1Form({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ clientName: "", contact: "", location: "", service: "", serviceType: "new_installation", engineerNotes: "", items: [{ ...emptyItem }] });
  return (
    <FormShell title="New Document 1" subtitle="Customer onboarding and stock requisition starts from Engineer." onCancel={onCancel} onSubmit={() => onSubmit(form)} submitLabel="Submit to Sales">
      <div className="form-grid">
        {textInput("Client Name", "clientName", form, setForm)}
        {textInput("Contact", "contact", form, setForm)}
        {textInput("Location", "location", form, setForm)}
        {textInput("Requested Service", "service", form, setForm)}
        <label className="wide">Onboarding Type
          <div className="segmented-control">
            {serviceTypes.map(([value, label]) => (
              <button
                className={form.serviceType === value ? "active" : ""}
                key={value}
                type="button"
                onClick={() => setForm({ ...form, serviceType: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </label>
        <label className="wide">Engineer Notes<textarea value={form.engineerNotes} onChange={(event) => setForm({ ...form, engineerNotes: event.target.value })} /></label>
      </div>
      <ItemEditor items={form.items} setItems={(items) => setForm({ ...form, items })} engineerRequest />
    </FormShell>
  );
}

function MaintenanceForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ clientName: "", contact: "", location: "", service: "", fault: "", action: "", items: [{ ...emptyItem }] });
  return (
    <FormShell title="New Maintenance Request" subtitle="Maintenance starts from Engineer, goes to HOD, then Accounts." onCancel={onCancel} onSubmit={() => onSubmit(form)} submitLabel="Submit to HOD">
      <div className="form-grid">
        {textInput("Client Name", "clientName", form, setForm)}
        {textInput("Contact", "contact", form, setForm)}
        {textInput("Location", "location", form, setForm)}
        {textInput("Service", "service", form, setForm)}
        <label className="wide">Fault Report<textarea required value={form.fault} onChange={(event) => setForm({ ...form, fault: event.target.value })} /></label>
        <label className="wide">Recommended Action<textarea required value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value })} /></label>
      </div>
      <ItemEditor items={form.items} setItems={(items) => setForm({ ...form, items })} requestMode />
    </FormShell>
  );
}

function FormShell({ title, subtitle, children, submitLabel, onSubmit, onCancel }) {
  return (
    <>
      <div className="topbar"><div className="page-title"><h1>{title}</h1><p>{subtitle}</p></div></div>
      <form className="panel" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        {children}
        <div className="button-row"><button className="btn">{submitLabel}</button><button type="button" className="btn secondary" onClick={onCancel}>Cancel</button></div>
      </form>
    </>
  );
}

function DocumentDetail({ user, doc, onBack, run }) {
  const engineerCompleted = doc.type === "doc1" && doc.status === "Completed" && (user.role === "Engineer" || user.role === "System Admin");
  const maintenanceCompleted = doc.type === "maintenance" && doc.status === "Completed" && (user.role === "Engineer" || user.role === "System Admin");
  return (
    <>
      <div className="topbar"><div className="page-title"><h1>{doc.number}</h1><p>{doc.clientName} / {doc.service}</p></div><button className="btn secondary" onClick={onBack}>Back</button></div>
      {engineerCompleted ? (
        <CompletedEngineerDocuments user={user} doc={doc} />
      ) : maintenanceCompleted ? (
        <MaintenanceCertificate user={user} doc={doc} />
      ) : (
        <>
          <section className="panel"><div className="section-title"><h2>Workflow State</h2><span className={`status ${statusClass(doc.status)}`}>{doc.status}</span></div><div className="form-grid"><p><strong>Current Department</strong><br />{doc.currentDepartment}</p><p><strong>Location</strong><br />{doc.location}</p></div></section>
          {doc.type === "doc1" ? <Doc1Actions user={user} doc={doc} run={run} /> : <MaintenanceActions user={user} doc={doc} run={run} />}
          <History doc={doc} />
        </>
      )}
    </>
  );
}

function MaintenanceCertificate({ user, doc }) {
  async function download() {
    const blob = await api.downloadDocument(user, doc.id, "maintenance-certificate");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.clientName}_maintenance_certificate.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="final-documents">
      <div className="panel final-toolbar">
        <div>
          <h2>Certificate of Completion</h2>
          <p>{doc.clientName} maintenance has been completed and certified.</p>
        </div>
        <div className="button-row">
          <button className="btn" onClick={download}>Download Certificate PDF</button>
          <button className="btn secondary" onClick={() => window.print()}>Print This Page</button>
        </div>
      </div>
      <article className="paper-form certificate-form">
        <div className="certificate-logo">zanlink</div>
        <div className="certificate-meta">
          <span>Date: {formatDate(new Date())}</span>
          <span>Certificate No: Zanlink/{doc.number}</span>
        </div>
        <h2>Certificate of Completion</h2>
        <p className="certificate-intro">This is to confirm and certify that the job was done successfully at {doc.clientName} and the below materials were issued through requisition no. {doc.number}.</p>
        <p><strong>Site Name:</strong> {doc.clientName}</p>
        <h3>Materials Used</h3>
        <table className="paper-table">
          <thead><tr><th>S/N</th><th>Item ID</th><th>Description</th><th>Quantity Requested</th><th>Quantity Issued</th></tr></thead>
          <tbody>
            {(doc.maintenance?.items || []).map((item, index) => (
              <tr key={index}><td>{index + 1}</td><td>{item.serialNumber || "-"}</td><td>{item.name}</td><td>{item.requestedQty}</td><td>{item.issuedQty}</td></tr>
            ))}
          </tbody>
        </table>
        <p>The site has been inspected for the completion of the job carried.</p>
        <div className="certificate-signoff">
          <strong>Certified by Head of Department</strong>
          <span>Name: {doc.hod?.approvedBy ? "Head of Department" : "----------------"}</span>
          <span>Signature: ----------------</span>
          <span>Date: {formatDate(new Date())}</span>
        </div>
      </article>
    </section>
  );
}

function CompletedEngineerDocuments({ user, doc }) {
  async function download(kind, filename) {
    const blob = await api.downloadDocument(user, doc.id, kind);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="final-documents">
      <div className="panel final-toolbar">
        <div>
          <h2>Completed Client Documents</h2>
          <p>{doc.clientName} now has the final onboarding and stock requisition documents ready for download.</p>
        </div>
        <div className="button-row">
          <button className="btn" onClick={() => download("onboarding", `${doc.clientName}_onboarding.pdf`)}>Download Onboarding PDF</button>
          <button className="btn secondary" onClick={() => download("stock-requisition", `${doc.clientName}_stock_requisition.pdf`)}>Download Stock Requisition PDF</button>
          <button className="btn secondary" onClick={() => window.print()}>Print This Page</button>
        </div>
      </div>
      <div className="document-preview-grid">
        <OnboardingPreview doc={doc} />
        <StockRequisitionPreview doc={doc} />
      </div>
    </section>
  );
}

function OnboardingPreview({ doc }) {
  return (
    <article className="paper-form">
      <header className="paper-head"><span className="paper-logo">zanlink</span><h2>Customer Onboarding Form</h2><span>Form No. {doc.number}</span></header>
      <h3>Customer Information</h3>
      <div className="check-row">
        <PaperCheck label="New Installation" active={(doc.serviceType || "new_installation") === "new_installation"} />
        <PaperCheck label="Reconnection" active={doc.serviceType === "reconnection"} />
        <PaperCheck label="WiFi Extension" active={doc.serviceType === "wifi_extension"} />
        <PaperCheck label="IP" />
        <PaperCheck label="Site Addition" />
      </div>
      <div className="paper-fields">
        <Field label="Client Name" value={doc.clientName} />
        <Field label="Location" value={doc.location} />
        <Field label="Installation Cost" value={money(doc.sales?.amount)} />
        <Field label="Equipment Cost" value={money(doc.sales?.packageCost)} />
        <Field label="Subscription package" value={doc.sales?.remarks || doc.service} />
        <Field label="MRR" value={money(doc.accounts?.billingAmount)} />
        <Field label="Requested By" value="Engineer" />
        <Field label="Date" value={formatDate(doc.createdAt)} />
      </div>
      <h3>Engineering Confirmation</h3>
      <div className="paper-fields two"><Field label="Stock Requisition No" value={doc.number} /><Field label="Reviewed by" value="Engineer" /></div>
      <h3>Management Approval</h3>
      <div className="paper-fields two"><Field label="Approved By" value="Management" /><Field label="Comments" value={doc.management?.remarks || "Approved"} /></div>
      <h3>Admin Stock Confirmation</h3>
      <div className="paper-fields two"><Field label="Stock Availability" value="Confirmed" /><Field label="Stock issued by" value="Store" /><Field label="Work Order Form No." value={`Zanlink/${doc.number}`} /><Field label="Date" value={formatDate(new Date())} /></div>
      <h3>Finance & Billing</h3>
      <div className="paper-fields two"><Field label="Billing Confirmation" value="Confirmed" /><Field label="User Created in System" value="Yes" /><Field label="Invoice Number" value={doc.accounts?.invoiceNumber} /><Field label="Received By" value="Engineer" /></div>
    </article>
  );
}

function PaperCheck({ label, active = false }) {
  return <span className="paper-check"><span className={active ? "checked-box" : "empty-box"}>{active ? "✓" : ""}</span>{label}</span>;
}

function StockRequisitionPreview({ doc }) {
  return (
    <article className="paper-form">
      <header className="paper-head stock"><span className="paper-logo">zanlink</span><div><h2>Stock Requisition Form</h2><p>Install Requisition No. {doc.number}</p></div></header>
      <table className="paper-table">
        <thead><tr><th>S/N</th><th>Item ID</th><th>Description</th><th>Quantity Requested</th><th>Quantity Issued</th></tr></thead>
        <tbody>
          {(doc.store?.items || []).map((item, index) => (
            <tr key={index}><td>{index + 1}</td><td>{item.serialNumber || "-"}</td><td>{item.name}</td><td>{item.requestedQty}</td><td>{item.issuedQty}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="narration"><strong>Narration</strong><p>{doc.engineer?.notes || `Installation for ${doc.clientName}`}</p></div>
      <div className="signature-grid">
        <Signature label="Requested by" name="Engineer" position="S.E" />
        <Signature label="Approved by" name="Accounts" position="Accounts" />
        <Signature label="Issued by" name="Store" position="Admin" />
        <Signature label="Received by" name="Engineer" position="N/A" />
      </div>
    </article>
  );
}

function Field({ label, value }) {
  return <div className="paper-field"><span>{label}</span><strong>{value || "-"}</strong></div>;
}

function Signature({ label, name, position }) {
  return <div className="signature-row"><strong>{label}</strong><Field label="Name" value={name} /><Field label="Position" value={position} /><Field label="Signature" value="" /><Field label="Date" value={formatDate(new Date())} /></div>;
}

function Doc1Actions({ user, doc, run }) {
  const salesOpen = canAct(user, "Sales") && ["Pending Sales", "Returned to Sales"].includes(doc.status);
  const accountsOpen = canAct(user, "Accounts") && doc.status === "Pending Accounts";
  const storeOpen = canAct(user, "Store") && doc.status === "Pending Store";
  const managementOpen = canAct(user, "Management") && doc.status === "Pending Management";
  const [sales, setSales] = useState({ amount: doc.sales?.amount || "", packageCost: doc.sales?.packageCost || "", remarks: doc.sales?.remarks || "" });
  const [accounts, setAccounts] = useState({ billingAmount: doc.accounts?.billingAmount || "", invoiceNumber: doc.accounts?.invoiceNumber || "", remarks: doc.accounts?.remarks || "" });
  const [items, setItems] = useState(doc.store?.items || []);
  const [storeRemarks, setStoreRemarks] = useState(doc.store?.remarks || "");
  const [managementRemarks, setManagementRemarks] = useState(doc.management?.remarks || "");

  return (
    <>
      <ActionPanel title="Sales Section" enabled={salesOpen} actionLabel="Submit to Accounts" onAction={() => run(() => api.sales(user, doc.id, sales), "Moved to Accounts.")}>
        <div className="form-grid">{numberInput("Total Amount", "amount", sales, setSales, !salesOpen)}{numberInput("Package Cost", "packageCost", sales, setSales, !salesOpen)}<label className="wide">Remarks<textarea disabled={!salesOpen} value={sales.remarks} onChange={(e) => setSales({ ...sales, remarks: e.target.value })} /></label></div>
      </ActionPanel>
      <ActionPanel title="Accounts Section" enabled={accountsOpen} actionLabel="Submit to Store" onAction={() => run(() => api.accounts(user, doc.id, accounts), "Moved to Store.")}>
        <div className="form-grid">{numberInput("Billing Amount", "billingAmount", accounts, setAccounts, !accountsOpen)}{textInput("Invoice Number", "invoiceNumber", accounts, setAccounts, !accountsOpen)}<label className="wide">Remarks<textarea disabled={!accountsOpen} value={accounts.remarks} onChange={(e) => setAccounts({ ...accounts, remarks: e.target.value })} /></label></div>
      </ActionPanel>
      <ActionPanel title="Store Confirmation" enabled={storeOpen} actionLabel="Confirm Stock and Validate" onAction={() => run(() => api.store(user, doc.id, { remarks: storeRemarks, items }), "Store validation complete.")}>
        <ItemEditor items={items} setItems={setItems} locked={!storeOpen} />
        <div className="form-grid"><p><strong>Sales Amount</strong><br />{money(doc.sales?.amount)}</p><p><strong>Accounts Billing</strong><br />{money(doc.accounts?.billingAmount)}</p><label className="wide">Store Remarks<textarea disabled={!storeOpen} value={storeRemarks} onChange={(e) => setStoreRemarks(e.target.value)} /></label></div>
      </ActionPanel>
      <ActionPanel title="Management Approval" enabled={managementOpen} actionLabel="Approve and Complete" onAction={() => run(() => api.management(user, doc.id, { remarks: managementRemarks }), "Document completed.")}>
        <label>Approval Notes<textarea disabled={!managementOpen} value={managementRemarks} onChange={(e) => setManagementRemarks(e.target.value)} /></label>
      </ActionPanel>
    </>
  );
}

function MaintenanceActions({ user, doc, run }) {
  const hodOpen = canAct(user, "HOD") && doc.status === "Pending HOD";
  const accountsOpen = canAct(user, "Accounts") && doc.status === "Pending Accounts";
  const [hodRemarks, setHodRemarks] = useState(doc.hod?.remarks || "");
  const [accounts, setAccounts] = useState({ billingAmount: doc.accounts?.billingAmount || "", invoiceNumber: doc.accounts?.invoiceNumber || "", remarks: doc.accounts?.remarks || "" });
  return (
    <>
      <section className="panel"><h2>Maintenance Details</h2><p><strong>Fault</strong><br />{doc.maintenance?.fault}</p><p><strong>Recommended Action</strong><br />{doc.maintenance?.action}</p></section>
      <ActionPanel title="HOD Approval" enabled={hodOpen} actionLabel="Approve to Accounts" onAction={() => run(() => api.hod(user, doc.id, { remarks: hodRemarks }), "Moved to Accounts.")}>
        <label>HOD Notes<textarea disabled={!hodOpen} value={hodRemarks} onChange={(e) => setHodRemarks(e.target.value)} /></label>
      </ActionPanel>
      <ActionPanel title="Accounts Billing" enabled={accountsOpen} actionLabel="Complete Maintenance" onAction={() => run(() => api.accounts(user, doc.id, accounts), "Maintenance completed.")}>
        <div className="form-grid">{numberInput("Billing Amount", "billingAmount", accounts, setAccounts, !accountsOpen)}{textInput("Invoice Number", "invoiceNumber", accounts, setAccounts, !accountsOpen)}<label className="wide">Remarks<textarea disabled={!accountsOpen} value={accounts.remarks} onChange={(e) => setAccounts({ ...accounts, remarks: e.target.value })} /></label></div>
      </ActionPanel>
    </>
  );
}

function ActionPanel({ title, enabled, actionLabel, onAction, children }) {
  return (
    <form className="panel" onSubmit={(event) => { event.preventDefault(); onAction(); }}>
      <div className="section-title"><h2>{title}</h2></div>
      {children}
      {enabled && <div className="button-row"><button className="btn">{actionLabel}</button></div>}
    </form>
  );
}

function ItemEditor({ items, setItems, locked = false, requestMode = false, engineerRequest = false }) {
  if (engineerRequest) return <EngineerItemEditor items={items} setItems={setItems} />;
  function update(index, key, value) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: key.includes("Qty") || key === "unitCost" ? Number(value) : value } : item));
  }
  return (
    <div className="items-list">
      <div className="section-title"><h2>Stock Items</h2>{!locked && requestMode && <button type="button" className="btn secondary" onClick={() => setItems([...items, { ...emptyItem }])}>Add Item</button>}</div>
      {items.map((item, index) => (
        <div className="item-row" key={index}>
          <label>Item<input required disabled={locked && !requestMode} value={item.name} onChange={(e) => update(index, "name", e.target.value)} /></label>
          <label>Req. Qty<input required min="1" type="number" disabled={locked && !requestMode} value={item.requestedQty} onChange={(e) => update(index, "requestedQty", e.target.value)} /></label>
          <label>Issued Qty<input min="0" type="number" disabled={locked} value={item.issuedQty} onChange={(e) => update(index, "issuedQty", e.target.value)} /></label>
          <label>Serial No.<input disabled={locked} value={item.serialNumber} onChange={(e) => update(index, "serialNumber", e.target.value)} /></label>
          <label>Purpose<input disabled={locked} value={item.purpose} onChange={(e) => update(index, "purpose", e.target.value)} /></label>
          <label>Unit Cost<input min="0" type="number" disabled={locked} value={item.unitCost} onChange={(e) => update(index, "unitCost", e.target.value)} /></label>
        </div>
      ))}
    </div>
  );
}

function EngineerItemEditor({ items, setItems }) {
  function updateDescription(index, description) {
    const selected = engineerStockItems.find((item) => item.description === description);
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, name: description, serialNumber: selected?.id || "" } : item));
  }

  function updateQuantity(index, value) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, requestedQty: Number(value) } : item));
  }

  return (
    <div className="items-list">
      <div className="section-title"><h2>Stock Items</h2></div>
      <div className="table-wrap engineer-items-table">
        <table>
          <thead><tr><th>S/N</th><th>Item ID</th><th>Description</th><th>Quantity Requested</th><th>Action</th></tr></thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td><input readOnly value={item.serialNumber} /></td>
                <td><select required value={item.name} onChange={(event) => updateDescription(index, event.target.value)}><option value="">Select equipment/material</option>{engineerStockItems.map((stockItem) => <option key={stockItem.id} value={stockItem.description}>{stockItem.description}</option>)}</select></td>
                <td><input required min="1" type="number" value={item.requestedQty} onChange={(event) => updateQuantity(index, event.target.value)} /></td>
                <td><button type="button" className="btn danger" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="engineer-add-item"><button type="button" className="btn secondary" onClick={() => setItems([...items, { ...emptyItem }])}>+ Add Item</button></div>
      </div>
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
    ["Management Approval", "Pending Management"],
  ];
  const currentIndex = Math.max(1, stages.findIndex(([, pendingStatus]) => pendingStatus === status));
  return (
    <div className="workflow-tracker"><strong>Workflow Progress</strong>{stages.map(([label], index) => {
      const state = status === "Completed" || index < currentIndex ? "Completed" : index === currentIndex ? "Pending" : "Not Started";
      return <div className={`workflow-step ${state.toLowerCase().replace(" ", "-")}`} key={label}><span>{state === "Completed" ? "✓" : state === "Pending" ? "⏳" : "○"}</span><b>{label}</b><small>{state}</small></div>;
    })}</div>
  );
}

function History({ doc }) {
  return <section className="panel"><h2>Audit Trail</h2><div className="timeline">{doc.history.map((item) => <div className="history-row" key={item.id}><time>{formatDate(item.at)}</time><div><strong>{item.action}</strong><br /><small>{item.note}</small></div></div>)}</div></section>;
}

function Summaries({ user, summaries, documents, refresh, showError }) {
  if (!summaries.length) return <div className="panel empty">No client summaries generated yet.</div>;
  return <><div className="topbar"><div className="page-title"><h1>Client Summaries</h1><p>Accounts adds equipment costs and downloads the client delivery document.</p></div></div>{summaries.map((summary) => <Summary key={summary.id} user={user} summary={summary} doc={documents.find((item) => item.id === summary.sourceDocumentId)} refresh={refresh} showError={showError} />)}</>;
}

function Summary({ user, summary, doc, refresh, showError }) {
  const canEdit = canAct(user, "Accounts");
  const [draft, setDraft] = useState(() => ({
    invoiceNumber: summary.invoiceNumber || "",
    customerName: summary.customerName || doc?.clientName || "",
    customerLocation: summary.customerLocation || doc?.location || "",
    zanlinkStaff: summary.zanlinkStaff || "",
    transportCost: summary.transportCost || 0,
    terms: summary.terms || "",
    items: summary.items.map((item) => ({ ...item, purpose: item.purpose || "Sold to Client", unitCost: item.unitCost || 0 })),
  }));
  const subtotal = draft.items.reduce((total, item) => total + Number(item.issuedQty || 0) * Number(item.unitCost || 0), 0);
  const grandTotal = subtotal + Number(draft.transportCost || 0);

  function updateItem(index, key, value) {
    setDraft({
      ...draft,
      items: draft.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: key === "unitCost" || key === "issuedQty" ? Number(value) : value } : item),
    });
  }

  async function save() {
    try {
      await api.updateSummary(user, summary.id, draft);
      await refresh();
    } catch (error) {
      showError(error);
    }
  }

  async function download() {
    try {
      const blob = await api.downloadSummary(user, summary.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${draft.customerName || "client"}_client_summary.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(error);
    }
  }

  return (
    <article className="summary-document client-delivery">
      <div className="client-summary-head">
        <div className="paper-logo">zanlink</div>
        <div className="company-address">P.O. Box 4204,<br />Zanzibar, TANZANIA.<br />Tel: +255 777 476 666<br />E-Mail: info-zanlink@liquidtelecom.co.tz</div>
      </div>
      <div className="summary-meta-grid">
        <Field label="Sheet No." value={summary.number} />
        <label>Customer<input required disabled={!canEdit} value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} /></label>
        <Field label="Date" value={formatDate(summary.createdAt)} />
        <label>Invoice Number<input required disabled={!canEdit} value={draft.invoiceNumber} onChange={(e) => setDraft({ ...draft, invoiceNumber: e.target.value })} /></label>
      </div>
      <h3>Equipment/Accessories delivered</h3>
      <div className="table-wrap">
        <table className="delivery-table">
          <thead><tr><th>No.</th><th>Equipment/Accessory</th><th>Serial No</th><th>Qty</th><th>Purpose</th><th>Cost</th><th>Total</th></tr></thead>
          <tbody>
            {draft.items.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.name}</td>
                <td><input disabled={!canEdit} value={item.serialNumber || ""} onChange={(e) => updateItem(index, "serialNumber", e.target.value)} /></td>
                <td><input required min="0" type="number" disabled={!canEdit} value={item.issuedQty || 0} onChange={(e) => updateItem(index, "issuedQty", e.target.value)} /></td>
                <td><input required disabled={!canEdit} value={item.purpose || ""} onChange={(e) => updateItem(index, "purpose", e.target.value)} /></td>
                <td><input required min="0.01" step="0.01" type="number" disabled={!canEdit} value={item.unitCost || 0} onChange={(e) => updateItem(index, "unitCost", e.target.value)} /></td>
                <td>{usd(Number(item.issuedQty || 0) * Number(item.unitCost || 0))}</td>
              </tr>
            ))}
            <tr><td colSpan="6"><strong>Sub Total:</strong></td><td>{usd(subtotal)}</td></tr>
            <tr><td colSpan="6"><strong>Transportation Cost:</strong></td><td>{canEdit ? <input min="0" type="number" value={draft.transportCost} onChange={(e) => setDraft({ ...draft, transportCost: Number(e.target.value) })} /> : usd(draft.transportCost)}</td></tr>
            <tr><td colSpan="6"><strong>Grand Total Cost:</strong></td><td>{usd(grandTotal)}</td></tr>
          </tbody>
        </table>
      </div>
      <section className="terms-box">
        <strong>Terms & Conditions</strong>
        <textarea required disabled={!canEdit} value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} />
      </section>
      <div className="signature-pair">
        <label>Name of Customer<input required disabled={!canEdit} value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} /></label>
        <label>Name of ZANLINK Staff<input required disabled={!canEdit} value={draft.zanlinkStaff} onChange={(e) => setDraft({ ...draft, zanlinkStaff: e.target.value })} /></label>
      </div>
      <div className="button-row no-print">
        {canEdit && <button className="btn" onClick={save}>Save Accounts Costs</button>}
        <button className="btn secondary" onClick={download}>Download Client Summary PDF</button>
        <button className="btn secondary" onClick={() => window.print()}>Print This Page</button>
      </div>
    </article>
  );
}

function Reports({ reports }) {
  if (!reports) return <div className="panel empty">Loading reports...</div>;
  return (
    <>
      <div className="topbar"><div className="page-title"><h1>Reports</h1><p>Operational totals for management review.</p></div></div>
      <section className="stats"><div className="stat"><b>{reports.totalDocuments}</b><span>Total Documents</span></div><div className="stat"><b>{reports.totalSummaries}</b><span>Client Summaries</span></div><div className="stat"><b>{reports.unreadNotifications}</b><span>Unread Notifications</span></div></section>
      <section className="panel"><h2>Status Breakdown</h2><div className="table-wrap"><table><tbody>{Object.entries(reports.statusCounts).map(([status, count]) => <tr key={status}><td>{status}</td><td>{count}</td></tr>)}</tbody></table></div></section>
    </>
  );
}

function textInput(label, key, form, setForm, disabled = false) {
  return <label>{label}<input disabled={disabled} required value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>;
}

function numberInput(label, key, form, setForm, disabled = false) {
  return <label>{label}<input type="number" min="0" disabled={disabled} required value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>;
}

function canCreate(user) {
  return user.role === "Engineer" || user.role === "System Admin";
}

function canAct(user, department) {
  return user.role === "System Admin" || user.department === department || user.role === department;
}

function statusClass(status) {
  if (status === "Completed") return "done";
  if (status?.includes("Returned")) return "returned";
  return "";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-TZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function money(value) {
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function usd(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(Number(value || 0));
}

createRoot(document.getElementById("root")).render(<App />);
