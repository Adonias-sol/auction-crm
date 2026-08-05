import { useState } from "react";
import { batches, money } from "../data";

export default function ImportBatches({ role }) {
  const canImport = role === "administrator" || role === "auction_manager";
  const [company, setCompany] = useState("");
  const [date, setDate] = useState("");
  const [batchName, setBatchName] = useState("");
  const [preview, setPreview] = useState(null);

  function runPreview() {
    if (!company || !date) { window.alert("Company name and auction date are required."); return; }
    // TODO: replace with POST /api/import-batches/preview/ (multipart file
    // + companyName + auctionDate). This sample data mirrors that response shape.
    setPreview({
      summary: `3 winners \u00b7 6 lots found in bid_data_report.xlsx for ${company}, ${date}`,
      rows: [
        { bidderName: "H. Girma", winnerPhone: "251911223344", lots: 2, totalFee: "362.90", feePercentage: "0.95" },
        { bidderName: "M. Tesfaye", winnerPhone: "251922334455", lots: 1, totalFee: "122.55", feePercentage: "0.95" },
        { bidderName: "A. Bekele", winnerPhone: "251933445566", lots: 3, totalFee: "596.60", feePercentage: "0.95" },
      ],
    });
  }
  function confirmImport() {
    // TODO: replace with POST /api/import-batches/confirm/
    window.alert("3 invoices created and added to the batch list below.");
    setPreview(null);
  }

  return (
    <div>
      <div className={"card section" + (canImport ? "" : " locked")} style={{ marginBottom: 18 }}>
        <h3 style={{ margin: "0 0 4px" }}>New import batch</h3>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 16 }}>
          Upload a bid data report to generate invoices. Only one file is required \u2014 bidder company names are left blank and can be added manually afterward.
        </div>
        <div className="upload-form">
          <div className="full">
            <label>Bid data report <span className="req">*</span> \u2014 .xlsx only</label>
            <div className="filedrop">bid_data_report.xlsx \u2014 drag file here or click to browse</div>
          </div>
          <div><label>Company name <span className="req">*</span></label><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Ethio Telecom" /></div>
          <div><label>Auction date <span className="req">*</span></label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="full"><label>Batch name <span className="opt">(optional)</span></label><input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="e.g. Ethio Telecom Q4 2026" /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={runPreview}>Preview import</button>
        </div>
      </div>
      {!canImport && <div className="locked-note" style={{ marginTop: -10, marginBottom: 18 }}>Only Administrators and Auction Managers can start a new import. You can still review past batches below.</div>}

      {preview && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 4px" }}>Preview \u2014 nothing saved yet</h3>
          <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 14 }}>{preview.summary}</div>
          <div className="tbl-wrap" style={{ marginBottom: 14 }}>
            <table>
              <thead><tr><th>Bidder</th><th>Phone</th><th>Lots</th><th>Total fee</th><th>Fee %</th></tr></thead>
              <tbody>
                {preview.rows.map((w, i) => (
                  <tr key={i}>
                    <td>{w.bidderName}</td><td className="mono">{w.winnerPhone}</td><td className="mono">{w.lots}</td>
                    <td className="amount">{money(w.totalFee)}</td><td className="mono">{w.feePercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="locked-note" style={{ marginBottom: 14 }}>Fee % is editable per winner before confirming \u2014 click a row to adjust.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-brass" onClick={confirmImport}>Confirm &amp; create invoices</button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>Discard preview</button>
          </div>
        </div>
      )}

      <div className="tbl-wrap">
        <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Batch</th><th>Company</th><th>Auction date</th><th>Uploaded</th><th>Records</th><th>Status</th><th>Imported by</th></tr></thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{b.batchName || <span style={{ color: "var(--text-3)" }}>\u2014</span>}<div style={{ fontSize: 11, color: "var(--text-3)" }} className="mono">{b.fileName}</div></td>
                <td>{b.companyName}</td>
                <td className="mono">{b.auctionDate}</td>
                <td className="mono">{b.uploadDate}</td>
                <td className="mono">{b.validRecords}/{b.totalRecords}</td>
                <td><span className="stamp paid" style={{ transform: "none" }}>{b.status}</span></td>
                <td>{b.importedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}