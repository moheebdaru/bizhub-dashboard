// app/api/shopify/route.js
// This runs on the server — your Shopify access token is never exposed to the browser

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
    const [shopData, ordersData, productsData] = await Promise.all([
      shopifyFetch(domain, token, "shop.json"),
      shopifyFetch(domain, token, "orders.json?status=any&limit=50&order=created_at desc"),
      shopifyFetch(domain, token, "products.json?limit=50"),
    ]);

    const shop = shopData.shop || {};
    const orders = ordersData.orders || [];
    const products = productsData.products || [];

    const currency = shop.currency || "USD";

    const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
    const totalOrders = orders.length;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todaysOrders = orders.filter((o) => new Date(o.created_at) >= startOfDay);
    const todaysRevenue = todaysOrders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);

    const fulfillmentCounts = orders.reduce(
      (acc, o) => {
        const status = o.fulfillment_status || "unfulfilled";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {}
    );

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
        variantCount: variants.length,
      };
    });

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
        avgOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
      },
      fulfillmentCounts,
      products: productSummaries,
      lowStock,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
