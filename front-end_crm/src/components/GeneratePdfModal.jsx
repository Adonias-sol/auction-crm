import { useState, useEffect } from "react";
import { apiCall } from "../api";

const BANK_ACCOUNT = "1000547266289"; // matches the account hardcoded in the PDF template

function SingleInvoiceForm({ invoice, onConfirm, onClose }) {
  const [pct, setPct] = useState(String(invoice.lots?.[0]?.feePercentage ?? "0.95"));
  const [amhName, setAmhName] = useState(invoice.bidderNameAmharic || "");
  const [amountWords, setAmountWords] = useState("");
  const [feeWords, setFeeWords] = useState("");
  const [auctionRefNumber, setAuctionRefNumber] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    apiCall('/api/office-settings/')
      .then((r) => r.json())
      .then((d) => setOfficeAddress(d.address || ""))
      .catch(() => {});
  }, []);

  const totalAmount = (invoice.lots || []).reduce((s, l) => s + parseFloat(l.winningAmount), 0);
  const feeAmount = totalAmount * (parseFloat(pct) || 0) / 100;

  async function saveAddress() {
    setSavingAddress(true);
    try {
      const res = await apiCall('/api/office-settings/', {
        method: 'PUT',
        body: JSON.stringify({ address: officeAddress }),
      });
      if (!res.ok) window.alert("Failed to save address.");
    } catch {
      window.alert("Network error saving address.");
    } finally {
      setSavingAddress(false);
    }
  }

  function handleConfirm() {
    if (!amhName.trim()) {
      window.alert("Enter the bidder name in Amharic before generating.");
      return;
    }
    onConfirm({
      percentagesByInvId: { [invoice.id]: pct || "0.95" },
      auctionRefNumber,
      amhNames: { [invoice.id]: amhName },
      amountWordsByInv: { [invoice.id]: amountWords },
      feeWordsByInv: { [invoice.id]: feeWords },
      officeAddress,
    });
    onClose();
}

  return (
    <>
      <div className="tbl-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Lot #</th><th>Auction</th><th>Amount</th></tr></thead>
          <tbody>
            {(invoice.lots || []).map((l) => (
              <tr key={l.id}>
                <td className="mono">{l.lotNumber}</td>
                <td>{l.auctionName}</td>
                <td className="amount">ETB {parseFloat(l.winningAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="field-grid">
        <div className="field">
          <div className="fl">Bidder name (English)</div>
          <div className="fv">{invoice.bidderName}</div>
        </div>
        <div className="field">
          <div className="fl">Bidder name (Amharic) *</div>
          <input type="text" value={amhName} onChange={(e) => setAmhName(e.target.value)} placeholder="የተጫራች ስም" />
        </div>

        <div className="field">
          <div className="fl">Fee %</div>
          <input type="number" step="0.01" min="0" max="100" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <div className="field">
          <div className="fl">Total amount</div>
          <div className="fv mono">ETB {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>

        <div className="field">
          <div className="fl">Amount in words (Amharic)— optional</div>
          <input type="text" value={amountWords} onChange={(e) => setAmountWords(e.target.value)} maxLength={500} />
        </div>
        <div className="field">
          <div className="fl">Fee amount</div>
          <div className="fv mono">ETB {feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>

        <div className="field">
          <div className="fl">Fee in words (Amharic)— optional</div>
          <input type="text" value={feeWords} onChange={(e) => setFeeWords(e.target.value)} maxLength={500} />
        </div>
        <div className="field">
          <div className="fl">Auction Reference Number (ጨረታ ቁጥር)</div>
          <input type="text" value={auctionRefNumber} onChange={(e) => setAuctionRefNumber(e.target.value)} placeholder="e.g. EEP/DS/05/2018" />
        </div>
      </div>

      <div className="section-label">Office address (Amharic) — printed on invoice</div>
      <textarea
        value={officeAddress}
        onChange={(e) => setOfficeAddress(e.target.value)}
        maxLength={500}
        rows={3}
        style={{ width: "100%", fontFamily: "'Inter'", fontSize: 14, padding: 10, border: "1px solid var(--border)", borderRadius: 6 }}
      />
      <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={saveAddress} disabled={savingAddress}>
        {savingAddress ? "Saving..." : "Save address"}
      </button>

      <div className="field" style={{ marginTop: 16 }}>
        <div className="fl">Bank account</div>
        <div className="fv mono">{BANK_ACCOUNT}</div>
      </div>

      {showPreview && (
        <div className="card" style={{ marginTop: 16, background: "var(--paper)" }}>
          <div className="section-label" style={{ marginTop: 0 }}>Preview</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
            <div>ለ {amhName || "—"}</div>
            <div>ጨረታ ቁጥር: {auctionRefNumber || "—"}</div>
            <div>ጠቅላላ ዋጋ: ብር {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{amountWords ? ` (${amountWords})` : ""}</div>
            <div>Processing fee ({pct}%): ብር {feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{feeWords ? ` (${feeWords})` : ""}</div>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{officeAddress}</div>
          </div>
        </div>
      )}

      <div className="locked-note" style={{ marginTop: 14 }}>
        This recalculates the invoice's fee amount and total based on the percentage set here.
        Invoices still in "Invoice Generated" status also move to "Pending Payment"; invoices
        further along keep their current status. The generated PDF uses the Amharic bidder name —
        not the English name.
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn-brass" onClick={handleConfirm}>Generate 1 PDF</button>
        <button className="btn" onClick={() => setShowPreview((s) => !s)}>{showPreview ? "Hide preview" : "Preview"}</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}

function BulkForm({ invoices, onConfirm, onClose }) {
  // unchanged compact table for multi-invoice bulk generation
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

  function setPct(invId, value) { setPcts((p) => ({ ...p, [invId]: value })); }
  function setAmhName(invId, value) { setAmhNames((p) => ({ ...p, [invId]: value })); }

  function handleConfirm() {
    const missingName = invoices.some((inv) => !(amhNames[inv.id] || "").trim());
    if (missingName) {
      window.alert("Enter the bidder name in Amharic for every invoice before generating.");
      return;
    }
    const percentagesByInvId = {};
    invoices.forEach((inv) => { percentagesByInvId[inv.id] = pcts[inv.id] || '0.95'; });
    onConfirm({ percentagesByInvId, auctionRefNumber, amhNames, amountWordsByInv: {}, feeWordsByInv: {}, officeAddress: '' });
    onClose();
  }

  return (
    <>
      <div className="tbl-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Invoice #</th><th>Bidder</th><th>Bidder (Amharic)</th><th>Fee %</th></tr></thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="mono">{inv.invoiceNumber}</td>
                <td>{inv.bidderName}</td>
                <td>
                  <input type="text" placeholder="የተጫራች ስም" value={amhNames[inv.id] || ''} onChange={(e) => setAmhName(inv.id, e.target.value)} style={{ width: 140, fontSize: 13, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 5 }} />
                </td>
                <td>
                  <input type="number" step="0.01" min="0" max="100" value={pcts[inv.id] || '0.95'} onChange={(e) => setPct(inv.id, e.target.value)} style={{ width: 80, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 5 }} /> %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="locked-note" style={{ marginBottom: 14 }}>
        This recalculates each invoice's fee amount and total based on the percentage set here.
        Invoices still in "Invoice Generated" status also move to "Pending Payment"; invoices
        further along keep their current status.
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 'bold', fontSize: 12, color: '#666' }}>Auction Reference Number (ጨረታ ቁጥር)</label>
        <input type="text" value={auctionRefNumber} onChange={(e) => setAuctionRefNumber(e.target.value)} placeholder="e.g. EEP/DS/05/2018" style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-brass" onClick={handleConfirm}>Generate {invoices.length} PDFs</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}

export default function GeneratePdfModal({ invoices, onConfirm, onClose }) {
  const single = invoices.length === 1;
  return (
    <div className="overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-head">
          <div>
            <h2 style={{ margin: 0 }}>Generate invoice PDF{single ? "" : "s"}</h2>
            <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
              Set the processing fee percentage {single ? "and Amharic name for this invoice" : "for each invoice"} before generating.
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {single
            ? <SingleInvoiceForm invoice={invoices[0]} onConfirm={onConfirm} onClose={onClose} />
            : <BulkForm invoices={invoices} onConfirm={onConfirm} onClose={onClose} />
          }
        </div>
      </div>
    </div>
  );
}