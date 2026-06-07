"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n) {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n) { return Math.round(n).toLocaleString("en-US"); }
function fmtCurrency(n) { return "$" + fmt(n); }

function unique(arr) { return [...new Set(arr.filter(Boolean))].sort(); }

function StatusBadge({ status }) {
  const s = (status || "").toLowerCase();
  return (
    <span className={`badge ${s}`}>
      <span className="badge-dot" />
      {status || "—"}
    </span>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastSync, setLastSync]   = useState(null);
  const [sortKey, setSortKey]     = useState("date");
  const [sortDir, setSortDir]     = useState("desc");

  // Filters
  const [fProduct,    setFProduct]    = useState("");
  const [fCategory,   setFCategory]   = useState("");
  const [fPackaging,  setFPackaging]  = useState("");
  const [fStatus,     setFStatus]     = useState("");
  const [fDateFrom,   setFDateFrom]   = useState("");
  const [fDateTo,     setFDateTo]     = useState("");
  const [fPriceMin,   setFPriceMin]   = useState("");
  const [fPriceMax,   setFPriceMax]   = useState("");
  const [fQtyMin,     setFQtyMin]     = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/sales");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows(json.rows || []);
      setLastSync(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 60 seconds
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // ── Filter options (derived from data) ────────────────────────────────────
  const products   = useMemo(() => unique(rows.map(r => r.product)),   [rows]);
  const categories = useMemo(() => unique(rows.map(r => r.category)),  [rows]);
  const packagings = useMemo(() => unique(rows.map(r => r.packaging)), [rows]);
  const statuses   = useMemo(() => unique(rows.map(r => r.status)),    [rows]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (fProduct   && r.product   !== fProduct)   return false;
      if (fCategory  && r.category  !== fCategory)  return false;
      if (fPackaging && r.packaging !== fPackaging) return false;
      if (fStatus    && r.status    !== fStatus)    return false;
      if (fDateFrom  && r.date < fDateFrom)         return false;
      if (fDateTo    && r.date > fDateTo)           return false;
      const price = parseFloat(r.unit_price) || 0;
      if (fPriceMin  && price < parseFloat(fPriceMin)) return false;
      if (fPriceMax  && price > parseFloat(fPriceMax)) return false;
      const qty = parseInt(r.quantity) || 0;
      if (fQtyMin    && qty < parseInt(fQtyMin))    return false;
      return true;
    });
  }, [rows, fProduct, fCategory, fPackaging, fStatus, fDateFrom, fDateTo, fPriceMin, fPriceMax, fQtyMin]);

  // ── Sorted rows ───────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortKey] ?? "";
      let bv = b[sortKey] ?? "";
      const numCols = ["quantity","unit_price","total"];
      if (numCols.includes(sortKey)) {
        av = parseFloat(av) || 0;
        bv = parseFloat(bv) || 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1  : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const totalRevenue  = useMemo(() => filtered.reduce((s,r) => s + (parseFloat(r.total)      || 0), 0), [filtered]);
  const totalUnits    = useMemo(() => filtered.reduce((s,r) => s + (parseInt(r.quantity)     || 0), 0), [filtered]);
  const totalOrders   = filtered.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const fulfilledPct  = totalOrders
    ? Math.round((filtered.filter(r => r.status === "Fulfilled").length / totalOrders) * 100)
    : 0;

  // ── Revenue by product (for bar chart) ────────────────────────────────────
  const revenueByProduct = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const k = r.product || "Unknown";
      map[k] = (map[k] || 0) + (parseFloat(r.total) || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered]);

  const maxRevenue = revenueByProduct[0]?.value || 1;

  // ── Units by category (for bar chart) ─────────────────────────────────────
  const unitsByCategory = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const k = r.category || "Unknown";
      map[k] = (map[k] || 0) + (parseInt(r.quantity) || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const maxUnits = unitsByCategory[0]?.value || 1;

  // ── Sort handler ──────────────────────────────────────────────────────────
  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function clearFilters() {
    setFProduct(""); setFCategory(""); setFPackaging(""); setFStatus("");
    setFDateFrom(""); setFDateTo(""); setFPriceMin(""); setFPriceMax(""); setFQtyMin("");
  }

  function SortTh({ col, label }) {
    const active = sortKey === col;
    const arrow  = active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";
    return (
      <th onClick={() => handleSort(col)}>
        {label}
        <span className={`sort-arrow${active ? " active" : ""}`}>{arrow}</span>
      </th>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="shell">

      {/* Sidebar */}
      <nav className="sidebar">
        <div className="logo">Biz<span>Hub</span></div>
        <div className="nav-label">Analytics</div>
        <div className="nav-item active">📊 Sales</div>
        <div className="nav-label">Coming soon</div>
        <div className="nav-item" style={{opacity:0.4, cursor:"default"}}>🛒 Orders</div>
        <div className="nav-item" style={{opacity:0.4, cursor:"default"}}>📦 Inventory</div>
        <div className="nav-item" style={{opacity:0.4, cursor:"default"}}>📬 Inbox</div>
        <div style={{marginTop:"auto", padding:"16px 18px"}}>
          <div style={{fontSize:11, color:"var(--text-3)"}}>Sheet sync</div>
          <div style={{fontSize:12, color:"var(--text-2)", marginTop:3}}>
            {lastSync ? `${lastSync.toLocaleTimeString()}` : "—"}
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="main">

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-title">Sales Analytics</div>
          <div className="topbar-right">
            {lastSync && (
              <span className="sync-time">
                Synced {lastSync.toLocaleTimeString()}
              </span>
            )}
            <div className="live-pill">
              <span className="live-dot" />
              Live
            </div>
            <button className="refresh-btn" onClick={fetchData} disabled={loading}>
              {loading ? "Syncing…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        <div className="content">

          {error && (
            <div className="error-box">
              ⚠️ {error}
              <br /><small>Check your GOOGLE_API_KEY and SHEET_ID in Vercel environment variables, and make sure the sheet is publicly viewable.</small>
            </div>
          )}

          {/* Metrics */}
          <div className="metrics">
            <div className="metric">
              <div className="metric-label">Total Revenue</div>
              <div className="metric-value">{fmtCurrency(totalRevenue)}</div>
              <div className="metric-sub">{totalOrders} orders shown</div>
            </div>
            <div className="metric">
              <div className="metric-label">Units Sold</div>
              <div className="metric-value">{fmtInt(totalUnits)}</div>
              <div className="metric-sub">Across all products</div>
            </div>
            <div className="metric">
              <div className="metric-label">Avg Order Value</div>
              <div className="metric-value">{fmtCurrency(avgOrderValue)}</div>
              <div className="metric-sub">Per order</div>
            </div>
            <div className="metric">
              <div className="metric-label">Fulfillment Rate</div>
              <div className="metric-value">{fulfilledPct}%</div>
              <div className={`metric-sub ${fulfilledPct >= 70 ? "up" : "down"}`}>
                {fulfilledPct >= 70 ? "▲ On track" : "▼ Below target"}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="filter-bar">
            <div className="filter-group">
              <label>Product</label>
              <select value={fProduct} onChange={e => setFProduct(e.target.value)}>
                <option value="">All products</option>
                {products.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Category</label>
              <select value={fCategory} onChange={e => setFCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Packaging</label>
              <select value={fPackaging} onChange={e => setFPackaging(e.target.value)}>
                <option value="">All packaging</option>
                {packagings.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Status</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">All statuses</option>
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Date from</label>
              <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>Date to</label>
              <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>Min price ($)</label>
              <input type="text" placeholder="0" value={fPriceMin} onChange={e => setFPriceMin(e.target.value)} style={{width:80}} />
            </div>
            <div className="filter-group">
              <label>Max price ($)</label>
              <input type="text" placeholder="∞" value={fPriceMax} onChange={e => setFPriceMax(e.target.value)} style={{width:80}} />
            </div>
            <div className="filter-group">
              <label>Min qty</label>
              <input type="text" placeholder="0" value={fQtyMin} onChange={e => setFQtyMin(e.target.value)} style={{width:70}} />
            </div>
            <button className="clear-btn" onClick={clearFilters}>✕ Clear</button>
          </div>

          {/* Charts */}
          {!loading && filtered.length > 0 && (
            <div className="charts-row">
              <div className="chart-card">
                <h3>Revenue by product</h3>
                <div className="bar-chart">
                  {revenueByProduct.map(({ name, value }) => (
                    <div className="bar-row" key={name}>
                      <span className="bar-label" title={name}>{name}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.round((value / maxRevenue) * 100)}%` }} />
                      </div>
                      <span className="bar-val">{fmtCurrency(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="chart-card">
                <h3>Units sold by category</h3>
                <div className="bar-chart">
                  {unitsByCategory.map(({ name, value }) => (
                    <div className="bar-row" key={name}>
                      <span className="bar-label" title={name}>{name}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.round((value / maxUnits) * 100)}%`, background: "#378ADD" }} />
                      </div>
                      <span className="bar-val">{fmtInt(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="table-card">
            <div className="table-header">
              <h3>Order detail</h3>
              <span className="row-count">
                {loading ? "Loading…" : `${sorted.length} of ${rows.length} rows`}
              </span>
            </div>

            {loading ? (
              <div className="empty">
                <div className="skeleton" style={{ width: "60%", height: 14, margin: "0 auto 10px" }} />
                <div className="skeleton" style={{ width: "40%", height: 14, margin: "0 auto" }} />
              </div>
            ) : sorted.length === 0 ? (
              <div className="empty">
                {rows.length === 0
                  ? "No data yet — make sure your Google Sheet has data and your API key is set."
                  : "No rows match the current filters."}
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <SortTh col="order_id"   label="Order ID" />
                      <SortTh col="date"        label="Date" />
                      <SortTh col="product"     label="Product" />
                      <SortTh col="category"    label="Category" />
                      <SortTh col="packaging"   label="Packaging" />
                      <SortTh col="quantity"    label="Qty" />
                      <SortTh col="unit_price"  label="Unit price" />
                      <SortTh col="total"       label="Total" />
                      <SortTh col="status"      label="Status" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => (
                      <tr key={row.order_id || i}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{row.order_id || "—"}</td>
                        <td>{row.date || "—"}</td>
                        <td>{row.product || "—"}</td>
                        <td>{row.category || "—"}</td>
                        <td>{row.packaging || "—"}</td>
                        <td style={{ textAlign: "right" }}>{fmtInt(row.quantity)}</td>
                        <td style={{ textAlign: "right" }}>{fmtCurrency(row.unit_price)}</td>
                        <td style={{ textAlign: "right", fontWeight: 500 }}>{fmtCurrency(row.total)}</td>
                        <td><StatusBadge status={row.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
