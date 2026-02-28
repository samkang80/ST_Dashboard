import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const PROJECT_IDS = [
  ...Array.from({ length: 38 }, (_, i) => `P${i + 1}`),
  ...Array.from({ length: 27 }, (_, i) => `C${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `PC${String(i + 1).padStart(2, '0')}`),
  'PC01M',
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
  PC02: 'PC02',
  PC03: 'PC03',
  PC04: 'PC04',
  PC04P: 'PC04',
  PC04S: 'PC04',
  PC06: 'PC06',
  PC08: 'PC08',
};

const preferredInput = path.resolve('data/data.xlsx');
const fallbackInput = path.resolve('data/※스토리타코 게임 매출실적기록★.xlsx');
const input = fs.existsSync(preferredInput) ? preferredInput : fallbackInput;
const out = path.resolve('src/data/dashboardData.json');

const workbook = XLSX.readFile(input);
const targetSheetName = workbook.SheetNames.includes('앱 실적 합산')
  ? '앱 실적 합산'
  : workbook.SheetNames[0];
const sheet = workbook.Sheets[targetSheetName];
const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
  header: 1,
  raw: false,
  defval: '',
});
const headers = rows[4] as string[];

const projectRevenueCols: Record<string, number[]> = {};
const projectAdCols: Record<string, number[]> = {};

headers.forEach((h, idx) => {
  if (!h) return;
  const match = h.match(/^([A-Z0-9()구]+)\s(총매출|순매출|광고)$/);
  if (!match) return;
  const raw = match[1];
  const id = HEADER_TO_ID[raw] ?? raw;

  if (match[2] === '총매출') {
    if (!projectRevenueCols[id]) projectRevenueCols[id] = [];
    projectRevenueCols[id].push(idx);
  }

  if (match[2] === '광고') {
    if (!projectAdCols[id]) projectAdCols[id] = [];
    projectAdCols[id].push(idx);
  }
});

const parseNumber = (v: unknown) => {
  const source = String(v ?? '').trim();
  if (!source) return 0;

  const normalized = source
    .replace(/[()]/g, '')
    .replace(/,/g, '')
    .replace(/[^0-9.-]/g, '');

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Excel 셀에 통화 기호가 섞여 있어도 KRW 기준으로 정규화한다.
 * - ₩: 그대로 KRW
 * - $: Exchange_Rate를 곱해 KRW로 환산
 * - 기호 없음: 원본 값(기존 데이터 관례상 KRW) 유지
 */
const parseMoneyCellToKrw = (v: unknown, exchangeRate: number) => {
  const raw = String(v ?? '').trim();
  if (!raw) return 0;

  const amount = parseNumber(raw);
  if (!amount) return 0;

  const hasDollar = /[$]|USD/i.test(raw);
  const hasWon = /[₩]|KRW|원/i.test(raw);

  if (hasDollar && exchangeRate > 0) {
    return amount * exchangeRate;
  }

  if (hasWon) {
    return amount;
  }

  return amount;
};

let currentYear = 0;
let currentMonth = 0;
let lastKnownExchangeRate = 1300;

const records = rows.slice(5).flatMap((r) => {
  const rawYear = String(r[0] ?? '').trim();
  const rawMonth = String(r[1] ?? '').trim();
  const rawDay = String(r[2] ?? '').trim();

  // C열의 "3월", "4월" 같은 월 합계 행은 중복 집계 방지를 위해 제외
  if (/월/.test(rawDay)) {
    return [];
  }

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

  const rawExchangeRate = parseNumber(r[4]);
  if (rawExchangeRate > 0) {
    lastKnownExchangeRate = rawExchangeRate;
  }

  const exchangeRate = rawExchangeRate > 0 ? rawExchangeRate : lastKnownExchangeRate;

  const rec: Record<string, number | string> = {
    Date: isoDate,
    Exchange_Rate: exchangeRate,
    Total_Revenue_Sum: parseMoneyCellToKrw(r[5], exchangeRate),
    Net_Revenue_Sum: parseMoneyCellToKrw(r[6], exchangeRate),
    Total_Ad_Spend: parseMoneyCellToKrw(r[7], exchangeRate),
    Gross_Profit: parseMoneyCellToKrw(r[8], exchangeRate),
  };

  PROJECT_IDS.forEach((id) => {
    const revenueCols = projectRevenueCols[id] ?? [];
    const adCols = projectAdCols[id] ?? [];

    rec[`${id}_Total_Revenue`] = revenueCols.reduce(
      (acc, colIdx) => acc + parseMoneyCellToKrw(r[colIdx], exchangeRate),
      0,
    );

    rec[`${id}_Ad_Spend`] = adCols.reduce(
      (acc, colIdx) => acc + parseMoneyCellToKrw(r[colIdx], exchangeRate),
      0,
    );
  });

  return rec;
});

fs.writeFileSync(out, JSON.stringify({ rows: records, projectIds: PROJECT_IDS }, null, 2));
console.log(`Source: ${input}`);
console.log(`Sheet: ${targetSheetName}`);
console.log(`Wrote ${records.length} rows to ${out}`);
