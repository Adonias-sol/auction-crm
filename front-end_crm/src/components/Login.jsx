// Renamed from her original marker comment "components/Sidebar.jsx" — this
// file is a login screen, not a sidebar (this app has no sidebar at all,
// it's a top navbar). Split Header out into its own file below too.
import { useState } from "react";
import { demoAccounts } from "../data";
import logo from "../logo";
import { API_BASE } from "../api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  async function attemptLogin() {
  setError("");
  
  if (!username.trim() || !password) {
    setError("Username and password required.");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      setError(errorData.non_field_errors?.[0] || "Login failed");
      return;
    }

    const data = await response.json();
    sessionStorage.setItem('authToken', data.token); 
    onLogin(data.role, data.username, data.token, remember);
  } catch (err) {
    setError("Network error. Please try again.");
  }
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