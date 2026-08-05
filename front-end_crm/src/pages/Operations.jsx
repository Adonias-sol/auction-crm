import { useState } from "react";
import { LOCKED_STATUSES, PDF_ROLES, searchFieldDefs, money } from "../data";
import { ActionBtn } from "../components/ActionButton";
import StatusCell from "../components/StatusCell";
import GeneratePdfModal from "../components/GeneratePdfModal";

export default function Operations({ invoices, setInvoices, role, onOpenDetail, onGeneratePdf }) {
  const [searchField, setSearchField] = useState("bidderName");
  const [searchValue, setSearchValue] = useState("");
  const [searchValueTo, setSearchValueTo] = useState("");
  const [filtered, setFiltered] = useState(null);
  const [selected, setSelected] = useState([]);

  const rows = filtered || invoices;
  const searchDef = searchFieldDefs[searchField];
  const canGeneratePdf = PDF_ROLES.includes(role);

  function runSearch() {
    if (searchField === "daterange") {
      let f = invoices;
      if (searchValue) f = f.filter((inv) => inv.dueDate >= searchValue);
      if (searchValueTo) f = f.filter((inv) => inv.dueDate <= searchValueTo);
      setFiltered(f);
      return;
    }
    const val = searchValue.toLowerCase().trim();
    if (!val) { setFiltered(null); return; }
    setFiltered(invoices.filter((inv) => {
      switch (searchField) {
        case "bidderName": return inv.bidderName.toLowerCase().includes(val);
        case "phoneNumber": return inv.winnerPhone.includes(val);
        case "companyName": return (inv.companyName || "").toLowerCase().includes(val);
        case "lotNo": return inv.lots.some((l) => l.lotNumber.toLowerCase().includes(val));
        case "batchId": return String(inv.batchId) === val;
        case "status": return inv.status === val;
        default: return true;
      }
    }));
  }
  function clearSearch() {
    setSearchField("bidderName"); setSearchValue(""); setSearchValueTo(""); setFiltered(null);
  }

  function toggleRow(inv) {
    setSelected((s) => s.includes(inv) ? s.filter((x) => x !== inv) : [...s, inv]);
  }
  function toggleAll() {
    setSelected(selected.length === rows.length ? [] : rows.map((r) => r.inv));
  }

  function changeStatus(invNumber, newStatus) {
    setInvoices((prev) => prev.map((inv) => inv.inv === invNumber ? { ...inv, status: newStatus } : inv));
  }

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const eligibleForPdf = invoices.filter((inv) => selected.includes(inv.inv) && !LOCKED_STATUSES.includes(inv.status));

  function openGenerateModal() {
    if (selected.length === 0) { window.alert("Select at least one invoice first."); return; }
    if (eligibleForPdf.length === 0) { window.alert("None of the selected invoices are eligible \u2014 Paid, Cancelled, and Waived invoices can't have a new PDF generated."); return; }
    setShowGenerateModal(true);
  }

  return (
    <div>
      <div className="filters">
        <select className="grow" value={searchField} onChange={(e) => { setSearchField(e.target.value); setSearchValue(""); setSearchValueTo(""); }}>
          <option value="bidderName">Bidder name</option>
          <option value="phoneNumber">Phone number</option>
          <option value="companyName">Company name</option>
          <option value="lotNo">Lot number</option>
          <option value="batchId">Import batch</option>
          <option value="status">Payment status</option>
          <option value="daterange">Date range</option>
        </select>
        {searchDef.type === "select" && (
          <select className="grow" value={searchValue} onChange={(e) => setSearchValue(e.target.value)}>
            <option value="">Any {searchDef.label}</option>
            {searchDef.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        )}
        {searchDef.type === "text" && (
          <input value={searchValue} onChange={(e) => setSearchValue(e.target.value)} placeholder={`Search by ${searchDef.label}`} />
        )}
        {searchDef.type === "daterange" && (
          <>
            <input type="date" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
            <span style={{ color: "var(--text-3)", fontSize: 12 }}>to</span>
            <input type="date" value={searchValueTo} onChange={(e) => setSearchValueTo(e.target.value)} />
          </>
        )}
        <button className="btn btn-primary" onClick={runSearch}>Search</button>
        <button className="btn btn-ghost" onClick={clearSearch}>Clear</button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12, alignItems: "center" }}>
        {selected.length > 0 && <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{selected.length} selected</span>}
        <ActionBtn label="Generate invoice PDF" roles={PDF_ROLES} role={role} onClick={openGenerateModal} />
        <ActionBtn label="Export records" roles={["administrator", "auction_manager", "finance_manager"]} role={role} />
        <ActionBtn label="Bulk update" roles={["administrator"]} role={role} />
      </div>

      <div className="tbl-wrap">
        <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                {canGeneratePdf && <input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={toggleAll} />}
              </th>
              <th>Invoice #</th><th>Bidder</th><th>Company</th><th>Lots</th><th>Total amount</th><th>Due date</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-3)", padding: 28 }}>No records match that search</td></tr>}
            {rows.map((inv) => (
              <tr key={inv.inv}>
                <td>
                  {canGeneratePdf && <input type="checkbox" checked={selected.includes(inv.inv)} onChange={() => toggleRow(inv.inv)} />}
                </td>
                <td className="mono" style={{ cursor: "pointer" }} onClick={() => onOpenDetail(inv.inv)}>{inv.inv}</td>
                <td>{inv.bidderName}</td>
                <td>{inv.companyName || <span style={{ color: "var(--text-3)" }}>\u2014</span>}</td>
                <td className="mono">{inv.lots.length}</td>
                <td className="amount">{money(inv.totalAmount)}</td>
                <td className="mono">{inv.dueDate}</td>
                <td><StatusCell invoice={inv} role={role} onChangeStatus={changeStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="pagination">
          <span>Showing 1\u2013{rows.length} of 1,240</span>
          <div className="btns">
            <button className="btn btn-sm" disabled>Previous</button>
            <button className="btn btn-sm">Next</button>
          </div>
        </div>
      </div>
      <div className="locked-note" style={{ marginTop: 10 }}>
        Click an invoice number to open its full record. Click a status badge to change it directly \u2014 only available to roles allowed to make that change.
      </div>
      {showGenerateModal && (
        <GeneratePdfModal
          invoices={eligibleForPdf}
          onConfirm={(pcts) => { onGeneratePdf(pcts); setSelected([]); }}
          onClose={() => setShowGenerateModal(false)}
        />
      )}
    </div>
  );
}