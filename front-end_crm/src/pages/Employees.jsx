import { useState, useEffect } from "react";
import { apiCall } from "../api";

function groupByCategory(catalog) {
  const groups = {};
  catalog.forEach((p) => {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  });
  return groups;
}

function PrivilegeGrid({ catalog, selected, onToggle }) {
  const grouped = groupByCategory(catalog);
  return (
    <div>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ margin: "12px 0 8px" }}>{category}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((p) => (
              <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selected.includes(p.key)}
                  onChange={() => onToggle(p.key)}
                  style={{ width: 15, height: 15, accentColor: "var(--brass)", flexShrink: 0 }}
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NewEmployeeModal({ catalog, roles, onClose, onCreated, token }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id || "");
  const [privileges, setPrivileges] = useState(roles[0]?.defaultPrivileges || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleRoleChange(newRoleId) {
    setRoleId(newRoleId);
    const role = roles.find((r) => String(r.id) === String(newRoleId));
    setPrivileges(role ? [...role.defaultPrivileges] : []);
  }

  function togglePrivilege(key) {
    setPrivileges((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  async function handleCreate() {
    setError("");
    if (!fullName.trim() || !username.trim() || !password || !roleId) {
      setError("Full name, username, password, and role are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiCall('/api/employees/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          password,
          roleId,
          privileges,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create employee");
        return;
      }
      onCreated();
      onClose();
    } catch (err) {
      setError("Network error creating employee");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay active">
      <div className="modal">
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>New employee</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="field-grid">
            <div className="field">
              <div className="fl">Full name</div>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="field">
              <div className="fl">Username</div>
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="field">
              <div className="fl">Temporary password</div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <div className="fl">Role (template)</div>
              <select value={roleId} onChange={(e) => handleRoleChange(e.target.value)}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic", marginBottom: 4 }}>
            Role sets the starting privileges below — fine-tune any of them for this specific employee.
          </div>

          <PrivilegeGrid catalog={catalog} selected={privileges} onToggle={togglePrivilege} />

          {error && <div style={{ color: "var(--red)", marginBottom: 10, fontSize: 13 }}>{error}</div>}
          <div className="modal-actions">
            <button className="btn btn-brass" onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create account"}
            </button>
            <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewRoleModal({ catalog, onClose, onCreated, token }) {
  const [name, setName] = useState("");
  const [privileges, setPrivileges] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function togglePrivilege(key) {
    setPrivileges((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  async function handleCreate() {
    setError("");
    if (!name.trim()) {
      setError("Role name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiCall('/api/roles/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
        body: JSON.stringify({ name: name.trim(), defaultPrivileges: privileges }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create role");
        return;
      }
      onCreated();
      onClose();
    } catch (err) {
      setError("Network error creating role");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay active">
      <div className="modal">
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>New role / department</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="field" style={{ marginBottom: 18 }}>
            <div className="fl">Role name</div>
            <input placeholder="e.g. Auction Doctor" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="section-label" style={{ margin: "0 0 8px" }}>Default privileges for this role</div>
          <PrivilegeGrid catalog={catalog} selected={privileges} onToggle={togglePrivilege} />

          {error && <div style={{ color: "var(--red)", marginBottom: 10, fontSize: 13 }}>{error}</div>}
          <div className="modal-actions">
            <button className="btn btn-brass" onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create role"}
            </button>
            <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditPrivilegesModal({ employee, catalog, onClose, onSaved, token }) {
  const [privileges, setPrivileges] = useState(employee.privileges || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function togglePrivilege(key) {
    setPrivileges((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await apiCall(`/api/employees/${employee.id}/privileges/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
        body: JSON.stringify({ privileges }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save privileges");
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError("Network error saving privileges");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay active">
      <div className="modal">
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>Edit privileges — {employee.name}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <PrivilegeGrid catalog={catalog} selected={privileges} onToggle={togglePrivilege} />
          {error && <div style={{ color: "var(--red)", marginBottom: 10, fontSize: 13 }}>{error}</div>}
          <div className="modal-actions">
            <button className="btn btn-brass" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save privileges"}
            </button>
            <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Employees({ role, token }) {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const canManage = role === "administrator";

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    setError("");
    try {
      const [empRes, roleRes, catRes] = await Promise.all([
        apiCall('/api/employees/', { headers: token ? { Authorization: `Token ${token}` } : {} }),
        apiCall('/api/roles/', { headers: token ? { Authorization: `Token ${token}` } : {} }),
        apiCall('/api/privileges/', { headers: token ? { Authorization: `Token ${token}` } : {} }),
      ]);
      const [empData, roleData, catData] = await Promise.all([empRes.json(), roleRes.json(), catRes.json()]);
      if (!empRes.ok || !roleRes.ok || !catRes.ok) {
        setError("Failed to load employees/roles data");
        return;
      }
      setEmployees(empData);
      setRoles(roleData);
      setCatalog(catData);
    } catch (err) {
      setError("Network error loading employees/roles");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(emp) {
    if (!window.confirm(`${emp.isActive ? "Deactivate" : "Reactivate"} ${emp.name}?`)) return;
    try {
      const res = await apiCall(`/api/employees/${emp.id}/deactivate/`, {
        method: 'POST',
        headers: token ? { Authorization: `Token ${token}` } : {},
      });
      if (!res.ok) {
        setError("Failed to update employee status");
        return;
      }
      await fetchAll();
    } catch (err) {
      setError("Network error updating employee status");
      console.error(err);
    }
  }

  if (!canManage) {
    return (
      <div className="card">
        <h3 style={{ margin: "0 0 6px" }}>Employees & roles</h3>
        <div className="locked-note">Only Administrators can manage employee accounts and privileges.</div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
        <button className="btn btn-brass" onClick={() => setShowNewEmployee(true)}>New employee</button>
        <button className="btn btn-primary" onClick={() => setShowNewRole(true)}>New role</button>
      </div>

      {error && <div style={{ color: "var(--red)", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div className="tbl-wrap">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last password change</th>
                <th>Last username change</th>
                <th>Privileges</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.name}</td>
                  <td className="mono">{emp.username}</td>
                  <td>{emp.roleName}</td>
                  <td><span className={`stamp ${emp.isActive ? "paid" : "cancelled"}`}>{emp.isActive ? "Active" : "Inactive"}</span></td>
                  <td>{emp.lastPasswordChange ? new Date(emp.lastPasswordChange).toLocaleDateString() : "—"}</td>
                  <td>{emp.lastUsernameChange ? new Date(emp.lastUsernameChange).toLocaleDateString() : "—"}</td>
                  <td className="mono">{emp.privilegeCount}</td>
                  <td className="row-actions">
                    <button className="btn btn-sm" onClick={() => setEditingEmployee(emp)}>Edit privileges</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(emp)}>
                      {emp.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 12px" }}>Roles</h3>
        <div className="tbl-wrap">
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Default privileges</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="mono">{r.privilegeCount}/{catalog.length} default privileges</td>
                    <td style={{ color: "var(--text-3)" }}>{r.isBuiltIn ? "Built-in" : "Custom"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showNewEmployee && (
        <NewEmployeeModal
          catalog={catalog}
          roles={roles}
          token={token}
          onClose={() => setShowNewEmployee(false)}
          onCreated={fetchAll}
        />
      )}
      {showNewRole && (
        <NewRoleModal
          catalog={catalog}
          token={token}
          onClose={() => setShowNewRole(false)}
          onCreated={fetchAll}
        />
      )}
      {editingEmployee && (
        <EditPrivilegesModal
          employee={editingEmployee}
          catalog={catalog}
          token={token}
          onClose={() => setEditingEmployee(null)}
          onSaved={fetchAll}
        />
      )}
    </div>
  );
}