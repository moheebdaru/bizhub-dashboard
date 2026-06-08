"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

const CURRENCY = "$";

function fmt(n) {
  const value = Number(n) || 0;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n) {
  return Math.round(Number(n) || 0).toLocaleString("en-US");
}

function fmtCurrency(n) {
  return `${CURRENCY}${fmt(n)}`;
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))].sort();
}

function normalizeStatus(status) {
  return (status || "").toLowerCase().trim();
}

function safeDateValue(date) {
  return date || "";
}

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status).replace(/\s+/g, "-") || "unknown";
  return (
    <span className={`status-badge ${normalized}`}>
      <span className="status-dot" />
      {status || "Unknown"}
    </span>
  );
}

function MetricCard({ label, value, detail, icon, tone = "green", active = false, onClick, progress }) {
  return (
    <button className={`metric-card ${tone}${active ? " is-active" : ""}`} onClick={onClick} type="button">
      <span className="metric-glow" />
      <span className="metric-topline">
        <span className="metric-icon">{icon}</span>
        {typeof progress === "number" ? <span className="metric-progress-label">{Math.max(0, Math.min(100, progress))}%</span> : null}
      </span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
      {typeof progress === "number" ? (
        <span className="metric-progress" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </span>
      ) : null}
    </button>
  );
}

