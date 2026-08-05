import { useState } from "react";
import { roleLabels } from "../data";

export default function ProfileMenu({ username, role, theme, setTheme, onLogout, onOpenAccountSettings }) {
  const [open, setOpen] = useState(false);
  const initial = (username || "?").charAt(0).toUpperCase();

  return (
    <div style={{ position: "relative" }}>
      <button className="avatar-btn" onClick={() => setOpen((v) => !v)} aria-label="Account menu" title={`${username} \u00b7 ${roleLabels[role]}`}>
        {initial}
      </button>
      {open && (
        <>
          <div className="profile-scrim" onClick={() => setOpen(false)} />
          <div className="profile-menu">
            <div className="profile-menu-head">
              <div className="avatar-btn avatar-btn-lg">{initial}</div>
              <div>
                <div className="profile-menu-name">{username}</div>
                <div className="profile-menu-role">{roleLabels[role]}</div>
              </div>
            </div>

            <div className="profile-menu-section">
              <div className="profile-menu-label">Appearance</div>
              <button
                className="theme-toggle-icon"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              >
                {theme === "light" ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
                <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
              </button>
            </div>

            <button className="profile-menu-item" onClick={() => { setOpen(false); onOpenAccountSettings(); }}>Edit profile</button>
            <button className="profile-menu-item" onClick={onLogout}>Log out</button>
          </div>
        </>
      )}
    </div>
  );
}