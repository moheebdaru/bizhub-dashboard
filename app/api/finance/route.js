// app/api/finance/route.js
// This runs on the server — your API key is never exposed to the browser
//
// Reads live figures directly from the "P&L Statement" tab of the
// daru_finance_master Google Sheet (built from daru_finance_master.xlsx).
// Requires the sheet to have general access set to "Anyone with the link:
// Viewer" since this uses a simple API key rather than full OAuth.

const CELLS = {
  revenue: "'P&L Statement'!B5",
  cogs: "'P&L Statement'!B6",
  grossProfit: "'P&L Statement'!B7",
  fixedCosts: "'P&L Statement'!B8",
  netIncome: "'P&L Statement'!B9",
};

export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY;
  const sheetId = process.env.FINANCE_SHEET_ID || process.env.SHEET_ID;

  if (!apiKey || !sheetId) {
    return Response.json(
      { error: "Missing GOOGLE_API_KEY or FINANCE_SHEET_ID (or SHEET_ID) in environment variables." },
      { status: 500 }
    );
  }

  const ranges = Object.values(CELLS).map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges}&key=${apiKey}`;

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
    const ranges = json.valueRanges || [];

    function valueAt(index) {
      const raw = ranges[index]?.values?.[0]?.[0];
      if (raw === undefined) return null;
      const numeric = parseFloat(String(raw).replace(/[,()]/g, ""));
      return Number.isNaN(numeric) ? raw : Math.abs(numeric);
    }

    const keys = Object.keys(CELLS);
    const metrics = {
      Revenue: valueAt(keys.indexOf("revenue")),
      COGS: valueAt(keys.indexOf("cogs")),
      "Gross Profit": valueAt(keys.indexOf("grossProfit")),
      "Fixed Costs": valueAt(keys.indexOf("fixedCosts")),
      "Net Income": valueAt(keys.indexOf("netIncome")),
    };

    return Response.json({ metrics });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
