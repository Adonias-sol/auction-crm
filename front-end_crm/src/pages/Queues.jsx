import { useState, useEffect } from "react";
import { money } from "../data";
import Stamp from "../components/Stamp";
import { apiCall } from "../api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const queueDefs = [
  { key: "pending", label: "Pending processing fee payments", filter: (inv) => inv.status === "invoice_generated" || inv.status === "pending_payment" },
  { key: "verify", label: "Payment verification queue", filter: (inv) => inv.status === "payment_submitted" || inv.status === "under_verification" },
  { key: "overdue", label: "Overdue payments", filter: (inv) => inv.status === "overdue" },
  { key: "missing", label: "Receipt missing", filter: (inv) => inv.status === "invoice_generated" && inv.dueDate < todayISO() },
  { key: "recent", label: "Recently paid", filter: (inv) => inv.status === "paid" },
];

function QueueCard({ inv }) {
  return (
    <div className="card" style={{ marginBottom: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span className="mono" style={{ fontWeight: 600 }}>{inv.invoiceNumber}</span>
            <Stamp status={inv.status} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{inv.bidderName}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
            {inv.companyName || <span style={{ color: "var(--text-3)" }}>No company on file</span>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="amount" style={{ fontSize: 15 }}>{money(inv.totalAmount.toFixed(2))}</div>
          <div className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
            Due {new Date(inv.dueDate).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12.5 }}>
        <span style={{ color: "var(--text-3)", marginRight: 6 }}>Call center note:</span>
        <span style={{ color: inv.callNotes ? "var(--text)" : "var(--text-3)", fontStyle: inv.callNotes ? "normal" : "italic" }}>
          {inv.callNotes || "No notes yet"}
        </span>
      </div>
    </div>
  );
}

export default function Queues({ role, token }) {
  const [invoices, setInvoices] = useState([]);
  const [active, setActive] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canView = role === "administrator" || role === "auction_manager" || role === "finance_manager";

  useEffect(() => {
    if (canView) fetchInvoices();
    else setLoading(false);
  }, [token]);

  async function fetchInvoices() {
    try {
      const response = await apiCall('/api/invoices/', {
        method: 'GET',
        headers: token ? { Authorization: `Token ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.results || data);
      } else {
        setError('Failed to load invoices');
      }
    } catch (err) {
      setError('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return (
      <div className="card">
        <h3 style={{ margin: "0 0 6px" }}>Operational queues</h3>
        <div className="locked-note">You don't have permission to view operational queues.</div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 20 }}>Loading queues...</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>;

  const activeDef = queueDefs.find((q) => q.key === active);
  const rows = invoices
    .filter(activeDef.filter)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return (
    <div>
      <div className="queue-tabs">
        {queueDefs.map((q) => {
          const count = invoices.filter(q.filter).length;
          return (
            <div key={q.key} className={"queue-tab" + (active === q.key ? " active" : "")} onClick={() => setActive(q.key)}>
              {q.label}<span className="count">{count}</span>
            </div>
          );
        })}
      </div>
      {active === "missing" && <div className="queue-note">Invoices still in "Invoice Generated" status past their due date — no receipt was ever submitted.</div>}

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--text-3)", padding: 28 }}>
          Nothing in this queue right now
        </div>
      ) : (
        <div>
          {rows.map((inv) => <QueueCard key={inv.id} inv={inv} />)}
        </div>
      )}
    </div>
  );
}
