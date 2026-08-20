import React, { useEffect, useId, useRef, useState } from "react";
import Field from "./components/common/Field";
import GuidedTour from "./components/common/GuidedTour";
import Sidebar from "./components/layout/Sidebar";
import { defaultPricing, emptyItem, engineerStockItems, requestedServices, serviceTypes, subscriptionPackages } from "./config/workflow";
import ClientsPage, { CountryCodePicker, countryCodeForIso, countryCodes } from "./pages/ClientsPage";
import ClientSummariesPage from "./pages/ClientSummariesPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ReportsPage from "./pages/ReportsPage";
import UserManagementPage from "./pages/UserManagementPage";
import PricingManagementPage from "./pages/PricingManagementPage";
import { api } from "./services/api";
import { searchTanzaniaLocations } from "./services/tanzaniaLocations";
import { formatDate, formatTime, money } from "./utils/formatters";
import { canAct, statusClass } from "./utils/permissions";

function mergePricingCatalog(pricingData) {
  const savedItems = Array.isArray(pricingData?.items) ? pricingData.items : [];
  const savedById = new Map(savedItems.map((item) => [item.id, item]));
  const defaultIds = new Set(defaultPricing.items.map((item) => item.id));
  return {
    ...defaultPricing,
    ...pricingData,
    items: [
      ...defaultPricing.items.map((item) => ({ ...item, ...(savedById.get(item.id) || {}) })),
      ...savedItems.filter((item) => !defaultIds.has(item.id)),
    ],
  };
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("zanlink-user") || "null"));
  const [view, setView] = useState("dashboard");
  const [documents, setDocuments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientPlans, setClientPlans] = useState([]);
  const [reports, setReports] = useState(null);
  const [users, setUsers] = useState([]);
  const [pricing, setPricing] = useState(defaultPricing);
  const [filters, setFilters] = useState({ q: "", type: "", status: "", department: "" });
  const [message, setMessage] = useState("");
  const [tourOpen, setTourOpen] = useState(false);

  const selected = documents.find((doc) => doc.id === selectedId);

  async function refresh(nextFilters = filters) {
    if (!user) return;
    const [accountData, docs, summaryData, reportData, clientData, clientPlanData, userData, pricingData] = await Promise.all([
      api.account(user),
      api.documents(user, nextFilters),
      ["System Admin", "Management"].includes(user.role) ? api.summaries(user) : Promise.resolve([]),
      api.reports(user),
      api.clients(user),
      api.clientPlans(user),
      ["System Admin", "Management"].includes(user.role) ? api.users(user) : Promise.resolve([]),
      api.pricing(user),
    ]);
    setDocuments(docs);
    setSummaries(summaryData);
    setReports(reportData);
    setClients(clientData);
    setClientPlans(clientPlanData);
    setUsers(userData);
    setPricing(mergePricingCatalog(pricingData));
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
      setMessage("Password added. You can now sign in with Microsoft or email and password.");
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

  async function updateClient(clientId, payload) {
    try {
      await api.updateClient(user, clientId, payload);
      await refresh();
      setMessage("Client details updated.");
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
      setMessage(changes.approve ? "Microsoft account approved. The user can now continue with Microsoft sign-in." : changes.active === false ? "User access revoked." : changes.active === true ? "User access restored." : "User role updated.");
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

  async function updatePricing(payload) {
    try {
      await api.updatePricing(user, payload);
      await refresh();
      setMessage("Item prices and USD to TZS rate updated.");
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
        {user.microsoftLinked && !user.hasPassword && <PasswordSetupCard onSubmit={setAccountPassword} />}
        {selected ? (
          <DocumentDetail user={user} doc={selected} onBack={() => setSelectedId(null)} run={run} />
        ) : view === "doc1" ? (
          <Doc1Form clients={clients} pricing={pricing} onCancel={() => navigate("dashboard")} onSubmit={(payload) => run(() => api.createDoc1(user, payload), "Document submitted to Sales.")} />
        ) : view === "maintenance" ? (
          <MaintenanceForm clients={clients} pricing={pricing} onCancel={() => navigate("dashboard")} onSubmit={(payload) => run(() => api.createMaintenance(user, payload), "General Maintenance submitted to HOD.")} />
        ) : view === "survey" ? (
          <SurveyRequestForm clients={clients} plans={clientPlans} onCancel={() => navigate("dashboard")} onSubmit={(payload) => run(() => api.createSurvey(user, payload), "Site survey request submitted to Engineer.")} />
        ) : view === "clients" ? (
          <ClientsPage clients={clients} onRegister={registerClient} onUpdate={updateClient} />
        ) : view === "users" && ["System Admin", "Management"].includes(user.role) ? (
          <UserManagementPage currentUser={user} users={users} onCreateUser={createUser} onUpdateUser={updateUser} onDeleteUser={deleteUser} />
        ) : view === "pricing" && ["System Admin", "Management"].includes(user.role) ? (
          <PricingManagementPage pricing={pricing} onSave={updatePricing} />
        ) : view === "summaries" && ["System Admin", "Management"].includes(user.role) ? (
          <ClientSummariesPage user={user} summaries={summaries} documents={documents} showError={showError} />
        ) : view === "reports" ? (
          <ReportsPage reports={reports} user={user} />
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
            onCreateSurvey={() => navigate("survey")}
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
        <span>This Microsoft account can also use email and password after you create an app password.</span>
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

function Doc1Form({ clients, pricing, onSubmit, onCancel }) {
  const [form, setForm] = useState({ clientId: "", clientName: "", countryIso: "TZ", contact: "", email: "", location: "", service: "", otherService: "", serviceType: "new_installation", engineerNotes: "", currency: "TZS", items: [{ ...emptyItem }] });
  const equipmentTotal = form.items.reduce((total, item) => total + Number(item.requestedQty || 0) * Number(item.unitCost || 0), 0);
  const engineerMustConfirm = equipmentTotal < (form.currency === "USD" ? 400 : 1000000);
  return (
    <FormShell title="New Document 1" subtitle="Customer onboarding and stock requisition starts from Engineer." onCancel={onCancel} onSubmit={() => onSubmit(form)} submitLabel="Submit to Sales">
      <div className="form-grid">
        <ClientFields clients={clients} form={form} setForm={setForm} />
        <ServiceSelect form={form} setForm={setForm} label="Requested Service" />
        <label>Display Currency<select value={form.currency} onChange={(event) => { const currency = event.target.value; setForm({ ...form, currency, items: form.items.map((item) => ({ ...item, costCurrency: currency, unitCost: item.unitCostUsd ? (currency === "USD" ? item.unitCostUsd : item.unitCostUsd * Number(pricing.usdToTzsRate)) : item.unitCost })) }); }}><option value="TZS">TZS</option><option value="USD">USD</option></select></label>
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
      <ItemEditor items={form.items} setItems={(items) => setForm({ ...form, items })} engineerRequest pricing={pricing} currency={form.currency} />
      {engineerMustConfirm && (
        <ConfirmationUpload
          value={form.clientConfirmation}
          onChange={(clientConfirmation) => setForm({ ...form, clientConfirmation })}
          owner="Engineer"
        />
      )}
      {!engineerMustConfirm && <p className="confirmation-routing-note">The equipment total has reached TZS 1,000,000 ($400 equivalent). Sales must upload the client email confirmation.</p>}
    </FormShell>
  );
}

function MaintenanceForm({ clients, pricing, onSubmit, onCancel }) {
  const [form, setForm] = useState({ clientId: "", clientName: "", countryIso: "TZ", contact: "", email: "", location: "", service: "", otherService: "", fault: "", action: "", items: [{ ...emptyItem }] });
  return (
    <FormShell title="New General Maintenance" subtitle="General Maintenance starts from Engineer, goes to HOD, then Accounts." onCancel={onCancel} onSubmit={() => onSubmit(form)} submitLabel="Submit to HOD">
      <div className="form-grid">
        <ClientFields clients={clients} form={form} setForm={setForm} />
        <ServiceSelect form={form} setForm={setForm} label="Service" />
        <label className="wide">Fault Report<textarea required value={form.fault} onChange={(event) => setForm({ ...form, fault: event.target.value })} /></label>
        <label className="wide">Recommended Action<textarea required value={form.action} onChange={(event) => setForm({ ...form, action: event.target.value })} /></label>
      </div>
      <MaintenanceItemEditor
        items={form.items}
        setItems={(items) => setForm({ ...form, items })}
        pricing={pricing || { items: engineerStockItems.map((item) => ({ id: item.itemId, description: item.description })) }}
      />
    </FormShell>
  );
}

function SurveyRequestForm({ clients, plans, onSubmit, onCancel }) {
  const availablePlans = [...new Set([
    ...subscriptionPackages,
    ...plans,
  ])].sort((first, second) => first.localeCompare(second));
  const [form, setForm] = useState({ clientId: "new", clientName: "", countryIso: "TZ", location: "", contact: "", email: "", package: subscriptionPackages[0] || "" });
  return <FormShell title="Request Site Survey" subtitle="Sales starts the request; Engineer performs the survey." onCancel={onCancel} onSubmit={() => onSubmit(form)} submitLabel="Submit to Engineer">
    <div className="form-grid">
      <ClientFields clients={clients} form={form} setForm={setForm} allowNewClient />
      <label>Package Needed<select required value={form.package} onChange={(event) => setForm({ ...form, package: event.target.value })}>{availablePlans.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    </div>
  </FormShell>;
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
  const managementReview = false;
  const doc1PendingManagement = doc.type === "doc1" && doc.status === "Pending Management";
  const doc1Completed = doc.type === "doc1" && doc.status === "Completed";
  const maintenanceCompleted = doc.type === "maintenance" && doc.status === "Completed";
  return (
    <>
      <div className="topbar"><div className="page-title"><h1>{doc.number}</h1><p>{doc.clientName} / {doc.service}</p></div><button className="btn secondary" onClick={onBack}>Back</button></div>
      {doc.type === "doc1" && !doc1Completed && !doc1PendingManagement && <SalesCostSummary doc={doc} />}
      {managementReview ? (
        <ManagementReview user={user} doc={doc} run={run} />
      ) : doc1PendingManagement ? (
        <PendingManagementDocuments user={user} doc={doc} run={run} />
      ) : doc1Completed ? (
        <CompletedEngineerDocuments user={user} doc={doc} />
      ) : maintenanceCompleted ? (
        <MaintenanceCertificate user={user} doc={doc} />
      ) : doc.type === "survey" && doc.status === "Completed" ? (
        <SurveyActions user={user} doc={doc} run={run} />
      ) : doc.type === "survey" ? (
        <><section className="panel"><div className="section-title"><h2>Site Survey Workflow</h2><span className={`status ${statusClass(doc.status)}`}>{doc.status}</span></div><div className="form-grid"><p><strong>Current Department</strong><br />{doc.currentDepartment}</p><p><strong>Requested Package</strong><br />{doc.service}</p></div></section><SurveyActions user={user} doc={doc} run={run} /><History doc={doc} /></>
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

function PendingManagementDocuments({ user, doc, run }) {
  const onboardingPrintId = `pending-onboarding-print-${doc.id}`;
  const stockPrintId = `pending-stock-print-${doc.id}`;
  const verificationPrintId = `pending-verification-print-${doc.id}`;
  const printIds = doc.clientConfirmation?.dataUrl ? [onboardingPrintId, stockPrintId, verificationPrintId] : [onboardingPrintId, stockPrintId];
  const [remarks, setRemarks] = useState(doc.management?.remarks || "");
  const canApprove = canAct(user, "Management");
  return (
    <section className="final-documents">
      <div className="panel final-toolbar">
        <div>
          <h2>Management Review Forms</h2>
          <p>{doc.clientName} is pending management approval. The onboarding and stock requisition forms are ready to view.</p>
          <span className={`status ${statusClass(doc.status)}`}>{doc.status}</span>
        </div>
        <div className="button-row">
          <button className="btn secondary" onClick={() => printElementById(onboardingPrintId)}>Print Onboarding Doc</button>
          <button className="btn secondary" onClick={() => printElementById(stockPrintId)}>Print Stock Doc</button>
          <button className="btn" onClick={() => printElementsByIds(printIds)}>Print All</button>
        </div>
      </div>
      <div className="document-preview-grid">
        <OnboardingPreview doc={doc} printId={onboardingPrintId} />
        <StockRequisitionPreview doc={doc} printId={stockPrintId} />
        {doc.clientConfirmation?.dataUrl && <ClientVerificationPreview doc={doc} printId={verificationPrintId} />}
      </div>
      {canApprove && (
        <ActionPanel title="Management Approval" enabled initiallyEditing actionLabel="Approve and Complete" onAction={() => run(() => api.management(user, doc.id, { remarks }), "Document completed.")}>
          <label>Approval Notes<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
        </ActionPanel>
      )}
    </section>
  );
}

function SalesCostSummary({ doc }) {
  const laborCharge = Number(doc.sales?.laborCharge ?? 0);
  const equipmentCost = Number(doc.sales?.packageCost ?? 0);
  const totalSalesCost = Number(doc.sales?.amount ?? (laborCharge + equipmentCost));
  if (!doc.sales || (!laborCharge && !equipmentCost && !totalSalesCost)) return null;
  return (
    <section className="panel">
      <div className="section-title"><h2>Sales Cost Summary</h2></div>
      <div className="form-grid">
        <p><strong>Installation Cost / Labor Charge</strong><br />{money(laborCharge, doc.sales?.currency)}</p>
        <p><strong>Equipment Cost</strong><br />{money(equipmentCost, doc.sales?.currency)}</p>
        <p><strong>Total Sales Cost</strong><br />{money(totalSalesCost, doc.sales?.currency)}</p>
      </div>
    </section>
  );
}

function ManagementReview({ user, doc, run }) {
  const pending = doc.status === "Pending Management";
  const storeName = actorName(doc.store?.approvedByName, doc.store?.approvedBy, "Store Manager");
  const [remarks, setRemarks] = useState(doc.management?.remarks || "");
  return (
      <ActionPanel title="Store Manager Submission" enabled={pending} initiallyEditing={pending} actionLabel="Approve" onAction={() => run(() => api.management(user, doc.id, { remarks }), "Document approved and completed.")}>
      <div className="form-grid">
        <p><strong>Submitted By</strong><br />{storeName}</p>
        <p><strong>Submitted At</strong><br />{doc.store?.approvedAt ? formatDate(doc.store.approvedAt) : "-"}</p>
        <p><strong>Status</strong><br /><span className={`status ${statusClass(doc.status)}`}>{doc.status}</span></p>
        <label className="wide">Approval Comments<textarea disabled={!pending} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
      </div>
      <ItemEditor items={doc.store?.items || []} setItems={() => {}} locked storeMode />
    </ActionPanel>
  );
}

function MaintenanceCertificate({ user, doc }) {
  const printId = `maintenance-certificate-${doc.id}`;
  const stockPrintId = `maintenance-stock-requisition-${doc.id}`;
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
          <button className="btn secondary" onClick={() => printElementById(stockPrintId)}>Print Stock Requisition</button>
          <button className="btn" onClick={() => printElementsByIds([printId, stockPrintId])}>Print All</button>
        </div>
      </div>
      <div className="document-preview-grid">
        <MaintenanceDocumentPreview doc={doc} printId={printId} certificate />
        <StockRequisitionPreview doc={{ ...doc, store: { items: doc.maintenance?.items || [] } }} printId={stockPrintId} />
      </div>
    </section>
  );
}

function CompletedEngineerDocuments({ user, doc }) {
  const onboardingPrintId = `onboarding-print-${doc.id}`;
  const stockPrintId = `stock-print-${doc.id}`;
  const verificationPrintId = `verification-print-${doc.id}`;
  const printIds = doc.clientConfirmation?.dataUrl ? [onboardingPrintId, stockPrintId, verificationPrintId] : [onboardingPrintId, stockPrintId];
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
          <button className="btn" onClick={() => printElementsByIds(printIds)}>Print All</button>
        </div>
      </div>
      <div className="document-preview-grid">
        <OnboardingPreview doc={doc} printId={onboardingPrintId} />
        <StockRequisitionPreview doc={doc} printId={stockPrintId} />
        {doc.clientConfirmation?.dataUrl && <ClientVerificationPreview doc={doc} printId={verificationPrintId} />}
      </div>
    </section>
  );
}

function OnboardingPreview({ doc, printId, extraClass = "" }) {
  const equipmentCost = Number(doc.sales?.packageCost || 0);
  const oneTimeTotal = doc.sales?.oneTimeTotal ?? (
    Number(doc.sales?.amount || 0) + equipmentCost + Number(doc.sales?.additionalNrr ?? doc.sales?.additionalNpr ?? 0)
  );
  const firstInvoiceTotal = doc.sales?.grandTotal ?? (oneTimeTotal + Number(doc.sales?.mrr ?? doc.sales?.mbr ?? 0));
  const laborCharge = Number(doc.sales?.laborCharge ?? doc.sales?.amount ?? 0);
  const engineerName = actorName(doc.createdByName || doc.engineer?.submittedByName, doc.createdBy, "Engineer");
  const salesName = actorName(doc.sales?.submittedByName || doc.sales?.requestedBy, doc.sales?.submittedBy, "Sales");
  const storeName = actorName(doc.store?.approvedByName, doc.store?.approvedBy, "Store");
  const hocName = actorName(doc.hoc?.reviewedByName, doc.hoc?.reviewedBy, "-");
  const managementName = actorName(doc.management?.approvedByName, doc.management?.approvedBy, "Pending Management");
  const isBilled = Boolean(String(doc.accounts?.invoiceNumber || "").trim());
  const billingDate = isBilled && doc.accounts?.processedAt ? formatDate(doc.accounts.processedAt) : "-";
  return (
    <article id={printId} className={`paper-form onboarding-form ${extraClass}`}>
      <header className="paper-head onboarding-head">
        <span className="paper-logo">zanlink</span>
        <div className="onboarding-title">
          <h2>Customer Onboarding Form</h2>
          <span>Form No. {doc.number}</span>
        </div>
      </header>
      <h3>Customer Information</h3>
      <div className="check-row">
        {serviceTypes.map(([value, label]) => (
          <PaperCheck key={value} label={label} active={(doc.serviceType || "new_installation") === value} />
        ))}
      </div>
      <div className="paper-fields">
        <Field label="Client Name" value={doc.clientName} />
        <Field label="Location" value={doc.location} />
        <Field label="Installation Cost/Labor Charge" value={money(laborCharge, doc.sales?.currency)} />
        <Field label="Equipment Cost" value={money(equipmentCost, doc.accounts?.currency || doc.sales?.currency)} />
        <Field label="Additional NRR" value={money(doc.sales?.additionalNrr ?? doc.sales?.additionalNpr, doc.sales?.currency)} />
        <Field label="Total One-time Cost" value={money(oneTimeTotal, doc.sales?.currency)} />
        <Field label="Subscription package" value={doc.sales?.subscription || doc.sales?.remarks || doc.service} />
        <Field label="MRR" value={money(doc.sales?.mrr ?? doc.sales?.mbr ?? 0, doc.accounts?.currency || doc.sales?.currency)} />
        <Field label="First Invoice Total" value={money(firstInvoiceTotal, doc.accounts?.currency || doc.sales?.currency)} />
        <Field label="Requested By" value={salesName} />
        <Field label="Date" value={doc.sales?.requestedDate || formatDate(doc.createdAt)} />
        <Field label="Time" value={formatTime(doc.sales?.requestedTime || doc.createdAt)} />
      </div>
      <h3>Engineering Confirmation</h3>
      <div className="paper-fields two"><Field label="Stock Requisition No" value={doc.number} /><Field label="Prepared by" value={engineerName} /></div>
      {doc.hoc?.reviewedBy && <><h3>Head of Commercial Approval</h3><div className="paper-fields two"><Field label="Reviewed By" value={hocName} /><Field label="Decision" value={doc.hoc.decision ? doc.hoc.decision[0].toUpperCase() + doc.hoc.decision.slice(1) : "-"} /><Field label="Comments" value={doc.hoc.remarks || "-"} /></div></>}
      <h3>Admin Stock Confirmation</h3>
      <div className="paper-fields two"><Field label="Stock Availability" value="Confirmed" /><Field label="Stock issued by" value={storeName} /><Field label="Work Order Form No." value={`Zanlink/${doc.number}`} /><Field label="Date" value={formatDate(new Date())} /></div>
      <h3>Management Approval</h3>
      <div className="paper-fields two"><Field label="Approved By" value={doc.management?.approvedBy ? managementName : "Pending Management"} /><Field label="Comments" value={doc.management?.remarks || "-"} /></div>
      <h3>Finance & Billing</h3>
      <div className="paper-fields two"><Field label="Billing Confirmation" value={isBilled ? "Billed" : "Not Billed"} /><Field label="User Created in System" value={isBilled ? "Yes" : "No"} /><Field label="Date" value={billingDate} /><Field label="Received by" value={engineerName} /></div>
    </article>
  );
}

function ClientVerificationPreview({ doc, printId, extraClass = "" }) {
  if (!doc.clientConfirmation?.dataUrl) return null;
  return (
    <article id={printId} className={`paper-form printed-confirmation ${extraClass}`}>
      <header className="paper-head">
        <span className="paper-logo">zanlink</span>
        <div>
          <h2>Client Verification</h2>
          <p>Form No. {doc.number}</p>
        </div>
      </header>
      <div className="paper-fields two">
        <Field label="Client Name" value={doc.clientName} />
        <Field label="Uploaded By" value={doc.clientConfirmation.uploadedByName || "-"} />
        <Field label="File" value={doc.clientConfirmation.name || "-"} />
        <Field label="Uploaded At" value={doc.clientConfirmation.uploadedAt ? formatDate(doc.clientConfirmation.uploadedAt) : "-"} />
      </div>
      <img src={doc.clientConfirmation.dataUrl} alt="Client email confirmation screenshot" />
    </article>
  );
}

function PaperCheck({ label, active = false }) {
  return <span className="paper-check"><span className={active ? "checked-box" : "empty-box"}>{active ? "X" : ""}</span>{label}</span>;
}

function StockRequisitionPreview({ doc, printId, extraClass = "" }) {
  const isMaintenance = doc.type === "maintenance";
  const isSurvey = doc.type === "survey";
  const historyEntry = (...actions) => [...(doc.history || [])].reverse().find((entry) => actions.includes(entry.action));
  const historyActionAt = (...actions) => historyEntry(...actions)?.at;
  const historyActor = (...actions) => {
    const entry = historyEntry(...actions);
    return actorName(entry?.userName, entry?.userId, "Not recorded");
  };
  const people = isMaintenance
    ? [
      ["Requested by", actorName(doc.createdByName || doc.maintenance?.submittedByName, doc.createdBy, "Not recorded"), doc.createdByRole || "Engineer", doc.createdAt],
      ["Reviewed by HOD", actorName(doc.hod?.approvedByName, doc.hod?.approvedBy, historyActor("HOD approved General Maintenance")), doc.hod?.approvedByRole || "HOD", doc.hod?.approvedAt || historyActionAt("HOD approved General Maintenance")],
      ["Reviewed by Accounts", actorName(doc.accounts?.processedByName, doc.accounts?.processedBy, historyActor("General Maintenance equipment reviewed")), doc.accounts?.processedByRole || "Accounts", doc.accounts?.processedAt || historyActionAt("General Maintenance equipment reviewed")],
    ]
    : isSurvey ? [
      ["Requested by", actorName(doc.sales?.submittedByName || doc.createdByName, doc.sales?.submittedBy || doc.createdBy, "Not recorded"), doc.sales?.submittedByRole || doc.createdByRole || "Sales", doc.createdAt],
      ["Surveyed by", actorName(doc.engineer?.submittedByName, doc.engineer?.submittedBy, "Not recorded"), doc.engineer?.submittedByRole || "Engineer", doc.engineer?.submittedAt],
      ["Payment confirmed by", actorName(doc.hoc?.reviewedByName, doc.hoc?.reviewedBy, "Not recorded"), doc.hoc?.reviewedByRole || "HOC", doc.hoc?.reviewedAt],
      ["Billed by", actorName(doc.accounts?.processedByName, doc.accounts?.processedBy, "Not recorded"), doc.accounts?.processedByRole || "Accounts", doc.accounts?.processedAt],
      ["Issued by", actorName(doc.store?.approvedByName, doc.store?.approvedBy, "Not recorded"), doc.store?.approvedByRole || "Store", doc.store?.approvedAt],
      ["Approved by", actorName(doc.management?.approvedByName, doc.management?.approvedBy, "Pending Management"), doc.management?.approvedByRole || "Management", doc.management?.approvedAt],
    ] : [
      ["Requested by", actorName(doc.createdByName || doc.engineer?.submittedByName, doc.createdBy, "Not recorded"), doc.createdByRole || "Engineer", doc.createdAt],
      [
        "Costed by",
        actorName(doc.sales?.submittedByName || doc.sales?.requestedBy, doc.sales?.submittedBy, "Not recorded"),
        doc.sales?.submittedByRole || "Sales",
        doc.sales?.submittedAt
          || historyActionAt("Sales cost submitted", "Sales cost updated", "Sales amount added")
          || doc.sales?.requestedDate,
      ],
      ["Billed by", actorName(doc.accounts?.processedByName || doc.accounts?.submittedByName, doc.accounts?.processedBy || doc.accounts?.submittedBy, "Not recorded"), doc.accounts?.processedByRole || doc.accounts?.submittedByRole || "Accounts", doc.accounts?.processedAt || doc.accounts?.submittedAt || historyActionAt("Billing added")],
      ["Issued by", actorName(doc.store?.approvedByName, doc.store?.approvedBy, "Not recorded"), doc.store?.approvedByRole || "Store", doc.store?.approvedAt],
      ["Approved by", actorName(doc.management?.approvedByName, doc.management?.approvedBy, "Not recorded"), doc.management?.approvedByRole || "Management", doc.management?.approvedAt],
    ];
  return (
    <article id={printId} className={`paper-form ${extraClass}`}>
      <header className="paper-head stock"><span className="paper-logo">zanlink</span><div><h2>Stock Requisition Form</h2><p>{isMaintenance ? "General Maintenance No." : isSurvey ? "Survey Requisition No." : "Install Requisition No."} {doc.number}</p></div></header>
      <table className="paper-table">
        <thead><tr><th>S/N</th><th>Item ID</th><th>Description</th><th>Quantity Requested</th><th>Quantity Issued</th></tr></thead>
        <tbody>
          {(doc.store?.items || []).map((item, index) => (
            <tr key={index}><td>{index + 1}</td><td>{item.itemId || item.serialNumber || "-"}</td><td>{item.name}</td><td>{item.requestedQty}</td><td>{item.issuedQty}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="narration"><strong>Narration</strong><p>{isSurvey ? doc.engineer?.comments || "-" : doc.engineer?.notes || "-"}</p></div>
      <div className="signature-grid">
        {people.map(([label, name, position, at]) => <Signature key={label} label={label} name={name} position={position} at={at} />)}
      </div>
    </article>
  );
}

function Signature({ label, name, position, at }) {
  return <div className="signature-row"><strong>{label}:</strong><span><b>Name:</b> {name}</span><span><b>Position:</b> {position}</span><span><b>Date:</b> {at ? formatDate(at) : "Not recorded"}</span></div>;
}

function MaintenanceDocumentPreview({ doc, printId, extraClass = "", certificate = false }) {
  const engineerName = actorName(doc.createdByName || doc.maintenance?.submittedByName, doc.createdBy, "Engineer");
  const hodName = doc.hod?.approvedByName || actorName(null, doc.hod?.approvedBy, "Pending approval");
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
      <p><strong>Submitted By:</strong> {engineerName}</p>
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
        <span>Name: {hodName}</span>
      </div>
    </article>
  );
}

function SurveyActions({ user, doc, run }) {
  const engineerOpen = canAct(user, "Engineer") && doc.status === "Pending Engineer";
  const salesReviewOpen = canAct(user, "Sales") && doc.status === "On Hold";
  const hocOpen = canAct(user, "HOC") && doc.status === "Pending HOC";
  const accountsOpen = canAct(user, "Accounts") && doc.status === "Pending Accounts";
  const storeOpen = canAct(user, "Store") && doc.status === "Pending Store";
  const managementOpen = canAct(user, "Management") && doc.status === "Pending Management";
  const [engineer, setEngineer] = useState({ connectionType: doc.engineer?.connectionType || "fibre", distance: doc.engineer?.distance || "", node: doc.engineer?.node || "", tower: doc.engineer?.tower || "", comments: doc.engineer?.comments || "", proceed: doc.engineer?.proceed === false ? "no" : "yes", clientFeedback: doc.engineer?.clientFeedback || "", currency: doc.engineer?.currency || "TZS", items: doc.engineer?.items?.length ? doc.engineer.items : [{ ...emptyItem }] });
  const [salesReviewRemarks, setSalesReviewRemarks] = useState(doc.salesReview?.remarks || "");
  const [paymentConfirmation, setPaymentConfirmation] = useState(null);
  const [hocRemarks, setHocRemarks] = useState(doc.hoc?.remarks || "");
  const surveyEquipment = doc.sales?.equipment?.length ? doc.sales.equipment : (doc.engineer?.items || []);
  const surveyEquipmentTotal = surveyEquipment.reduce((total, item) => total + Number(item.requestedQty || 0) * Number(item.unitCost || 0), 0);
  const [accounts, setAccounts] = useState({ billingAmount: doc.accounts?.billingAmount || surveyEquipmentTotal || "", invoiceNumber: doc.accounts?.invoiceNumber || "", remarks: doc.accounts?.remarks || "" });
  const [items, setItems] = useState((doc.store?.items || []).map((item) => ({ ...item, issuedQty: item.issuedQty || item.requestedQty })));
  const [storeRemarks, setStoreRemarks] = useState(doc.store?.remarks || "");
  const [managementRemarks, setManagementRemarks] = useState(doc.management?.remarks || "");
  const canPrint = Boolean(doc.survey);
  const surveyResultPrintId = `survey-result-print-${doc.id}`;
  const stockPrintId = `survey-stock-print-${doc.id}`;
  const workOrderPrintId = `survey-work-order-print-${doc.id}`;
  const paymentConfirmationPrintId = `survey-payment-confirmation-print-${doc.id}`;
  const surveyDocumentPrintIds = doc.paymentConfirmation?.dataUrl ? [surveyResultPrintId, stockPrintId, workOrderPrintId, paymentConfirmationPrintId] : [surveyResultPrintId, stockPrintId, workOrderPrintId];
  const completedSurvey = doc.status === "Completed";
  const showDocumentPack = doc.status === "Pending Management" || completedSurvey;
  const postStoreReview = ["Pending Management", "Completed"].includes(doc.status);
  const managementViewer = ["Management", "System Admin"].includes(user.role);
  const engineerUser = user.role === "Engineer" || user.department === "Engineer";
  const speedTestOpen = engineerUser && doc.status === "Pending Management";
  const [speedTest, setSpeedTest] = useState(doc.engineer?.speedTest || "");
  return <>
    {speedTestOpen && <ActionPanel title="Work Order Speed Test" enabled initiallyEditing actionLabel="Save Speed Test" onAction={() => run(() => api.surveySpeedTest(user, doc.id, { speedTest }), "Speed test recorded on the work order.")}><label>Speed Test Obtained<input required value={speedTest} onChange={(event) => setSpeedTest(event.target.value)} /></label></ActionPanel>}
    {canPrint && <section className="panel"><div className="section-title"><h2>Survey Documents</h2><span>{showDocumentPack ? "Ready for Management review" : "Available before Management approval"}</span></div><div className="button-row">{(canAct(user, "Engineer") || canAct(user, "HOC")) && <button className="btn" type="button" onClick={() => printElementById(surveyResultPrintId)}>Print Survey Result</button>}<button className="btn secondary" type="button" onClick={() => printElementById(stockPrintId)}>Print Stock Requisition</button><button className="btn secondary" type="button" onClick={() => printElementById(workOrderPrintId)}>Print Work Order</button><button className="btn" type="button" onClick={() => printElementsByIds(surveyDocumentPrintIds)}>Print All</button></div><div className={showDocumentPack ? "document-preview-grid" : ""}><SurveyResultPreview doc={doc} printId={surveyResultPrintId} extraClass={showDocumentPack ? "" : "print-only-document"} /><StockRequisitionPreview doc={doc} printId={stockPrintId} extraClass={showDocumentPack ? "" : "print-only-document"} /><WorkOrderPreview doc={doc} printId={workOrderPrintId} extraClass={showDocumentPack ? "" : "print-only-document"} />{doc.paymentConfirmation?.dataUrl && <PaymentConfirmationPreview doc={doc} printId={paymentConfirmationPrintId} extraClass={showDocumentPack ? "" : "print-only-document"} />}</div></section>}
    {!completedSurvey && canAct(user, "Engineer") && (!postStoreReview || managementViewer) && <ActionPanel title="Engineer Site Survey" enabled={engineerOpen} initiallyEditing={engineerOpen} actionLabel="Submit Survey Result" onAction={() => run(() => api.surveyEngineer(user, doc.id, engineer), engineer.proceed === "no" ? "Survey placed on hold and returned to Sales." : "Survey result submitted to HOC.")}>
      <div className="form-grid"><label>Connection Type<select value={engineer.connectionType} onChange={(event) => setEngineer({ ...engineer, connectionType: event.target.value })}><option value="fibre">Fibre</option><option value="wireless">Radiowaves (Wireless)</option></select></label>{engineer.connectionType === "fibre" && <label>Distance<input required value={engineer.distance} onChange={(event) => setEngineer({ ...engineer, distance: event.target.value })} /></label>}{engineer.connectionType === "fibre" ? <label>Node<input required value={engineer.node} onChange={(event) => setEngineer({ ...engineer, node: event.target.value })} /></label> : <label>Tower<input required value={engineer.tower} onChange={(event) => setEngineer({ ...engineer, tower: event.target.value })} /></label>}<label>Currency<select value={engineer.currency} onChange={(event) => setEngineer({ ...engineer, currency: event.target.value })}><option>TZS</option><option>USD</option></select></label><label>Proceed?<select value={engineer.proceed} onChange={(event) => setEngineer({ ...engineer, proceed: event.target.value })}><option value="yes">Yes</option><option value="no">No</option></select></label><label className="wide">Comments<textarea required value={engineer.comments} onChange={(event) => setEngineer({ ...engineer, comments: event.target.value })} /></label><label>Client Feedback<input required value={engineer.clientFeedback} onChange={(event) => setEngineer({ ...engineer, clientFeedback: event.target.value })} /></label></div>
      <ItemEditor items={engineer.items} setItems={(items) => setEngineer({ ...engineer, items })} engineerRequest currency={engineer.currency} />
    </ActionPanel>}
    {!completedSurvey && canAct(user, "Sales") && <ActionPanel title="Sales On-Hold Review" enabled={salesReviewOpen} initiallyEditing={salesReviewOpen} actionLabel="Return to Engineer" onAction={() => run(() => api.surveySalesReview(user, doc.id, { remarks: salesReviewRemarks }), "Survey returned to Engineer.")}>
      <div className="form-grid">
        <p><strong>Engineer Decision</strong><br />{doc.engineer?.proceed === false ? "No" : "-"}</p>
        <p><strong>Engineer Comments</strong><br />{doc.engineer?.comments || "-"}</p>
        <p><strong>Client Feedback</strong><br />{doc.engineer?.clientFeedback || "-"}</p>
      </div>
      <label>Sales Remarks<textarea required value={salesReviewRemarks} onChange={(event) => setSalesReviewRemarks(event.target.value)} /></label>
    </ActionPanel>}
    {!completedSurvey && canAct(user, "HOC") && (!postStoreReview || managementViewer) && <ActionPanel title="HOC Survey Review & Payment Confirmation" enabled={hocOpen} initiallyEditing={hocOpen} actionLabel="Confirm Payment to Accounts" onAction={() => run(() => api.surveyHoc(user, doc.id, { paid: true, paymentConfirmation, remarks: hocRemarks }), "Payment confirmed and sent to Accounts.")}>
      <div className="form-grid">
        <p><strong>Client Name</strong><br />{doc.clientName}</p><p><strong>Location</strong><br />{doc.location}</p>
        <p><strong>Mobile Number</strong><br />{doc.contact}</p><p><strong>Package Needed</strong><br />{doc.service}</p>
        <p><strong>Connection Type</strong><br />{doc.engineer?.connectionType === "wireless" ? "Radiowaves (Wireless)" : doc.engineer?.connectionType || "-"}</p><p><strong>{doc.engineer?.connectionType === "wireless" ? "Tower" : "Node"}</strong><br />{doc.engineer?.connectionType === "wireless" ? doc.engineer?.tower || "-" : doc.engineer?.node || "-"}</p>
        {doc.engineer?.connectionType === "fibre" && <p><strong>Distance</strong><br />{doc.engineer?.distance || "-"}</p>}
        <p><strong>Engineer Comments</strong><br />{doc.engineer?.comments || "-"}</p><p><strong>Client Feedback</strong><br />{doc.engineer?.clientFeedback || "-"}</p>
      </div>
      <EquipmentCostEditor items={doc.engineer?.items || []} locked currency={doc.engineer?.currency || "TZS"} />
      <div className="equipment-total-bar sales-total-bar"><strong>Total Equipment Cost</strong><span>{money((doc.engineer?.items || []).reduce((total, item) => total + Number(item.requestedQty || 0) * Number(item.unitCost || 0), 0), doc.engineer?.currency || "TZS")}</span></div>
      <p><strong>Confirm that the client has paid.</strong></p><ConfirmationUpload value={paymentConfirmation} onChange={setPaymentConfirmation} owner="HOC" />
      <label>HOC Comments<textarea required value={hocRemarks} onChange={(event) => setHocRemarks(event.target.value)} /></label>
    </ActionPanel>}
    {!completedSurvey && canAct(user, "Accounts") && (!postStoreReview || managementViewer) && <ActionPanel title="Accounts Section" enabled={accountsOpen} initiallyEditing={accountsOpen} actionLabel="Submit to Store" onAction={() => run(() => api.accounts(user, doc.id, accounts), "Submitted to Store.")}><div className="form-grid"><label>Client Name<input readOnly value={doc.clientName} /></label><label>Location<input readOnly value={doc.location} /></label><label>Equipment Cost<input readOnly value={money(surveyEquipmentTotal, doc.engineer?.currency || "TZS")} /></label><label>Total Cost Required<input readOnly value={money(surveyEquipmentTotal, doc.engineer?.currency || "TZS")} /></label></div><EquipmentCostEditor items={surveyEquipment} locked currency={doc.engineer?.currency || "TZS"} /><div className="equipment-total-bar sales-total-bar"><strong>Total Cost Required</strong><span>{money(surveyEquipmentTotal, doc.engineer?.currency || "TZS")}</span></div><div className="form-grid">{numberInput("Billing Amount", "billingAmount", accounts, setAccounts, !accountsOpen)}{textInput("Invoice Number", "invoiceNumber", accounts, setAccounts, !accountsOpen, false)}<label className="wide">Remarks<textarea required value={accounts.remarks} onChange={(event) => setAccounts({ ...accounts, remarks: event.target.value })} /></label></div></ActionPanel>}
    {!completedSurvey && canAct(user, "Store") && (!postStoreReview || managementViewer) && <ActionPanel title="Store Section" enabled={storeOpen} initiallyEditing={storeOpen} actionLabel="Confirm Stock and Validate" onAction={() => run(() => api.store(user, doc.id, { remarks: storeRemarks, items }), "Store validation complete.")}><div className="form-grid"><p><strong>Total Equipment Cost</strong><br />{money(surveyEquipmentTotal, doc.engineer?.currency || "TZS")}</p><p><strong>Accounts Billing</strong><br />{money(doc.accounts?.billingAmount, doc.accounts?.currency || doc.engineer?.currency || "TZS")}</p></div><ItemEditor items={items} setItems={setItems} locked={!storeOpen} storeMode /><label>Store Remarks<textarea value={storeRemarks} onChange={(event) => setStoreRemarks(event.target.value)} /></label></ActionPanel>}
    {!completedSurvey && canAct(user, "Management") && <ActionPanel title="Management Approval" enabled={managementOpen} initiallyEditing={managementOpen} actionLabel="Approve and Complete" onAction={() => run(() => api.management(user, doc.id, { remarks: managementRemarks }), "Survey workflow completed.")}><label>Approval Notes<textarea value={managementRemarks} onChange={(event) => setManagementRemarks(event.target.value)} /></label></ActionPanel>}
  </>;
}

function SurveyResultPreview({ doc, printId, extraClass = "" }) {
  const survey = doc.survey || {};
  const engineer = doc.engineer || {};
  return <article id={printId} className={`paper-form ${extraClass}`}>
    <header className="paper-head"><span className="paper-logo">zanlink</span><div><h2>Site Survey Result</h2><p>Survey Result No. {survey.resultNumber || doc.number}</p></div></header>
    <div className="paper-fields two">
      <Field label="Survey Request No." value={doc.number} /><Field label="Client Name" value={doc.clientName} />
      <Field label="Location" value={doc.location} /><Field label="Mobile Number" value={doc.contact} />
      <Field label="Package Needed" value={doc.service} /><Field label="Connection Type" value={engineer.connectionType === "wireless" ? "Radiowaves (Wireless)" : engineer.connectionType} />
      <Field label="Distance" value={engineer.connectionType === "fibre" ? engineer.distance : "N/A"} /><Field label={engineer.connectionType === "wireless" ? "Tower" : "Node"} value={engineer.connectionType === "wireless" ? engineer.tower : engineer.node} />
      <Field label="Proceed with Installation" value={engineer.proceed ? "Yes" : "No"} /><Field label="Surveyed By" value={engineer.submittedByName} />
      <Field label="Comments" value={engineer.comments} />
    </div>
  </article>;
}

function WorkOrderPreview({ doc, printId, extraClass = "" }) {
  const survey = doc.survey || {};
  const engineer = doc.engineer || {};
  return <article id={printId} className={`paper-form ${extraClass}`}>
    <header className="paper-head"><span className="paper-logo">zanlink</span><div><h2>Work Order Form</h2><p>Survey Request No. {doc.number}</p></div></header>
    <div className="paper-fields two">
      <Field label="Survey Request No." value={doc.number} /><Field label="Survey Result Form No." value={survey.resultNumber} />
      <Field label="Client Name" value={doc.clientName} /><Field label="Location" value={doc.location} />
      <Field label="Mobile Number" value={doc.contact} /><Field label="Package Needed" value={doc.service} />
      <Field label="Client Feedback" value={engineer.clientFeedback} /><Field label="Speed Test Obtained" value={engineer.speedTest || "Not recorded"} />
      <Field label="Client Confirmation" value={doc.paymentConfirmation ? "Uploaded" : "Not uploaded"} /><Field label="Connection Type" value={engineer.connectionType === "wireless" ? "Radiowaves (Wireless)" : engineer.connectionType} />
    </div>
    <h3>Payment Summary</h3>
    <div className="paper-fields two">
      <Field label="Invoice Number" value={doc.accounts?.invoiceNumber || "-"} /><Field label="Payment Confirmed" value={doc.hoc?.paid ? "Yes" : "No"} />
      <Field label="Billing Amount" value={money(doc.accounts?.billingAmount, doc.accounts?.currency || engineer.currency || "TZS")} /><Field label="Confirmed By" value={doc.hoc?.reviewedByName || "-"} />
    </div>
  </article>;
}

function PaymentConfirmationPreview({ doc, printId, extraClass = "" }) {
  const confirmation = doc.paymentConfirmation;
  if (!confirmation?.dataUrl) return null;
  return <article id={printId} className={`paper-form printed-confirmation ${extraClass}`}>
    <header className="paper-head"><span className="paper-logo">zanlink</span><div><h2>Client Payment Confirmation</h2><p>Survey Request No. {doc.number}</p></div></header>
    <div className="paper-fields two"><Field label="Client Name" value={doc.clientName} /><Field label="Confirmed By" value={confirmation.uploadedByName || doc.hoc?.reviewedByName} /><Field label="File" value={confirmation.name} /><Field label="Confirmed At" value={confirmation.uploadedAt ? formatDate(confirmation.uploadedAt) : "-"} /></div>
    <img src={confirmation.dataUrl} alt="Client payment confirmation" />
  </article>;
}

function Doc1Actions({ user, doc, run }) {
  const storeManager = user.department === "Store" || ["Store", "Store Manager"].includes(user.role);
  const requiresHocApproval = doc.serviceType === "new_installation";
  const salesOpen = canAct(user, "Sales") && (requiresHocApproval ? ["Pending Sales", "Returned to Sales"] : ["Pending Sales", "Returned to Sales", "Pending Accounts"]).includes(doc.status);
  const hocOpen = canAct(user, "HOC") && doc.status === "Pending HOC";
  const accountsOpen = canAct(user, "Accounts") && doc.status === "Pending Accounts";
  const storeOpen = canAct(user, "Store") && doc.status === "Pending Store";
  const managementOpen = canAct(user, "Management") && doc.status === "Pending Management";
  const salesOnly = user.role === "Sales";
  const accountsOnly = user.role === "Accounts";
  const [sales, setSales] = useState({
    clientName: doc.sales?.clientName || doc.clientName || "",
    location: doc.sales?.location || doc.location || "",
    surveyFormNo: doc.sales?.surveyFormNo || doc.number || "",
    amount: doc.sales?.laborCharge ?? doc.sales?.amount ?? "",
    packageCost: doc.sales?.packageCost || "",
    additionalNrr: doc.sales?.additionalNrr ?? doc.sales?.additionalNpr ?? "",
    subscription: doc.sales?.subscription || doc.sales?.remarks || doc.service || "",
    mrr: doc.sales?.mrr ?? doc.sales?.mbr ?? "",
    requestedBy: doc.sales?.requestedBy || user.name || "",
    requestedDate: doc.sales?.requestedDate || new Date().toISOString().slice(0, 10),
    requestedTime: doc.sales?.requestedTime || new Date().toTimeString().slice(0, 5),
    currency: doc.sales?.currency || doc.engineer?.currency || "TZS",
  });
  const [accounts, setAccounts] = useState({ billingAmount: doc.accounts?.billingAmount || "", invoiceNumber: doc.accounts?.invoiceNumber || "", remarks: doc.accounts?.remarks || "" });
  const engineerEquipment = doc.store?.items || [];
  const [salesEquipment, setSalesEquipment] = useState(doc.sales?.equipment?.length ? doc.sales.equipment : (doc.store?.items || []));
  const equipmentTotal = salesEquipment.reduce((total, item) => total + (Number(item.requestedQty || 0) * Number(item.unitCost || 0)), 0);
  const accountsEquipment = doc.sales?.equipment?.length ? doc.sales.equipment : engineerEquipment;
  const accountsEquipmentTotal = accountsEquipment.reduce((total, item) => total + (Number(item.requestedQty || 0) * Number(item.unitCost || 0)), 0);
  const accountsLaborCharge = Number(doc.sales?.laborCharge || 0);
  const accountsRequiredTotal = Number(doc.sales?.amount ?? (accountsLaborCharge + accountsEquipmentTotal));
  const originalEngineerTotal = (doc.store?.items || []).reduce((total, item) => total + Number(item.requestedQty || 0) * Number(item.unitCost || 0), 0);
  const salesMustConfirm = doc.confirmationRequiredFrom === "Sales" || (!doc.confirmationRequiredFrom && originalEngineerTotal >= 1000000);
  const laborCharge = Number(sales.amount || 0);
  const salesTotal = laborCharge + equipmentTotal;
  const oneTimeTotal = salesTotal;
  const grandTotal = salesTotal;
  const [items, setItems] = useState(() => (doc.store?.items || []).map((item) => ({
    ...item,
    issuedQty: storeOpen && Number(item.issuedQty || 0) === 0 ? Number(item.requestedQty || 0) : Number(item.issuedQty || 0),
  })));
  const [storeRemarks, setStoreRemarks] = useState(doc.store?.remarks || "");
  const [managementRemarks, setManagementRemarks] = useState(doc.management?.remarks || "");
  const [clientConfirmation, setClientConfirmation] = useState(null);
  const storeOnboardingPrintId = `store-onboarding-print-${doc.id}`;
  const storeStockPrintId = `store-stock-print-${doc.id}`;
  const storeVerificationPrintId = `store-verification-print-${doc.id}`;
  const storePrintIds = doc.clientConfirmation?.dataUrl ? [storeOnboardingPrintId, storeStockPrintId, storeVerificationPrintId] : [storeOnboardingPrintId, storeStockPrintId];

  return (
    <>
      {canAct(user, "Sales") && <ActionPanel enabled={salesOpen} initiallyEditing={["Pending Sales", "Returned to Sales"].includes(doc.status)} actionLabel={requiresHocApproval ? "Submit to HOC" : doc.status === "Pending Accounts" ? "Update Sales Cost" : "Submit to Accounts"} onAction={() => run(() => api.sales(user, doc.id, { ...sales, clientConfirmation, packageCost: equipmentTotal, oneTimeTotal, grandTotal, equipment: salesEquipment }), requiresHocApproval ? "Submitted to Head of Commercial." : doc.status === "Pending Accounts" ? "Sales cost updated." : "Moved to Accounts.")}>
        <div className="form-grid">
          {textInput("Client Name", "clientName", sales, setSales, true)}
          <label>Location<input readOnly value={doc.location || sales.location || "-"} /></label>
          {textInput("Survey Form No.", "surveyFormNo", sales, setSales, !salesOpen)}
          {numberInput("Installation Cost/Labor Charge", "amount", sales, setSales, !salesOpen)}
          {numberInput("Additional NRR", "additionalNrr", sales, setSales, !salesOpen)}
          {subscriptionInput(sales, setSales, !salesOpen)}
          {numberInput("MRR", "mrr", sales, setSales, !salesOpen)}
          {textInput("Requested By", "requestedBy", sales, setSales, !salesOpen)}
          <label>Date<input type="date" readOnly value={sales.requestedDate} /></label>
          <label>Time<input readOnly value={formatTime(sales.requestedTime)} /></label>
        </div>
        <EquipmentCostEditor items={salesEquipment} setItems={setSalesEquipment} locked={!salesOpen} currency={sales.currency || "TZS"} />
        <div className="equipment-total-bar sales-total-bar">
          <strong>Total Cost</strong>
          <span>{money(salesTotal, sales.currency)}</span>
        </div>
        {salesOpen && salesMustConfirm && (
          <ConfirmationUpload
            value={clientConfirmation}
            onChange={setClientConfirmation}
            owner="Sales"
          />
        )}
      </ActionPanel>}
      {requiresHocApproval && canAct(user, "HOC") && <HocApproval user={user} doc={doc} enabled={hocOpen} run={run} />}
      {!salesOnly && (
        <>
          <ActionPanel title="Accounts Section" enabled={accountsOpen} initiallyEditing={doc.status === "Pending Accounts"} actionLabel="Submit to Store" onAction={() => run(() => api.accounts(user, doc.id, accounts), "Moved to Store.")}>
            <div className="form-grid">
              <label>Client Name<input readOnly value={doc.clientName || doc.sales?.clientName || "-"} /></label>
              <label>Location<input readOnly value={doc.location || doc.sales?.location || "-"} /></label>
              <label>Installation Cost / Labour Charge<input readOnly value={money(accountsLaborCharge, sales.currency)} /></label>
              <label>Equipment Cost<input readOnly value={money(accountsEquipmentTotal, sales.currency)} /></label>
            </div>
            <EquipmentCostEditor items={accountsEquipment} locked currency={sales.currency || "TZS"} />
            <div className="equipment-total-bar sales-total-bar"><strong>Total Cost Required</strong><span>{money(accountsRequiredTotal, sales.currency)}</span></div>
            <div className="form-grid">{numberInput("Billing Amount", "billingAmount", accounts, setAccounts, !accountsOpen)}{textInput("Invoice Number", "invoiceNumber", accounts, setAccounts, !accountsOpen, false)}<label className="wide">Remarks<textarea required disabled={!accountsOpen} value={accounts.remarks} onChange={(e) => setAccounts({ ...accounts, remarks: e.target.value })} /></label></div>
          </ActionPanel>
          {!accountsOnly && (
            <>
              <ActionPanel title="Store Section" enabled={storeOpen} initiallyEditing={doc.status === "Pending Store"} actionLabel={storeManager ? "Approve Requested Equipment" : "Confirm Stock and Validate"} onAction={() => run(() => api.store(user, doc.id, { remarks: storeRemarks, items }), "Store validation complete.")}>
                <OnboardingPreview doc={doc} printId={storeOnboardingPrintId} extraClass="print-only-document" />
                <StockRequisitionPreview doc={{ ...doc, store: { ...doc.store, items } }} printId={storeStockPrintId} extraClass="print-only-document" />
                {doc.clientConfirmation?.dataUrl && <ClientVerificationPreview doc={doc} printId={storeVerificationPrintId} extraClass="print-only-document" />}
                <div className="form-grid"><p><strong>Location</strong><br />{doc.location || "-"}</p></div>
                <ItemEditor items={items} setItems={setItems} locked={!storeOpen} storeMode={storeManager} />
                {!storeManager && <div className="form-grid store-remarks-grid"><p><strong>Total Sales Cost</strong><br />{money(doc.sales?.amount, doc.sales?.currency)}</p><p><strong>Accounts Billing</strong><br />{money(doc.accounts?.billingAmount, doc.accounts?.currency)}</p><label className="wide">Store Remarks<textarea disabled={!storeOpen} value={storeRemarks} onChange={(e) => setStoreRemarks(e.target.value)} /></label><div className="store-print-actions no-print">
                  <button className="btn secondary" type="button" onClick={() => printElementById(storeOnboardingPrintId)}>Print Onboarding Doc</button>
                  <button className="btn secondary" type="button" onClick={() => printElementById(storeStockPrintId)}>Print Stock Doc</button>
                  <button className="btn" type="button" onClick={() => printElementsByIds(storePrintIds)}>Print All</button>
                </div></div>}
              </ActionPanel>
              {!storeManager && (
                <ActionPanel title="Management Approval" enabled={managementOpen} initiallyEditing={doc.status === "Pending Management"} actionLabel="Approve and Complete" onAction={() => run(() => api.management(user, doc.id, { remarks: managementRemarks }), "Document completed.")}>
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

function HocApproval({ user, doc, enabled, run }) {
  const [remarks, setRemarks] = useState(doc.hoc?.remarks || "");
  const salesEquipment = doc.sales?.equipment || [];
  return (
    <form className="panel" onSubmit={(event) => event.preventDefault()}>
      <div className="section-title"><h2>Head of Commercial Approval</h2><span className={`status ${statusClass(doc.status)}`}>{doc.status}</span></div>
      <div className="form-grid">
        <p><strong>Engineer</strong><br />{actorName(doc.engineer?.submittedByName || doc.createdByName, doc.engineer?.submittedBy || doc.createdBy, "Not recorded")}</p>
        <p><strong>Engineer Notes</strong><br />{doc.engineer?.notes || "-"}</p>
        <p><strong>Sales Submitted By</strong><br />{actorName(doc.sales?.submittedByName || doc.sales?.requestedBy, doc.sales?.submittedBy, "Not recorded")}</p>
        <p><strong>Subscription</strong><br />{doc.sales?.subscription || doc.service || "-"}</p>
        <p><strong>Installation Cost</strong><br />{money(doc.sales?.laborCharge, doc.sales?.currency)}</p>
        <p><strong>Equipment Cost</strong><br />{money(doc.sales?.packageCost, doc.sales?.currency)}</p>
        <p><strong>Total Sales Cost</strong><br />{money(doc.sales?.amount, doc.sales?.currency)}</p>
        <p><strong>MRR</strong><br />{money(doc.sales?.mrr, doc.sales?.currency)}</p>
      </div>
      <EquipmentCostEditor items={salesEquipment} locked currency={doc.sales?.currency || "TZS"} />
      <label>Approval Comments <small>(required when declining)</small><textarea required={enabled} disabled={!enabled} value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
      {enabled && <div className="button-row">
        <button className="btn" type="button" onClick={() => run(() => api.hoc(user, doc.id, { decision: "approve", remarks }), "Approved and submitted to Accounts.")}>Approve to Accounts</button>
        <button className="btn danger" type="button" disabled={!remarks.trim()} onClick={() => run(() => api.hoc(user, doc.id, { decision: "decline", remarks }), "Declined and returned to Sales.")}>Decline to Sales</button>
      </div>}
    </form>
  );
}

function MaintenanceActions({ user, doc, run }) {
  const hodOpen = canAct(user, "HOD") && doc.status === "Pending HOD";
  const accountsOpen = canAct(user, "Accounts") && doc.status === "Pending Accounts";
  const accountsOnly = user.role === "Accounts";
  const [hodRemarks, setHodRemarks] = useState(doc.hod?.remarks || "");
  const hodPrintId = `hod-maintenance-print-${doc.id}`;
  return (
    <>
      <section className="panel"><h2>General Maintenance Details</h2><p><strong>Fault</strong><br />{doc.maintenance?.fault}</p><p><strong>Recommended Action</strong><br />{doc.maintenance?.action}</p></section>
      {!accountsOnly && (
        <ActionPanel title="HOD Approval" enabled={hodOpen} initiallyEditing={doc.status === "Pending HOD"} actionLabel="Approve to Accounts" onAction={() => run(() => api.hod(user, doc.id, { remarks: hodRemarks }), "Moved to Accounts.")}>
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
      <ActionPanel title="Accounts Equipment Review" enabled={accountsOpen} initiallyEditing={doc.status === "Pending Accounts"} actionLabel="Submit to Engineer" onAction={() => run(() => api.accounts(user, doc.id, {}), "General Maintenance equipment submitted to Engineer.")}>
        <ReadOnlyEquipment title="Equipment Used" items={doc.maintenance?.items || []} />
      </ActionPanel>
    </>
  );
}

function ActionPanel({ title, enabled, initiallyEditing = false, actionLabel, onAction, children }) {
  const [editing, setEditing] = useState(enabled && initiallyEditing);
  return (
    <form className="panel" onSubmit={(event) => { event.preventDefault(); if (enabled && editing) onAction(); }}>
      {title && <div className="section-title"><h2>{title}</h2></div>}
      <fieldset disabled={!enabled || !editing}>
        {children}
      </fieldset>
      {enabled && <div className="button-row">
        {editing ? <button className="btn">{actionLabel}</button> : <button className="btn secondary" type="button" onClick={() => setEditing(true)}>Edit</button>}
      </div>}
    </form>
  );
}

function ConfirmationUpload({ value, onChange, owner }) {
  function useImage(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ name: file.name || 'email-confirmation.png', dataUrl: reader.result });
    reader.readAsDataURL(file);
  }
  function selectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return onChange(null);
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      event.target.setCustomValidity("Select a PNG or JPEG screenshot no larger than 5 MB.");
      event.target.reportValidity();
      return onChange(null);
    }
    event.target.setCustomValidity("");
    useImage(file);
  }
  async function pasteImage() {
    try {
      const clipboard = await navigator.clipboard.read();
      for (const item of clipboard) {
        const type = item.types.find((entry) => ['image/png', 'image/jpeg'].includes(entry));
        if (type) return useImage(await item.getType(type));
      }
    } catch (_) { /* The normal paste handler remains available where clipboard permission is denied. */ }
  }
  return <div className="confirmation-upload" tabIndex="0" onPaste={(event) => { const file = [...(event.clipboardData?.files || [])].find((entry) => entry.type.startsWith('image/')); if (file) { event.preventDefault(); useImage(file); } }}><label>Client email confirmation screenshot ({owner})<input required={!value?.dataUrl} accept="image/png,image/jpeg" capture="environment" type="file" onChange={selectFile} /></label><div className="button-row"><button className="btn secondary" type="button" onClick={pasteImage}>Paste Screenshot</button></div>{value?.dataUrl && <img src={value.dataUrl} alt="Client email confirmation preview" />}<small>Upload, snap with the camera, or paste a screenshot. PNG or JPEG, maximum 5 MB.</small></div>;
}

function EquipmentCostEditor({ items, setItems, locked = false, currency = "TZS" }) {
  const total = items.reduce((sum, item) => sum + Number(item.requestedQty || 0) * Number(item.unitCost || 0), 0);
  if (!items.length) return <div className="empty">No sales equipment added.</div>;
  return (
    <div className="items-list">
      <div className="section-title"><h2>Equipment Costs</h2></div>
      {items.map((item, index) => (
        <div className="item-row" key={index}>
          <label>Item<input disabled value={item.name || ""} readOnly /></label>
          <label>Item ID<span className="readonly-value">{item.itemId || item.serialNumber || "-"}</span></label>
          <label>Req. Qty<span className="readonly-value">{item.requestedQty || 1}</span></label>
          <label>Unit Cost ({currency})<input required min="0" readOnly type="number" value={item.unitCost || ""} /></label>
          <AutoTotal label="Line Total" value={Number(item.requestedQty || 0) * Number(item.unitCost || 0)} currency={currency} compact />
        </div>
      ))}
      <div className="equipment-total-bar"><strong>Equipment Total</strong><span>{money(total, currency)}</span></div>
    </div>
  );
}

function ReadOnlyEquipment({ title, items, simple = false }) {
  if (!items.length) return <div className="empty">No equipment added by Engineer.</div>;
  return (
    <div className="readonly-equipment">
      <div className="section-title"><h2>{title}</h2></div>
      <div className="readonly-equipment-list">
        {items.map((item, index) => (
          <div className="readonly-equipment-row" key={index}>
            <div className="readonly-equipment-main">
              <strong>{item.name || "-"}</strong>
            </div>
            {!simple && (
              <div className="readonly-equipment-meta">
                <span><b>Req. Qty</b>{item.requestedQty || 1}</span>
                <span><b>Purpose</b>{item.purpose || "-"}</span>
                <span><b>Item ID</b>{item.itemId || item.serialNumber || "-"}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemEditor({ items, setItems, locked = false, requestMode = false, engineerRequest = false, title = "Stock Items", addLabel = "Add Item", costLocked = false, storeMode = false, pricing = null, currency = "TZS" }) {
  if (engineerRequest) return <EngineerItemEditor items={items} setItems={setItems} currency={currency} pricing={pricing || { usdToTzsRate: 2500, items: engineerStockItems.map((item) => ({ ...item, unitCostUsd: item.unitCost })) }} />;
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

function EngineerItemEditor({ items, setItems, pricing, currency }) {
  const pageSize = 5;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const startIndex = page * pageSize;
  const visibleItems = items.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  function updateDescription(index, description) {
    const selected = pricing.items.find((item) => item.description === description);
    setItems(items.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      itemId: selected?.id || "",
      name: description,
      serialNumber: "",
      unitCost: selected ? (currency === "USD" ? selected.unitCostUsd : selected.unitCostUsd * Number(pricing.usdToTzsRate)) : 0,
      unitCostUsd: selected?.unitCostUsd ?? 0,
      costCurrency: currency,
      purpose: item.purpose || "Sold to Client",
    } : item));
  }

  function updateQuantity(index, value) {
    setItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, requestedQty: Number(value) } : item));
  }

  return (
    <div className="items-list">
      <div className="section-title"><h2>Stock Items</h2></div>
      <div className="table-wrap engineer-items-table">
        <table>
          <thead><tr><th>S/N</th><th>Item ID</th><th>Description</th><th>Quantity Requested</th><th>Unit Cost ({currency})</th><th>Purpose</th><th>Total</th><th>Action</th></tr></thead>
          <tbody>
            {visibleItems.map((item, visibleIndex) => {
              const itemIndex = startIndex + visibleIndex;
              return (
                <tr key={itemIndex}>
                  <td>{itemIndex + 1}</td>
                  <td><span className="readonly-value">{item.itemId || item.serialNumber || "-"}</span></td>
                  <td>
                    <select
                      aria-label={`Search equipment for item ${itemIndex + 1}`}
                      required
                      value={item.name}
                      onChange={(event) => updateDescription(itemIndex, event.target.value)}
                    >
                      <option value="">Select an item</option>
                      {pricing.items.map((stockItem) => (
                        <option key={stockItem.id} value={stockItem.description}>
                          {stockItem.description}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td><input required min="1" type="number" value={item.requestedQty} onChange={(event) => updateQuantity(itemIndex, event.target.value)} /></td>
                  <td><input aria-label={`Unit cost for ${item.name || `item ${itemIndex + 1}`}`} required min="0" readOnly type="number" value={item.unitCost || ""} /></td>
                  <td><select aria-label={`Purpose for item ${itemIndex + 1}`} required value={item.purpose || "Sold to Client"} onChange={(event) => setItems(items.map((entry, index) => index === itemIndex ? { ...entry, purpose: event.target.value } : entry))}><option value="Sold to Client">Sold to Client</option><option value="Lease">Lease</option></select></td>
                  <td className="money-cell">{money(Number(item.requestedQty || 0) * Number(item.unitCost || 0), currency)}</td>
                  <td><button type="button" className="btn danger" onClick={() => setItems(items.filter((_, index) => index !== itemIndex))}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><td colSpan="6"><strong>Equipment Total</strong></td><td className="money-cell"><strong>{money(items.reduce((sum, item) => sum + Number(item.requestedQty || 0) * Number(item.unitCost || 0), 0), currency)}</strong></td><td /></tr></tfoot>
        </table>
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

function MaintenanceItemEditor({ items, setItems, pricing }) {
  const pageSize = 5;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const startIndex = page * pageSize;
  const visibleItems = items.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  function updateDescription(index, description) {
    const selected = (pricing?.items || []).find((item) => item.description === description);
    setItems(items.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      itemId: selected?.id || "",
      name: description,
      serialNumber: "",
      requestedQty: Number(item.requestedQty || 1),
      issuedQty: Number(item.requestedQty || 1),
      unitCost: 0,
      costCurrency: "TZS",
      purpose: "General Maintenance",
    } : item));
  }

  function updateQuantity(index, value) {
    const quantity = Number(value || 0);
    setItems(items.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      requestedQty: quantity,
      issuedQty: quantity,
      unitCost: 0,
      costCurrency: "TZS",
      purpose: "General Maintenance",
    } : item));
  }

  return (
    <div className="items-list">
      <div className="section-title"><h2>Materials Used</h2></div>
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
                  <td>
                    <select
                      aria-label={`Search material for item ${itemIndex + 1}`}
                      required
                      value={item.name}
                      onChange={(event) => updateDescription(itemIndex, event.target.value)}
                    >
                      <option value="">Select an item</option>
                      {(pricing?.items || []).map((stockItem) => (
                        <option key={stockItem.id} value={stockItem.description}>
                          {stockItem.description} — {stockItem.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td><input required min="1" type="number" value={item.requestedQty} onChange={(event) => updateQuantity(itemIndex, event.target.value)} /></td>
                  <td><button type="button" className="btn danger" onClick={() => setItems(items.filter((_, index) => index !== itemIndex))}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="engineer-table-footer">
          <button type="button" className="btn secondary engineer-add-button" onClick={() => { setItems([...items, { ...emptyItem, unitCost: 0, purpose: "General Maintenance" }]); setPage(Math.floor(items.length / pageSize)); }}>+ Add Item</button>
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
  return <section className="panel"><h2>Audit Trail</h2><div className="timeline">{doc.history.map((item) => <div className="history-row" key={item.id}><time>{formatDate(item.at)}</time><div><strong>{item.action}</strong><br /><small>{actorName(item.userName, item.userId, "Unknown user")} - {item.note}</small></div></div>)}</div></section>;
}

function actorName(name, userId, fallback = "") {
  const cleanName = String(name || "").trim();
  if (cleanName) return cleanName;
  const legacyNames = {
    u1: "Engineer",
    u2: "Sales",
    u3: "Accounts Team",
    u4: "System Admin",
  };
  return legacyNames[String(userId || "")] || fallback;
}

const countryCodesByPrefix = [...countryCodes].sort((first, second) => second[2].length - first[2].length);

function splitContactNumber(contact, fallbackIso = "TZ") {
  const value = String(contact || "").trim();
  const compactValue = value.replace(/[\s-]/g, "");
  const digits = compactValue.replace(/\D/g, "");
  const fallbackCountry = countryCodeForIso(fallbackIso);
  const fallbackDialCode = fallbackCountry[2].replace(/[\s-]/g, "");
  const fallbackDialDigits = fallbackDialCode.replace(/\D/g, "");
  const preferredCountry = (
    compactValue === fallbackDialCode ||
    compactValue.startsWith(fallbackDialCode) ||
    digits.startsWith(fallbackDialDigits)
  ) ? fallbackCountry : null;
  const matchedCountry = countryCodesByPrefix.find(([, , dialCode]) => {
    const compactDialCode = dialCode.replace(/[\s-]/g, "");
    const dialDigits = compactDialCode.replace(/\D/g, "");
    if (compactValue === compactDialCode || compactValue.startsWith(compactDialCode)) return true;
    if (!digits.startsWith(dialDigits)) return false;
    if (dialCode === "+255") return true;
    return dialDigits.length > 1 && digits.length > dialDigits.length + 4;
  });
  const selectedCountry = preferredCountry || matchedCountry || fallbackCountry;
  const selectedDialDigits = selectedCountry[2].replace(/\D/g, "");
  const number = matchedCountry
    ? digits.slice(selectedDialDigits.length)
    : value;
  return {
    countryIso: selectedCountry[0],
    number,
  };
}

function formatContactNumber(countryIso, number) {
  const trimmedNumber = String(number || "").trim();
  if (!trimmedNumber) return "";
  const selectedCountry = countryCodeForIso(countryIso);
  return `${selectedCountry[2]} ${trimmedNumber}`;
}

function ClientPicker({ clients, value, onChange, allowNewClient }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = clients.find((client) => client.id === value);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = clients.filter((client) => !normalizedQuery || [client.name, client.contact, client.email, client.serviceArea, client.street, client.siteLocation, client.staticIp, ...(client.locations || [])]
    .join(" ").toLowerCase().includes(normalizedQuery));

  function choose(clientId) {
    onChange(clientId);
    setQuery("");
    setOpen(false);
  }

  return <label>Client
    <input
      aria-autocomplete="list"
      aria-expanded={open}
      autoComplete="off"
      onBlur={() => setTimeout(() => setOpen(false), 150)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)}
      placeholder={selected ? selected.name : "Search registered clients"}
      value={query}
    />
    {open && <div className="client-picker-options" role="listbox">
      {allowNewClient && <button type="button" className="client-picker-option" onMouseDown={(event) => event.preventDefault()} onClick={() => choose("new")}>Add New Client</button>}
      {matches.map((client) => <button type="button" className="client-picker-option" key={client.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(client.id)}>
        <strong>{client.name}</strong>
        <small>{[client.contact, client.email, client.street, client.siteLocation].filter(Boolean).join(" · ")}</small>
      </button>)}
      {!matches.length && <span className="client-picker-empty">No matching client.</span>}
    </div>}
    {!clients.length && <small className="field-help">Register a client from the Clients page first.</small>}
  </label>;
}

function ClientFields({ clients, form, setForm, allowNewClient = false }) {
  const selectedClient = clients.find((client) => client.id === form.clientId);
  const isNewClient = allowNewClient && form.clientId === "new";
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const contactParts = splitContactNumber(form.contact, form.countryIso);

  function selectClient(clientId) {
    if (allowNewClient && clientId === "new") {
      setForm({ ...form, clientId: "new", clientName: "", countryIso: "TZ", countryDialCode: "+255", contact: "", email: "", location: "" });
      return;
    }
    const client = clients.find((item) => item.id === clientId);
    const clientContact = splitContactNumber(client?.contact || "", client?.countryIso || "TZ");
    const location = client?.locations?.[0] || "";
    setForm({
      ...form,
      clientId,
      clientName: client?.name || "",
      countryIso: clientContact.countryIso,
      countryDialCode: countryCodeForIso(clientContact.countryIso)[2],
      contact: client?.contact || "",
      email: client?.email || "",
      location,
    });
  }

  function updateLocation(location) {
    setForm({
      ...form,
      location,
    });
  }

  return (
    <>
      <ClientPicker clients={clients} value={form.clientId} onChange={selectClient} allowNewClient={allowNewClient} />
      {isNewClient && <label>Client Name<input required value={form.clientName} onChange={(event) => setForm({ ...form, clientName: event.target.value })} /></label>}
      <label>Location
        {selectedClient?.locations?.length ? (
          <select required value={form.location} onChange={(event) => updateLocation(event.target.value)}>
            {selectedClient.locations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        ) : (
          <TanzaniaLocationField
            value={form.location}
            onChange={updateLocation}
          />
        )}
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
              countryDialCode: countryCodeForIso(countryIso)[2],
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
              countryDialCode: countryCodeForIso(contactParts.countryIso)[2],
              contact: formatContactNumber(contactParts.countryIso, event.target.value),
            })}
          />
        </div>
      </label>
      {isNewClient ? <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label> : <label>Email<input readOnly value={form.email} /></label>}
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
    if (disabled || !query) {
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
        aria-expanded={!disabled && isOpen && !!value.trim()}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        required
        role="combobox"
        placeholder="Search any address or place in Zanzibar"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => !disabled && value.trim() && setIsOpen(true)}
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
      {!disabled && isOpen && !!value.trim() && (
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
