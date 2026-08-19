import { useState, useEffect } from "react";
import { apiCall } from "../api";

const DEFAULT_BANK_ACCOUNT = "1000547266289";
const DEFAULT_ADDRESS = "ቦሌ አትላስ ከአውሮፓ ዩኒየን ዝቅ ብሎ ከለላ ህንጻ 3ኛ ፎቅ ቢሮ ቁጥር 301";

function joinAmharicList(items) {
  items = items.map(String);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} እና ${items[1]}`;
  return items.slice(0, -1).join(", ") + ` እና ${items[items.length - 1]}`;
}

function fmt(n) {
  const num = parseFloat(n);
  return (isNaN(num) ? 0 : num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildParagraph1({ auctionName, auctionRefNumber, lotNumbers, totalAmount, amountWords, pct, feeAmount, feeWords }) {
  const amountWordsPart = amountWords ? ` (${amountWords})` : "";
  const feeWordsPart = feeWords ? ` (${feeWords})` : "";
  return `${auctionName} ለኩባንያው አገልግሎት የማያሰጡ የተለያዩ ዕቃዎችን በጨረታ አወዳድሮ ለመሸጥ ባወጣው የጨረታ ቁጥር ${auctionRefNumber} ተሳትፈው በሎት ቁጥር ${lotNumbers} የተጠቀሱትን ለመግዛት ባቀረቡት ጠቅላላ ዋጋ ቫትን ጨምሮ ብር ${fmt(totalAmount)}${amountWordsPart} ሲሆን የንብረቶቹን ርክክብ መመሪያ ተመልክተው ከተረከቡ በኋላ ከአሸነፉበት ዋጋ ላይ የሚታሰብ ${pct}% (processing fee) ${fmt(feeAmount)}${feeWordsPart} ለአክሽን ኢትዮጵያ የሚከፍሉ ይሆናል፡፡`;
}

function buildParagraph2({ bankAccount, officeAddress }) {
  return `ስለሆነም በኢትዮጵያ ንግድ ባንክ የሂሳብ ቁጥር ${bankAccount || DEFAULT_BANK_ACCOUNT} ገቢ በማድረግ ${officeAddress || DEFAULT_ADDRESS} በአካል በመገኘት ደረሰኝ እንዲያስገቡ እንጠይቃለን፡፡`;
}

function SingleInvoiceForm({ invoice, onConfirm, onClose }) {
  const [pct, setPct] = useState(String(invoice.lots?.[0]?.feePercentage ?? "0.95"));
  const [amhName, setAmhName] = useState(invoice.bidderNameAmharic || "");
  const [amountWords, setAmountWords] = useState("");
  const [feeWords, setFeeWords] = useState("");
  const [auctionRefNumber, setAuctionRefNumber] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const computedTotal = (invoice.lots || []).reduce((s, l) => s + parseFloat(l.winningAmount), 0);
  const [totalAmount, setTotalAmount] = useState(computedTotal.toFixed(2));
  const [feeAmount, setFeeAmount] = useState((computedTotal * (parseFloat(pct) || 0) / 100).toFixed(2));
  const [bankAccount, setBankAccount] = useState(DEFAULT_BANK_ACCOUNT);

  // Fee amount auto-recalculates from total/pct — but only while the user
  // hasn't manually typed into the Fee amount field themselves.
  const [feeTouched, setFeeTouched] = useState(false);
  useEffect(() => {
    if (!feeTouched) {
      setFeeAmount((parseFloat(totalAmount || 0) * (parseFloat(pct) || 0) / 100).toFixed(2));
    }
  }, [totalAmount, pct, feeTouched]);

  const auctionName = invoice.lots?.[0]?.auctionName || "";
  const lotNumbers = joinAmharicList((invoice.lots || []).map((l) => l.lotNumber));

  const [paragraph1, setParagraph1] = useState("");
  const [paragraph2, setParagraph2] = useState("");
  const [p1Touched, setP1Touched] = useState(false);
  const [p2Touched, setP2Touched] = useState(false);

  useEffect(() => {
    if (!p1Touched) {
      setParagraph1(buildParagraph1({ auctionName, auctionRefNumber, lotNumbers, totalAmount, amountWords, pct, feeAmount, feeWords }));
    }
  }, [auctionName, auctionRefNumber, lotNumbers, totalAmount, amountWords, pct, feeAmount, feeWords, p1Touched]);

  useEffect(() => {
    if (!p2Touched) {
      setParagraph2(buildParagraph2({ bankAccount, officeAddress }));
    }
  }, [bankAccount, officeAddress, p2Touched]);

  useEffect(() => {
    apiCall('/api/office-settings/')
      .then((r) => r.json())
      .then((d) => setOfficeAddress(d.address || ""))
      .catch(() => {});
  }, []);

  async function saveAddress() {
    setSavingAddress(true);
    try {
      const res = await apiCall('/api/office-settings/', { method: 'PUT', body: JSON.stringify({ address: officeAddress }) });
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
      totalAmountByInv: { [invoice.id]: totalAmount },
      feeAmountByInv: { [invoice.id]: feeAmount },
      bankAccountByInv: { [invoice.id]: bankAccount },
      paragraph1ByInv: { [invoice.id]: paragraph1 },
      paragraph2ByInv: { [invoice.id]: paragraph2 },
    });
    onClose();
  }

  return (
    <>
      <div className="tbl-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Lot #</th><th>Auction</th><th>Amount</th></tr></thead>
          <tbody>
            {(invoice.lots || []).length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text-3)" }}>No lots on this invoice</td></tr>
            ) : invoice.lots.map((l) => (
              <tr key={l.id}>
                <td className="mono">{l.lotNumber}</td>
                <td>{l.auctionName}</td>
                <td className="amount">ETB {fmt(l.winningAmount)}</td>
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
          <div className="fl">Total amount (editable)</div>
          <input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
        </div>

        <div className="field">
          <div className="fl">Amount in words (Amharic) — optional</div>
          <input type="text" value={amountWords} onChange={(e) => setAmountWords(e.target.value)} maxLength={500} />
        </div>
        <div className="field">
          <div className="fl">Fee amount (editable)</div>
          <input type="number" step="0.01" value={feeAmount} onChange={(e) => { setFeeAmount(e.target.value); setFeeTouched(true); }} />
        </div>

        <div className="field">
          <div className="fl">Fee in words (Amharic) — optional</div>
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
        <div className="fl">Bank account (editable)</div>
        <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} style={{ maxWidth: 240 }} />
      </div>

      {showPreview && (
        <div className="card" style={{ marginTop: 16, background: "var(--paper)" }}>
          <div className="section-label" style={{ marginTop: 0 }}>Preview — edit directly if needed</div>

          <div style={{ marginBottom: 4, fontSize: 13.5 }}>ለ {amhName || "—"}</div>

          <textarea
            value={paragraph1}
            onChange={(e) => { setParagraph1(e.target.value); setP1Touched(true); }}
            rows={6}
            style={{ width: "100%", fontFamily: "'Noto Sans Ethiopic', 'Inter'", fontSize: 14, lineHeight: 1.8, padding: 10, border: "1px solid var(--border)", borderRadius: 6, marginBottom: 6 }}
          />
          {p1Touched && (
            <button className="btn btn-sm btn-ghost" style={{ marginBottom: 10 }} onClick={() => setP1Touched(false)}>
              Reset to auto-generated text
            </button>
          )}

          <textarea
            value={paragraph2}
            onChange={(e) => { setParagraph2(e.target.value); setP2Touched(true); }}
            rows={4}
            style={{ width: "100%", fontFamily: "'Noto Sans Ethiopic', 'Inter'", fontSize: 14, lineHeight: 1.8, padding: 10, border: "1px solid var(--border)", borderRadius: 6, marginBottom: 6 }}
          />
          {p2Touched && (
            <button className="btn btn-sm btn-ghost" onClick={() => setP2Touched(false)}>
              Reset to auto-generated text
            </button>
          )}
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