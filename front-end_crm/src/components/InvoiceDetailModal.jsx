import { useState } from "react";
import { LOCKED_STATUSES, PDF_ROLES, actionDefsFor, batchLabel, money } from "../data";
import Stamp from "./Stamp";
import { ActionBtn } from "./ActionButton";
import GeneratePdfModal from "./GeneratePdfModal";

export default function InvoiceDetailModal({ invoice, role, onClose, onGeneratePdf }) {
  const [showGenerate, setShowGenerate] = useState(false);
  if (!invoice) return null;
  const locked = LOCKED_STATUSES.includes(invoice.status);
  const canGeneratePdf = PDF  _ROLES.includes(role) && !LOCKED_STATUSES.includes(invoice.status);
  const otherActions = actionDefsFor(invoice).filter((b) => b.label !== "Generate invoice PDF");
  return (
    <div className="overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2 style={{ margin: 0 }}>{invoice.inv}</h2>
            <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
              {batchLabel(invoice.batchId)} \u00b7 {invoice.lots.length} lot(s)
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 16 }}>
            <Stamp status={invoice.status} />
            {locked && <span className="badge-note">Locked \u2014 no edits except admin override</span>}
          </div>
          <div className="field-grid">
            <div className="field"><div className="fl">Bidder</div><div className="fv">{invoice.bidderName}</div></div>
            <div className="field"><div className="fl">Company</div><div className="fv">{invoice.companyName || <span style={{ color: "var(--text-3)" }}>Not set \u2014 edit winner record to add</span>}</div></div>
            <div className="field"><div className="fl">Phone</div><div className="fv mono">{invoice.winnerPhone}</div></div>
            <div className="field"><div className="fl">Fee percentage</div><div className="fv mono">{invoice.feePercentage}%</div></div>
            <div className="field"><div className="fl">Invoice date</div><div className="fv mono">{invoice.invoiceDate}</div></div>
            <div className="field"><div className="fl">Due date</div><div className="fv mono">{invoice.dueDate}</div></div>
            <div className="field"><div className="fl">Total amount</div><div className="fv mono">{money(invoice.totalAmount)}</div></div>
            <div className="field"><div className="fl">Verified by</div><div className="fv">{invoice.verifiedBy}</div></div>
          </div>

          <div className="section-label">Lots ({invoice.lots.length})</div>
          <div className="tbl-wrap" style={{ marginBottom: 6 }}>
            <table>
              <thead><tr><th>Lot #</th><th>Auction</th><th>Winning amount</th><th>Fee %</th><th>Lot fee</th></tr></thead>
              <tbody>
                {invoice.lots.map((l) => (
                  <tr key={l.lotNumber}>
                    <td className="mono">{l.lotNumber}</td>
                    <td>{l.auctionName}</td>
                    <td className="amount">{money(l.winningAmount)}</td>
                    <td className="mono">{l.feePercentage}%</td>
                    <td className="amount">{money(l.lotFee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="field" style={{ margin: "16px 0" }}>
            <div className="fl">Remarks</div>
            <div className="fv">{invoice.remarks || <span style={{ color: "var(--text-3)" }}>No remarks added</span>}</div>
          </div>

          <div className="section-label">Attachments</div>
          <div className="attach-list">
            <div className="attach-item"><span className="ic"></span> Invoice document \u2014 {invoice.inv}.pdf</div>
            {["paid", "under_verification", "payment_submitted"].includes(invoice.status) && (
              <div className="attach-item"><span className="ic"></span> Bank slip / transfer proof \u2014 receipt_{invoice.inv}.pdf</div>
            )}
          </div>

          <div className="modal-actions">
            {canGeneratePdf && (
              <button className="btn btn-sm" onClick={() => setShowGenerate(true)}>Generate invoice PDF</button>
            )}
            {otherActions.map((b, i) => (
              <ActionBtn key={i} label={b.label} roles={b.roles} role={role} />
            ))}
          </div>
          {locked && (
            <div className="locked-note">
              Action buttons are hidden once an invoice is Paid, Cancelled, or Waived \u2014 only an Administrator override can change status from here.
            </div>
          )}
        </div>
      </div>
      {showGenerate && (
        <GeneratePdfModal
          invoices={[invoice]}
          onConfirm={onGeneratePdf}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </div>
  );
}