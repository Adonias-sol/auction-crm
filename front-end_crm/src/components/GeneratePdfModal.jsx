// Split out of her original "InvoiceDetailModal.jsx" marker on its own —
// it's used by BOTH Operations.jsx (bulk generate) and InvoiceDetailModal.jsx
// (single-invoice generate), so it has to be its own file either way.
import { useState } from "react";

export default function GeneratePdfModal({ invoices, onConfirm, onClose }) {
  const [pcts, setPcts] = useState(() => {
    const init = {};
    invoices.forEach((inv) => { init[inv.id] = String(inv.lots?.[0]?.feePercentage ?? "0.95"); });
    return init;
  });

  const [auctionRefNumber, setAuctionRefNumber] = useState('');
  const [amhNames, setAmhNames] = useState(() => {
    const init = {};
    invoices.forEach((inv) => { init[inv.id] = inv.bidderNameAmharic || ""; });
    return init;
  });

  function setPct(invId, value) {
    setPcts(prev => ({ ...prev, [invId]: value }));

  }
  function setAmhName(invId, value) {
    setAmhNames(prev => ({ ...prev, [invId]: value }));
  }
  function handleConfirm() {
    const missingName = invoices.some((inv) => !(amhNames[inv.id] || "").trim());
    if (missingName) {
      window.alert("Enter the bidder name in Amharic for every invoice before generating.");
      return;
    }
    const percentagesByInvId = {};
    invoices.forEach(inv => {
      percentagesByInvId[inv.id] = pcts[inv.id] || '0.95';
    });
    const dataToSend = {
      percentagesByInvId,
      auctionRefNumber,
      amhNames,
    };
    onConfirm(dataToSend);
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
              <thead><tr><th>Invoice #</th><th>Bidder</th><th>Bidder (Amharic)</th><th>Fee %</th></tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono">{inv.invoiceNumber}</td>
                    <td>{inv.bidderName}</td>
                    <td>
                      <input
                        type="text"
                        placeholder="የተጫራች ስም"
                        value={amhNames[inv.id] || ''}
                        onChange={(e) => setAmhName(inv.id, e.target.value)}
                        style={{ width: 140, fontSize: 13, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 5 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number" step="0.01" min="0" max="100"
                        value={pcts[inv.id] || '0.95'}
                        onChange={(e) => setPct(inv.id, e.target.value)}
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
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 'bold', fontSize: 12, color: '#666' }}>
              Auction Reference Number (ጨረታ ቁጥር)
            </label>
            <input
              type="text"
              value={auctionRefNumber}
              onChange={(e) => setAuctionRefNumber(e.target.value)}
              placeholder="e.g. EEP/DS/05/2018"
              style={{
                width: '100%',
                padding: '8px',
                marginTop: '4px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: 13,
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-brass" onClick={handleConfirm}>Generate {invoices.length} PDF{multiple ? "s" : ""}</button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>  
      </div>
    </div>
  );
}