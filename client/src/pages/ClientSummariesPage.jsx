import React, { useState } from "react";
import { api } from "../services/api";
import { money } from "../utils/formatters";

export default function ClientSummariesPage({ user, summaries, documents, showError }) {
  if (!summaries.length) return <div className="panel empty">No client summaries generated yet.</div>;

  return (
    <>
      <style>{`
        @media print {
          .client-delivery .summary-top-meta {
            display: flex;
            gap: 1rem;
            margin: 0.2rem 0 0.6rem;
            font-size: 10pt;
          }

          .client-delivery .summary-top-meta-item {
            display: flex;
            gap: 0.35rem;
          }

          .client-delivery .summary-top-meta-label {
            font-weight: 700;
          }

          .client-delivery .summary-meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0.5rem;
            table-layout: fixed;
          }

          .client-delivery .summary-meta-table th,
          .client-delivery .summary-meta-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            vertical-align: top;
            word-break: break-word;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .client-delivery .summary-meta-table th {
            font-weight: 700;
            text-align: left;
            font-size: 9pt;
            width: 20%;
            background: #f7f7f7;
          }

          .client-delivery .summary-meta-table td {
            text-align: left;
            font-size: 9pt;
            width: 30%;
          }

          .client-delivery .signature-pair {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
            margin-top: 0.8rem;
          }

          .client-delivery .signature-pair .signature-field {
            border-bottom: 1px solid #000;
            padding-bottom: 0.55rem;
          }

          .client-delivery .signature-pair .signature-field.full-width {
            grid-column: 1 / -1;
          }

          .client-delivery .signature-pair .field-label {
            font-weight: 700;
            font-size: 9pt;
            margin-bottom: 0.2rem;
          }

          .client-delivery .signature-pair .field-value {
            font-size: 9pt;
          }

          .client-delivery .delivery-table {
            width: 100%;
            font-size: 12pt;
          }

          .client-delivery .delivery-table th,
          .client-delivery .delivery-table td {
            padding: 8px 10px;
            white-space: nowrap;
          }
        }
      `}</style>

      <div className="topbar">
        <div className="page-title">
          <h1>Client Summaries</h1>
          <p>Completed, read-only delivery records generated from approved Document 1 data.</p>
        </div>
      </div>

      {summaries.map((summary) => (
        <ClientSummary
          key={summary.id}
          user={user}
          summary={summary}
          doc={documents.find((item) => item.id === summary.sourceDocumentId)}
          showError={showError}
        />
      ))}
    </>
  );
}

