import { useEffect, useState } from "react";

const VAT_RATE = 0.18;
// Selling prices and availability are transcribed from the approved August 2025 list.
const PDF_SELLING_PRICES = [55, 28, 37, 0, 8, 0, 0, 84, 0, 0, 0, 0, 25, 0, 0, 0, 1, 2, 81, 0, 24, 24, 137, 165, 158, 436, 158, 9, 6, 317, 33, 0, 0, 67, 156, 101, 93, 448, 374, 67, 22, 127, 114, 0, 15, 0, 0, 0, 0, 47, 38, 57, 63, 3, 4, 3, 4, 139, 297, 2, 16, 15, 3, 330, 204, 306, 173, 508, 635, 0, 126, 0, 0, 197, 28, 38, 152, 237, 48, 58, 120, 54, 72, 126, 306, 35, 207, 111, 53, 180, 244, 37, 122, 175, 228, 157];
const ON_DEMAND_INDEXES = new Set([5, 6, 8, 9, 10, 11, 13, 14, 15, 19, 31, 32, 43, 45, 46, 47, 48, 69, 71, 72]);
const AVAILABLE = "Available";
const NOT_AVAILABLE = "Not Available";

function usd(value) {
  return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function approvedSellingPrice(item, index) {
  const expectedId = `ITM-${String(index + 1).padStart(3, "0")}`;
  return item.id === expectedId ? PDF_SELLING_PRICES[index] : Number(item.unitCostUsd || 0) * (1 + VAT_RATE);
}

function defaultRemarks(item, index) {
  const expectedId = `ITM-${String(index + 1).padStart(3, "0")}`;
  return item.id === expectedId ? (ON_DEMAND_INDEXES.has(index) ? NOT_AVAILABLE : AVAILABLE) : Number(item.unitCostUsd || 0) > 0 ? AVAILABLE : NOT_AVAILABLE;
}

function remarksValue(item, index) {
  if (item.remarks === "OK") return AVAILABLE;
  if (item.remarks === "On Demand") return NOT_AVAILABLE;
  return item.remarks || defaultRemarks(item, index);
}

export default function PricingManagementPage({ pricing, onSave }) {
  const [form, setForm] = useState(pricing);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => setForm(pricing), [pricing]);

  function updateItem(index, unitCostUsd) {
    setForm({
      ...form,
      items: form.items.map((item, itemIndex) => itemIndex === index ? { ...item, unitCostUsd } : item),
    });
  }

  function updateRemarks(index, remarks) {
    setForm({
      ...form,
      items: form.items.map((item, itemIndex) => itemIndex === index ? { ...item, remarks } : item),
    });
  }

  function startEditing() {
    setForm({ ...pricing, items: pricing.items.map((item) => ({ ...item })) });
    setEditing(true);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        usdToTzsRate: Number(form.usdToTzsRate),
        items: form.items.map((item, index) => ({ ...item, unitCostUsd: Number(item.unitCostUsd), remarks: remarksValue(item, index) })),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title"><h1>Inventory Valuation</h1><p>Admin-only inventory selling costs. TZS conversion is shown as the final reference field.</p></div>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>Zanlink Limited</h2>
          <div className="button-row">
            <button className="btn secondary" disabled={editing || saving} type="button" onClick={startEditing}>Edit Pricing</button>
            <button className="btn" disabled={!editing || saving} form="pricing-settings-form" type="submit">{saving ? "Updating…" : "Update Pricing"}</button>
            {editing && <button className="btn secondary" disabled={saving} type="button" onClick={() => { setForm(pricing); setEditing(false); }}>Cancel</button>}
          </div>
        </div>
        <form id="pricing-settings-form" onSubmit={save}>
        <div className="form-grid">
          <label>USD to TZS Exchange Rate
            {editing ? <input min="0.01" required step="0.01" type="number" value={form.usdToTzsRate} onChange={(event) => setForm({ ...form, usdToTzsRate: event.target.value })} /> : <output>{Number(form.usdToTzsRate).toLocaleString("en-US")}</output>}
            <small>Selected item costs are converted to TZS using this rate.</small>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th /><th>Inventory Valuation</th><th colSpan="2">Selling Cost</th><th /><th /></tr>
              <tr><th>S/N</th><th>Item Description</th><th>Unit Cost in USD Excl VAT</th><th>Selling Price VAT Incl 18%</th><th>Remarks</th><th>Converted Cost (TZS)</th></tr>
            </thead>
            <tbody>{form.items.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.description}</td>
                <td>{editing ? <input aria-label={`USD cost for ${item.description}`} min="0" required step="0.01" type="number" value={item.unitCostUsd} onChange={(event) => updateItem(index, event.target.value)} /> : usd(item.unitCostUsd)}</td>
                <td>{usd(approvedSellingPrice(item, index))}</td>
                <td>{editing ? <select aria-label={`Remarks for ${item.description}`} value={remarksValue(item, index)} onChange={(event) => updateRemarks(index, event.target.value)}><option value={AVAILABLE}>Available</option><option value={NOT_AVAILABLE}>Not Available</option></select> : remarksValue(item, index)}</td>
                <td>{(Number(item.unitCostUsd || 0) * Number(form.usdToTzsRate || 0)).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        </form>
      </div>
    </>
  );
}
