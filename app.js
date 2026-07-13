const USERS = [
  { id: "u1", name: "Eng. Amina", username: "engineer", password: "demo123", role: "Engineer", department: "Engineer" },
  { id: "u2", name: "Sales Team", username: "sales", password: "demo123", role: "Sales", department: "Sales" },
  { id: "u3", name: "Accounts Team", username: "accounts", password: "demo123", role: "Accounts", department: "Accounts" },
  { id: "u4", name: "Store Team", username: "store", password: "demo123", role: "Store", department: "Store" },
  { id: "u5", name: "Managing Director", username: "management", password: "demo123", role: "Management", department: "Management" },
  { id: "u6", name: "Head of Department", username: "hod", password: "demo123", role: "Head of Department", department: "HOD" },
  { id: "u7", name: "System Admin", username: "admin", password: "demo123", role: "System Admin", department: "Admin" }
];

const STATUS_DEPT = {
  "Draft": "Engineer",
  "Pending Sales": "Sales",
  "Returned to Sales": "Sales",
  "Pending Accounts": "Accounts",
  "Pending Store": "Store",
  "Pending Management": "Management",
  "Pending HOD": "HOD",
  "Completed": "Engineer",
  "Cancelled": "Admin"
};

const STORE_KEY = "zanlink-flow-state-v1";

let state = loadState();
let currentUser = state.sessionUser ? USERS.find((user) => user.id === state.sessionUser) : null;
let view = "dashboard";
let editingId = null;
let toastTimer = null;

function loadState() {
  const existing = localStorage.getItem(STORE_KEY);
  if (existing) return JSON.parse(existing);

  const seed = {
    sessionUser: null,
    counters: { doc1: 2, maintenance: 2, summary: 2 },
    documents: [
      {
        id: "d1",
        type: "doc1",
        number: "REQ-000001",
        clientName: "Stone Town Hotel",
        contact: "+255 777 100 400",
        service: "Dedicated internet onboarding",
        location: "Zanzibar",
        status: "Pending Store",
        currentDepartment: "Store",
        createdBy: "u1",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        engineer: { notes: "Install router, outdoor radio and cabling for new client." },
        sales: { amount: 1250000, packageCost: 1150000, remarks: "Business 50 Mbps package." },
        accounts: { billingAmount: 1250000, invoiceNumber: "INV-2044", remarks: "Invoice prepared." },
        store: { confirmed: false, amountMatches: null, remarks: "", items: [
          { name: "Router", requestedQty: 1, issuedQty: 0, serialNumber: "", purpose: "CPE", unitCost: 180000 },
          { name: "Outdoor radio", requestedQty: 1, issuedQty: 0, serialNumber: "", purpose: "Connectivity", unitCost: 520000 }
        ] },
        management: {},
        history: [
          historyItem("u1", "Created Document 1", "Engineer submitted onboarding and requisition."),
          historyItem("u2", "Sales amount added", "Moved to Accounts."),
          historyItem("u3", "Billing added", "Moved to Store.")
        ]
      },
      {
        id: "m1",
        type: "maintenance",
        number: "MNT-000001",
        clientName: "Airport Office",
        contact: "+255 777 222 111",
        service: "Link maintenance",
        location: "Abeid Amani Karume Airport",
        status: "Pending HOD",
        currentDepartment: "HOD",
        createdBy: "u1",
        createdAt: new Date(Date.now() - 43200000).toISOString(),
        maintenance: { fault: "Intermittent signal during rain.", action: "Inspect mast alignment and replace weatherproofing." },
        hod: {},
        accounts: {},
        history: [historyItem("u1", "Created maintenance request", "Waiting for HOD approval.")]
      }
    ],
    summaries: [],
    notifications: [
      { id: "n1", department: "Store", message: "REQ-000001 is waiting for stock and amount validation.", read: false },
      { id: "n2", department: "HOD", message: "MNT-000001 is waiting for HOD approval.", read: false }
    ]
  };

  localStorage.setItem(STORE_KEY, JSON.stringify(seed));
  return seed;
}

function saveState() {
  state.sessionUser = currentUser ? currentUser.id : null;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function historyItem(userId, action, note = "") {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), userId, action, note };
}

function nextNumber(kind) {
  const value = state.counters[kind] || 1;
  state.counters[kind] = value + 1;
  if (kind === "summary") return `Zanlink/${String(value).padStart(6, "0")}`;
  if (kind === "maintenance") return `MNT-${String(value).padStart(6, "0")}`;
  return `REQ-${String(value).padStart(6, "0")}`;
}

