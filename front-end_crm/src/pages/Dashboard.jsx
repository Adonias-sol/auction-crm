import { useState } from "react";
import { periodLabels, receivedByPeriod, statusCountsByPeriod, statusLabels, money } from "../data";
import PeriodDropdown from "../components/PeriodDropdown";

const revenueByAuction = [["Spring Classic Cars", 88, "92,400.00"], ["Estate Jewelry Lot 12", 64, "67,150.00"], ["Vintage Watches", 51, "53,900.00"], ["Modern Art Sale", 40, "41,700.00"], ["Rare Books", 27, "29,500.00"]];
const revenueByClient = [["Whitfield Holdings", 70, "38,200.00"], ["Marchetti Estates", 55, "29,800.00"], ["R. Delgado", 38, "20,400.00"]];

export default function Dashboard() {
  const [receivedPeriod, setReceivedPeriod] = useState("today");
  const [statusPeriod, setStatusPeriod] = useState("today");
  const statusCounts = statusCountsByPeriod[statusPeriod];

  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">Total fees collected</div>
          <div className="stat-value up">ETB 284,650</div>
          <div className="stat-foot">Across 6 active auctions</div>
        </div>
        <div className="card">
          <div className="stat-label">Outstanding fees</div>
          <div className="stat-value warn">ETB 41,200</div>
          <div className="stat-foot">18 invoices unpaid</div>
        </div>
        <div className="card">
          <div className="stat-label-row">
            <div className="stat-label">Received \u2014 {periodLabels[receivedPeriod].toLowerCase()}</div>
            <PeriodDropdown value={receivedPeriod} onChange={setReceivedPeriod} />
          </div>
          <div className="stat-value">{money(receivedByPeriod[receivedPeriod])}</div>
          <div className="stat-foot">Payments verified in this period</div>
        </div>
        <div className="card">
          <div className="stat-label">Collection percentage</div>
          <div className="stat-value up">87.4%</div>
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
          {revenueByAuction.map(([name, pct, val]) => (
            <div className="bar-row" key={name}>
              <span className="name">{name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%" }}></div></div>
              <span className="val">{money(val)}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ margin: "0 0 4px" }}>Revenue by client</h3>
          {revenueByClient.map(([name, pct, val]) => (
            <div className="bar-row" key={name}>
              <span className="name">{name}</span>
              <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%" }}></div></div>
              <span className="val">{money(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}