function SelectFilter({ label, value, onChange, options, placeholder }) {
  return (
    <label className="field-control">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

function TextFilter({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="field-control">
      <span>{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <span>✦</span>
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [chartMode, setChartMode] = useState("revenue");
  const [tableDensity, setTableDensity] = useState("comfortable");

  const [fProduct, setFProduct] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fPackaging, setFPackaging] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [fPriceMin, setFPriceMin] = useState("");
  const [fPriceMax, setFPriceMax] = useState("");
  const [fQtyMin, setFQtyMin] = useState("");

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

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const products = useMemo(() => unique(rows.map((r) => r.product)), [rows]);
  const categories = useMemo(() => unique(rows.map((r) => r.category)), [rows]);
  const packagings = useMemo(() => unique(rows.map((r) => r.packaging)), [rows]);
  const statuses = useMemo(() => unique(rows.map((r) => r.status)), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (fProduct && r.product !== fProduct) return false;
      if (fCategory && r.category !== fCategory) return false;
      if (fPackaging && r.packaging !== fPackaging) return false;
      if (fStatus && r.status !== fStatus) return false;
      if (fDateFrom && safeDateValue(r.date) < fDateFrom) return false;
      if (fDateTo && safeDateValue(r.date) > fDateTo) return false;

      const price = parseFloat(r.unit_price) || 0;
      if (fPriceMin && price < parseFloat(fPriceMin)) return false;
      if (fPriceMax && price > parseFloat(fPriceMax)) return false;

      const qty = parseInt(r.quantity) || 0;
      if (fQtyMin && qty < parseInt(fQtyMin)) return false;

      if (q) {
        const haystack = [r.order_id, r.date, r.product, r.category, r.packaging, r.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [rows, search, fProduct, fCategory, fPackaging, fStatus, fDateFrom, fDateTo, fPriceMin, fPriceMax, fQtyMin]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortKey] ?? "";
      let bv = b[sortKey] ?? "";
      const numCols = ["quantity", "unit_price", "total"];

      if (numCols.includes(sortKey)) {
        av = parseFloat(av) || 0;
        bv = parseFloat(bv) || 0;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalRevenue = useMemo(() => filtered.reduce((s, r) => s + (parseFloat(r.total) || 0), 0), [filtered]);
  const totalUnits = useMemo(() => filtered.reduce((s, r) => s + (parseInt(r.quantity) || 0), 0), [filtered]);
  const totalOrders = filtered.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const fulfilledCount = filtered.filter((r) => normalizeStatus(r.status) === "fulfilled").length;
  const pendingCount = filtered.filter((r) => normalizeStatus(r.status) === "pending").length;
  const cancelledCount = filtered.filter((r) => normalizeStatus(r.status) === "cancelled").length;
  const fulfilledPct = totalOrders ? Math.round((fulfilledCount / totalOrders) * 100) : 0;

  const revenueByProduct = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const key = r.product || "Unknown";
      map[key] = (map[key] || 0) + (parseFloat(r.total) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [filtered]);

  const unitsByCategory = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const key = r.category || "Unknown";
      map[key] = (map[key] || 0) + (parseInt(r.quantity) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [filtered]);

  const statusSummary = useMemo(() => {
    const map = { fulfilled: 0, pending: 0, cancelled: 0, other: 0 };
    filtered.forEach((r) => {
      const status = normalizeStatus(r.status);
      if (status === "fulfilled") map.fulfilled += 1;
      else if (status === "pending") map.pending += 1;
      else if (status === "cancelled") map.cancelled += 1;
      else map.other += 1;
    });
    return map;
  }, [filtered]);

  const chartData = chartMode === "revenue" ? revenueByProduct : unitsByCategory;
  const chartMax = chartData[0]?.value || 1;
  const topProduct = revenueByProduct[0];
  const recentOrders = useMemo(() => sorted.slice(0, 5), [sorted]);

  const activeFilterCount = [search, fProduct, fCategory, fPackaging, fStatus, fDateFrom, fDateTo, fPriceMin, fPriceMax, fQtyMin].filter(Boolean).length;

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setSearch("");
    setFProduct("");
    setFCategory("");
    setFPackaging("");
    setFStatus("");
    setFDateFrom("");
    setFDateTo("");
    setFPriceMin("");
    setFPriceMax("");
    setFQtyMin("");
  }

  function setStatusQuickFilter(status) {
    setFStatus((current) => (current === status ? "" : status));
  }

  function SortTh({ col, label, align = "left" }) {
    const active = sortKey === col;
    return (
      <th className={align === "right" ? "align-right" : ""} onClick={() => handleSort(col)}>
        <span>{label}</span>
        <span className={`sort-arrow${active ? " active" : ""}`}>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </th>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">B</div>
          <div>
            <strong>BizHub</strong>
            <span>Operations cockpit</span>
          </div>
        </div>

        <nav className="nav-list">
          <button className="nav-item active" type="button"><span>⌘</span> Overview</button>
          <button className="nav-item" type="button"><span>☑</span> Orders</button>
          <button className="nav-item" type="button"><span>◫</span> Products</button>
          <button className="nav-item" type="button"><span>✉</span> Messages</button>
        </nav>

        <div className="sync-card">
          <div className="pulse-dot" />
          <span>Live sheet sync</span>
          <strong>{lastSync ? lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Waiting"}</strong>
          <p>Updates automatically every minute.</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Sales command center</span>
            <h1>Dashboard</h1>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <span>⌕</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, product, category..." />
            </label>
            <button className="refresh-button" onClick={fetchData} disabled={loading} type="button">
              <span className={loading ? "spin" : ""}>↻</span>
              {loading ? "Syncing" : "Refresh"}
            </button>
          </div>
        </header>

        <section className="hero-card">
          <div className="hero-copy">
            <div className="hero-chip-row">
              <span className="live-chip"><span /> Live</span>
              <span>{rows.length} total rows</span>
              <span>{activeFilterCount} active filters</span>
            </div>
            <h2>Turn every sheet row into a clean business view.</h2>
            <p>Filter, sort, review order details, and monitor sales performance from one interactive workspace.</p>
          </div>

          <div className="hero-stat-stack">
            <button type="button" onClick={() => setStatusQuickFilter("Pending")}>
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </button>
            <button type="button" onClick={() => setStatusQuickFilter("Fulfilled")}>
              <span>Fulfilled</span>
              <strong>{fulfilledCount}</strong>
            </button>
            <button type="button" onClick={() => setStatusQuickFilter("Cancelled")}>
              <span>Cancelled</span>
              <strong>{cancelledCount}</strong>
            </button>
          </div>
        </section>

        {error ? (
          <div className="error-box">
            <strong>Connection issue</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <section className="metrics-grid">
          <MetricCard label="Revenue" value={fmtCurrency(totalRevenue)} detail={`${totalOrders} orders shown`} icon="◉" tone="green" />
          <MetricCard label="Units sold" value={fmtInt(totalUnits)} detail="Across all products" icon="▦" tone="blue" />
          <MetricCard label="Avg order" value={fmtCurrency(avgOrderValue)} detail="Per order" icon="◇" tone="purple" />
          <MetricCard label="Fulfillment" value={`${fulfilledPct}%`} detail={`${fulfilledCount} done / ${pendingCount} pending`} icon="✓" tone="gold" progress={fulfilledPct} />
        </section>

        <section className="control-panel">
          <div className="control-header">
            <div>
              <h2>Interactive filters</h2>
              <p>{activeFilterCount ? `${activeFilterCount} filters applied` : "Start narrowing your live data"}</p>
            </div>
            <div className="quick-status-row">
              <button className={fStatus === "Fulfilled" ? "active" : ""} onClick={() => setStatusQuickFilter("Fulfilled")} type="button">Fulfilled</button>
              <button className={fStatus === "Pending" ? "active" : ""} onClick={() => setStatusQuickFilter("Pending")} type="button">Pending</button>
              <button className={fStatus === "Cancelled" ? "active" : ""} onClick={() => setStatusQuickFilter("Cancelled")} type="button">Cancelled</button>
              <button onClick={clearFilters} type="button">Clear all</button>
            </div>
          </div>

          <div className="filter-grid">
            <SelectFilter label="Product" value={fProduct} onChange={setFProduct} options={products} placeholder="All products" />
            <SelectFilter label="Category" value={fCategory} onChange={setFCategory} options={categories} placeholder="All categories" />
            <SelectFilter label="Packaging" value={fPackaging} onChange={setFPackaging} options={packagings} placeholder="All packaging" />
            <SelectFilter label="Status" value={fStatus} onChange={setFStatus} options={statuses} placeholder="All statuses" />
            <TextFilter label="Date from" value={fDateFrom} onChange={setFDateFrom} type="date" />
            <TextFilter label="Date to" value={fDateTo} onChange={setFDateTo} type="date" />
            <TextFilter label="Min price" value={fPriceMin} onChange={setFPriceMin} placeholder="0" />
            <TextFilter label="Max price" value={fPriceMax} onChange={setFPriceMax} placeholder="∞" />
            <TextFilter label="Min qty" value={fQtyMin} onChange={setFQtyMin} placeholder="0" />
          </div>
        </section>

        <section className="insights-grid">
          <article className="panel chart-panel">
            <div className="panel-header">
              <div>
                <h2>{chartMode === "revenue" ? "Revenue leaders" : "Category movement"}</h2>
                <p>{topProduct ? `${topProduct.name} is your strongest product right now.` : "Waiting for sales data."}</p>
              </div>
              <div className="segmented-control">
                <button className={chartMode === "revenue" ? "active" : ""} onClick={() => setChartMode("revenue")} type="button">Revenue</button>
                <button className={chartMode === "units" ? "active" : ""} onClick={() => setChartMode("units")} type="button">Units</button>
              </div>
            </div>

            {loading ? <EmptyState title="Loading chart" body="Syncing your Google Sheet data." /> : chartData.length ? (
              <div className="bar-chart">
                {chartData.map(({ name, value }, index) => (
                  <button className="bar-row" key={name} type="button" onClick={() => chartMode === "revenue" ? setFProduct(name) : setFCategory(name)}>
                    <span className="bar-rank">{index + 1}</span>
                    <span className="bar-name" title={name}>{name}</span>
                    <span className="bar-track"><span style={{ width: `${Math.max(6, Math.round((value / chartMax) * 100))}%` }} /></span>
                    <strong>{chartMode === "revenue" ? fmtCurrency(value) : `${fmtInt(value)} units`}</strong>
                  </button>
                ))}
              </div>
            ) : <EmptyState title="No matching rows" body="Try clearing your filters." />}
          </article>

          <article className="panel health-panel">
            <div className="panel-header compact">
              <div>
                <h2>Order health</h2>
                <p>Click a segment below to filter.</p>
              </div>
            </div>
            <button className="donut" type="button" onClick={() => setStatusQuickFilter("Fulfilled")} style={{ background: `conic-gradient(var(--success) 0 ${fulfilledPct}%, var(--warning) ${fulfilledPct}% ${fulfilledPct + (totalOrders ? Math.round((pendingCount / totalOrders) * 100) : 0)}%, var(--danger) 0)` }}>
              <span>
                <strong>{fulfilledPct}%</strong>
                <small>fulfilled</small>
              </span>
            </button>
            <div className="health-list">
              <button type="button" onClick={() => setStatusQuickFilter("Fulfilled")}><span className="dot success" />Fulfilled<strong>{statusSummary.fulfilled}</strong></button>
              <button type="button" onClick={() => setStatusQuickFilter("Pending")}><span className="dot warning" />Pending<strong>{statusSummary.pending}</strong></button>
              <button type="button" onClick={() => setStatusQuickFilter("Cancelled")}><span className="dot danger" />Cancelled<strong>{statusSummary.cancelled}</strong></button>
            </div>
          </article>
        </section>

        <section className="bottom-grid">
          <article className="panel activity-panel">
            <div className="panel-header compact">
              <div>
                <h2>Recent orders</h2>
                <p>Click any order to preview its details.</p>
              </div>
            </div>
            <div className="activity-list">
              {recentOrders.length ? recentOrders.map((order, index) => (
                <button className="activity-card" key={order.order_id || index} type="button" onClick={() => setSelectedOrder(order)}>
                  <span className="activity-number">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{order.product || "Unnamed product"}</strong>
                    <small>{order.order_id || "No ID"} · {order.date || "No date"}</small>
                  </span>
                  <span className="activity-total">{fmtCurrency(order.total)}</span>
                </button>
              )) : <EmptyState title="No recent orders" body="There are no rows matching your filters." />}
            </div>
          </article>

          <article className="panel table-panel">
            <div className="panel-header table-header">
              <div>
                <h2>Order detail</h2>
                <p>{loading ? "Loading rows..." : `${sorted.length} of ${rows.length} rows`}</p>
              </div>
              <div className="segmented-control">
                <button className={tableDensity === "comfortable" ? "active" : ""} onClick={() => setTableDensity("comfortable")} type="button">Comfort</button>
                <button className={tableDensity === "compact" ? "active" : ""} onClick={() => setTableDensity("compact")} type="button">Compact</button>
              </div>
            </div>

            {loading ? <EmptyState title="Loading table" body="Pulling live rows from Google Sheets." /> : sorted.length === 0 ? (
              <EmptyState title="No orders found" body="Adjust your filters or check your sheet data." />
            ) : (
              <div className={`table-wrap ${tableDensity}`}>
                <table>
                  <thead>
                    <tr>
                      <SortTh col="order_id" label="Order ID" />
                      <SortTh col="date" label="Date" />
                      <SortTh col="product" label="Product" />
                      <SortTh col="category" label="Category" />
                      <SortTh col="packaging" label="Packaging" />
                      <SortTh col="quantity" label="Qty" align="right" />
                      <SortTh col="unit_price" label="Unit price" align="right" />
                      <SortTh col="total" label="Total" align="right" />
                      <SortTh col="status" label="Status" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => (
                      <tr key={row.order_id || i} onClick={() => setSelectedOrder(row)}>
                        <td className="mono">{row.order_id || "—"}</td>
                        <td>{row.date || "—"}</td>
                        <td className="strong-cell">{row.product || "—"}</td>
                        <td>{row.category || "—"}</td>
                        <td>{row.packaging || "—"}</td>
                        <td className="align-right">{fmtInt(row.quantity)}</td>
                        <td className="align-right">{fmtCurrency(row.unit_price)}</td>
                        <td className="align-right strong-cell">{fmtCurrency(row.total)}</td>
                        <td><StatusBadge status={row.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </main>

      {selectedOrder ? (
        <div className="drawer-backdrop" onClick={() => setSelectedOrder(null)}>
          <aside className="order-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" type="button" onClick={() => setSelectedOrder(null)}>×</button>
            <span className="eyebrow">Order preview</span>
            <h2>{selectedOrder.order_id || "Order"}</h2>
            <StatusBadge status={selectedOrder.status} />
            <div className="drawer-total">{fmtCurrency(selectedOrder.total)}</div>
            <div className="drawer-grid">
              <div><span>Date</span><strong>{selectedOrder.date || "—"}</strong></div>
              <div><span>Product</span><strong>{selectedOrder.product || "—"}</strong></div>
              <div><span>Category</span><strong>{selectedOrder.category || "—"}</strong></div>
              <div><span>Packaging</span><strong>{selectedOrder.packaging || "—"}</strong></div>
              <div><span>Quantity</span><strong>{fmtInt(selectedOrder.quantity)}</strong></div>
              <div><span>Unit price</span><strong>{fmtCurrency(selectedOrder.unit_price)}</strong></div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
