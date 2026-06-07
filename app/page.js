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

function StatusBadge({ status }) {
  const s = normalizeStatus(status).replace(/\s+/g, "-") || "unknown";
  return (
    <span className={`status-badge ${s}`}>
      <span className="status-dot" />
      {status || "—"}
    </span>
  );
}

function MetricCard({ label, value, detail, tone = "green", icon, progress }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-card-top">
        <span className="metric-icon">{icon}</span>
        {typeof progress === "number" && (
          <span className="metric-percent">{Math.max(0, Math.min(100, progress))}%</span>
        )}
      </div>
      <p className="metric-label">{label}</p>
      <h2>{value}</h2>
      <div className="metric-footer">
        <span>{detail}</span>
        {typeof progress === "number" && (
          <div className="mini-progress" aria-hidden="true">
            <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </div>
        )}
      </div>
    </article>
  );
}

function SelectFilter({ label, value, onChange, options, placeholder }) {
  return (
    <label className="filter-field">
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
    <label className="filter-field compact">
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

function EmptyChart({ message }) {
  return <div className="empty-chart">{message}</div>;
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

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
    return rows.filter((r) => {
      if (fProduct && r.product !== fProduct) return false;
      if (fCategory && r.category !== fCategory) return false;
      if (fPackaging && r.packaging !== fPackaging) return false;
      if (fStatus && r.status !== fStatus) return false;
      if (fDateFrom && r.date < fDateFrom) return false;
      if (fDateTo && r.date > fDateTo) return false;

      const price = parseFloat(r.unit_price) || 0;
      if (fPriceMin && price < parseFloat(fPriceMin)) return false;
      if (fPriceMax && price > parseFloat(fPriceMax)) return false;

      const qty = parseInt(r.quantity) || 0;
      if (fQtyMin && qty < parseInt(fQtyMin)) return false;

      return true;
    });
  }, [rows, fProduct, fCategory, fPackaging, fStatus, fDateFrom, fDateTo, fPriceMin, fPriceMax, fQtyMin]);

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
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered]);

  const unitsByCategory = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const key = r.category || "Unknown";
      map[key] = (map[key] || 0) + (parseInt(r.quantity) || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filtered]);

  const statusSummary = useMemo(() => {
    const map = { Fulfilled: 0, Pending: 0, Cancelled: 0, Other: 0 };
    filtered.forEach((r) => {
      const status = normalizeStatus(r.status);
      if (status === "fulfilled") map.Fulfilled += 1;
      else if (status === "pending") map.Pending += 1;
      else if (status === "cancelled") map.Cancelled += 1;
      else map.Other += 1;
    });
    return map;
  }, [filtered]);

  const topProduct = revenueByProduct[0];
  const maxRevenue = revenueByProduct[0]?.value || 1;
  const maxUnits = unitsByCategory[0]?.value || 1;

  const recentOrders = useMemo(() => sorted.slice(0, 6), [sorted]);

  const activeFilterCount = [
    fProduct,
    fCategory,
    fPackaging,
    fStatus,
    fDateFrom,
    fDateTo,
    fPriceMin,
    fPriceMax,
    fQtyMin,
  ].filter(Boolean).length;

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
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
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">BizHub</div>
            <div className="brand-caption">Sales Control Center</div>
          </div>
        </div>

        <div className="sidebar-section">
          <p>Workspace</p>
          <a className="sidebar-link active"><span>⌁</span> Overview</a>
          <a className="sidebar-link muted"><span>□</span> Orders</a>
          <a className="sidebar-link muted"><span>◇</span> Inventory</a>
          <a className="sidebar-link muted"><span>✉</span> Inbox</a>
        </div>

        <div className="sidebar-card">
          <span className="sidebar-card-label">Live sheet sync</span>
          <strong>{lastSync ? lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not synced"}</strong>
          <small>Auto-refreshes every 60 seconds</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="hero-panel">
          <div>
            <div className="eyebrow-row">
              <span className="live-indicator"><span /> Live dashboard</span>
              <span className="sheet-pill">Google Sheets</span>
            </div>
            <h1>Sales Analytics</h1>
            <p>Track orders, products, packaging, quantities, revenue, and fulfillment in one clean view.</p>
          </div>

          <div className="hero-actions">
            {lastSync && <span>Last sync: {lastSync.toLocaleTimeString()}</span>}
            <button className="primary-button" onClick={fetchData} disabled={loading}>
              {loading ? "Syncing…" : "Refresh data"}
            </button>
          </div>
        </header>

        <section className="metrics-grid">
          <MetricCard
            label="Total Revenue"
            value={fmtCurrency(totalRevenue)}
            detail={`${totalOrders} filtered orders`}
            icon="◌"
            tone="green"
            progress={Math.min(100, Math.round((totalRevenue / Math.max(totalRevenue, 1)) * 100))}
          />
          <MetricCard
            label="Units Sold"
            value={fmtInt(totalUnits)}
            detail="Total quantity moved"
            icon="▦"
            tone="blue"
          />
          <MetricCard
            label="Average Order"
            value={fmtCurrency(avgOrderValue)}
            detail="Revenue per order"
            icon="◍"
            tone="gold"
          />
          <MetricCard
            label="Fulfillment Rate"
            value={`${fulfilledPct}%`}
            detail={`${fulfilledCount} fulfilled / ${pendingCount} pending`}
            icon="✓"
            tone={fulfilledPct >= 70 ? "green" : "red"}
            progress={fulfilledPct}
          />
        </section>

        {error && (
          <div className="error-box">
            <strong>Connection issue</strong>
            <span>{error}</span>
            <small>Check your GOOGLE_API_KEY and SHEET_ID in Vercel environment variables, and make sure the sheet is publicly viewable.</small>
          </div>
        )}

        <section className="filter-panel">
          <div className="filter-header">
            <div>
              <h2>Filters</h2>
              <p>{activeFilterCount ? `${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}` : "Showing all live rows"}</p>
            </div>
            <button className="ghost-button" onClick={clearFilters}>Clear filters</button>
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
          <article className="panel large-panel">
            <div className="panel-header">
              <div>
                <h2>Revenue by product</h2>
                <p>{topProduct ? `${topProduct.name} is currently leading` : "No product data yet"}</p>
              </div>
              <span className="panel-chip">Top 6</span>
            </div>

            {loading ? (
              <EmptyChart message="Loading revenue data…" />
            ) : revenueByProduct.length ? (
              <div className="lux-bars">
                {revenueByProduct.map(({ name, value }, index) => (
                  <div className="lux-bar-row" key={name}>
                    <div className="bar-meta">
                      <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                      <span title={name}>{name}</span>
                    </div>
                    <div className="bar-line">
                      <span style={{ width: `${Math.round((value / maxRevenue) * 100)}%` }} />
                    </div>
                    <strong>{fmtCurrency(value)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart message="No rows match the current filters." />
            )}
          </article>

          <article className="panel status-panel">
            <div className="panel-header compact-header">
              <div>
                <h2>Order health</h2>
                <p>Fulfilled vs pending</p>
              </div>
            </div>

            <div
              className="donut"
              style={{
                background: `conic-gradient(var(--success) 0 ${fulfilledPct}%, var(--warning) ${fulfilledPct}% ${Math.min(100, fulfilledPct + (totalOrders ? Math.round((pendingCount / totalOrders) * 100) : 0))}%, var(--danger) 0)`,
              }}
            >
              <div>
                <strong>{fulfilledPct}%</strong>
                <span>fulfilled</span>
              </div>
            </div>

            <div className="status-list">
              <div><span className="legend success" /> Fulfilled <strong>{statusSummary.Fulfilled}</strong></div>
              <div><span className="legend warning" /> Pending <strong>{statusSummary.Pending}</strong></div>
              <div><span className="legend danger" /> Cancelled <strong>{statusSummary.Cancelled}</strong></div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header compact-header">
              <div>
                <h2>Units by category</h2>
                <p>Quantity movement</p>
              </div>
            </div>

            {loading ? (
              <EmptyChart message="Loading category data…" />
            ) : unitsByCategory.length ? (
              <div className="category-list">
                {unitsByCategory.map(({ name, value }) => (
                  <div className="category-item" key={name}>
                    <div>
                      <strong title={name}>{name}</strong>
                      <span>{fmtInt(value)} units</span>
                    </div>
                    <div className="category-meter">
                      <span style={{ width: `${Math.round((value / maxUnits) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart message="No category data yet." />
            )}
          </article>
        </section>

        <section className="lower-grid">
          <article className="panel orders-panel">
            <div className="panel-header">
              <div>
                <h2>Recent activity</h2>
                <p>Latest visible orders after filters</p>
              </div>
              <span className="panel-chip">{recentOrders.length} shown</span>
            </div>

            <div className="activity-list">
              {loading ? (
                <EmptyChart message="Loading orders…" />
              ) : recentOrders.length ? (
                recentOrders.map((order, index) => (
                  <div className="activity-item" key={order.order_id || index}>
                    <div className="activity-icon">{index + 1}</div>
                    <div>
                      <strong>{order.product || "Unnamed product"}</strong>
                      <span>{order.order_id || "No order ID"} · {order.date || "No date"}</span>
                    </div>
                    <div className="activity-right">
                      <strong>{fmtCurrency(order.total)}</strong>
                      <StatusBadge status={order.status} />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyChart message="No recent orders to show." />
              )}
            </div>
          </article>

          <article className="panel table-panel">
            <div className="panel-header">
              <div>
                <h2>Order detail</h2>
                <p>{loading ? "Loading rows…" : `${sorted.length} of ${rows.length} rows`}</p>
              </div>
            </div>

            {loading ? (
              <div className="table-skeleton">
                <span /><span /><span />
              </div>
            ) : sorted.length === 0 ? (
              <div className="empty-state">
                {rows.length === 0
                  ? "No data yet — make sure your Google Sheet has data and your API key is set."
                  : "No rows match the current filters."}
              </div>
            ) : (
              <div className="table-wrap">
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
                      <tr key={row.order_id || i}>
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
    </div>
  );
}
