import { useState, useEffect } from "react";
import { apiCall } from "../api";

const REPORT_TYPE_OPTIONS = [
  { v: "outstanding", l: "Outstanding processing fees" },
  { v: "overdue", l: "Overdue payments report" },
  { v: "daily", l: "Daily collections" },
  { v: "monthly", l: "Monthly collections" },
  { v: "verification", l: "Payment verification report" },
  { v: "by-auction", l: "Revenue by auction" },
  { v: "by-client", l: "Revenue by client" },
];

const PERIOD_OPTIONS = [
  { v: "today", l: "Today" },
  { v: "week", l: "This week" },
  { v: "month", l: "This month" },
  { v: "year", l: "This year" },
];

export default function Reports({ role, token }) {
  const [filters, setFilters] = useState({
    reportType: "outstanding", period: "month",
    clientCompany: "", importBatch: "", auction: "", dateFrom: "", dateTo: "",
  });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState([]);

  useEffect(() => { fetchRecent(); }, []);

  async function fetchRecent() {
    try {
      const res = await apiCall('/api/reports/recent/', {
        headers: token ? { Authorization: `Token ${token}` } : {},
      });
      if (res.ok) setRecent(await res.json());
    } catch (err) {
      console.error('Failed to load recent reports', err);
    }
  }

  function setF(k, v) {
    setFilters((p) => ({ ...p, [k]: v }));
  }

  function buildBody() {
    // Only send filters that are actually set — empty strings would
    // otherwise override the backend's own defaults for no reason.
    const body = { reportType: filters.reportType, period: filters.period };
    ['clientCompany', 'importBatch', 'auction', 'dateFrom', 'dateTo'].forEach((k) => {
      if (filters[k]) body[k] = filters[k];
    });
    return body;
  }

  async function runPreview() {
    setLoading(true);
    setError("");
    try {
      const res = await apiCall('/api/reports/preview/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to run report');
        setPreview(null);
        return;
      }
      setPreview(data);
    } catch (err) {
      setError('Network error running report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function generatePdf() {
    setError("");
    try {
      const res = await fetch(`https://auction-crm-api.onrender.com/api/reports/generate-pdf/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(buildBody()),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to generate PDF');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filters.reportType}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      await fetchRecent();
    } catch (err) {
      setError('Network error generating PDF');
      console.error(err);
    }
  }

  if (role !== "administrator") {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 6px" }}>Custom reports</h3>
        <div className="locked-note">Only Administrators can build and generate custom reports.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h3 style={{ margin: "0 0 4px" }}>Build a custom report</h3>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 16 }}>
          Choose a report type and narrow it to a specific period, client, batch, or auction. Preview on screen, then generate a PDF.
        </div>
        <div className="field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div className="field">
            <div className="fl">Report type</div>
            <select value={filters.reportType} onChange={(e) => setF("reportType", e.target.value)}>
              {REPORT_TYPE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="field">
            <div className="fl">Period (ignored by outstanding/overdue unless you set dates below)</div>
            <select value={filters.period} onChange={(e) => setF("period", e.target.value)}>
              {PERIOD_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="field">
            <div className="fl">Client / company <span className="opt">(optional)</span></div>
            <input value={filters.clientCompany} onChange={(e) => setF("clientCompany", e.target.value)} />
          </div>
          <div className="field">
            <div className="fl">Import batch ID <span className="opt">(optional)</span></div>
            <input value={filters.importBatch} onChange={(e) => setF("importBatch", e.target.value)} />
          </div>
          <div className="field">
            <div className="fl">Auction name contains <span className="opt">(optional)</span></div>
            <input value={filters.auction} onChange={(e) => setF("auction", e.target.value)} />
          </div>
          <div className="field">
            <div className="fl">Date from <span className="opt">(optional)</span></div>
            <input type="date" value={filters.dateFrom} onChange={(e) => setF("dateFrom", e.target.value)} />
          </div>
          <div className="field">
            <div className="fl">Date to <span className="opt">(optional)</span></div>
            <input type="date" value={filters.dateTo} onChange={(e) => setF("dateTo", e.target.value)} />
          </div>
        </div>
        <button className="btn btn-brass" onClick={runPreview} disabled={loading}>
          {loading ? "Loading..." : "Preview report"}
        </button>
        {error && <div style={{ color: "red", marginTop: 10, fontSize: 13 }}>{error}</div>}
      </div>

      {preview && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>{preview.title} — preview</h3>
            <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
              {preview.periodLabel} · {preview.count} record(s) · total ETB {Number(preview.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="tbl-wrap" style={{ marginTop: 12, marginBottom: 14 }}>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>{preview.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.length === 0 ? (
                    <tr><td colSpan={preview.columns.length} style={{ textAlign: "center", color: "var(--text-3)", padding: 20 }}>No matching records</td></tr>
                  ) : preview.rows.map((row, i) => (
                    <tr key={i}>
                      {preview.columns.map((c) => <td key={c.key}>{row[c.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button className="btn btn-brass" onClick={generatePdf}>Generate PDF</button>
        </div>
      )}

      {recent.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 10px" }}>Recently generated</h3>
          <div className="attach-list">
            {recent.map((r) => (
              <div className="attach-item" key={r.id}>
                {r.title} — {r.periodLabel} — {r.rowCount} rows — {new Date(r.generatedAt).toLocaleString()} — {r.generatedBy}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}