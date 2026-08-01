import { useEffect, useState } from "react";

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
        items: form.items.map((item) => ({ ...item, unitCostUsd: Number(item.unitCostUsd) })),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title"><h1>Item Pricing</h1><p>Admin-only USD source prices and the conversion rate used when equipment is selected.</p></div>
      </div>
      <div className="panel">
        <div className="section-title">
          <h2>Pricing Settings</h2>
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
            <thead><tr><th>Item ID</th><th>Item</th><th>Source Cost (USD)</th><th>Converted Cost (TZS)</th></tr></thead>
            <tbody>{form.items.map((item, index) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.description}</td>
                <td>{editing ? <input aria-label={`USD cost for ${item.description}`} min="0" required step="0.01" type="number" value={item.unitCostUsd} onChange={(event) => updateItem(index, event.target.value)} /> : `$${Number(item.unitCostUsd).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}</td>
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
