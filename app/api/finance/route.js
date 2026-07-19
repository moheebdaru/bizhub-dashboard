// app/api/finance/route.js
// This runs on the server — your API key is never exposed to the browser
//
// Expects a Google Sheet tab named "Finance Dashboard Input" with two columns:
//   Metric | Value
// e.g. Revenue | 102000
//      COGS | 48300
//      Fixed Costs | 11400
//      Net Income | 42300
// This mirrors the finance model built in daru_finance_master.xlsx — point
// FINANCE_SHEET_ID at that same spreadsheet once it's uploaded to Google Sheets.

export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY;
  const sheetId = process.env.FINANCE_SHEET_ID || process.env.SHEET_ID;

  if (!apiKey || !sheetId) {
    return Response.json(
      { error: "Missing GOOGLE_API_KEY or FINANCE_SHEET_ID (or SHEET_ID) in environment variables." },
      { status: 500 }
    );
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Finance%20Dashboard%20Input?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      // Revalidate cache every 60 seconds — same live-sync cadence as the sales feed
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Google Sheets error: ${text}` }, { status: 500 });
    }

    const json = await res.json();
    const rows = json.values || [];

    if (rows.length < 2) {
      return Response.json({ metrics: {} });
    }

    // First row is headers (Metric, Value), rest are data pairs
    const metrics = {};
    rows.slice(1).forEach(([metric, value]) => {
      if (!metric) return;
      const numeric = parseFloat(String(value).replace(/,/g, ""));
      metrics[metric.trim()] = Number.isNaN(numeric) ? value : numeric;
    });

    return Response.json({ metrics });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
