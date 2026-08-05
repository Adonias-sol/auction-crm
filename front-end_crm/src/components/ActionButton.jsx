// Presentational only now — actionDefsFor() (the permission logic that
// decides WHICH buttons appear) moved to data.js, alongside canChangeStatus,
// since both are business-rule functions, not UI.
import { actionDefsFor } from "../data";

export function ActionBtn({ label, roles, role, onClick }) {
  const allowed = roles.includes(role);
  return (
    <button onClick={onClick} className={"btn btn-sm" + (allowed ? "" : " locked")}>
      {label}
    </button>
  );
}

export function ActionRow({ inv, role }) {
  return (
    <div className="row-actions">
      {actionDefsFor(inv).map((b, i) => (
        <ActionBtn key={i} label={b.label} roles={b.roles} role={role} />
      ))}
    </div>
  );
}