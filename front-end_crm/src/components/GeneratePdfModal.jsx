// Split out of her original "InvoiceDetailModal.jsx" marker on its own —
// it's used by BOTH Operations.jsx (bulk generate) and InvoiceDetailModal.jsx
// (single-invoice generate), so it has to be its own file either way.
import { useState } from "react";

export default function GeneratePdfModal({ invoices, onConfirm, onClose }) {
  const [pcts, setPcts] = useState(() => {
    const init = {};
    invoices.forEach((inv) => { init[inv.inv] = "0.95"; });
    return init;
  });

  function setPct(invNumber, val) {
    setPcts((p) => ({ ...p, [invNumber]: val }));
  }
  function confirm() {
    onConfirm(pcts);
    onClose();
  }

  const multiple = invoices.length > 1;
  return (
    <div className="overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <div>
            <h2 style={{ margin: 0 }}>Generate invoice PDF{multiple ? "s" : ""}</h2>
            <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
              Set the processing fee percentage for {multiple ? "each invoice" : "this invoice"} before generating.
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="tbl-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead><tr><th>Invoice #</th><th>Bidder</th><th>Fee %</th></tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.inv}>
                    <td className="mono">{inv.inv}</td>
                    <td>{inv.bidderName}</td>
                    <td>
                      <input
                        type="number" step="0.01" min="0" max="100"
                        value={pcts[inv.inv]}
                        onChange={(e) => setPct(inv.inv, e.target.value)}
                        style={{ width: 80, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 5 }}
                      /> %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="locked-note" style={{ marginBottom: 14 }}>
            This recalculates each invoice's fee amount and total based on the percentage set here. Invoices still in "Invoice Generated" status also move to "Pending Payment"; invoices further along keep their current status.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-brass" onClick={confirm}>Generate {invoices.length} PDF{multiple ? "s" : ""}</button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}