function ClientSummary({ user, summary, doc, showError }) {
  const items = summary.items || [];
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const customerName = summary.customerName || doc?.clientName || "";
  const printId = `client-summary-${summary.id}`;
  const subtotal = items.reduce(
    (total, item) => total + Number(item.issuedQty || 0) * Number(item.unitCost || 0),
    0
  );
  const transportCost = Number(summary.transportCost || 0);
  const grandTotal = subtotal + transportCost;
  const currency = summary.currency || doc?.accounts?.currency || "TZS";

  const visibleItems = items.filter((item) => {
    const query = equipmentSearch.trim().toLowerCase();
    return (
      !query ||
      [item.name, item.itemId, item.serialNumber, item.purpose].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    );
  });

  async function download() {
    try {
      const blob = await api.downloadSummary(user, summary.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${customerName || "client"}_client_summary.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(error);
    }
  }

  function printSummary() {
    const target = document.getElementById(printId);
    if (!target) return;

    const cleanup = () => {
      target.classList.remove("print-target");
      document.body.classList.remove("printing-summary");
    };

    document.body.classList.add("printing-summary");
    target.classList.add("print-target");
    window.addEventListener("afterprint", cleanup, { once: true });

    try {
      window.print();
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  return (
    <article id={printId} className="summary-document client-delivery">
      <div className="client-summary-head">
        <div className="paper-logo">zanlink</div>
        <div className="company-address">
          P.O. Box 4204,<br />
          Zanzibar, TANZANIA.<br />
          Tel: +255 777 476 666<br />
          E-Mail: info-zanlink@liquidtelecom.co.tz
        </div>
      </div>

      <div className="summary-top-meta">
        <div className="summary-top-meta-item">
          <span className="summary-top-meta-label">Sheet No.</span>
          <span>{summary.number}</span>
        </div>
        <div className="summary-top-meta-item">
          <span className="summary-top-meta-label">Source Document</span>
          <span>{summary.sourceDocumentNumber || doc?.number}</span>
        </div>
      </div>

      <table className="summary-meta-table">
        <tbody>
          <tr>
            <th>Customer</th>
            <td>{customerName}</td>
            <th>Location</th>
            <td>{summary.customerLocation || doc?.location}</td>
          </tr>
          <tr>
            <th>Invoice Number</th>
            <td>{summary.invoiceNumber || doc?.accounts?.invoiceNumber}</td>
            <th>Accounts Billing Amount</th>
            <td>{money(summary.billingAmount ?? doc?.accounts?.billingAmount ?? 0, currency)}</td>
          </tr>
          <tr>
            <th>Contact</th>
            <td colSpan="3">{summary.customerContact || doc?.contact || "-"}</td>
          </tr>
        </tbody>
      </table>

      <h3>Equipment/Accessories delivered</h3>

      <label className="equipment-search equipment-list-search no-print">
        Search Equipment
        <input
          aria-label="Search delivered equipment"
          placeholder="Type item name, ID, serial number or purpose"
          type="search"
          value={equipmentSearch}
          onChange={(event) => setEquipmentSearch(event.target.value)}
        />
      </label>

      <div className="table-wrap">
        <table className="delivery-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Item ID</th>
              <th>Equipment</th>
              <th>Qty</th>
              <th>Purpose</th>
              <th>Cost</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.itemId || item.serialNumber || "-"}</td>
                <td>{item.name || "-"}</td>
                <td>{Number(item.issuedQty || 0)}</td>
                <td>{item.purpose || "Sold to Client"}</td>
                <td>{money(Number(item.unitCost || 0), currency)}</td>
                <td>{money(Number(item.issuedQty || 0) * Number(item.unitCost || 0), currency)}</td>
              </tr>
            ))}

            {!visibleItems.length && (
              <tr>
                <td className="empty" colSpan="7">
                  No equipment matches “{equipmentSearch}”.
                </td>
              </tr>
            )}

            <tr className="summary-total-row">
              <td colSpan="6">
                <strong>Sub Total:</strong>
              </td>
              <td>{money(subtotal, currency)}</td>
            </tr>

            <tr className="summary-total-row">
              <td colSpan="6">
                <strong>Transportation Cost:</strong>
              </td>
              <td>{money(transportCost, currency)}</td>
            </tr>

            <tr className="summary-total-row grand-total-row">
              <td colSpan="6">
                <strong>Grand Total Cost:</strong>
              </td>
              <td>{money(grandTotal, currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="terms-box">
        <strong>Terms & Conditions</strong>
        <p>{summary.terms || "-"}</p>
      </section>

      <div className="signature-pair">
        <div className="field signature-field">
          <div className="field-label">Name of Customer</div>
          <div className="field-value">{customerName}</div>
        </div>

        <div className="field signature-field">
          <div className="field-label">Name of ZANLINK Staff</div>
          <div className="field-value">{summary.zanlinkStaff}</div>
        </div>

        <div className="field signature-field full-width">
          <div className="field-label">Contact</div>
          <div className="field-value">{summary.customerContact || doc?.contact || "-"}</div>
        </div>
      </div>

      <div className="button-row no-print">
        <button className="btn secondary" onClick={download}>
          Download Client Summary PDF
        </button>
        <button className="btn secondary" onClick={printSummary}>
          Print This Summary
        </button>
      </div>
    </article>
  );
}