function render() {
  const app = document.querySelector("#app");
  app.innerHTML = currentUser ? shell() : loginScreen();
  bindEvents();
}

function loginScreen() {
  return `
    <main class="login-shell">
      <section class="login-panel">
        <div class="brand-mark">Z</div>
        <h1>Zanlink Document Flow System</h1>
        <p>Controlled movement for onboarding, stock requisition, client summaries, and maintenance requests.</p>
        <form class="login-form" data-action="login">
          <label>Username
            <input name="username" autocomplete="username" value="engineer" required />
          </label>
          <label>Password
            <input name="password" type="password" autocomplete="current-password" value="demo123" required />
          </label>
          <button class="btn" type="submit">Sign in</button>
        </form>
        <div class="demo-grid">
          ${USERS.map((user) => `<button class="demo-pill" data-login="${user.username}">${user.role}: ${user.username}</button>`).join("")}
        </div>
      </section>
      <section class="hero-art">
        <div>
          <h2>Documents move to the right department, with every action recorded.</h2>
          <p>Engineer to Sales to Accounts to Store to Management, with corrections, summaries, and maintenance approvals routed automatically.</p>
        </div>
      </section>
    </main>
  `;
}

function shell() {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">Z</div><div>Zanlink Flow</div></div>
        <div class="user-box">
          <strong>${currentUser.name}</strong>
          <span>${currentUser.role} / ${currentUser.department}</span>
        </div>
        <nav class="nav">
          ${navButton("dashboard", "Dashboard")}
          ${canCreateDoc1() ? navButton("new-doc1", "New Onboarding") : ""}
          ${canCreateMaintenance() ? navButton("new-maintenance", "New Maintenance") : ""}
          ${navButton("summaries", "Client Summaries")}
          ${navButton("reports", "Reports")}
          ${currentUser.role === "System Admin" ? navButton("admin", "Users & Roles") : ""}
        </nav>
        <button class="logout" data-action="logout">Sign out</button>
      </aside>
      <main class="main">${route()}</main>
    </div>
  `;
}

function navButton(key, label) {
  return `<button class="${view === key ? "active" : ""}" data-view="${key}">${label}</button>`;
}

function route() {
  if (view === "new-doc1") return doc1Form();
  if (view === "new-maintenance") return maintenanceForm();
  if (view === "summaries") return summariesView();
  if (view === "reports") return reportsView();
  if (view === "admin") return adminView();
  if (editingId) return detailView(editingId);
  return dashboardView();
}

function visibleDocuments() {
  if (currentUser.role === "System Admin" || currentUser.role === "Management") return state.documents;
  return state.documents.filter((doc) => {
    if (doc.createdBy === currentUser.id) return true;
    return doc.currentDepartment === currentUser.department || doc.status === "Completed";
  });
}

function dashboardView() {
  const docs = applyFilters(visibleDocuments());
  const stats = [
    ["Pending Here", visibleDocuments().filter((doc) => doc.currentDepartment === currentUser.department && doc.status !== "Completed").length],
    ["Returned", visibleDocuments().filter((doc) => doc.status.includes("Returned")).length],
    ["Completed", visibleDocuments().filter((doc) => doc.status === "Completed").length],
    ["Total Visible", visibleDocuments().length]
  ];

  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Dashboard</h1>
        <p>Search, filter, and process documents assigned to your role.</p>
      </div>
      <div class="toolbar">
        ${canCreateDoc1() ? `<button class="btn" data-view="new-doc1">New Onboarding</button>` : ""}
        ${canCreateMaintenance() ? `<button class="btn secondary" data-view="new-maintenance">New Maintenance</button>` : ""}
      </div>
    </div>
    <section class="stats">${stats.map(([label, value]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join("")}</section>
    <section class="panel">
      <div class="filters">
        <input data-filter="q" placeholder="Search number, client, status, department" value="${getFilter("q")}" />
        <select data-filter="type">
          ${option("", "All types", getFilter("type"))}
          ${option("doc1", "Document 1", getFilter("type"))}
          ${option("maintenance", "Maintenance", getFilter("type"))}
        </select>
        <select data-filter="status">
          ${["", "Draft", "Pending Sales", "Returned to Sales", "Pending Accounts", "Pending Store", "Pending Management", "Pending HOD", "Completed"].map((s) => option(s, s || "All statuses", getFilter("status"))).join("")}
        </select>
        <select data-filter="department">
          ${["", "Engineer", "Sales", "Accounts", "Store", "Management", "HOD"].map((d) => option(d, d || "All departments", getFilter("department"))).join("")}
        </select>
      </div>
    </section>
    ${documentTable(docs)}
  `;
}

