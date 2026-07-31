import React, { useEffect, useId, useRef, useState } from "react";
import Field from "./components/common/Field";
import GuidedTour from "./components/common/GuidedTour";
import Sidebar from "./components/layout/Sidebar";
import { currencies, emptyItem, engineerStockItems, requestedServices, serviceTypes, subscriptionPackages } from "./config/workflow";
import ClientsPage, { CountryCodePicker, countryCodes } from "./pages/ClientsPage";
import ClientSummariesPage from "./pages/ClientSummariesPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ReportsPage from "./pages/ReportsPage";
import UserManagementPage from "./pages/UserManagementPage";
import { api } from "./services/api";
import { searchTanzaniaLocations } from "./services/tanzaniaLocations";
import { formatDate, formatTime, money } from "./utils/formatters";
import { canAct, statusClass } from "./utils/permissions";

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("zanlink-user") || "null"));
  const [view, setView] = useState("dashboard");
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [clients, setClients] = useState([]);
  const [reports, setReports] = useState(null);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ q: "", type: "", status: "", department: "" });
  const [message, setMessage] = useState("");
  const [tourOpen, setTourOpen] = useState(false);

  const selected = documents.find((doc) => doc.id === selectedId);

  async function refresh(nextFilters = filters) {
    if (!user) return;
    const [accountData, docs, summaryData, reportData, clientData, userData] = await Promise.all([
      api.account(user),
      api.documents(user, nextFilters),
      user.role === "System Admin" ? api.summaries(user) : Promise.resolve([]),
      api.reports(user),
      api.clients(user),
      user.role === "System Admin" ? api.users(user) : Promise.resolve([]),
    ]);
    setDocuments(docs);
    setSummaries(summaryData);
    setReports(reportData);
    setClients(clientData);
    setUsers(userData);
    setUser((currentUser) => JSON.stringify(currentUser) === JSON.stringify(accountData) ? currentUser : accountData);
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
    if ((error.message || String(error)).includes("Missing or invalid X-User-Id")) {
      localStorage.removeItem("zanlink-user");
      setUser(null);
      setMessage("Your session expired. Please sign in again.");
      setTimeout(() => setMessage(""), 3200);
      return;
    }
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

  async function setAccountPassword(payload) {
    try {
      const updatedUser = await api.setPassword(user, payload);
      setUser(updatedUser);
      setMessage("Password added. You can now sign in with Google or email and password.");
      setTimeout(() => setMessage(""), 3200);
    } catch (error) {
      showError(error);
    }
  }

  async function registerClient(payload) {
    try {
      await api.createClient(user, payload);
      await refresh();
      setMessage("Client registered.");
      setTimeout(() => setMessage(""), 2600);
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  async function updateUser(userId, changes) {
    try {
      await api.updateUser(user, userId, changes);
      await refresh();
      setMessage(changes.approve ? "Google account approved. The user can now continue with Google sign-in." : changes.active === false ? "User access revoked." : changes.active === true ? "User access restored." : "User role updated.");
      setTimeout(() => setMessage(""), 2600);
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  async function createUser(payload) {
    try {
      await api.createUser(user, payload);
      await refresh();
      setMessage("User account created.");
      setTimeout(() => setMessage(""), 2600);
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  async function deleteUser(userId) {
    try {
      await api.deleteUser(user, userId);
      await refresh();
      setMessage("User account deleted.");
      setTimeout(() => setMessage(""), 2600);
    } catch (error) {
      showError(error);
      throw error;
    }
  }

  if (!user) return (
    <LoginPage onLogin={setUser} showError={showError} />
  );

  return (
    <div className="app-shell">
      <Sidebar user={user} view={view} onNavigate={navigate} onStartTour={startTour} onLogout={() => { localStorage.removeItem("zanlink-user"); setUser(null); }} />
      <main className="main">
        {user.googleLinked && !user.hasPassword && <PasswordSetupCard onSubmit={setAccountPassword} />}
        {selected ? (
          <DocumentDetail user={user} doc={selected} onBack={() => setSelectedId(null)} run={run} />
        ) : view === "doc1" ? (
          <Doc1Form clients={clients} onCancel={() => navigate("dashboard")} onSubmit={(payload) => run(() => api.createDoc1(user, payload), "Document submitted to Sales.")} />
        ) : view === "maintenance" ? (
          <MaintenanceForm clients={clients} onCancel={() => navigate("dashboard")} onSubmit={(payload) => run(() => api.createMaintenance(user, payload), "General Maintenance submitted to HOD.")} />
        ) : view === "clients" ? (
          <ClientsPage clients={clients} onRegister={registerClient} />
        ) : view === "users" && user.role === "System Admin" ? (
          <UserManagementPage currentUser={user} users={users} onCreateUser={createUser} onUpdateUser={updateUser} onDeleteUser={deleteUser} />
        ) : view === "summaries" && user.role === "System Admin" ? (
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

function PasswordSetupCard({ onSubmit }) {
  const [form, setForm] = useState({ password: "", confirmPassword: "" });

  function submit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <form className="account-password-card" onSubmit={submit}>
      <div>
        <strong>Add password sign-in</strong>
        <span>This Google account can also use email and password after you create an app password.</span>
      </div>
      <label>Password
        <input
          autoComplete="new-password"
          minLength="8"
          required
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
      </label>
      <label>Confirm
        <input
          autoComplete="new-password"
          minLength="8"
          required
          type="password"
          value={form.confirmPassword}
          onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
        />
      </label>
      <button className="btn" type="submit">Save password</button>
    </form>
  );
}

function Doc1Form({ clients, onSubmit, onCancel }) {
  const [form, setForm] = useState({ clientId: "", clientName: "", countryIso: "TZ", contact: "", email: "", location: "", service: "", otherService: "", serviceType: "new_installation", engineerNotes: "", items: [{ ...emptyItem }] });
  return (
    <FormShell title="New Document 1" subtitle="Customer onboarding and stock requisition starts from Engineer." onCancel={onCancel} onSubmit={() => onSubmit(form)} submitLabel="Submit to Sales">
      <div className="form-grid">
        <ClientFields clients={clients} form={form} setForm={setForm} />
        <ServiceSelect form={form} setForm={setForm} label="Requested Service" />
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

function MaintenanceForm({ clients, onSubmit, onCancel }) {
  const [form, setForm] = useState({ clientId: "", clientName: "", countryIso: "TZ", contact: "", email: "", location: "", service: "", otherService: "", fault: "", action: "", items: [{ ...emptyItem }] });
  return (
    <FormShell title="New General Maintenance" subtitle="General Maintenance starts from Engineer, goes to HOD, then Accounts." onCancel={onCancel} onSubmit={() => onSubmit(form)} submitLabel="Submit to HOD">
      <div className="form-grid">
        <ClientFields clients={clients} form={form} setForm={setForm} />
        <ServiceSelect form={form} setForm={setForm} label="Service" />
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

function printElementById(printId) {
  printElementsByIds([printId]);
}

function printElementsByIds(printIds) {
  const targets = printIds.map((printId) => document.getElementById(printId)).filter(Boolean);
  if (!targets.length) return;
  const printRoot = document.createElement("div");
  printRoot.className = "print-root";
  targets.forEach((target) => {
    const printDocument = target.cloneNode(true);
    printDocument.classList.remove("print-only-document");
    printDocument.classList.add("print-root-document");
    printRoot.appendChild(printDocument);
  });
  const cleanup = () => {
    printRoot.remove();
    document.body.classList.remove("printing-document");
  };
  document.body.classList.add("printing-document");
  document.body.appendChild(printRoot);
  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}

function DocumentDetail({ user, doc, onBack, run }) {
  const managementReview = doc.type === "doc1" && user.role !== "System Admin" && (user.role === "Management" || user.department === "Management");
  const engineerCompleted = doc.type === "doc1" && (doc.status === "Completed" || (doc.workflowCompletedAt && user.role === "Engineer")) && (user.role === "Engineer" || user.role === "System Admin");
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
  const printId = `maintenance-certificate-${doc.id}`;
  async function download() {
    const blob = await api.downloadDocument(user, doc.id, "maintenance-certificate");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.clientName}_general_maintenance.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="final-documents">
      <div className="panel final-toolbar">
        <div>
          <h2>General Maintenance</h2>
          <p>{doc.clientName} general maintenance has been completed.</p>
        </div>
        <div className="button-row">
          <button className="btn" onClick={download}>Download General Maintenance PDF</button>
          <button className="btn secondary" onClick={() => printElementById(printId)}>Print General Maintenance</button>
        </div>
      </div>
      <MaintenanceDocumentPreview doc={doc} printId={printId} certificate />
    </section>
  );
}

function CompletedEngineerDocuments({ user, doc }) {
  const onboardingPrintId = `onboarding-print-${doc.id}`;
  const stockPrintId = `stock-print-${doc.id}`;
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
          <button className="btn secondary" onClick={() => printElementById(onboardingPrintId)}>Print Onboarding Doc</button>
          <button className="btn secondary" onClick={() => printElementById(stockPrintId)}>Print Stock Doc</button>
          <button className="btn" onClick={() => printElementsByIds([onboardingPrintId, stockPrintId])}>Print All</button>
        </div>
      </div>
      <div className="document-preview-grid">
        <OnboardingPreview doc={doc} printId={onboardingPrintId} />
        <StockRequisitionPreview doc={doc} printId={stockPrintId} />
      </div>
    </section>
  );
}

function OnboardingPreview({ doc, printId, extraClass = "" }) {
  const equipmentCost = Number(doc.sales?.packageCost || 0);
  const oneTimeTotal = doc.sales?.oneTimeTotal ?? (
    Number(doc.sales?.amount || 0) + equipmentCost + Number(doc.sales?.additionalNpr || 0)
  );
  const firstInvoiceTotal = doc.sales?.grandTotal ?? (oneTimeTotal + Number(doc.sales?.mbr || 0));
  const laborCharge = Number(doc.sales?.laborCharge ?? doc.sales?.amount ?? 0);
  return (
    <article id={printId} className={`paper-form ${extraClass}`}>
      <header className="paper-head"><span className="paper-logo">zanlink</span><h2>Customer Onboarding Form</h2><span>Form No. {doc.number}</span></header>
      <h3>Customer Information</h3>
      <div className="check-row">
        <PaperCheck label="New Installation" active={(doc.serviceType || "new_installation") === "new_installation"} />
        <PaperCheck label="Reconnection" active={doc.serviceType === "reconnection"} />
        <PaperCheck label="WiFi Extension" active={doc.serviceType === "wifi_extension"} />
        <PaperCheck label="TT" />
      </div>
      <div className="paper-fields">
        <Field label="Client Name" value={doc.clientName} />
        <Field label="Location" value={doc.location} />
        <Field label="Installation Cost/Labor Charge" value={money(laborCharge, doc.sales?.currency)} />
        <Field label="Equipment Cost" value={money(equipmentCost, doc.accounts?.currency || doc.sales?.currency)} />
        <Field label="Additional NPR" value={money(doc.sales?.additionalNpr, doc.sales?.currency)} />
        <Field label="Total One-time Cost" value={money(oneTimeTotal, doc.sales?.currency)} />
        <Field label="Subscription package" value={doc.sales?.subscription || doc.sales?.remarks || doc.service} />
        <Field label="MBR" value={money(doc.sales?.mbr ?? 0, doc.accounts?.currency || doc.sales?.currency)} />
        <Field label="First Invoice Total" value={money(firstInvoiceTotal, doc.accounts?.currency || doc.sales?.currency)} />
        <Field label="Requested By" value={doc.sales?.requestedBy || "Engineer"} />
        <Field label="Date" value={doc.sales?.requestedDate || formatDate(doc.createdAt)} />
        <Field label="Time" value={formatTime(doc.sales?.requestedTime || doc.createdAt)} />
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
  return <span className="paper-check"><span className={active ? "checked-box" : "empty-box"}>{active ? "X" : ""}</span>{label}</span>;
}

function StockRequisitionPreview({ doc, printId, extraClass = "" }) {
  return (
    <article id={printId} className={`paper-form ${extraClass}`}>
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

function MaintenanceDocumentPreview({ doc, printId, extraClass = "", certificate = false }) {
  return (
    <article id={printId} className={`paper-form certificate-form ${extraClass}`}>
      <div className="certificate-logo">zanlink</div>
      <div className="certificate-meta">
        <span>Date: {formatDate(new Date())}</span>
        <span>General Maintenance No: {doc.number}</span>
      </div>
      <h2>General Maintenance</h2>
      <p className="certificate-intro">
        {certificate
          ? `This confirms that the general maintenance work was completed successfully at ${doc.clientName} and the materials below were issued through requisition no. ${doc.number}.`
          : `This general maintenance document records the reported fault and recommended action for ${doc.clientName}.`}
      </p>
      <p><strong>Site Name:</strong> {doc.clientName}</p>
      <p><strong>Location:</strong> {doc.location}</p>
      <p><strong>Service:</strong> {doc.service}</p>
      <p><strong>Fault:</strong> {doc.maintenance?.fault || "-"}</p>
      <p><strong>Recommended Action:</strong> {doc.maintenance?.action || "-"}</p>
      <h3>Materials Used</h3>
      <table className="paper-table">
        <thead><tr><th>S/N</th><th>Item ID</th><th>Description</th><th>Quantity Requested</th><th>Quantity Issued</th></tr></thead>
        <tbody>
          {(doc.maintenance?.items || []).map((item, index) => (
            <tr key={index}><td>{index + 1}</td><td>{item.itemId || item.serialNumber || "-"}</td><td>{item.name}</td><td>{item.requestedQty}</td><td>{item.issuedQty}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="certificate-signoff">
        <strong>Head of Department</strong>
        <span>Name: {doc.hod?.approvedByName || (doc.hod?.approvedBy ? "Head of Department" : "Pending approval")}</span>
      </div>
    </article>
  );
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
    mbr: doc.sales?.mbr || "",
    requestedBy: doc.sales?.requestedBy || user.name || "",
    requestedDate: doc.sales?.requestedDate || new Date().toISOString().slice(0, 10),
    requestedTime: doc.sales?.requestedTime || new Date().toTimeString().slice(0, 5),
    currency: doc.sales?.currency || "TZS",
  });
  const [accounts, setAccounts] = useState({ billingAmount: doc.accounts?.billingAmount || "", invoiceNumber: doc.accounts?.invoiceNumber || "", remarks: doc.accounts?.remarks || "" });
  const engineerEquipment = doc.store?.items || [];
  const [salesEquipment, setSalesEquipment] = useState(doc.sales?.equipment?.length ? doc.sales.equipment : (doc.store?.items || []));
  const equipmentTotal = salesEquipment.reduce((total, item) => total + (Number(item.requestedQty || 0) * Number(item.unitCost || 0)), 0);
  const laborCharge = Number(sales.amount || 0);
  const salesTotal = laborCharge + equipmentTotal;
  const oneTimeTotal = Number(sales.amount || 0) + equipmentTotal + Number(sales.additionalNpr || 0);
  const grandTotal = oneTimeTotal + Number(sales.mbr || 0);
  const [items, setItems] = useState(() => (doc.store?.items || []).map((item) => ({
    ...item,
    issuedQty: storeOpen && Number(item.issuedQty || 0) === 0 ? Number(item.requestedQty || 0) : Number(item.issuedQty || 0),
  })));
  const [storeRemarks, setStoreRemarks] = useState(doc.store?.remarks || "");
  const [managementRemarks, setManagementRemarks] = useState(doc.management?.remarks || "");
  const storeOnboardingPrintId = `store-onboarding-print-${doc.id}`;
  const storeStockPrintId = `store-stock-print-${doc.id}`;

  return (
    <>
      <ActionPanel enabled={salesOpen} actionLabel="Submit to Accounts" onAction={() => run(() => api.sales(user, doc.id, { ...sales, packageCost: equipmentTotal, oneTimeTotal, grandTotal, equipment: salesEquipment }), "Moved to Accounts.")}>
        <ReadOnlyEquipment title="Engineer Equipment" items={engineerEquipment} />
        <div className="form-grid">
          {textInput("Client Name", "clientName", sales, setSales, true)}
          <label>Location<TanzaniaLocationField disabled={!salesOpen} value={sales.location} onChange={(location) => setSales({ ...sales, location })} /></label>
          {textInput("Survey Form No.", "surveyFormNo", sales, setSales, !salesOpen)}
          <label>Money Type<select disabled={!salesOpen} value={sales.currency} onChange={(event) => setSales({ ...sales, currency: event.target.value })}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
          {numberInput("Installation Cost/Labor Charge", "amount", sales, setSales, !salesOpen)}
          <p><strong>Total Equipment Cost</strong><br />{money(equipmentTotal, sales.currency)}</p>
          <p><strong>Total Cost from Sales</strong><br />{money(salesTotal, sales.currency)}</p>
          {numberInput("Additional NPR", "additionalNpr", sales, setSales, !salesOpen)}
          <AutoTotal label="Total One-time Cost" value={oneTimeTotal} currency={sales.currency} />
          {subscriptionInput(sales, setSales, !salesOpen)}
          {numberInput("MBR", "mbr", sales, setSales, !salesOpen)}
          <AutoTotal label="First Invoice Total" value={grandTotal} currency={sales.currency} />
          {textInput("Requested By", "requestedBy", sales, setSales, !salesOpen)}
          <label>Date<input type="date" readOnly value={sales.requestedDate} /></label>
          <label>Time<input readOnly value={formatTime(sales.requestedTime)} /></label>
        </div>
        <EquipmentCostEditor items={salesEquipment} setItems={setSalesEquipment} locked={!salesOpen} currency={sales.currency || "TZS"} />
      </ActionPanel>
      {!salesOnly && (
        <>
          <ActionPanel title="Accounts Section" enabled={accountsOpen} actionLabel="Submit to Store" onAction={() => run(() => api.accounts(user, doc.id, { ...accounts, billingAmount: doc.sales?.grandTotal || doc.sales?.amount || 0 }), "Moved to Store.")}>
            <div className="form-grid"><AutoTotal label="Billing Amount" value={doc.sales?.grandTotal || doc.sales?.amount || 0} currency={doc.sales?.currency} />{textInput("Invoice Number", "invoiceNumber", accounts, setAccounts, !accountsOpen, false)}<label className="wide">Remarks<textarea required disabled={!accountsOpen} value={accounts.remarks} onChange={(e) => setAccounts({ ...accounts, remarks: e.target.value })} /></label></div>
          </ActionPanel>
          {!accountsOnly && (
            <>
              <ActionPanel title="Store Section" enabled={storeOpen} actionLabel={storeManager ? "Approve Requested Equipment" : "Confirm Stock and Validate"} onAction={() => run(() => api.store(user, doc.id, { remarks: storeRemarks, items }), "Store validation complete.")}>
                <OnboardingPreview doc={doc} printId={storeOnboardingPrintId} extraClass="print-only-document" />
                <StockRequisitionPreview doc={{ ...doc, store: { ...doc.store, items } }} printId={storeStockPrintId} extraClass="print-only-document" />
                <ItemEditor items={items} setItems={setItems} locked={!storeOpen} storeMode={storeManager} />
                {!storeManager && <div className="form-grid store-remarks-grid"><p><strong>Sales Amount</strong><br />{money(doc.sales?.amount, doc.sales?.currency)}</p><p><strong>Accounts Billing</strong><br />{money(doc.accounts?.billingAmount, doc.accounts?.currency)}</p><label className="wide">Store Remarks<textarea disabled={!storeOpen} value={storeRemarks} onChange={(e) => setStoreRemarks(e.target.value)} /></label><div className="store-print-actions no-print">
                  <button className="btn secondary" type="button" onClick={() => printElementById(storeOnboardingPrintId)}>Print Onboarding Doc</button>
                  <button className="btn secondary" type="button" onClick={() => printElementById(storeStockPrintId)}>Print Stock Doc</button>
                  <button className="btn" type="button" onClick={() => printElementsByIds([storeOnboardingPrintId, storeStockPrintId])}>Print All</button>
                </div></div>}
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
  const hodPrintId = `hod-maintenance-print-${doc.id}`;
  return (
    <>
      <section className="panel"><h2>General Maintenance Details</h2><p><strong>Fault</strong><br />{doc.maintenance?.fault}</p><p><strong>Recommended Action</strong><br />{doc.maintenance?.action}</p></section>
      {!accountsOnly && (
        <ActionPanel title="HOD Approval" enabled={hodOpen} actionLabel="Approve to Accounts" onAction={() => run(() => api.hod(user, doc.id, { remarks: hodRemarks }), "Moved to Accounts.")}>
          <MaintenanceDocumentPreview
            doc={{
              ...doc,
              hod: {
                ...doc.hod,
                approvedByName: doc.hod?.approvedByName || (canAct(user, "HOD") ? user.name : undefined),
                remarks: hodRemarks,
              },
            }}
            printId={hodPrintId}
            extraClass="print-only-document"
          />
          <div className="hod-notes-area">
            <label>HOD Notes<textarea disabled={!hodOpen} value={hodRemarks} onChange={(e) => setHodRemarks(e.target.value)} /></label>
            <div className="section-print-actions no-print">
              <button className="btn secondary" type="button" onClick={() => printElementById(hodPrintId)}>Print General Maintenance</button>
            </div>
          </div>
        </ActionPanel>
      )}
      <ActionPanel title="Accounts Billing" enabled={accountsOpen} actionLabel="Complete General Maintenance" onAction={() => run(() => api.accounts(user, doc.id, accounts), "General Maintenance completed.")}>
        <div className="form-grid">{numberInput("Billing Amount", "billingAmount", accounts, setAccounts, !accountsOpen)}{textInput("Invoice Number", "invoiceNumber", accounts, setAccounts, !accountsOpen, false)}<label className="wide">Remarks<textarea required disabled={!accountsOpen} value={accounts.remarks} onChange={(e) => setAccounts({ ...accounts, remarks: e.target.value })} /></label></div>
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

function EquipmentCostEditor({ items, setItems, locked = false, currency = "TZS" }) {
  const total = items.reduce((sum, item) => sum + Number(item.requestedQty || 0) * Number(item.unitCost || 0), 0);
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
          <label>Unit Cost ({currency})<input required min="0" type="number" disabled={locked} value={item.unitCost || ""} onChange={(event) => update(index, event.target.value)} /></label>
          <AutoTotal label="Line Total" value={Number(item.requestedQty || 0) * Number(item.unitCost || 0)} currency={currency} compact />
        </div>
      ))}
      <div className="equipment-total-bar"><strong>Equipment Total</strong><span>{money(total, currency)}</span></div>
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
          <thead><tr><th>Description</th><th>Requested Qty</th><th>Issued Qty</th><th>Item ID</th><th>Purpose</th><th>Unit Cost</th><th>Total</th></tr></thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td><input aria-label={`Item ${index + 1}`} required disabled={locked} value={item.name} onChange={(e) => update(index, "name", e.target.value)} /></td>
                <td>{locked ? <span className="readonly-value">{item.requestedQty}</span> : <input aria-label={`Requested quantity for item ${index + 1}`} required min="1" type="number" value={item.requestedQty} onChange={(e) => update(index, "requestedQty", e.target.value)} />}</td>
                <td><input aria-label={`Issued quantity for item ${index + 1}`} min="0" type="number" disabled={locked} value={item.issuedQty} onChange={(e) => update(index, "issuedQty", e.target.value)} /></td>
                <td>{locked ? <span className="readonly-value">{item.itemId || item.serialNumber || "-"}</span> : <input aria-label={`Item ID for item ${index + 1}`} value={item.itemId || ""} onChange={(e) => update(index, "itemId", e.target.value)} />}</td>
                <td><input aria-label={`Purpose for item ${index + 1}`} disabled={locked} value={item.purpose} onChange={(e) => update(index, "purpose", e.target.value)} /></td>
                <td><input aria-label={`Unit cost for item ${index + 1}`} min="0" type="number" disabled={locked || costLocked} value={item.unitCost} onChange={(e) => update(index, "unitCost", e.target.value)} /></td>
                <td className="money-cell">{money(Number(item.requestedQty || 0) * Number(item.unitCost || 0), item.costCurrency || "TZS")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan="6"><strong>Equipment Total</strong></td><td className="money-cell"><strong>{money(items.reduce((sum, item) => sum + Number(item.requestedQty || 0) * Number(item.unitCost || 0), 0), items[0]?.costCurrency || "TZS")}</strong></td></tr></tfoot>
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

  function updateUnitCost(index, value) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, unitCost: Number(value) } : item));
  }

  return (
    <div className="items-list">
      <div className="section-title"><h2>Stock Items</h2></div>
      <div className="table-wrap engineer-items-table">
        <table>
          <thead><tr><th>S/N</th><th>Item ID</th><th>Description</th><th>Quantity Requested</th><th>Unit Cost</th><th>Total</th><th>Action</th></tr></thead>
          <tbody>
            {visibleItems.map((item, visibleIndex) => {
              const itemIndex = startIndex + visibleIndex;
              return (
                <tr key={itemIndex}>
                  <td>{itemIndex + 1}</td>
                  <td><span className="readonly-value">{item.itemId || item.serialNumber || "-"}</span></td>
                  <td>
                    <input
                      aria-label={`Search equipment for item ${itemIndex + 1}`}
                      autoComplete="off"
                      list="engineer-equipment-options"
                      placeholder="Type to search equipment"
                      required
                      value={item.name}
                      onChange={(event) => updateDescription(itemIndex, event.target.value)}
                    />
                  </td>
                  <td><input required min="1" type="number" value={item.requestedQty} onChange={(event) => updateQuantity(itemIndex, event.target.value)} /></td>
                  <td><input required min="0" type="number" value={item.unitCost || ""} onChange={(event) => updateUnitCost(itemIndex, event.target.value)} /></td>
                  <td className="money-cell">{money(Number(item.requestedQty || 0) * Number(item.unitCost || 0), "TZS")}</td>
                  <td><button type="button" className="btn danger" onClick={() => setItems(items.filter((_, index) => index !== itemIndex))}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><td colSpan="5"><strong>Equipment Total</strong></td><td className="money-cell"><strong>{money(items.reduce((sum, item) => sum + Number(item.requestedQty || 0) * Number(item.unitCost || 0), 0), "TZS")}</strong></td><td /></tr></tfoot>
        </table>
        <datalist id="engineer-equipment-options">
          {engineerStockItems.map((stockItem) => (
            <option key={stockItem.id} value={stockItem.description}>{stockItem.id}</option>
          ))}
        </datalist>
        <div className="engineer-table-footer">
          <button type="button" className="btn secondary engineer-add-button" onClick={() => { setItems([...items, { ...emptyItem }]); setPage(Math.floor(items.length / pageSize)); }}>+ Add Item</button>
          <div className="engineer-pagination">
            <button type="button" className="pagination-arrow" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}>{"<"}</button>
            <span>Page {page + 1} of {totalPages}</span>
            <button type="button" className="pagination-arrow" aria-label="Next page" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>{">"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function History({ doc }) {
  return <section className="panel"><h2>Audit Trail</h2><div className="timeline">{doc.history.map((item) => <div className="history-row" key={item.id}><time>{formatDate(item.at)}</time><div><strong>{item.action}</strong><br /><small>{item.note}</small></div></div>)}</div></section>;
}

const countryCodesByPrefix = [...countryCodes].sort((first, second) => second[2].length - first[2].length);

function splitContactNumber(contact, fallbackIso = "TZ") {
  const value = String(contact || "").trim();
  const matchedCountry = countryCodesByPrefix.find(([, , dialCode]) =>
    value === dialCode || value.startsWith(`${dialCode} `)
  );
  const selectedCountry = matchedCountry || countryCodes.find(([iso]) => iso === fallbackIso) || countryCodes[0];
  return {
    countryIso: selectedCountry[0],
    number: matchedCountry ? value.slice(matchedCountry[2].length).trim() : value,
  };
}

function formatContactNumber(countryIso, number) {
  const trimmedNumber = String(number || "").trim();
  if (!trimmedNumber) return "";
  const selectedCountry = countryCodes.find(([iso]) => iso === countryIso) || countryCodes[0];
  return `${selectedCountry[2]} ${trimmedNumber}`;
}

function ClientFields({ clients, form, setForm }) {
  const selectedClient = clients.find((client) => client.id === form.clientId);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const contactParts = splitContactNumber(form.contact, form.countryIso);

  function selectClient(clientId) {
    const client = clients.find((item) => item.id === clientId);
    const clientContact = splitContactNumber(client?.contact || "", "TZ");
    setForm({
      ...form,
      clientId,
      clientName: client?.name || "",
      countryIso: clientContact.countryIso,
      contact: client?.contact || "",
      email: client?.email || "",
      location: "",
    });
  }

  return (
    <>
      <label>Client
        <select required value={form.clientId} onChange={(event) => selectClient(event.target.value)}>
          <option value="">Select a registered client</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        {!clients.length && <small className="field-help">Register a client from the Clients page first.</small>}
      </label>
      <label>Location
        <TanzaniaLocationField
          value={form.location}
          onChange={(location) => setForm({ ...form, location })}
        />
        {!selectedClient && <small className="field-guidance">Select a client, then search for any service location in Zanzibar.</small>}
      </label>
      <label>Contact
        <div className="phone-input-wrap">
          <CountryCodePicker
            open={countryPickerOpen}
            selectedIso={contactParts.countryIso}
            setOpen={setCountryPickerOpen}
            onChange={(countryIso) => setForm({
              ...form,
              countryIso,
              contact: formatContactNumber(countryIso, contactParts.number),
            })}
          />
          <input
            inputMode="tel"
            placeholder="Phone number"
            required
            value={contactParts.number}
            onChange={(event) => setForm({
              ...form,
              countryIso: contactParts.countryIso,
              contact: formatContactNumber(contactParts.countryIso, event.target.value),
            })}
          />
        </div>
      </label>
      <label>Email<input readOnly value={form.email} /></label>
    </>
  );
}

function TanzaniaLocationField({ value, onChange, disabled = false }) {
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const requestNumber = useRef(0);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    const query = value.trim();
    if (disabled || query.length < 2) {
      setSuggestions([]);
      setStatus("idle");
      setActiveIndex(-1);
      return undefined;
    }
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return undefined;
    }

    const controller = new AbortController();
    const currentRequest = ++requestNumber.current;
    setStatus("loading");
    setIsOpen(true);

    const debounce = window.setTimeout(() => {
      searchTanzaniaLocations(query, controller.signal)
        .then((results) => {
          if (currentRequest !== requestNumber.current) return;
          setSuggestions(results);
          setStatus(results.length ? "ready" : "empty");
          setActiveIndex(results.length ? 0 : -1);
        })
        .catch((error) => {
          if (error.name === "AbortError" || currentRequest !== requestNumber.current) return;
          setSuggestions([]);
          setStatus("error");
          setActiveIndex(-1);
        });
    }, 450);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [value, disabled]);

  function selectLocation(location) {
    skipNextSearch.current = true;
    onChange(location);
    setSuggestions([]);
    setStatus("idle");
    setIsOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="location-combobox">
      <span className="location-search-icon" aria-hidden="true">⌕</span>
      <input
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={!disabled && isOpen && value.trim().length >= 2}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        required
        role="combobox"
        placeholder="Search any address or place in Zanzibar"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => !disabled && value.trim().length >= 2 && setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && suggestions.length) {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp" && suggestions.length) {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
          } else if (event.key === "Escape") {
            setIsOpen(false);
          } else if (event.key === "Enter" && suggestions[activeIndex]) {
            event.preventDefault();
            selectLocation(suggestions[activeIndex].label);
          }
        }}
      />
      {!disabled && !!value && (
        <button className="location-clear" aria-label="Clear location search" type="button" onClick={() => onChange("")}>×</button>
      )}
      {!disabled && isOpen && value.trim().length >= 2 && (
        <div className="location-suggestions" id={listboxId} role="listbox">
          {status === "loading" && <div className="location-message"><span className="location-spinner" />Searching across Zanzibar…</div>}
          {status === "empty" && <div className="location-message">No matching place found. You can still use the address you typed.</div>}
          {status === "error" && <div className="location-message">Suggestions are unavailable. You can still use the address you typed.</div>}
          {suggestions.map((place, index) => (
            <button
              className={index === activeIndex ? "active" : ""}
              id={`${listboxId}-${index}`}
              key={place.id}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectLocation(place.label)}
            >
              <span>{place.name}</span>
              <small>{place.label}</small>
            </button>
          ))}
          {(status === "ready" || status === "empty") && (
            <div className="location-attribution">Search results © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div>
          )}
        </div>
      )}
    </div>
  );
}

function ServiceSelect({ form, setForm, label }) {
  return (
    <>
      <label>{label}
        <select required value={form.service} onChange={(event) => setForm({ ...form, service: event.target.value, otherService: event.target.value === "Other" ? form.otherService : "" })}>
          <option value="">Select service</option>
          {requestedServices.map((service) => <option key={service}>{service}</option>)}
          <option>Other</option>
        </select>
      </label>
      {form.service === "Other" && <label>Other Service<input required value={form.otherService} onChange={(event) => setForm({ ...form, otherService: event.target.value })} /></label>}
    </>
  );
}

function textInput(label, key, form, setForm, disabled = false, required = true) {
  return <label>{label}<input disabled={disabled} required={required} value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>;
}

function subscriptionInput(form, setForm, disabled = false) {
  return (
    <label>Subscription Package
      <input
        disabled={disabled}
        required
        list="subscription-package-options"
        value={form.subscription || ""}
        onChange={(event) => setForm({ ...form, subscription: event.target.value })}
      />
      <datalist id="subscription-package-options">
        {subscriptionPackages.map((subscriptionPackage) => (
          <option key={subscriptionPackage} value={subscriptionPackage} />
        ))}
      </datalist>
    </label>
  );
}

function numberInput(label, key, form, setForm, disabled = false) {
  return <label>{label}<input type="number" min="0" disabled={disabled} required value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>;
}

function AutoTotal({ label, value, currency = "TZS", compact = false }) {
  return (
    <div className={`auto-total${compact ? " compact" : ""}`}>
      <span>{label}</span>
      <strong>{money(Number(value || 0), currency || "TZS")}</strong>
      {!compact && <small>Calculated automatically</small>}
    </div>
  );
}

export default App;
