import { useState, useEffect } from "react";
import { periodLabels, statusLabels, money } from "../data";
import PeriodDropdown from "../components/PeriodDropdown";
import { apiCall } from "../api";

export default function Dashboard({ token }) {
  const [receivedPeriod, setReceivedPeriod] = useState("today");
  const [statusPeriod, setStatusPeriod] = useState("today");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, [receivedPeriod, statusPeriod, token]);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      const response = await apiCall('/api/invoices/summary/', {
        method: 'GET',
        headers: token ? { Authorization: `Token ${token}` } : {},
      });

      if (!response.ok) {
        setError('Failed to load dashboard');
        return;
      }

      const data = await response.json();
      setStats(data);
      setError("");
    } catch (err) {
      setError('Network error loading dashboard');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading dashboard...</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>;

  // Compute stats from real invoices
  const invoices = stats?.invoices || [];
  const totalCollected = invoices
    .filter(inv => ['paid', 'waived'].includes(inv.status))
    .reduce((sum, inv) => sum + parseFloat(inv.totalAmount || 0), 0);
  
  const outstanding = invoices
    .filter(inv => !['paid', 'waived', 'cancelled'].includes(inv.status))
    .reduce((sum, inv) => sum + parseFloat(inv.totalAmount || 0), 0);
  
  const unpaidCount = invoices.filter(inv => 
    !['paid', 'waived', 'cancelled'].includes(inv.status)
  ).length;

  // Group by status
  const statusCounts = Object.keys(statusLabels).reduce((acc, key) => {
    acc[key] = invoices.filter(inv => inv.status === key).length;
    return acc;
  }, {});

  // Top auctions by revenue
  const auctionRevenue = {};
  invoices.forEach(inv => {
    const auctionName = inv.lots?.[0]?.auctionName || 'Unknown';
    auctionRevenue[auctionName] = (auctionRevenue[auctionName] || 0) + parseFloat(inv.totalAmount || 0);
  });
  const topAuctions = Object.entries(auctionRevenue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, total]) => [name, Math.round(total / Math.max(...Object.values(auctionRevenue)) * 100), total.toFixed(2)]);

  // Top clients by revenue
  const clientRevenue = {};
  invoices.forEach(inv => {
    const clientName = inv.winner?.companyName || inv.winner?.bidderName || 'Unknown';
    clientRevenue[clientName] = (clientRevenue[clientName] || 0) + parseFloat(inv.totalAmount || 0);
  });
  const topClients = Object.entries(clientRevenue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, total]) => [name, Math.round(total / Math.max(...Object.values(clientRevenue)) * 100), total.toFixed(2)]);

  const collectionPct = totalCollected && (totalCollected / (totalCollected + outstanding) * 100).toFixed(1);

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">Total fees collected</div>
          <div className="stat-value up">ETB {money(totalCollected.toFixed(2))}</div>
          <div className="stat-foot">Across {invoices.length} invoices</div>
        </div>
        <div className="card">
          <div className="stat-label">Outstanding fees</div>
          <div className="stat-value warn">ETB {money(outstanding.toFixed(2))}</div>
          <div className="stat-foot">{unpaidCount} invoices unpaid</div>
        </div>
        <div className="card">
          <div className="stat-label-row">
            <div className="stat-label">Received — {periodLabels[receivedPeriod].toLowerCase()}</div>
            <PeriodDropdown value={receivedPeriod} onChange={setReceivedPeriod} />
          </div>
          <div className="stat-value">ETB {money(totalCollected.toFixed(2))}</div>
          <div className="stat-foot">Payments verified in this period</div>
        </div>
        <div className="card">
          <div className="stat-label">Collection percentage</div>
          <div className="stat-value up">{collectionPct}%</div>
          <div className="stat-foot">of invoiced fees collected</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="stat-label-row">
          <h3 style={{ margin: 0 }}>Invoices by status</h3>
          <PeriodDropdown value={statusPeriod} onChange={setStatusPeriod} />
        </div>
        <div className="status-strip">
          {Object.keys(statusLabels).map((k) => (
            <div className="status-chip" key={k}>
              <div className="n">{statusCounts[k]}</div>
              <div className="l">{statusLabels[k]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ margin: "0 0 4px" }}>Revenue by auction</h3>
          {topAuctions.length ? topAuctions.map(([name, pct, val]) => (
            <div className="bar-row" key={name}>
              <span className="name">{name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%" }}></div></div>
              <span className="val">ETB {money(val)}</span>
            </div>
          )) : <p>No auction data</p>}
        </div>
        <div className="card">
          <h3 style={{ margin: "0 0 4px" }}>Revenue by client</h3>
          {topClients.length ? topClients.map(([name, pct, val]) => (
            <div className="bar-row" key={name}>
              <span className="name">{name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%" }}></div></div>
              <span className="val">ETB {money(val)}</span>
            </div>
          )) : <p>No client data</p>}
        </div>
      </div>
    </div>
  );
}