// app/api/shopify/route.js
// This runs on the server — your Shopify access token is never exposed to the browser
//
// Requires an Admin API access token with these read scopes:
//   read_orders, read_products, read_inventory, read_locations,
//   read_fulfillments, read_returns

const API_VERSION = "2024-10";

async function shopifyFetch(domain, token, path) {
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/${path}`, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    // Revalidate cache every 60 seconds — same live-sync cadence as the sales feed
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error (${path}): ${res.status} ${text}`);
  }

  return res.json();
}

export async function GET() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!domain || !token) {
    return Response.json(
      { error: "Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN in environment variables." },
      { status: 500 }
    );
  }

  try {
    const [shopData, ordersData, productsData, locationsData] = await Promise.all([
      shopifyFetch(domain, token, "shop.json"),
      shopifyFetch(
        domain,
        token,
        "orders.json?status=any&limit=50&order=created_at desc&fields=id,name,created_at,cancelled_at,total_price,financial_status,fulfillment_status,refunds"
      ),
      shopifyFetch(domain, token, "products.json?limit=50"),
      shopifyFetch(domain, token, "locations.json"),
    ]);

    const shop = shopData.shop || {};
    const orders = ordersData.orders || [];
    const products = productsData.products || [];
    const locations = locationsData.locations || [];

    const currency = shop.currency || "USD";

    // --- Orders & revenue ---
    const activeOrders = orders.filter((o) => !o.cancelled_at);
    const totalRevenue = activeOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
    const totalOrders = orders.length;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todaysOrders = activeOrders.filter((o) => new Date(o.created_at) >= startOfDay);
    const todaysRevenue = todaysOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);

    // --- Fulfillment breakdown: fulfilled / partial / pending / cancelled ---
    const fulfillmentCounts = { fulfilled: 0, partial: 0, pending: 0, cancelled: 0 };
    orders.forEach((o) => {
      if (o.cancelled_at) fulfillmentCounts.cancelled += 1;
      else if (o.fulfillment_status === "fulfilled") fulfillmentCounts.fulfilled += 1;
      else if (o.fulfillment_status === "partial") fulfillmentCounts.partial += 1;
      else fulfillmentCounts.pending += 1;
    });

    // --- Returns / refunds ---
    const ordersWithRefunds = orders.filter((o) => (o.refunds || []).length > 0);
    const totalRefunded = ordersWithRefunds.reduce((sum, o) => {
      const orderRefundTotal = (o.refunds || []).reduce((rSum, refund) => {
        const txTotal = (refund.transactions || []).reduce((tSum, tx) => tSum + (parseFloat(tx.amount) || 0), 0);
        return rSum + txTotal;
      }, 0);
      return sum + orderRefundTotal;
    }, 0);

    const returns = {
      returnedOrderCount: ordersWithRefunds.length,
      totalRefunded,
    };

    // --- Inventory & products breakdown ---
    const locationNames = Object.fromEntries(locations.map((l) => [l.id, l.name]));

    const productSummaries = products.map((p) => {
      const variants = p.variants || [];
      const totalInventory = variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0);
      const price = variants[0] ? parseFloat(variants[0].price) : 0;
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        price,
        inventory: totalInventory,
        inventoryValue: totalInventory * price,
        variantCount: variants.length,
      };
    });

    const totalInventoryUnits = productSummaries.reduce((sum, p) => sum + p.inventory, 0);
    const totalInventoryValue = productSummaries.reduce((sum, p) => sum + p.inventoryValue, 0);

    const lowStock = productSummaries
      .filter((p) => p.inventory <= 10)
      .sort((a, b) => a.inventory - b.inventory);

    return Response.json({
      shop: { name: shop.name, domain: shop.domain, currency },
      metrics: {
        totalRevenue,
        totalOrders,
        todaysRevenue,
        todaysOrderCount: todaysOrders.length,
        avgOrderValue: activeOrders.length ? totalRevenue / activeOrders.length : 0,
      },
      fulfillmentCounts,
      returns,
      inventory: {
        totalUnits: totalInventoryUnits,
        totalValue: totalInventoryValue,
        locationCount: locations.length,
        locationNames: Object.values(locationNames),
      },
      products: productSummaries,
      lowStock,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
