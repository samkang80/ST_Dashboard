import { format, parseISO } from 'date-fns';
import type { CurrencyMode, DashboardRow } from './types';

export const toCurrency = (value: number, mode: CurrencyMode) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: mode === 'USD' ? 'USD' : 'KRW',
    maximumFractionDigits: 0,
  }).format(value);

export const normalizeAmount = (value: number, exchangeRate: number, mode: CurrencyMode) =>
  mode === 'USD' ? value / (exchangeRate || 1) : value;

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const monthKey = (date: string) => format(parseISO(date), 'yyyy-MM');

export function projectAggregate(rows: DashboardRow[], projectIds: string[]) {
  return projectIds.map((id) => {
    const revenue = sum(rows.map((r) => Number(r[`${id}_Total_Revenue`] || 0)));
    const ad = sum(rows.map((r) => Number(r[`${id}_Ad_Spend`] || 0)));
    return { id, revenue, ad, profit: revenue - ad, roas: ad > 0 ? revenue / ad : 0 };
  });
}
