import { useState, useEffect } from "react";
import { LOCKED_STATUSES, PDF_ROLES, searchFieldDefs, money } from "../data";
import { ActionBtn } from "../components/ActionButton";
import StatusCell from "../components/StatusCell";
import GeneratePdfModal from "../components/GeneratePdfModal";
import { apiCall } from "../api";

export default function Operations({ role, token, onOpenDetail }) {
  const [searchField, setSearchField] = useState("bidderName");
  const [searchValue, setSearchValue] = useState("");
  const [searchValueTo, setSearchValueTo] = useState("");
  const [filtered, setFiltered] = useState(null);
  const [selected, setSelected] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  useEffect(() => {
    fetchInvoices();
  }, [currentPage, token]);
 
  async function fetchInvoices() {
  try {
    setLoading(true);
    console.log('Fetching invoices with token:', token);
    
    const response = await apiCall(`/api/invoices/?page=${currentPage}`, {
      method: 'GET',
      headers: token ? { Authorization: `Token ${token}` } : {},
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);

    if (!response.ok) {
      setError(`Failed to load invoices: ${response.status}`);
      console.error('API error:', data);
      return;
    }

    const invoiceList = data.results || data;
    console.log('Invoices loaded:', invoiceList);
    setInvoices(invoiceList);
    setError("");
  } catch (err) {
    console.error('Network error:', err);
    setError('Network error loading invoices');
  } finally {
    setLoading(false);
  }
}

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
        case "batchId": return String(inv.importBatch) === val;
        case "status": return inv.status === val;
        default: return true;
      }
    }));
  }

  function clearSearch() {
    setSearchField("bidderName");
    setSearchValue("");
    setSearchValueTo("");
    setFiltered(null);
  }

  function toggleRow(invId) {
    setSelected((s) => s.includes(invId) ? s.filter((x) => x !== invId) : [...s, invId]);
  }

  function toggleAll() {
    setSelected(selected.length === rows.length ? [] : rows.map((r) => r.id));
  }

  async function changeStatus(invId, newStatus) {
    try {
      const response = await apiCall(`/api/invoices/${invId}/change-status/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchInvoices();
      } else {
        setError('Failed to update status');
      }
    } catch (err) {
      setError('Network error updating status');
      console.error(err);
    }
  }

  const eligibleForPdf = invoices.filter((inv) => 
    selected.includes(inv.id) && !LOCKED_STATUSES.includes(inv.status)
  );

  function openGenerateModal() {
    if (selected.length === 0) {
      window.alert("Select at least one invoice first.");
      return;
    }
    if (eligibleForPdf.length === 0) {
      window.alert("None of the selected invoices are eligible — Paid, Cancelled, and Waived invoices can't have a new PDF generated.");
      return;
    }
    setShowGenerateModal(true);
  }

  async function confirmGeneratePdf({
    percentagesByInvId, auctionRefNumber, amhNames,
    amountWordsByInv = {}, feeWordsByInv = {}, officeAddress = '',
    totalAmountByInv = {}, feeAmountByInv = {}, bankAccountByInv = {},
    paragraph1ByInv = {}, paragraph2ByInv = {},
  }) {
    try {
      for (const [invId, pct] of Object.entries(percentagesByInvId)) {
        const amhName = amhNames[invId] || '';

        const response = await fetch(`https://auction-crm-api.onrender.com/api/invoices/${invId}/generate-pdf/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`,
          },
          body: JSON.stringify({
            feePercentage: parseFloat(pct),
            auctionRefNumber: auctionRefNumber || '',
            bidderNameAmharic: amhName,
            amountInWords: amountWordsByInv[invId] || '',
            feeInWords: feeWordsByInv[invId] || '',
            officeAddress: officeAddress || '',
            totalAmount: totalAmountByInv[invId] || '',
            feeAmount: feeAmountByInv[invId] || '',
            bankAccount: bankAccountByInv[invId] || '',
            paragraph1: paragraph1ByInv[invId] || '',
            paragraph2: paragraph2ByInv[invId] || '',
          }),
        });
      // ...rest unchanged
      // ...rest unchanged

        if (!response.ok) {
          const error = await response.json();
          setError(`Failed: ${error.detail}`);
          return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice_${invId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      alert('PDFs generated successfully!');
      await fetchInvoices();
      setSelected([]);
      setShowGenerateModal(false);
    } catch (err) {
      setError('Failed to generate PDFs');
      console.error(err);
    }
  }
  
const canDelete = role === "administrator";
async function deleteInvoice(invId) {
  if (!window.confirm("Delete this invoice permanently? This cannot be undone.")) return;
  try {
    const response = await apiCall(`/api/invoices/${invId}/`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Token ${token}` } : {},
    });
    if (response.ok || response.status === 204) {
      await fetchInvoices();
      setSelected((s) => s.filter((id) => id !== invId));
    } else {
      setError('Failed to delete invoice');
    }
  } catch (err) {
    setError('Network error deleting invoice');
    console.error(err);
  }
}

  if (loading) return <div style={{ padding: 20 }}>Loading invoices...</div>;
  if (error) return <div style={{ padding: 20, color: 'red' }}>{error}</div>;

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
                <th>Invoice #</th><th>Bidder</th><th>Company</th><th>Lots</th><th>Total amount</th><th>Due date</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-3)", padding: 28 }}>No records match that search</td></tr>}
              {rows.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    {canGeneratePdf && <input type="checkbox" checked={selected.includes(inv.id)} onChange={() => toggleRow(inv.id)} />}
                  </td>
                  <td className="mono">
                    <span style={{ cursor: "pointer" }} onClick={() => onOpenDetail(inv.id)}>{inv.invoiceNumber}</span>
                    {inv.callNotes && (
                      <span
                        title="Has call center notes"
                        style={{ marginLeft: 6, cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          alert(`Call center notes for ${inv.invoiceNumber}:\n\n${inv.callNotes}`);
                        }}
                      >
                        📎
                      </span>
                    )}
                  </td>
                  <td>{inv.bidderName}</td>
                  <td>{inv.companyName || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                  <td className="mono">{inv.lots?.length || 0}</td>
                  <td className="amount">ETB {money(inv.totalAmount.toFixed(2))}</td>
                  <td className="mono">{new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td><StatusCell invoice={inv} role={role} onChangeStatus={changeStatus} /></td>
                  <td>
                    {canDelete && (
                      <button className="btn btn-sm btn-danger" onClick={() => deleteInvoice(inv.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>Showing {invoices.length} records</span>
          <div className="btns">
            <button className="btn btn-sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
            <button className="btn btn-sm" onClick={() => setCurrentPage(p => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      <div className="locked-note" style={{ marginTop: 10 }}>
        Click an invoice number to open its full record. Click a status badge to change it directly — only available to roles allowed to make that change.
      </div>

      {showGenerateModal && (
        <GeneratePdfModal
          invoices={eligibleForPdf}
          onConfirm={confirmGeneratePdf}
          onClose={() => setShowGenerateModal(false)}
        />
      )}
    </div>
  );
}