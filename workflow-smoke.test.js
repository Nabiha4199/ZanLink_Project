const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const storage = new Map();
const elements = [];

const context = {
  console,
  assert,
  crypto,
  Intl,
  Date,
  Number,
  String,
  Array,
  Object,
  Boolean,
  setTimeout,
  clearTimeout,
  sessionStorage: {
    getItem: (key) => storage.get(`session:${key}`) || "",
    setItem: (key, value) => storage.set(`session:${key}`, String(value))
  },
  localStorage: {
    getItem: (key) => storage.get(`local:${key}`) || null,
    setItem: (key, value) => storage.set(`local:${key}`, String(value))
  },
  document: {
    body: { appendChild: () => {} },
    createElement: () => ({ className: "", textContent: "", remove: () => {} }),
    querySelector: () => ({ innerHTML: "", remove: () => {}, addEventListener: () => {} }),
    querySelectorAll: () => elements
  },
  FormData: class {
    constructor(form) {
      this.data = form.data || {};
    }
    get(name) {
      return this.data[name] ?? "";
    }
  },
  window: { print: () => {} }
};

const appCode = fs.readFileSync("legacy/app.js", "utf8");
const smoke = `
function fakeForm(id, data, rows) {
  return {
    dataset: { id },
    data,
    querySelectorAll(selector) {
      if (selector !== ".item-row") return [];
      return rows || [];
    }
  };
}

function fakeRow(values) {
  return {
    querySelector(selector) {
      const name = selector.match(/name='([^']+)'/)[1];
      return { value: values[name] ?? "" };
    }
  };
}

currentUser = USERS.find((user) => user.username === "engineer");
const createForm = fakeForm("", {
  clientName: "Test Client",
  contact: "+255700000001",
  location: "Zanzibar",
  service: "Business internet",
  engineerNotes: "Install and activate"
}, [fakeRow({ itemName: "Router", requestedQty: 1, issuedQty: 0, serialNumber: "", purpose: "CPE", unitCost: 100 })]);
createDoc1(createForm);
const doc = state.documents[0];
assert.strictEqual(doc.status, "Pending Sales");

currentUser = USERS.find((user) => user.username === "sales");
salesSubmit(fakeForm(doc.id, {
  clientName: "Test Client",
  location: "Zanzibar",
  surveyFormNo: "REQ-TEST",
  amount: 1000,
  packageCost: 900,
  additionalNpr: 0,
  subscription: "Business package",
  mbr: 1000,
  requestedBy: "Sales Team",
  requestedDate: "2026-07-14"
}));
assert.strictEqual(doc.status, "Pending Accounts");
assert.strictEqual(doc.sales.equipment[0].unitCost, 100);

currentUser = USERS.find((user) => user.username === "accounts");
accountsSubmit(fakeForm(doc.id, { billingAmount: 999, invoiceNumber: "INV-X", remarks: "mismatch" }, [fakeRow({ itemName: "Router", requestedQty: 1, unitCost: 900 })]));
assert.strictEqual(doc.status, "Pending Store");
assert.strictEqual(doc.sales.equipment[0].unitCost, 900);

currentUser = USERS.find((user) => user.username === "store");
storeSubmit(fakeForm(doc.id, { remarks: "amount mismatch" }, [fakeRow({ itemName: "Router", requestedQty: 1, issuedQty: 1, serialNumber: "R-1", purpose: "CPE", unitCost: 100 })]));
assert.strictEqual(doc.status, "Returned to Sales");

currentUser = USERS.find((user) => user.username === "sales");
salesSubmit(fakeForm(doc.id, {
  clientName: "Test Client",
  location: "Zanzibar",
  surveyFormNo: "REQ-TEST",
  amount: 1000,
  packageCost: 900,
  additionalNpr: 0,
  subscription: "Business package",
  mbr: 1000,
  requestedBy: "Sales Team",
  requestedDate: "2026-07-14"
}));
currentUser = USERS.find((user) => user.username === "accounts");
accountsSubmit(fakeForm(doc.id, { billingAmount: 1000, invoiceNumber: "INV-X2", remarks: "matched" }, [fakeRow({ itemName: "Router", requestedQty: 1, unitCost: 900 })]));
currentUser = USERS.find((user) => user.username === "store");
storeSubmit(fakeForm(doc.id, { remarks: "stock issued" }, [fakeRow({ itemName: "Router", requestedQty: 1, issuedQty: 1, serialNumber: "R-2", purpose: "CPE", unitCost: 100 })]));
assert.strictEqual(doc.status, "Pending Management");
assert.ok(state.summaries.some((summary) => summary.sourceDocumentId === doc.id && summary.number.startsWith("Zanlink/")));

currentUser = USERS.find((user) => user.username === "management");
managementSubmit(fakeForm(doc.id, { remarks: "approved" }));
assert.strictEqual(doc.status, "Completed");

currentUser = USERS.find((user) => user.username === "engineer");
createMaintenance(fakeForm("", {
  clientName: "Maintenance Client",
  contact: "+255700000002",
  location: "Zanzibar",
  service: "Repair",
  fault: "Signal low",
  action: "Replace cable"
}));
const maint = state.documents[0];
assert.strictEqual(maint.status, "Pending HOD");
currentUser = USERS.find((user) => user.username === "hod");
hodSubmit(fakeForm(maint.id, { remarks: "approved" }));
assert.strictEqual(maint.status, "Pending Accounts");
currentUser = USERS.find((user) => user.username === "accounts");
maintenanceAccountsSubmit(fakeForm(maint.id, { billingAmount: 500, invoiceNumber: "MINV-1", remarks: "billed" }));
assert.strictEqual(maint.status, "Completed");
console.log("workflow smoke passed");
`;

vm.createContext(context);
vm.runInContext(`${appCode}\n${smoke}`, context);
