import { actionDefsFor } from "../data";

export function ActionBtn({ label, roles, role, onClick, disabled }) {
  const allowed = roles.includes(role);
  return (
    <button 
      onClick={onClick} 
      disabled={disabled || !allowed}
      className={"btn btn-sm" + (allowed ? "" : " locked")}
    >
      {label}
    </button>
  );
}

export function ActionRow({ inv, role }) {
  return (
    <div className="row-actions">
      {actionDefsFor(inv).map((b, i) => (
        <ActionBtn key={i} label={b.label} roles={b.roles} role={role} onClick={b.onClick} />
      ))}
    </div>
  );
}