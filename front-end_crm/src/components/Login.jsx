import { useState } from "react";
import { demoAccounts } from "../data";
import logo from "../logo";
import { API_BASE } from "../api";

function EyeToggleButton({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Hide password" : "Show password"}
      style={{
        position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
        background: "none", border: "none", cursor: "pointer", color: "var(--text-3)",
        display: "flex", alignItems: "center", padding: 4,
      }}
    >
      {show ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.4 18.4 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      if (remember) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authUser', JSON.stringify({ username: data.username, role: data.role }));
      }
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
        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your password"
            style={{ paddingRight: 36 }}
          />
          <EyeToggleButton show={showPassword} onToggle={() => setShowPassword((s) => !s)} />
        </div>

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