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

Add a tab named `Finance Dashboard Input` with two columns:
```
Metric | Value
Revenue | 102000
COGS | 48300
Fixed Costs | 11400
Net Income | 42300
```
This mirrors the P&L model built in `daru_finance_master.xlsx` — once that workbook
is uploaded to Google Sheets, add a tab with this exact name and layout, pulling the
values from its `P&L Statement` sheet (e.g. `='P&L Statement'!B5`).

## Shopify feed — Admin API setup

1. In Shopify Admin: **Settings → Apps and sales channels → Develop apps → Create an app**.
2. Under **Configuration**, grant Admin API scopes: `read_orders`, `read_products`.
3. Install the app and copy the **Admin API access token**.
4. Set `SHOPIFY_STORE_DOMAIN` (e.g. `daru-eg.myshopify.com`) and
   `SHOPIFY_ADMIN_ACCESS_TOKEN` in your environment variables.

The Shopify panel shows live revenue (last 50 orders), today's orders, average order
value, and a low-stock list (≤10 units) pulled directly from the Shopify Admin API.

## How live sync works
The dashboard fetches sales, finance, and Shopify data every 60 seconds automatically.
Each API route uses Next.js cache revalidation so Vercel only calls the upstream API
once per minute per feed — stays within free limits.
