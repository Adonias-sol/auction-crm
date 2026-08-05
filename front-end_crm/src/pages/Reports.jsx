import { ActionBtn } from "../components/ActionButton";

const reportDefs = [
  ["Outstanding processing fees", "All unpaid or overdue invoices, current as of today"],
  ["Daily collections", "Payments verified in the last 24 hours"],
  ["Monthly collections", "Payments verified this calendar month"],
  ["Payment verification report", "Verification history with reviewer and timestamp"],
  ["Overdue payments report", "Invoices past due date, grouped by age"],
  ["Revenue by auction", "Total fees collected per auction event"],
  ["Revenue by client", "Total fees collected per client account"],
];

export default function Reports({ role }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
      {reportDefs.map(([title, desc]) => (
        <div className="tbl-wrap" key={title}>
          <div className="report-card">
            <div>
              <div className="rt">{title}</div>
              <div className="rd">{desc}</div>
            </div>
            <ActionBtn label="Generate" roles={["administrator", "auction_manager", "finance_manager"]} role={role} />
          </div>
        </div>
      ))}
    </div>
  );
}