function documentTable(docs) {
  if (!docs.length) return `<div class="empty panel">No documents match this view.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Number</th><th>Type</th><th>Client</th><th>Status</th><th>Current Department</th><th>Created</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${docs.map((doc) => `
            <tr>
              <td><strong>${doc.number}</strong></td>
              <td>${doc.type === "doc1" ? "Onboarding & Stock" : "Maintenance"}</td>
              <td>${doc.clientName}<br><small>${doc.location || ""}</small></td>
              <td><span class="status ${statusClass(doc.status)}">${doc.status}</span></td>
              <td>${doc.currentDepartment}</td>
              <td>${formatDate(doc.createdAt)}</td>
              <td><button class="btn secondary" data-open="${doc.id}">Open</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function doc1Form(doc = null) {
  const isEdit = Boolean(doc);
  const items = doc?.store?.items?.length ? doc.store.items : [{ name: "", requestedQty: 1, issuedQty: 0, serialNumber: "", purpose: "", unitCost: 0 }];
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>${isEdit ? doc.number : "New Document 1"}</h1>
        <p>Customer onboarding and stock requisition starts from Engineer.</p>
      </div>
    </div>
    <form class="panel" data-action="${isEdit ? "save-doc1" : "create-doc1"}" data-id="${doc?.id || ""}">
      <div class="section-title"><h2>Customer and Technical Details</h2></div>
      <div class="form-grid">
        <label>Client Name <input name="clientName" value="${escapeAttr(doc?.clientName || "")}" required /></label>
        <label>Contact <input name="contact" value="${escapeAttr(doc?.contact || "")}" required /></label>
        <label>Location <input name="location" value="${escapeAttr(doc?.location || "")}" required /></label>
        <label>Requested Service <input name="service" value="${escapeAttr(doc?.service || "")}" required /></label>
        <label class="wide">Engineer Notes <textarea name="engineerNotes">${doc?.engineer?.notes || ""}</textarea></label>
      </div>
      <div class="section-title">
        <h2>Requested Stock Items</h2>
        <button class="btn secondary" type="button" data-add-item>Add Item</button>
      </div>
      <div class="items-list" data-items>
        ${items.map((item) => itemInputs(item, false)).join("")}
      </div>
      <div class="button-row">
        <button class="btn" type="submit">${isEdit ? "Save Changes" : "Submit to Sales"}</button>
        <button class="btn secondary" type="button" data-view="dashboard">Cancel</button>
      </div>
    </form>
  `;
}

function maintenanceForm(doc = null) {
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>${doc ? doc.number : "New Maintenance Request"}</h1>
        <p>Maintenance starts from Engineer, goes to HOD, then Accounts.</p>
      </div>
    </div>
    <form class="panel" data-action="${doc ? "save-maintenance" : "create-maintenance"}" data-id="${doc?.id || ""}">
      <div class="form-grid">
        <label>Client Name <input name="clientName" value="${escapeAttr(doc?.clientName || "")}" required /></label>
        <label>Contact <input name="contact" value="${escapeAttr(doc?.contact || "")}" required /></label>
        <label>Location <input name="location" value="${escapeAttr(doc?.location || "")}" required /></label>
        <label>Service <input name="service" value="${escapeAttr(doc?.service || "")}" required /></label>
        <label class="wide">Fault Report <textarea name="fault" required>${doc?.maintenance?.fault || ""}</textarea></label>
        <label class="wide">Recommended Action <textarea name="action" required>${doc?.maintenance?.action || ""}</textarea></label>
      </div>
      <div class="button-row">
        <button class="btn" type="submit">${doc ? "Save" : "Submit to HOD"}</button>
        <button class="btn secondary" type="button" data-view="dashboard">Cancel</button>
      </div>
    </form>
  `;
}

function detailView(id) {
  const doc = state.documents.find((item) => item.id === id);
  if (!doc) {
    editingId = null;
    return dashboardView();
  }

  return `
    <div class="topbar">
      <div class="page-title">
        <h1>${doc.number}</h1>
        <p>${doc.clientName} / ${doc.service}</p>
      </div>
      <div class="toolbar">
        <button class="btn secondary" data-close-detail>Back</button>
      </div>
    </div>
    ${doc.type === "doc1" ? doc1Detail(doc) : maintenanceDetail(doc)}
    ${historyView(doc)}
  `;
}

function doc1Detail(doc) {
  return `
    <section class="panel">
      <div class="section-title">
        <h2>Workflow State</h2>
        <span class="status ${statusClass(doc.status)}">${doc.status}</span>
      </div>
      <div class="form-grid">
        <p><strong>Current Department</strong><br>${doc.currentDepartment}</p>
        <p><strong>Client Contact</strong><br>${doc.contact}</p>
        <p><strong>Location</strong><br>${doc.location}</p>
        <p><strong>Engineer Notes</strong><br>${doc.engineer?.notes || "-"}</p>
      </div>
    </section>
    ${salesSection(doc)}
    ${accountsSection(doc)}
    ${storeSection(doc)}
    ${managementSection(doc)}
  `;
}

function salesSection(doc) {
  const editable = canAct(doc, ["Sales"]) && ["Pending Sales", "Returned to Sales"].includes(doc.status);
  return `
    <form class="panel" data-action="sales-submit" data-id="${doc.id}">
      <div class="section-title"><h2>Sales Section</h2></div>
      <div class="form-grid">
        <label>Total Amount <input name="amount" type="number" min="0" value="${doc.sales?.amount || ""}" ${editable ? "required" : "disabled"} /></label>
        <label>Package Cost <input name="packageCost" type="number" min="0" value="${doc.sales?.packageCost || ""}" ${editable ? "" : "disabled"} /></label>
        <label class="wide">Remarks <textarea name="remarks" ${editable ? "" : "disabled"}>${doc.sales?.remarks || ""}</textarea></label>
      </div>
      ${editable ? `<div class="button-row"><button class="btn" type="submit">Submit to Accounts</button></div>` : ""}
    </form>
  `;
}

function accountsSection(doc) {
  const editable = canAct(doc, ["Accounts"]) && doc.status === "Pending Accounts";
  return `
    <form class="panel" data-action="accounts-submit" data-id="${doc.id}">
      <div class="section-title"><h2>Accounts Section</h2></div>
      <div class="form-grid">
        <label>Billing Amount <input name="billingAmount" type="number" min="0" value="${doc.accounts?.billingAmount || ""}" ${editable ? "required" : "disabled"} /></label>
        <label>Invoice Number <input name="invoiceNumber" value="${escapeAttr(doc.accounts?.invoiceNumber || "")}" ${editable ? "required" : "disabled"} /></label>
        <label class="wide">Remarks <textarea name="remarks" ${editable ? "" : "disabled"}>${doc.accounts?.remarks || ""}</textarea></label>
      </div>
      ${editable ? `<div class="button-row"><button class="btn" type="submit">Submit to Store</button></div>` : ""}
    </form>
  `;
}

function storeSection(doc) {
  const editable = canAct(doc, ["Store"]) && doc.status === "Pending Store";
  return `
    <form class="panel" data-action="store-submit" data-id="${doc.id}">
      <div class="section-title"><h2>Store Confirmation</h2></div>
      <div class="items-list">
        ${(doc.store?.items || []).map((item) => itemInputs(item, editable)).join("")}
      </div>
      <div class="form-grid">
        <label>Sales Amount <input value="${doc.sales?.amount || 0}" disabled /></label>
        <label>Accounts Billing <input value="${doc.accounts?.billingAmount || 0}" disabled /></label>
        <label class="wide">Store Remarks <textarea name="remarks" ${editable ? "" : "disabled"}>${doc.store?.remarks || ""}</textarea></label>
      </div>
      ${editable ? `<div class="button-row"><button class="btn" type="submit">Confirm Stock and Validate</button></div>` : ""}
    </form>
  `;
}

function managementSection(doc) {
  const editable = canAct(doc, ["Management"]) && doc.status === "Pending Management";
  return `
    <form class="panel" data-action="management-submit" data-id="${doc.id}">
      <div class="section-title"><h2>Management Approval</h2></div>
      <label>Approval Notes <textarea name="remarks" ${editable ? "" : "disabled"}>${doc.management?.remarks || ""}</textarea></label>
      ${editable ? `<div class="button-row"><button class="btn" type="submit">Approve and Complete</button></div>` : ""}
    </form>
  `;
}

function maintenanceDetail(doc) {
  const hodEditable = canAct(doc, ["HOD"]) && doc.status === "Pending HOD";
  const accountsEditable = canAct(doc, ["Accounts"]) && doc.status === "Pending Accounts";
  return `
    <section class="panel">
      <div class="section-title"><h2>Maintenance Details</h2><span class="status ${statusClass(doc.status)}">${doc.status}</span></div>
      <div class="form-grid">
        <p><strong>Fault</strong><br>${doc.maintenance?.fault || "-"}</p>
        <p><strong>Recommended Action</strong><br>${doc.maintenance?.action || "-"}</p>
      </div>
    </section>
    <form class="panel" data-action="hod-submit" data-id="${doc.id}">
      <div class="section-title"><h2>HOD Approval</h2></div>
      <label>HOD Notes <textarea name="remarks" ${hodEditable ? "" : "disabled"}>${doc.hod?.remarks || ""}</textarea></label>
      ${hodEditable ? `<div class="button-row"><button class="btn" type="submit">Approve to Accounts</button></div>` : ""}
    </form>
    <form class="panel" data-action="maintenance-accounts-submit" data-id="${doc.id}">
      <div class="section-title"><h2>Accounts Billing</h2></div>
      <div class="form-grid">
        <label>Billing Amount <input name="billingAmount" type="number" min="0" value="${doc.accounts?.billingAmount || ""}" ${accountsEditable ? "required" : "disabled"} /></label>
        <label>Invoice Number <input name="invoiceNumber" value="${escapeAttr(doc.accounts?.invoiceNumber || "")}" ${accountsEditable ? "required" : "disabled"} /></label>
        <label class="wide">Remarks <textarea name="remarks" ${accountsEditable ? "" : "disabled"}>${doc.accounts?.remarks || ""}</textarea></label>
      </div>
      ${accountsEditable ? `<div class="button-row"><button class="btn" type="submit">Complete Maintenance</button></div>` : ""}
    </form>
  `;
}

function itemInputs(item, storeMode) {
  return `
    <div class="item-row">
      <label>Item <input name="itemName" value="${escapeAttr(item.name || "")}" ${storeMode ? "disabled" : "required"} /></label>
      <label>Req. Qty <input name="requestedQty" type="number" min="1" value="${item.requestedQty || 1}" ${storeMode ? "disabled" : "required"} /></label>
      <label>Issued Qty <input name="issuedQty" type="number" min="0" value="${item.issuedQty || 0}" ${storeMode ? "required" : ""} /></label>
      <label>Serial No. <input name="serialNumber" value="${escapeAttr(item.serialNumber || "")}" /></label>
      <label>Purpose <input name="purpose" value="${escapeAttr(item.purpose || "")}" /></label>
      <label>Unit Cost <input name="unitCost" type="number" min="0" value="${item.unitCost || 0}" /></label>
      ${storeMode ? `<span></span>` : `<button class="btn secondary no-print" type="button" data-remove-item>Remove</button>`}
    </div>
  `;
}

function historyView(doc) {
  return `
    <section class="panel">
      <div class="section-title"><h2>Audit Trail</h2></div>
      <div class="timeline">
        ${doc.history.map((item) => `
          <div class="history-row">
            <time>${formatDate(item.at)}</time>
            <div><strong>${item.action}</strong><br><small>${userName(item.userId)}${item.note ? ` - ${item.note}` : ""}</small></div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function summariesView() {
  const summaries = currentUser.role === "System Admin" || currentUser.role === "Management" || currentUser.role === "Accounts"
    ? state.summaries
    : state.summaries.filter((summary) => state.documents.find((doc) => doc.id === summary.sourceDocumentId)?.createdBy === currentUser.id);

  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Client Summaries</h1>
        <p>Generated after Store confirms Document 1 items.</p>
      </div>
    </div>
    ${summaries.length ? summaries.map(summaryDocument).join("") : `<div class="empty panel">No client summaries generated yet.</div>`}
  `;
}

function summaryDocument(summary) {
  const doc = state.documents.find((item) => item.id === summary.sourceDocumentId);
  return `
    <article class="summary-document">
      <div class="summary-head">
        <div>
          <h2>Zanlink Client Summary</h2>
          <p>${summary.number}</p>
        </div>
        <div>
          <strong>${doc?.clientName || "Client"}</strong><br>
          <span>${doc?.location || ""}</span><br>
          <span>${formatDate(summary.createdAt)}</span>
        </div>
      </div>
      <p><strong>Source Document:</strong> ${doc?.number || summary.sourceDocumentId}</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Equipment / Accessory</th><th>Qty</th><th>Serial Number</th><th>Purpose</th><th>Unit Cost</th><th>Total</th></tr></thead>
          <tbody>
            ${summary.items.map((item) => `<tr><td>${item.name}</td><td>${item.issuedQty}</td><td>${item.serialNumber || "-"}</td><td>${item.purpose || "-"}</td><td>${money(item.unitCost)}</td><td>${money(item.issuedQty * item.unitCost)}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="form-grid">
        <p><strong>Invoice Number</strong><br>${summary.invoiceNumber || "-"}</p>
        <p><strong>Subtotal</strong><br>${money(summary.subtotal)}</p>
        <p><strong>Transport Cost</strong><br>${money(summary.transportCost)}</p>
        <p><strong>Grand Total</strong><br>${money(summary.grandTotal)}</p>
      </div>
      <div class="button-row no-print">
        <button class="btn" onclick="window.print()">Print / Save PDF</button>
      </div>
    </article>
  `;
}

function reportsView() {
  const docs = state.documents;
  const byStatus = countBy(docs, "status");
  const completedThisWeek = docs.filter((doc) => doc.status === "Completed" && Date.now() - new Date(doc.createdAt).getTime() < 7 * 86400000).length;
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Reports</h1>
        <p>Operational totals for daily, weekly, and department review.</p>
      </div>
    </div>
    <section class="stats">
      <div class="stat"><b>${docs.length}</b><span>Total Documents</span></div>
      <div class="stat"><b>${state.summaries.length}</b><span>Client Summaries</span></div>
      <div class="stat"><b>${completedThisWeek}</b><span>Completed This Week</span></div>
      <div class="stat"><b>${state.notifications.filter((n) => !n.read).length}</b><span>Unread Notifications</span></div>
    </section>
    <section class="panel">
      <div class="section-title"><h2>Status Breakdown</h2></div>
      <div class="table-wrap">
        <table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>
          ${Object.entries(byStatus).map(([status, count]) => `<tr><td>${status}</td><td>${count}</td></tr>`).join("")}
        </tbody></table>
      </div>
    </section>
  `;
}

function adminView() {
  return `
    <div class="topbar">
      <div class="page-title">
        <h1>Users & Roles</h1>
        <p>Demo users reflect the departments and permissions from the PDF plan.</p>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Department</th></tr></thead>
        <tbody>${USERS.map((user) => `<tr><td>${user.name}</td><td>${user.username}</td><td>${user.role}</td><td>${user.department}</td></tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
    view = button.dataset.view;
    editingId = null;
    render();
  }));

  document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => {
    editingId = button.dataset.open;
    render();
  }));

  document.querySelectorAll("[data-close-detail]").forEach((button) => button.addEventListener("click", () => {
    editingId = null;
    view = "dashboard";
    render();
  }));

  document.querySelectorAll("[data-filter]").forEach((input) => input.addEventListener("input", () => {
    sessionStorage.setItem(`filter:${input.dataset.filter}`, input.value);
    render();
  }));

  document.querySelectorAll("[data-login]").forEach((button) => button.addEventListener("click", () => {
    const user = USERS.find((item) => item.username === button.dataset.login);
    currentUser = user;
    saveState();
    render();
  }));

  document.querySelectorAll("[data-add-item]").forEach((button) => button.addEventListener("click", () => {
    button.closest("form").querySelector("[data-items]").insertAdjacentHTML("beforeend", itemInputs({ requestedQty: 1 }, false));
    bindEvents();
  }));

  document.querySelectorAll("[data-remove-item]").forEach((button) => button.addEventListener("click", () => {
    const list = button.closest(".items-list") || button.closest("form");
    if (list.querySelectorAll(".item-row").length > 1) button.closest(".item-row").remove();
  }));

  document.querySelectorAll("form").forEach((form) => form.addEventListener("submit", handleSubmit));

  const logout = document.querySelector("[data-action='logout']");
  if (logout) logout.addEventListener("click", () => {
    currentUser = null;
    editingId = null;
    view = "dashboard";
    saveState();
    render();
  });
}

function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const action = form.dataset.action;
  if (action === "login") return login(form);
  if (action === "create-doc1") return createDoc1(form);
  if (action === "create-maintenance") return createMaintenance(form);
  if (action === "sales-submit") return salesSubmit(form);
  if (action === "accounts-submit") return accountsSubmit(form);
  if (action === "store-submit") return storeSubmit(form);
  if (action === "management-submit") return managementSubmit(form);
  if (action === "hod-submit") return hodSubmit(form);
  if (action === "maintenance-accounts-submit") return maintenanceAccountsSubmit(form);
}

function login(form) {
  const data = new FormData(form);
  const user = USERS.find((item) => item.username === data.get("username") && item.password === data.get("password"));
  if (!user) return showToast("Invalid demo login.");
  currentUser = user;
  saveState();
  render();
}

function createDoc1(form) {
  const data = new FormData(form);
  const doc = {
    id: crypto.randomUUID(),
    type: "doc1",
    number: nextNumber("doc1"),
    clientName: data.get("clientName"),
    contact: data.get("contact"),
    location: data.get("location"),
    service: data.get("service"),
    status: "Pending Sales",
    currentDepartment: "Sales",
    createdBy: currentUser.id,
    createdAt: new Date().toISOString(),
    engineer: { notes: data.get("engineerNotes") },
    sales: {},
    accounts: {},
    store: { confirmed: false, amountMatches: null, remarks: "", items: readItems(form) },
    management: {},
    history: [historyItem(currentUser.id, "Created Document 1", "Submitted to Sales.")]
  };
  state.documents.unshift(doc);
  notify("Sales", `${doc.number} is waiting for Sales amount.`);
  saveState();
  view = "dashboard";
  showToast(`${doc.number} submitted to Sales.`);
  render();
}

function createMaintenance(form) {
  const data = new FormData(form);
  const doc = {
    id: crypto.randomUUID(),
    type: "maintenance",
    number: nextNumber("maintenance"),
    clientName: data.get("clientName"),
    contact: data.get("contact"),
    location: data.get("location"),
    service: data.get("service"),
    status: "Pending HOD",
    currentDepartment: "HOD",
    createdBy: currentUser.id,
    createdAt: new Date().toISOString(),
    maintenance: { fault: data.get("fault"), action: data.get("action") },
    hod: {},
    accounts: {},
    history: [historyItem(currentUser.id, "Created maintenance request", "Submitted to HOD.")]
  };
  state.documents.unshift(doc);
  notify("HOD", `${doc.number} is waiting for HOD approval.`);
  saveState();
  view = "dashboard";
  showToast(`${doc.number} submitted to HOD.`);
  render();
}

function salesSubmit(form) {
  const doc = findDoc(form);
  const data = new FormData(form);
  doc.sales = { amount: Number(data.get("amount")), packageCost: Number(data.get("packageCost") || 0), remarks: data.get("remarks") };
  moveDoc(doc, "Pending Accounts", "Accounts");
  doc.history.push(historyItem(currentUser.id, "Sales amount added", "Submitted to Accounts."));
  notify("Accounts", `${doc.number} is waiting for billing.`);
  finishAction(`${doc.number} moved to Accounts.`);
}

function accountsSubmit(form) {
  const doc = findDoc(form);
  const data = new FormData(form);
  doc.accounts = { billingAmount: Number(data.get("billingAmount")), invoiceNumber: data.get("invoiceNumber"), remarks: data.get("remarks") };
  moveDoc(doc, "Pending Store", "Store");
  doc.history.push(historyItem(currentUser.id, "Billing added", "Submitted to Store."));
  notify("Store", `${doc.number} is waiting for stock validation.`);
  finishAction(`${doc.number} moved to Store.`);
}

function storeSubmit(form) {
  const doc = findDoc(form);
  const items = readItems(form, doc.store.items);
  const data = new FormData(form);
  const matches = Number(doc.sales?.amount || 0) === Number(doc.accounts?.billingAmount || 0);
  doc.store = { confirmed: matches, amountMatches: matches, remarks: data.get("remarks"), items };
  if (matches) {
    moveDoc(doc, "Pending Management", "Management");
    doc.history.push(historyItem(currentUser.id, "Store confirmed stock and amount match", "Client summary generated."));
    generateSummary(doc);
    notify("Management", `${doc.number} is waiting for approval.`);
    finishAction(`${doc.number} confirmed and moved to Management.`);
  } else {
    moveDoc(doc, "Returned to Sales", "Sales");
    doc.history.push(historyItem(currentUser.id, "Returned to Sales", "Sales and Accounts amounts do not match."));
    notify("Sales", `${doc.number} was returned because amounts do not match.`);
    finishAction(`${doc.number} returned to Sales for correction.`);
  }
}

function managementSubmit(form) {
  const doc = findDoc(form);
  const data = new FormData(form);
  doc.management = { approvedBy: currentUser.id, approvedAt: new Date().toISOString(), remarks: data.get("remarks") };
  moveDoc(doc, "Completed", "Engineer");
  doc.history.push(historyItem(currentUser.id, "Management approved", "Document completed and returned to Engineer."));
  notify("Engineer", `${doc.number} has been completed.`);
  finishAction(`${doc.number} completed.`);
}

function hodSubmit(form) {
  const doc = findDoc(form);
  const data = new FormData(form);
  doc.hod = { approvedBy: currentUser.id, approvedAt: new Date().toISOString(), remarks: data.get("remarks") };
  moveDoc(doc, "Pending Accounts", "Accounts");
  doc.history.push(historyItem(currentUser.id, "HOD approved maintenance", "Submitted to Accounts."));
  notify("Accounts", `${doc.number} maintenance request is waiting for billing.`);
  finishAction(`${doc.number} moved to Accounts.`);
}

function maintenanceAccountsSubmit(form) {
  const doc = findDoc(form);
  const data = new FormData(form);
  doc.accounts = { billingAmount: Number(data.get("billingAmount")), invoiceNumber: data.get("invoiceNumber"), remarks: data.get("remarks") };
  moveDoc(doc, "Completed", "Engineer");
  doc.history.push(historyItem(currentUser.id, "Maintenance billing added", "Maintenance completed and returned to Engineer."));
  notify("Engineer", `${doc.number} maintenance request has been completed.`);
  finishAction(`${doc.number} completed.`);
}

function generateSummary(doc) {
  if (state.summaries.some((summary) => summary.sourceDocumentId === doc.id)) return;
  const subtotal = doc.store.items.reduce((total, item) => total + Number(item.issuedQty || 0) * Number(item.unitCost || 0), 0);
  const transportCost = 0;
  state.summaries.unshift({
    id: crypto.randomUUID(),
    number: nextNumber("summary"),
    sourceDocumentId: doc.id,
    invoiceNumber: doc.accounts?.invoiceNumber || "",
    items: doc.store.items,
    subtotal,
    transportCost,
    grandTotal: subtotal + transportCost,
    createdAt: new Date().toISOString()
  });
}

function readItems(form, source = []) {
  return Array.from(form.querySelectorAll(".item-row")).map((row, index) => ({
    name: row.querySelector("[name='itemName']")?.value || source[index]?.name || "",
    requestedQty: Number(row.querySelector("[name='requestedQty']")?.value || source[index]?.requestedQty || 1),
    issuedQty: Number(row.querySelector("[name='issuedQty']")?.value || 0),
    serialNumber: row.querySelector("[name='serialNumber']")?.value || "",
    purpose: row.querySelector("[name='purpose']")?.value || "",
    unitCost: Number(row.querySelector("[name='unitCost']")?.value || 0)
  }));
}

function moveDoc(doc, status, department) {
  doc.status = status;
  doc.currentDepartment = department;
}

function findDoc(form) {
  return state.documents.find((doc) => doc.id === form.dataset.id);
}

function finishAction(message) {
  saveState();
  editingId = null;
  view = "dashboard";
  showToast(message);
  render();
}

function notify(department, message) {
  state.notifications.push({ id: crypto.randomUUID(), department, message, read: false });
}

function canAct(doc, departments) {
  return currentUser.role === "System Admin" || departments.includes(currentUser.department) || departments.includes(currentUser.role);
}

function canCreateDoc1() {
  return currentUser.role === "System Admin" || currentUser.role === "Engineer";
}

function canCreateMaintenance() {
  return currentUser.role === "System Admin" || currentUser.role === "Engineer";
}

function applyFilters(docs) {
  const q = getFilter("q").toLowerCase();
  const type = getFilter("type");
  const status = getFilter("status");
  const department = getFilter("department");
  return docs.filter((doc) => {
    const haystack = `${doc.number} ${doc.clientName} ${doc.status} ${doc.currentDepartment}`.toLowerCase();
    return (!q || haystack.includes(q))
      && (!type || doc.type === type)
      && (!status || doc.status === status)
      && (!department || doc.currentDepartment === department);
  });
}

function getFilter(name) {
  return sessionStorage.getItem(`filter:${name}`) || "";
}

function option(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function statusClass(status) {
  if (status === "Completed") return "done";
  if (status.includes("Returned")) return "returned";
  if (status === "Draft") return "draft";
  return "";
}

function userName(id) {
  return USERS.find((user) => user.id === id)?.name || "System";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-TZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function money(value) {
  return new Intl.NumberFormat("en-TZ", { style: "currency", currency: "TZS", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function showToast(message) {
  clearTimeout(toastTimer);
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  toastTimer = setTimeout(() => toast.remove(), 2600);
}

render();
