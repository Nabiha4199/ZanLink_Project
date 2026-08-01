import React, { useState } from "react";
import { api } from "../services/api";
import { money } from "../utils/formatters";

const DELIVERY_NOTE_TERMS = `If any of the devices above is provided on test basis, it will only be kept for a maximum period of 5 days at client's premises. After that the client should either return the device(s) or will be charged for it.

1. During the test period, the device is entirely client's responsibility. If the device becomes damaged for whatever reason, the client will be charged for it.

2. Client should make payments for any device/accessories or transport cost applicable within 5 days of the Invoice attached with this note. If client fails to settle the bill within this period, ZANLINK will either remove the device from client's premises and/or will deduct any applicable cost from client's subscription costs.`;

export default function ClientSummariesPage({ user, summaries, documents, showError }) {
  if (!summaries.length) return <div className="panel empty">No delivery notes generated yet.</div>;

  return (
    <>
      <style>{`
        .client-delivery .summary-meta-table {
          width: 100%;
          min-width: 0;
          border-collapse: collapse;
          margin: 0 0 0.6rem;
          table-layout: fixed;
        }

        .client-delivery .summary-meta-table th,
        .client-delivery .summary-meta-table td {
          border: 1px solid #7b8490;
          padding: 6px 8px;
          vertical-align: top;
          word-break: break-word;
          white-space: normal;
          overflow-wrap: anywhere;
          text-align: left;
        }

        .client-delivery .summary-meta-table th {
          width: 20%;
          background: #d2d9e2;
          color: #1f2937;
          font-weight: 700;
        }

        .client-delivery .summary-meta-table td {
          width: 30%;
        }

        .client-delivery .delivery-table {
          width: 100%;
          min-width: 0;
          font-size: 14px;
          line-height: 1.25;
        }

        .client-delivery .delivery-table th,
        .client-delivery .delivery-table td {
          border: 1px solid #7b8490;
          padding: 4px 6px;
        }

        .client-delivery .delivery-table th {
          background: #d2d9e2;
          color: #1f2937;
          font-weight: 700;
        }

        @media print {
          .client-delivery .table-wrap {
            overflow: hidden;
            padding: 0;
            border: 0;
            box-shadow: none;
          }

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
            min-width: 0;
            border-collapse: collapse;
            margin: 0 0 0.5rem;
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
            text-align: left;
            font-size: 9pt;
            width: 20%;
            background: #c3ccd7;
            color: #111827;
            font-weight: 700;
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
            display: grid;
            gap: 0.35rem;
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

          .client-delivery .signature-pair .signature-line {
            height: 1.5rem;
            border-bottom: 1px solid #000;
          }

          .client-delivery .delivery-table {
            width: 100%;
            min-width: 0;
            font-size: 10pt;
            line-height: 1.2;
          }

          .client-delivery .delivery-table th,
          .client-delivery .delivery-table td {
            padding: 5px 6px;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .client-delivery .delivery-table th {
            background: #c3ccd7;
            color: #111827;
            font-weight: 700;
          }
        }
      `}</style>

      <div className="topbar">
        <div className="page-title">
          <h1>Delivery Note</h1>
          <p>Delivery Note</p>
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
  const calculatedEquipmentTotal = items.reduce(
    (total, item) => total + Number(item.issuedQty || 0) * Number(item.unitCost || 0),
    0
  );
  const subtotal = Number(summary.subtotal ?? calculatedEquipmentTotal);
  const transportCost = Number(summary.transportCost || 0);
  const billedAmount = Number(summary.billingAmount ?? doc?.accounts?.billingAmount ?? 0);
  const installationCost = Number(
    summary.installationCost
      ?? doc?.sales?.laborCharge
      ?? Math.max(billedAmount - subtotal - transportCost, 0)
  );
  const grandTotal = Number((summary.grandTotal ?? billedAmount) || (subtotal + installationCost + transportCost));
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
      link.download = `${customerName || "client"}_delivery_note.pdf`;
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
            <th>Billed Amount</th>
            <td>{money(billedAmount, currency)}</td>
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
                <strong>Installation Cost/Labor Charge:</strong>
              </td>
              <td>{money(installationCost, currency)}</td>
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
        <p>{DELIVERY_NOTE_TERMS}</p>
      </section>

      <div className="signature-pair">
        <div className="field signature-field">
          <div className="field-label">Name of Customer</div>
          <div className="field-value">{customerName}</div>
          <div className="field-label">Signature</div>
          <div className="signature-line" aria-label="Customer signature to be completed by hand" />
        </div>

        <div className="field signature-field">
          <div className="field-label">Name of ZANLINK Staff</div>
          <div className="signature-line" aria-label="ZANLINK staff name to be completed by hand" />
          <div className="field-label">Signature</div>
          <div className="signature-line" aria-label="ZANLINK staff signature to be completed by hand" />
        </div>
      </div>

      <div className="button-row no-print">
        <button className="btn secondary" onClick={download}>
          Download Delivery Note PDF
        </button>
        <button className="btn secondary" onClick={printSummary}>
          Print Delivery Note
        </button>
      </div>
    </article>
  );
}
