import { useState } from "react";
import { ActionBtn } from "../components/ActionButton";
import { apiCall } from "../api";

const reportDefs = [
  { id: "outstanding", title: "Outstanding processing fees", desc: "All unpaid or overdue invoices, current as of today", endpoint: "/api/reports/outstanding/" },
  { id: "daily", title: "Daily collections", desc: "Payments verified in the last 24 hours", endpoint: "/api/reports/daily-collections/" },
  { id: "monthly", title: "Monthly collections", desc: "Payments verified this calendar month", endpoint: "/api/reports/monthly-collections/" },
  { id: "verification", title: "Payment verification report", desc: "Verification history with reviewer and timestamp", endpoint: "/api/reports/verification/" },
  { id: "overdue", title: "Overdue payments report", desc: "Invoices past due date, grouped by age", endpoint: "/api/reports/overdue/" },
  { id: "by-auction", title: "Revenue by auction", desc: "Total fees collected per auction event", endpoint: "/api/reports/by-auction/" },
  { id: "by-client", title: "Revenue by client", desc: "Total fees collected per client account", endpoint: "/api/reports/by-client/" },
];

export default function Reports({ role, token }) {
  const [generating, setGenerating] = useState(null);

  async function generateReport(reportId, endpoint) {
    setGenerating(reportId);
    try {
      const response = await apiCall(endpoint, {
        method: 'GET',
        headers: token ? { Authorization: `Token ${token}` } : {},
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportId}-report.csv`;
        a.click();
      }
    } catch (err) {
      console.error('Report generation failed', err);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {reportDefs.map(({ id, title, desc, endpoint }) => (
        <div className="tbl-wrap" key={id}>
          <div className="report-card">
            <div>
              <div className="rt">{title}</div>
              <div className="rd">{desc}</div>
            </div>
            <ActionBtn 
              label={generating === id ? "Generating..." : "Generate"} 
              roles={["administrator", "auction_manager", "finance_manager"]} 
              role={role}
              onClick={() => generateReport(id, endpoint)}
              disabled={generating === id}
            />
          </div>
        </div>
      ))}
    </div>
  );
}