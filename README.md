# BizHub — Sales Dashboard

Live sales analytics synced from Google Sheets. Built with Next.js, deployed free on Vercel.

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
```

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:3000

### 4. Deploy to Vercel
- Push this folder to a GitHub repo
- Connect the repo on vercel.com
- Add GOOGLE_API_KEY and SHEET_ID in Vercel → Settings → Environment Variables
- Deploy!

## Google Sheet format

Your sheet's first row must have these exact headers:
```
order_id | date | product | category | packaging | quantity | unit_price | total | status
```

- Dates: YYYY-MM-DD
- Status: Fulfilled / Pending / Cancelled

## How live sync works
The dashboard fetches your sheet every 60 seconds automatically.
The API route uses Next.js cache revalidation so Vercel only calls Google once per minute — stays within free limits.
