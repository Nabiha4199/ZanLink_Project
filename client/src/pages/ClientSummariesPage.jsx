import React from "react";
import Field from "../components/common/Field";
import { api } from "../services/api";
import { formatDate, usd } from "../utils/formatters";

export default function ClientSummariesPage({ user, summaries, documents, showError }) {
  if (!summaries.length) return <div className="panel empty">No client summaries generated yet.</div>;
  return (
    <>
      <div className="topbar"><div className="page-title"><h1>Client Summaries</h1><p>Completed, read-only delivery records generated from approved Document 1 data.</p></div></div>
      {summaries.map((summary) => <ClientSummary key={summary.id} user={user} summary={summary} doc={documents.find((item) => item.id === summary.sourceDocumentId)} showError={showError} />)}
    </>
  );
}

function ClientSummary({ user, summary, doc, showError }) {
  const items = summary.items || [];
  const customerName = summary.customerName || doc?.clientName || "";
  const printId = `client-summary-${summary.id}`;
  const subtotal = items.reduce((total, item) => total + Number(item.issuedQty || 0) * Number(item.unitCost || 0), 0);
  const transportCost = Number(summary.transportCost || 0);
  const grandTotal = subtotal + transportCost;

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
        <div className="company-address">P.O. Box 4204,<br />Zanzibar, TANZANIA.<br />Tel: +255 777 476 666<br />E-Mail: info-zanlink@liquidtelecom.co.tz</div>
      </div>
      <div className="summary-meta-grid">
        <Field label="Sheet No." value={summary.number} />
        <Field label="Source Document" value={summary.sourceDocumentNumber || doc?.number} />
        <Field label="Customer" value={customerName} />
        <Field label="Location" value={summary.customerLocation || doc?.location} />
        <Field label="Date" value={formatDate(summary.createdAt)} />
        <Field label="Invoice Number" value={summary.invoiceNumber || doc?.accounts?.invoiceNumber} />
        <Field label="Accounts Billing Amount" value={usd(summary.billingAmount ?? doc?.accounts?.billingAmount ?? 0)} />
        <Field label="Contact" value={summary.customerContact || doc?.contact} />
      </div>
      <h3>Equipment/Accessories delivered</h3>
      <div className="table-wrap">
        <table className="delivery-table">
          <thead><tr><th>No.</th><th>Item ID</th><th>Equipment/Accessory</th><th>Qty</th><th>Purpose</th><th>Cost</th><th>Total</th></tr></thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.itemId || item.serialNumber || "-"}</td>
                <td>{item.name || "-"}</td>
                <td>{Number(item.issuedQty || 0)}</td>
                <td>{item.purpose || "Sold to Client"}</td>
                <td>{usd(Number(item.unitCost || 0))}</td>
                <td>{usd(Number(item.issuedQty || 0) * Number(item.unitCost || 0))}</td>
              </tr>
            ))}
            <tr><td colSpan="6"><strong>Sub Total:</strong></td><td>{usd(subtotal)}</td></tr>
            <tr><td colSpan="6"><strong>Transportation Cost:</strong></td><td>{usd(transportCost)}</td></tr>
            <tr><td colSpan="6"><strong>Grand Total Cost:</strong></td><td>{usd(grandTotal)}</td></tr>
          </tbody>
        </table>
      </div>
      <section className="terms-box"><strong>Terms & Conditions</strong><p>{summary.terms || "-"}</p></section>
      <div className="signature-pair"><Field label="Name of Customer" value={customerName} /><Field label="Name of ZANLINK Staff" value={summary.zanlinkStaff} /></div>
      <div className="button-row no-print">
        <button className="btn secondary" onClick={download}>Download Client Summary PDF</button>
        <button className="btn secondary" onClick={printSummary}>Print This Summary</button>
      </div>
    </article>
  );
}
