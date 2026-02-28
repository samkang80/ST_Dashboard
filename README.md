# ST Dashboard (Vite + React)

Dark glassmorphism dashboard for StoryTaco portfolio revenue/ad analytics.

## Stack
- React + Vite + TypeScript
- Tailwind CSS
- Recharts
- TanStack Table
- lucide-react
- framer-motion
- shadcn-style UI primitives (`Card`, `Button`, `Input`)

## Features
- Global KPI cards
  - Total Portfolio Revenue + MoM growth
  - Net Revenue Performance
  - Total ROAS
  - Profit Margin %
- Main synchronized trend chart: Revenue vs Ad Spend
- Project efficiency matrix (Top 10)
- Project performance table (search + sort)
- Currency toggle (KRW / USD via `Exchange_Rate`)
- Date range filtering and year/month/day granularity
- Smart group aggregates for P / C / PC series

## Data source
Excel file (downloaded with rclone):
- Remote: `momo_dropbox:`
- Preferred path: `OpenClaw/data.xlsx`
- Fallback path: `OpenClaw/※스토리타코 게임 매출실적기록★.xlsx`

Transformed JSON:
- `src/data/dashboardData.json`

Currency normalization rules during transform:
- Cells with `₩` / `KRW` are treated as KRW.
- Cells with `$` / `USD` are converted to KRW using row-level `Exchange_Rate`.
- Cells without currency symbol are treated as local (KRW) numeric values.
- If `Exchange_Rate` is missing on a row, the last known valid rate is forward-filled.
- Rows where column C contains month summary labels like `3월`, `4월` are excluded to prevent double counting.

## Setup
```bash
npm install
npm run transform-data
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Refresh data from Excel
```bash
mkdir -p data
rclone copy "momo_dropbox:OpenClaw/data.xlsx" ./data -v
npm run transform-data
```

## Schema support
Primary columns:
- `Date`, `Exchange_Rate`, `Total_Revenue_Sum`, `Net_Revenue_Sum`, `Total_Ad_Spend`, `Gross_Profit`

Project columns (generated):
- Revenue: `P1_Total_Revenue` ~ `P38_Total_Revenue`, `C1_Total_Revenue` ~ `C27_Total_Revenue`, `PC01_Total_Revenue` ~ `PC08_Total_Revenue`, `G1_Total_Revenue`, `H1_Total_Revenue`
- Ads: matching `*_Ad_Spend`

Missing columns in source are filled with `0` so the app stays stable.
