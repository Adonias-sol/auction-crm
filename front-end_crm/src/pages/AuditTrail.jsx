import { useState, useEffect } from "react";
import { apiCall } from "../api";

export default function AuditTrail({ token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuditLogs();
  }, [token]);

  async function fetchAuditLogs() {
    try {
      const response = await apiCall('/api/audit-logs/', {
        method: 'GET',
        headers: token ? { Authorization: `Token ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.results || data);
      } else {
        setError('Failed to load audit logs');
      }
    } catch (err) {
      setError('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading audit trail...</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>;

  return (
    <div className="tbl-wrap">
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Previous value</th><th>New value</th><th>Reason</th></tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={8} style={{ color: "var(--text-3)", textAlign: "center", padding: 24 }}>No audit logs yet</td></tr>}
            {logs.map((l) => {
              const actionDate = new Date(l.actionDate);
              return (
                <tr key={l.id}>
                  <td className="mono">{actionDate.toLocaleDateString()}</td>
                  <td className="mono">{actionDate.toLocaleTimeString()}</td>
                  <td>{l.performedBy}</td>
                  <td>{l.userRole}</td>
                  <td>{l.action}</td>
                  <td>{l.previousValue || '—'}</td>
                  <td>{l.newValue || '—'}</td>
                  <td>{l.reason || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}