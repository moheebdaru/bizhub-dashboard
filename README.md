# BizHub — Sales Dashboard

Live sales, finance, and Shopify analytics. Built with Next.js, deployed free on Vercel.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your environment variables
Create a `.env.local` file in the root folder:
```
GOOGLE_API_KEY=your_google_api_key_here
SHEET_ID=your_google_sheet_id_here
FINANCE_SHEET_ID=your_finance_google_sheet_id_here
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=your_shopify_admin_api_access_token_here
```
See `.env.example` for details on each. The Finance and Shopify feeds are optional —
the dashboard degrades gracefully and shows a "not connected" message per panel if
either is left unconfigured.

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:3000

### 4. Deploy to Vercel
- Push this folder to a GitHub repo
- Connect the repo on vercel.com
- Add all environment variables above in Vercel → Settings → Environment Variables
- Deploy!

## Google Sheet format — Sales feed

Your sheet's first row must have these exact headers:
```
order_id | date | product | category | packaging | quantity | unit_price | total | status
```

- Dates: YYYY-MM-DD
- Status: Fulfilled / Pending / Cancelled

## Google Sheet format — Finance feed

`FINANCE_SHEET_ID` points at the `daru_finance_master` Google Sheet directly — no
separate input tab needed. The API route reads these cells straight from its
`P&L Statement` tab:
```
Revenue        -> 'P&L Statement'!B5
COGS           -> 'P&L Statement'!B6
Gross Profit   -> 'P&L Statement'!B7
Fixed Costs    -> 'P&L Statement'!B8
Net Income     -> 'P&L Statement'!B9
```
Two requirements for this to work:
1. The workbook must be a **native Google Sheet** (File → Save as Google Sheets if
   it's still an uploaded `.xlsx`), since the Sheets API can't read raw Excel files.
2. Sharing must be set to **Anyone with the link: Viewer** (Share button, top right),
   since this route uses a simple API key rather than full OAuth.

## Shopify feed — Admin API setup

1. In Shopify Admin: **Settings → Apps and sales channels → Develop apps → Create an app**.
2. Under **Configuration**, grant Admin API scopes: `read_orders`, `read_products`.
3. Install the app and copy the **Admin API access token**.
4. Set `SHOPIFY_STORE_DOMAIN` (your `.myshopify.com` domain, not a custom domain) and
   `SHOPIFY_ADMIN_ACCESS_TOKEN` in your environment variables.

The Shopify panel shows live revenue (last 50 orders), today's orders, average order
value, and a low-stock list (≤10 units) pulled directly from the Shopify Admin API.

## How live sync works
The dashboard fetches sales, finance, and Shopify data every 60 seconds automatically.
Each API route uses Next.js cache revalidation so Vercel only calls the upstream API
once per minute per feed — stays within free limits.
