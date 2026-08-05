import { useState } from "react";
import { statusLabels, canChangeStatus } from "../data";
import Stamp from "./stamp";

export default function StatusCell({ invoice, role, onChangeStatus }) {
  const [editing, setEditing] = useState(false);
  const editable = canChangeStatus(invoice, role);

  if (editing) {
    return (
      <select
        autoFocus
        className="status-select"
        value={invoice.status}
        onChange={(e) => { onChangeStatus(invoice.inv, e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
      >
        {Object.keys(statusLabels).map((k) => (
          <option key={k} value={k}>{statusLabels[k]}</option>
        ))}
      </select>
    );
  }

  return (
    <span
      onClick={() => editable && setEditing(true)}
      title={editable ? "Click to change status" : "You don't have permission to change this status"}
      style={{ cursor: editable ? "pointer" : "default" }}
    >
      <Stamp status={invoice.status} />
    </span>
  );
}