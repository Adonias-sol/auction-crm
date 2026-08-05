// Renamed from her original marker comment "components/Sidebar.jsx" — this
// file is a login screen, not a sidebar (this app has no sidebar at all,
// it's a top navbar). Split Header out into its own file below too.
import { useState } from "react";
import { demoAccounts } from "../data";
import logo from "../logo";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  function attemptLogin() {
    const match = demoAccounts.find((a) => a.username === username.trim().toLowerCase() && a.password === password);
    if (!match) { setError("Incorrect username or password."); return; }
    setError("");
    // TODO: this is still the hardcoded demo check. Replace with a real
    // POST /api/auth/login/ call once that backend endpoint exists.
    onLogin(match.role, match.username, remember);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") attemptLogin();
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src={logo} alt="Auction Ethiopia S.C." style={{ maxWidth: 240, width: "100%", height: "auto", objectFit: "contain", display: "block", margin: "0 auto 20px" }} />
        <h2 style={{ margin: "0 0 4px", textAlign: "center" }}>Sign in</h2>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", textAlign: "center", marginBottom: 22 }}>Processing Fee Management</div>

        <label className="login-label">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. admin"
          autoFocus
        />
        <label className="login-label" style={{ marginTop: 12 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
        />

        <label className="remember-row">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me on this device
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={attemptLogin}>Sign in</button>
      </div>
    </div>
  );
}