// app/api/sales/route.js
// This runs on the server — your API key is never exposed to the browser

export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY;
  const sheetId = process.env.SHEET_ID;

  if (!apiKey || !sheetId) {
    return Response.json(
      { error: "Missing GOOGLE_API_KEY or SHEET_ID in environment variables." },
      { status: 500 }
    );
  }

  // Fetch all rows from Sheet1 (first tab)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Order%20Data%20Dashboard%20Input?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      // Revalidate cache every 60 seconds — this is your "live sync" interval
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Google Sheets error: ${text}` }, { status: 500 });
    }

    const json = await res.json();
    const rows = json.values || [];

    if (rows.length < 2) {
      return Response.json({ rows: [] });
    }

    // First row is headers, rest are data
    const headers = rows[0];
    const data = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i] ?? "";
      });
      return obj;
    });

    return Response.json({ rows: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
