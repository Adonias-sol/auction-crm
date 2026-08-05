import { useState } from "react";

export default function AccountSettingsModal({ username, onSave, onClose }) {
  const [name, setName] = useState(username);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (newPassword && newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    if (!name.trim()) { setError("Name can't be empty."); return; }
    setError("");
    onSave(name.trim());
    setSaved(true);
    setTimeout(onClose, 900);
  }

  return (
    <div className="overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-head">
          <h2 style={{ margin: 0 }}>Edit profile</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <label className="login-label">Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 14 }} />
          <label className="login-label">New password <span style={{ color: "var(--text-3)", textTransform: "none" }}>(leave blank to keep current)</span></label>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" style={{ marginBottom: 14 }} />
          <label className="login-label">Confirm new password</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" style={{ marginBottom: 14 }} />
          {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
          {saved && <div className="login-success" style={{ marginBottom: 12 }}>Saved.</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-brass" onClick={handleSave}>Save changes</button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}