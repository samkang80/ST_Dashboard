import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const PROJECT_IDS = [
  ...Array.from({ length: 38 }, (_, i) => `P${i + 1}`),
  ...Array.from({ length: 27 }, (_, i) => `C${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `PC${String(i + 1).padStart(2, '0')}`),
  'G1',
  'H1',
] as const;

const HEADER_TO_ID: Record<string, string> = {
  P2G: 'P2',
  P4K: 'P4',
  P4G: 'P4',
  '(구)P13': 'P13',
  C1K: 'C1',
  C1G: 'C1',
  PC01: 'PC01',
  PC01M: 'PC01',
  PC02: 'PC02',
  PC03: 'PC03',
  PC04: 'PC04',
  PC04P: 'PC04',
  PC04S: 'PC04',
  PC06: 'PC06',
  PC08: 'PC08',
};

const input = path.resolve('data/※스토리타코 게임 매출실적기록★.xlsx');
const out = path.resolve('src/data/dashboardData.json');

const workbook = XLSX.readFile(input);
const sheet = workbook.Sheets['앱 실적 합산'];
const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, raw: false, defval: '' });
const headers = rows[4] as string[];

const projectRevenueCols: Record<string, number> = {};
const projectAdCols: Record<string, number> = {};

headers.forEach((h, idx) => {
  if (!h) return;
  const match = h.match(/^([A-Z0-9()구]+)\s(총매출|순매출|광고)$/);
  if (!match) return;
  const raw = match[1];
  const id = HEADER_TO_ID[raw] ?? raw;
  if (match[2] === '총매출') projectRevenueCols[id] = idx;
  if (match[2] === '광고') projectAdCols[id] = idx;
});

const num = (v: unknown) => {
  const s = String(v ?? '').replace(/[^0-9.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

let currentYear = 0;
let currentMonth = 0;

const records = rows.slice(5).flatMap((r) => {
  const rawYear = String(r[0] ?? '').trim();
  const rawMonth = String(r[1] ?? '').trim();
  const rawDay = String(r[2] ?? '').trim();

  if (rawYear) {
    const y = Number(rawYear.replace(/[^0-9]/g, ''));
    if (y) currentYear = y;
  }

  if (rawMonth) {
    const m = Number(rawMonth.replace(/[^0-9]/g, ''));
    if (m) currentMonth = m;
  }

  const day = Number(rawDay.replace(/[^0-9]/g, ''));
  if (!currentYear || !currentMonth || !day) return [];

  const isoDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const rec: Record<string, number | string> = {
    Date: isoDate,
    Exchange_Rate: num(r[4]),
    Total_Revenue_Sum: num(r[5]),
    Net_Revenue_Sum: num(r[6]),
    Total_Ad_Spend: num(r[7]),
    Gross_Profit: num(r[8]),
  };

  PROJECT_IDS.forEach((id) => {
    rec[`${id}_Total_Revenue`] = projectRevenueCols[id] !== undefined ? num(r[projectRevenueCols[id]]) : 0;
    rec[`${id}_Ad_Spend`] = projectAdCols[id] !== undefined ? num(r[projectAdCols[id]]) : 0;
  });

  return rec;
});

fs.writeFileSync(out, JSON.stringify({ rows: records, projectIds: PROJECT_IDS }, null, 2));
console.log(`Wrote ${records.length} rows to ${out}`);
