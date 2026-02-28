import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { BarChart3, DollarSign, Gauge, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rows, projectIds, groupedProjectIds } from '@/lib/data';
import {
  monthKey,
  normalizeAmount,
  projectAggregate,
  sum,
  toCompactNumber,
  toCurrency,
  toNumber,
} from '@/lib/metrics';
import { ProjectTable } from '@/components/dashboard/ProjectTable';
import type { CurrencyMode } from '@/lib/types';

function App() {
  const [currency, setCurrency] = useState<CurrencyMode>('LOCAL');
  const [startDate, setStartDate] = useState(rows[0]?.Date ?? '2018-01-01');
  const [endDate, setEndDate] = useState(rows.at(-1)?.Date ?? '2030-01-01');
  const [granularity, setGranularity] = useState<'year' | 'month' | 'day'>('month');

  const inRange = useMemo(
    () => rows.filter((r) => r.Date >= startDate && r.Date <= endDate),
    [startDate, endDate],
  );

  const enriched = useMemo(
    () =>
      inRange.map((r) => ({
        ...r,
        rev: normalizeAmount(r.Total_Revenue_Sum, r.Exchange_Rate, currency),
        net: normalizeAmount(r.Net_Revenue_Sum, r.Exchange_Rate, currency),
        ad: normalizeAmount(r.Total_Ad_Spend, r.Exchange_Rate, currency),
        profit: normalizeAmount(r.Gross_Profit, r.Exchange_Rate, currency),
      })),
    [currency, inRange],
  );

  const dateKey = (d: string) =>
    granularity === 'year'
      ? format(parseISO(d), 'yyyy')
      : granularity === 'month'
        ? monthKey(d)
        : d;

  const trend = useMemo(() => {
    const map = new Map<string, { period: string; revenue: number; ad: number }>();

    for (const r of enriched) {
      const key = dateKey(r.Date);
      const old = map.get(key) ?? { period: key, revenue: 0, ad: 0 };
      old.revenue += r.rev;
      old.ad += r.ad;
      map.set(key, old);
    }

    return Array.from(map.values());
  }, [enriched, granularity]);

  const totalRevenue = sum(enriched.map((r) => r.rev));
  const totalNet = sum(enriched.map((r) => r.net));
  const totalAd = sum(enriched.map((r) => r.ad));
  const totalProfit = sum(enriched.map((r) => r.profit));
  const roas = totalAd ? totalRevenue / totalAd : 0;
  const margin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;

  const mom =
    trend.length > 1
      ? ((trend.at(-1)!.revenue - trend.at(-2)!.revenue) / (trend.at(-2)!.revenue || 1)) * 100
      : 0;

  const projects = projectAggregate(inRange, projectIds, currency).sort(
    (a, b) => b.revenue - a.revenue,
  );
  const top10 = projects.slice(0, 10);

  const grouped = {
    P: sum(projects.filter((p) => groupedProjectIds.P.includes(p.id)).map((p) => p.revenue)),
    C: sum(projects.filter((p) => groupedProjectIds.C.includes(p.id)).map((p) => p.revenue)),
    PC: sum(projects.filter((p) => groupedProjectIds.PC.includes(p.id)).map((p) => p.revenue)),
  };

  type ScatterDatum = {
    id: string;
    revenue: number;
    ad: number;
    profit: number;
    roas: number;
  };

  type ScatterTooltipProps = {
    active?: boolean;
    payload?: ReadonlyArray<{ payload: ScatterDatum }>;
  };

  const renderProjectTooltip = ({ active, payload }: ScatterTooltipProps) => {
    if (!active || !payload?.length) return null;

    const point = payload[0].payload;

    return (
      <div className="rounded-md border border-zinc-300 bg-white p-3 text-xs text-zinc-900 shadow-lg">
        <p className="mb-2 text-sm font-semibold">프로젝트: {point.id}</p>
        <p>매출: {toCurrency(point.revenue, currency)}</p>
        <p>광고비: {toCurrency(point.ad, currency)}</p>
        <p>이익: {toCurrency(point.profit, currency)}</p>
        <p>ROAS: {point.roas.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 lg:grid-cols-[250px_1fr]">
        <Card className="h-fit p-4">
          <h1 className="mb-4 text-xl font-semibold">ST 대시보드</h1>
          <div className="space-y-2 text-sm text-zinc-300">
            <div>전체 개요</div>
            <div>프로젝트 상세</div>
            <div>광고 효율</div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={() => setCurrency('LOCAL')}>KRW</Button>
            <Button onClick={() => setCurrency('USD')}>USD</Button>
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => setGranularity('year')}>연</Button>
              <Button onClick={() => setGranularity('month')}>월</Button>
              <Button onClick={() => setGranularity('day')}>일</Button>
            </div>
          </div>

          <div className="mt-4 text-xs text-zinc-400">
            <p className="mb-1 font-medium">그룹</p>
            <p>P {toCurrency(grouped.P, currency)}</p>
            <p>C {toCurrency(grouped.C, currency)}</p>
            <p>PC {toCurrency(grouped.PC, currency)}</p>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                t: '포트폴리오 총매출',
                v: toCurrency(totalRevenue, currency),
                s: `전월 대비 ${mom.toFixed(1)}%`,
                i: TrendingUp,
              },
              {
                t: '순매출',
                v: toCurrency(totalNet, currency),
                s: '실현 순매출',
                i: DollarSign,
              },
              {
                t: '총 ROAS',
                v: roas.toLocaleString('en-US', { maximumFractionDigits: 2 }),
                s: '매출 / 광고비',
                i: Gauge,
              },
              {
                t: '이익률 %',
                v: `${margin.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`,
                s: '매출이익 / 매출',
                i: BarChart3,
              },
            ].map((k) => (
              <motion.div key={k.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">{k.t}</p>
                    <k.i size={16} />
                  </div>
                  <p className="mt-2 text-xl font-semibold">{k.v}</p>
                  <p className="text-xs text-zinc-400">{k.s}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-medium">매출 vs 광고비 추이</h2>
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={trend} syncId="main" margin={{ top: 8, right: 16, bottom: 8, left: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="period" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                  <YAxis
                    width={82}
                    tick={{ fill: '#a1a1aa', fontSize: 12 }}
                    tickFormatter={(value) => toCompactNumber(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #d4d4d8' }}
                    labelStyle={{ color: '#111827', fontWeight: 700 }}
                    itemStyle={{ color: '#111827' }}
                    formatter={(value, name) => [
                      toCurrency(Number(value), currency),
                      name === 'revenue' ? '매출' : '광고비',
                    ]}
                    labelFormatter={(label) => `기간: ${String(label)}`}
                  />
                  <Area dataKey="revenue" stroke="#22c55e" fill="#22c55e55" />
                  <Area dataKey="ad" stroke="#f97316" fill="#f9731655" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 text-sm font-medium">상위 10개 프로젝트 효율 매트릭스</h2>
              <div className="h-80">
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 12, right: 24, bottom: 20, left: 28 }}>
                    <CartesianGrid stroke="#3f3f46" />
                    <XAxis
                      dataKey="revenue"
                      name="매출"
                      height={40}
                      tick={{ fill: '#a1a1aa', fontSize: 12 }}
                      tickFormatter={(value) => toCompactNumber(Number(value))}
                    />
                    <YAxis
                      dataKey="ad"
                      name="광고비"
                      width={86}
                      tick={{ fill: '#a1a1aa', fontSize: 12 }}
                      tickFormatter={(value) => toCompactNumber(Number(value))}
                    />
                    <ZAxis dataKey="profit" range={[60, 300]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={renderProjectTooltip} />
                    <Scatter data={top10} fill="#60a5fa" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-zinc-400">X축: 매출 · Y축: 광고비 · 원 크기: 이익</p>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-medium">프로젝트 성과 테이블</h2>
              <ProjectTable data={projects} currency={currency} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
