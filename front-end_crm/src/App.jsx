import { useState } from "react";
import { invoicesSeed } from "./data";
import "./styles.css";

import Login from "./components/Login";
import Header from "./components/Header";
import InvoiceDetailModal from "./components/InvoiceDetailModal";
import AccountSettingsModal from "./components/AccountSettingsModal";

import Dashboard from "./pages/Dashboard";
import ImportBatches from "./pages/ImportBatches";
import Operations from "./pages/Operations";
import Queues from "./pages/Queues";
import Reports from "./pages/Reports";
import AuditTrail from "./pages/AuditTrail";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [session, setSession] = useState(null); // { role, username } | null
  const [theme, setTheme] = useState("light");
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [invoices, setInvoices] = useState(invoicesSeed);
  const [detailInvNumber, setDetailInvNumber] = useState(null);
  const detailInvoice = invoices.find((inv) => inv.inv === detailInvNumber) || null;

  function generateInvoicePdfs(percentagesByInv) {
    setInvoices((prev) => prev.map((inv) => {
      if (!(inv.inv in percentagesByInv)) return inv;
      const pct = parseFloat(percentagesByInv[inv.inv]);
      if (isNaN(pct)) return inv;
      const lots = inv.lots.map((l) => ({
        ...l,
        feePercentage: pct.toFixed(2),
        lotFee: (parseFloat(l.winningAmount) * pct / 100).toFixed(2),
      }));
      const totalAmount = lots.reduce((s, l) => s + parseFloat(l.lotFee), 0).toFixed(2);
      return {
        ...inv,
        lots,
        feePercentage: pct.toFixed(2),
        totalAmount,
        status: inv.status === "invoice_generated" ? "pending_payment" : inv.status,
      };
    }));
  }

  function handleLogout() {
    setSession(null);
    setPage("dashboard");
    setDetailInvNumber(null);
  }

  function handleLogin(role, username, remember) {
    // TODO: real persistence (cookie/localStorage) once wired to a real
    // login endpoint — "remember" only holds for the current session for now.
    setSession({ role, username });
  }

  function handleSaveProfile(newUsername) {
    setSession((s) => ({ ...s, username: newUsername }));
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app" data-theme={theme}>
      <Header
        page={page}
        setPage={setPage}
        role={session.role}
        username={session.username}
        theme={theme}
        setTheme={setTheme}
        onLogout={handleLogout}
        onOpenAccountSettings={() => setShowAccountSettings(true)}
      />
      <div className="main">
        <div className="page active">
          {page === "dashboard" && <Dashboard />}
          {page === "import" && <ImportBatches role={session.role} />}
          {page === "operations" && (
            <Operations
              invoices={invoices}
              setInvoices={setInvoices}
              role={session.role}
              onOpenDetail={setDetailInvNumber}
              onGeneratePdf={generateInvoicePdfs}
            />
          )}
          {page === "queues" && <Queues invoices={invoices} />}
          {page === "reports" && <Reports role={session.role} />}
          {page === "audit" && <AuditTrail />}
        </div>
      </div>
      <InvoiceDetailModal
        invoice={detailInvoice}
        role={session.role}
        onClose={() => setDetailInvNumber(null)}
        onGeneratePdf={generateInvoicePdfs}
      />
      {showAccountSettings && (
        <AccountSettingsModal
          username={session.username}
          onSave={handleSaveProfile}
          onClose={() => setShowAccountSettings(false)}
        />
      )}
    </div>
  );
}