import React, { useEffect, useState } from "react";
import Field from "./components/common/Field";
import GuidedTour from "./components/common/GuidedTour";
import Sidebar from "./components/layout/Sidebar";
import { emptyItem, engineerStockItems, serviceTypes } from "./config/workflow";
import ClientSummariesPage from "./pages/ClientSummariesPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ReportsPage from "./pages/ReportsPage";
import { api } from "./services/api";
import { formatDate, money } from "./utils/formatters";
import { canAct, statusClass } from "./utils/permissions";

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("zanlink-user") || "null"));
  const [view, setView] = useState("dashboard");
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [reports, setReports] = useState(null);
  const [filters, setFilters] = useState({ q: "", type: "", status: "", department: "" });
  const [message, setMessage] = useState("");
  const [tourOpen, setTourOpen] = useState(false);

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

  useEffect(() => {
    if (!user) return;
    const tourKey = `zanlink-tour-complete-${user.email || user.id}`;
    if (!localStorage.getItem(tourKey)) setTourOpen(true);
  }, [user]);

  function closeTour() {
    localStorage.setItem(`zanlink-tour-complete-${user.email || user.id}`, "true");
    setTourOpen(false);
  }

  function startTour() {
    navigate("dashboard");
    setTourOpen(true);
  }

  function showError(error) {
    setMessage(error.message || String(error));
    setTimeout(() => setMessage(""), 3200);
  }

  function navigate(nextView) {
    setSelectedId(null);
    setView(nextView);
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

  if (!user) return (
    <LoginPage onLogin={setUser} showError={showError} />
  );

  return (
    <div className="app-shell">
      <Sidebar user={user} view={view} onNavigate={navigate} onStartTour={startTour} onLogout={() => { localStorage.removeItem("zanlink-user"); setUser(null); }} />
      <main className="main">
        {selected ? (
          <DocumentDetail user={user} doc={selected} onBack={() => setSelectedId(null)} run={run} />
        ) : view === "doc1" ? (
          <Doc1Form onCancel={() => navigate("dashboard")} onSubmit={(payload) => run(() => api.createDoc1(user, payload), "Document submitted to Sales.")} />
        ) : view === "maintenance" ? (
          <MaintenanceForm onCancel={() => navigate("dashboard")} onSubmit={(payload) => run(() => api.createMaintenance(user, payload), "Maintenance request submitted to HOD.")} />
        ) : view === "summaries" ? (
          <ClientSummariesPage user={user} summaries={summaries} documents={documents} showError={showError} />
        ) : view === "reports" ? (
          <ReportsPage reports={reports} />
        ) : (
          <DashboardPage
            user={user}
            documents={documents}
            filters={filters}
            setFilters={(next) => {
              setFilters(next);
              refresh(next).catch(showError);
            }}
            onOpen={setSelectedId}
            onCreateDoc1={() => navigate("doc1")}
            onCreateMaintenance={() => navigate("maintenance")}
          />
        )}
      </main>
      {message && <div className="toast">{message}</div>}
      <GuidedTour open={tourOpen} onClose={closeTour} />
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
  const managementReview = doc.type === "doc1" && (user.role === "Management" || user.department === "Management");
  const engineerCompleted = doc.type === "doc1" && (doc.status === "Completed" || doc.workflowCompletedAt) && (user.role === "Engineer" || user.role === "System Admin");
  const maintenanceCompleted = doc.type === "maintenance" && doc.status === "Completed" && (user.role === "Engineer" || user.role === "System Admin");
  return (
    <>
      <div className="topbar"><div className="page-title"><h1>{doc.number}</h1><p>{doc.clientName} / {doc.service}</p></div><button className="btn secondary" onClick={onBack}>Back</button></div>
      {managementReview ? (
        <ManagementReview user={user} doc={doc} run={run} />
      ) : engineerCompleted ? (
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

function ManagementReview({ user, doc, run }) {
  const pending = doc.status === "Pending Management";
  return (
    <ActionPanel title="Store Manager Submission" enabled={pending} actionLabel="Approve" onAction={() => run(() => api.management(user, doc.id, {}), "Document approved and completed.")}>
      <div className="form-grid">
        <p><strong>Submitted By</strong><br />Store Manager</p>
        <p><strong>Submitted At</strong><br />{doc.store?.approvedAt ? formatDate(doc.store.approvedAt) : "-"}</p>
        <p><strong>Status</strong><br /><span className={`status ${statusClass(doc.status)}`}>{doc.status}</span></p>
      </div>
      <ItemEditor items={doc.store?.items || []} setItems={() => {}} locked storeMode />
    </ActionPanel>
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
              <tr key={index}><td>{index + 1}</td><td>{item.itemId || item.serialNumber || "-"}</td><td>{item.name}</td><td>{item.requestedQty}</td><td>{item.issuedQty}</td></tr>
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
          <span className={`status ${statusClass(doc.status)}`}>{doc.status}</span>
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
        <Field label="Subscription package" value={doc.sales?.subscription || doc.sales?.remarks || doc.service} />
        <Field label="MBR" value={money(doc.sales?.mbr || doc.accounts?.billingAmount)} />
        <Field label="Requested By" value={doc.sales?.requestedBy || "Engineer"} />
        <Field label="Date" value={doc.sales?.requestedDate || formatDate(doc.createdAt)} />
      </div>
      <h3>Engineering Confirmation</h3>
      <div className="paper-fields two"><Field label="Stock Requisition No" value={doc.number} /><Field label="Reviewed by" value="Engineer" /></div>
      <h3>Management Approval</h3>
      <div className="paper-fields two"><Field label="Approved By" value={doc.management?.approvedBy ? "Management" : "Pending Management"} /><Field label="Comments" value={doc.management?.approvedBy ? (doc.management?.remarks || "Approved") : "Approval optional"} /></div>
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
            <tr key={index}><td>{index + 1}</td><td>{item.itemId || item.serialNumber || "-"}</td><td>{item.name}</td><td>{item.requestedQty}</td><td>{item.issuedQty}</td></tr>
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

function Signature({ label, name, position }) {
  return <div className="signature-row"><strong>{label}</strong><Field label="Name" value={name} /><Field label="Position" value={position} /><Field label="Signature" value="" /><Field label="Date" value={formatDate(new Date())} /></div>;
}

function Doc1Actions({ user, doc, run }) {
  const storeManager = user.department === "Store" || ["Store", "Store Manager"].includes(user.role);
  const salesOpen = canAct(user, "Sales") && ["Pending Sales", "Returned to Sales"].includes(doc.status);
  const accountsOpen = canAct(user, "Accounts") && doc.status === "Pending Accounts";
  const storeOpen = canAct(user, "Store") && doc.status === "Pending Store";
  const managementOpen = canAct(user, "Management") && doc.status === "Pending Management";
  const salesOnly = user.role === "Sales";
  const accountsOnly = user.role === "Accounts";
  const [sales, setSales] = useState({
    clientName: doc.sales?.clientName || doc.clientName || "",
    location: doc.sales?.location || doc.location || "",
    surveyFormNo: doc.sales?.surveyFormNo || doc.number || "",
    amount: doc.sales?.amount || "",
    packageCost: doc.sales?.packageCost || "",
    additionalNpr: doc.sales?.additionalNpr || "",
    subscription: doc.sales?.subscription || doc.sales?.remarks || doc.service || "",
    mbr: doc.sales?.mbr || doc.accounts?.billingAmount || "",
    requestedBy: doc.sales?.requestedBy || user.name || "",
    requestedDate: doc.sales?.requestedDate || new Date().toISOString().slice(0, 10),
  });
  const [accounts, setAccounts] = useState({ billingAmount: doc.accounts?.billingAmount || "", invoiceNumber: doc.accounts?.invoiceNumber || "", remarks: doc.accounts?.remarks || "" });
  const engineerEquipment = doc.store?.items || [];
  const [accountEquipment, setAccountEquipment] = useState(doc.sales?.equipment?.length ? doc.sales.equipment : (doc.store?.items || []));
  const [items, setItems] = useState(() => (doc.store?.items || []).map((item) => ({
    ...item,
    issuedQty: storeOpen && Number(item.issuedQty || 0) === 0 ? Number(item.requestedQty || 0) : Number(item.issuedQty || 0),
  })));
  const [storeRemarks, setStoreRemarks] = useState(doc.store?.remarks || "");
  const [managementRemarks, setManagementRemarks] = useState(doc.management?.remarks || "");

  return (
    <>
      <ActionPanel enabled={salesOpen} actionLabel="Submit to Accounts" onAction={() => run(() => api.sales(user, doc.id, sales), "Moved to Accounts.")}>
        <ReadOnlyEquipment title="Engineer Equipment" items={engineerEquipment} />
        <div className="form-grid">
          {textInput("Client Name", "clientName", sales, setSales, !salesOpen)}
          {textInput("Location", "location", sales, setSales, !salesOpen)}
          {textInput("Survey Form No.", "surveyFormNo", sales, setSales, !salesOpen)}
          {numberInput("Installation Cost", "amount", sales, setSales, !salesOpen)}
          {numberInput("Total Equipment Cost", "packageCost", sales, setSales, !salesOpen)}
          {numberInput("Additional NPR", "additionalNpr", sales, setSales, !salesOpen)}
          {textInput("Subscription", "subscription", sales, setSales, !salesOpen)}
          {numberInput("MBR", "mbr", sales, setSales, !salesOpen)}
          {textInput("Requested By", "requestedBy", sales, setSales, !salesOpen)}
          <label>Date<input type="date" disabled={!salesOpen} required value={sales.requestedDate} onChange={(event) => setSales({ ...sales, requestedDate: event.target.value })} /></label>
        </div>
      </ActionPanel>
      {!salesOnly && (
        <>
          <ActionPanel title="Accounts Section" enabled={accountsOpen} actionLabel="Submit to Store" onAction={() => run(() => api.accounts(user, doc.id, { ...accounts, equipment: accountEquipment }), "Moved to Store.")}>
            <div className="form-grid">{numberInput("Billing Amount", "billingAmount", accounts, setAccounts, !accountsOpen)}{textInput("Invoice Number", "invoiceNumber", accounts, setAccounts, !accountsOpen)}<label className="wide">Remarks<textarea disabled={!accountsOpen} value={accounts.remarks} onChange={(e) => setAccounts({ ...accounts, remarks: e.target.value })} /></label></div>
            <EquipmentCostEditor items={accountEquipment} setItems={setAccountEquipment} locked={!accountsOpen} />
          </ActionPanel>
          {!accountsOnly && (
            <>
              <ActionPanel title="Store Section" enabled={storeOpen} actionLabel={storeManager ? "Approve Requested Equipment" : "Confirm Stock and Validate"} onAction={() => run(() => api.store(user, doc.id, { remarks: storeRemarks, items }), "Store validation complete.")}>
                <ItemEditor items={items} setItems={setItems} locked={!storeOpen} storeMode={storeManager} />
                {!storeManager && <div className="form-grid"><p><strong>Sales Amount</strong><br />{money(doc.sales?.amount)}</p><p><strong>Accounts Billing</strong><br />{money(doc.accounts?.billingAmount)}</p><label className="wide">Store Remarks<textarea disabled={!storeOpen} value={storeRemarks} onChange={(e) => setStoreRemarks(e.target.value)} /></label></div>}
              </ActionPanel>
              {!storeManager && (
                <ActionPanel title="Management Approval" enabled={managementOpen} actionLabel="Approve and Complete" onAction={() => run(() => api.management(user, doc.id, { remarks: managementRemarks }), "Document completed.")}>
                  <label>Approval Notes<textarea disabled={!managementOpen} value={managementRemarks} onChange={(e) => setManagementRemarks(e.target.value)} /></label>
                </ActionPanel>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function MaintenanceActions({ user, doc, run }) {
  const hodOpen = canAct(user, "HOD") && doc.status === "Pending HOD";
  const accountsOpen = canAct(user, "Accounts") && doc.status === "Pending Accounts";
  const accountsOnly = user.role === "Accounts";
  const [hodRemarks, setHodRemarks] = useState(doc.hod?.remarks || "");
  const [accounts, setAccounts] = useState({ billingAmount: doc.accounts?.billingAmount || "", invoiceNumber: doc.accounts?.invoiceNumber || "", remarks: doc.accounts?.remarks || "" });
  return (
    <>
      <section className="panel"><h2>Maintenance Details</h2><p><strong>Fault</strong><br />{doc.maintenance?.fault}</p><p><strong>Recommended Action</strong><br />{doc.maintenance?.action}</p></section>
      {!accountsOnly && (
        <ActionPanel title="HOD Approval" enabled={hodOpen} actionLabel="Approve to Accounts" onAction={() => run(() => api.hod(user, doc.id, { remarks: hodRemarks }), "Moved to Accounts.")}>
          <label>HOD Notes<textarea disabled={!hodOpen} value={hodRemarks} onChange={(e) => setHodRemarks(e.target.value)} /></label>
        </ActionPanel>
      )}
      <ActionPanel title="Accounts Billing" enabled={accountsOpen} actionLabel="Complete Maintenance" onAction={() => run(() => api.accounts(user, doc.id, accounts), "Maintenance completed.")}>
        <div className="form-grid">{numberInput("Billing Amount", "billingAmount", accounts, setAccounts, !accountsOpen)}{textInput("Invoice Number", "invoiceNumber", accounts, setAccounts, !accountsOpen)}<label className="wide">Remarks<textarea disabled={!accountsOpen} value={accounts.remarks} onChange={(e) => setAccounts({ ...accounts, remarks: e.target.value })} /></label></div>
      </ActionPanel>
    </>
  );
}

function ActionPanel({ title, enabled, actionLabel, onAction, children }) {
  return (
    <form className="panel" onSubmit={(event) => { event.preventDefault(); onAction(); }}>
      {title && <div className="section-title"><h2>{title}</h2></div>}
      {children}
      {enabled && <div className="button-row"><button className="btn">{actionLabel}</button></div>}
    </form>
  );
}

function EquipmentCostEditor({ items, setItems, locked = false }) {
  function update(index, value) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, unitCost: Number(value) } : item));
  }
  if (!items.length) return <div className="empty">No sales equipment added.</div>;
  return (
    <div className="items-list">
      <div className="section-title"><h2>Equipment Costs</h2></div>
      {items.map((item, index) => (
        <div className="item-row" key={index}>
          <label>Item<input disabled value={item.name || ""} readOnly /></label>
          <label>Req. Qty<span className="readonly-value">{item.requestedQty || 1}</span></label>
          <label>Unit Cost<input required min="0" type="number" disabled={locked} value={item.unitCost || ""} onChange={(event) => update(index, event.target.value)} /></label>
        </div>
      ))}
    </div>
  );
}

function ReadOnlyEquipment({ title, items }) {
  if (!items.length) return <div className="empty">No equipment added by Engineer.</div>;
  return (
    <div className="readonly-equipment">
      <div className="section-title"><h2>{title}</h2></div>
      <div className="readonly-equipment-list">
        {items.map((item, index) => (
          <div className="readonly-equipment-row" key={index}>
            <div className="readonly-equipment-main">
              <span>Item</span>
              <strong>{item.name || "-"}</strong>
            </div>
            <div className="readonly-equipment-meta">
              <span><b>Req. Qty</b>{item.requestedQty || 1}</span>
              <span><b>Purpose</b>{item.purpose || "-"}</span>
              <span><b>Item ID</b>{item.itemId || item.serialNumber || "-"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemEditor({ items, setItems, locked = false, requestMode = false, engineerRequest = false, title = "Stock Items", addLabel = "Add Item", costLocked = false, storeMode = false }) {
  if (engineerRequest) return <EngineerItemEditor items={items} setItems={setItems} />;
  function update(index, key, value) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: key.includes("Qty") || key === "unitCost" ? Number(value) : value } : item));
  }

  if (storeMode) {
    return (
      <div className="items-list">
        <div className="section-title"><h2>Required Equipment</h2></div>
        <div className="table-wrap">
          <table className="store-equipment-table">
            <thead>
              <tr><th>No.</th><th>Item ID</th><th>Description</th><th>Requested Quantity</th><th>Issued Quantity</th></tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td><strong>{item.itemId || item.serialNumber || "-"}</strong></td>
                  <td>{item.name || "-"}</td>
                  <td>{item.requestedQty}</td>
                  <td><input aria-label={`Issued quantity for ${item.name}`} required min="1" max={item.requestedQty} type="number" disabled={locked} value={item.issuedQty} onChange={(e) => update(index, "issuedQty", e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="items-list">
      <div className="section-title"><h2>{title}</h2>{!locked && requestMode && <button type="button" className="btn secondary" onClick={() => setItems([...items, { ...emptyItem }])}>{addLabel}</button>}</div>
      <div className="table-wrap">
        <table className="stock-items-table">
          <thead><tr><th>Description</th><th>Requested Qty</th><th>Issued Qty</th><th>Item ID</th><th>Purpose</th><th>Unit Cost</th></tr></thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td><input aria-label={`Item ${index + 1}`} required disabled={locked} value={item.name} onChange={(e) => update(index, "name", e.target.value)} /></td>
                <td>{locked ? <span className="readonly-value">{item.requestedQty}</span> : <input aria-label={`Requested quantity for item ${index + 1}`} required min="1" type="number" value={item.requestedQty} onChange={(e) => update(index, "requestedQty", e.target.value)} />}</td>
                <td><input aria-label={`Issued quantity for item ${index + 1}`} min="0" type="number" disabled={locked} value={item.issuedQty} onChange={(e) => update(index, "issuedQty", e.target.value)} /></td>
                <td>{locked ? <span className="readonly-value">{item.itemId || item.serialNumber || "-"}</span> : <input aria-label={`Item ID for item ${index + 1}`} value={item.itemId || ""} onChange={(e) => update(index, "itemId", e.target.value)} />}</td>
                <td><input aria-label={`Purpose for item ${index + 1}`} disabled={locked} value={item.purpose} onChange={(e) => update(index, "purpose", e.target.value)} /></td>
                <td><input aria-label={`Unit cost for item ${index + 1}`} min="0" type="number" disabled={locked || costLocked} value={item.unitCost} onChange={(e) => update(index, "unitCost", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EngineerItemEditor({ items, setItems }) {
  const pageSize = 5;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const startIndex = page * pageSize;
  const visibleItems = items.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  function updateDescription(index, description) {
    const selected = engineerStockItems.find((item) => item.description === description);
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, itemId: selected?.id || "", name: description, serialNumber: "" } : item));
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
            {visibleItems.map((item, visibleIndex) => {
              const itemIndex = startIndex + visibleIndex;
              return (
                <tr key={itemIndex}>
                  <td>{itemIndex + 1}</td>
                  <td><span className="readonly-value">{item.itemId || item.serialNumber || "-"}</span></td>
                  <td><select required value={item.name} onChange={(event) => updateDescription(itemIndex, event.target.value)}><option value="">Select equipment/material</option>{engineerStockItems.map((stockItem) => <option key={stockItem.id} value={stockItem.description}>{stockItem.description}</option>)}</select></td>
                  <td><input required min="1" type="number" value={item.requestedQty} onChange={(event) => updateQuantity(itemIndex, event.target.value)} /></td>
                  <td><button type="button" className="btn danger" onClick={() => setItems(items.filter((_, index) => index !== itemIndex))}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="engineer-table-footer">
          <button type="button" className="btn secondary engineer-add-button" onClick={() => { setItems([...items, { ...emptyItem }]); setPage(Math.floor(items.length / pageSize)); }}>+ Add Item</button>
          <div className="engineer-pagination">
            <button type="button" className="pagination-arrow" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
            <span>Page {page + 1} of {totalPages}</span>
            <button type="button" className="pagination-arrow" aria-label="Next page" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function History({ doc }) {
  return <section className="panel"><h2>Audit Trail</h2><div className="timeline">{doc.history.map((item) => <div className="history-row" key={item.id}><time>{formatDate(item.at)}</time><div><strong>{item.action}</strong><br /><small>{item.note}</small></div></div>)}</div></section>;
}

function textInput(label, key, form, setForm, disabled = false) {
  return <label>{label}<input disabled={disabled} required value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>;
}

function numberInput(label, key, form, setForm, disabled = false) {
  return <label>{label}<input type="number" min="0" disabled={disabled} required value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>;
}

export default App;
