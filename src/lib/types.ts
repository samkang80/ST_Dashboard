export type CurrencyMode = 'LOCAL' | 'USD';

export interface DashboardRow {
  Date: string;
  Exchange_Rate: number;
  Total_Revenue_Sum: number;
  Net_Revenue_Sum: number;
  Total_Ad_Spend: number;
  Gross_Profit: number;
  [key: string]: string | number;
}
