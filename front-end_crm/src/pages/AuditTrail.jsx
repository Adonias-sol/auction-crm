import { auditLog } from "../data";

export default function AuditTrail() {
  return (
    <div className="tbl-wrap">
      <div style={{ overflowX: "auto" }}>
      <table>
        <thead><tr><th>Date</th><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Previous value</th><th>New value</th><th>Reason</th><th>IP address</th></tr></thead>
        <tbody>
          {auditLog.map((l, i) => (
            <tr key={i}>
              <td className="mono">{l.d}</td><td className="mono">{l.t}</td><td>{l.u}</td><td>{l.r}</td>
              <td>{l.a}</td><td>{l.pv}</td><td>{l.nv}</td><td>{l.rs}</td><td className="mono">{l.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}