import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Gauge,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
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
} from '@/lib/metrics';
import { ProjectTable } from '@/components/dashboard/ProjectTable';
import type { CurrencyMode } from '@/lib/types';

function getHealthMeta(revenue: number, ad: number, roas: number) {
  // Case A: Organic Winner
  if (ad === 0 && revenue > 0) {
    return {
      label: '최상',
      icon: Sparkles,
      className: 'border-lime-400/50 bg-lime-400/15 text-lime-200',
      dotClass: 'bg-lime-300',
      roasDisplay: '유기 성장(∞)',
    };
  }

  // Case B: Burner
  if (ad > 0 && revenue === 0) {
    return {
      label: '치명',
      icon: AlertOctagon,
      className: 'border-rose-500/50 bg-rose-500/15 text-rose-200',
      dotClass: 'bg-rose-400',
      roasDisplay: '0.00',
    };
  }

  // Case C: ROAS based (both > 0)
  if (ad > 0 && revenue > 0) {
    if (roas >= 2) {
      return {
        label: '양호',
        icon: CheckCircle2,
        className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
        dotClass: 'bg-emerald-400',
        roasDisplay: roas.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      };
    }

    if (roas >= 1) {
      return {
        label: '주의',
        icon: AlertTriangle,
        className: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
        dotClass: 'bg-amber-400',
        roasDisplay: roas.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      };
    }

    return {
      label: '위험',
      icon: AlertOctagon,
      className: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
      dotClass: 'bg-rose-400',
      roasDisplay: roas.toLocaleString('en-US', { maximumFractionDigits: 2 }),
    };
  }

  return {
    label: '대기',
    icon: AlertTriangle,
    className: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
    dotClass: 'bg-zinc-400',
    roasDisplay: 'N/A',
  };
}

function App() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const latestDataDate = rows.at(-1)?.Date ?? todayIso;
  const defaultEndDate = latestDataDate > todayIso ? todayIso : latestDataDate;

  const [currency, setCurrency] = useState<CurrencyMode>('LOCAL');
  const [startDate, setStartDate] = useState(rows[0]?.Date ?? '2018-01-01');
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [granularity, setGranularity] = useState<'year' | 'month' | 'day'>('month');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const inRange = useMemo(
    () => rows.filter((r) => r.Date >= startDate && r.Date <= endDate && r.Date <= todayIso),
    [startDate, endDate, todayIso],
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

  const projects = useMemo(
    () => projectAggregate(inRange, projectIds, currency).sort((a, b) => b.revenue - a.revenue),
    [currency, inRange],
  );

  const top10 = projects.slice(0, 10);

  const grouped = {
    P: sum(projects.filter((p) => groupedProjectIds.P.includes(p.id)).map((p) => p.revenue)),
    C: sum(projects.filter((p) => groupedProjectIds.C.includes(p.id)).map((p) => p.revenue)),
    PC: sum(projects.filter((p) => groupedProjectIds.PC.includes(p.id)).map((p) => p.revenue)),
  };

  const projectDaily = useMemo(() => {
    if (!selectedProject) return [];

    return inRange
      .map((r) => ({
        date: r.Date,
        revenue: normalizeAmount(
          Number(r[`${selectedProject}_Total_Revenue`] || 0),
          r.Exchange_Rate,
          currency,
        ),
        ad: normalizeAmount(Number(r[`${selectedProject}_Ad_Spend`] || 0), r.Exchange_Rate, currency),
      }))
      .filter((r) => r.revenue > 0 || r.ad > 0);
  }, [currency, inRange, selectedProject]);

  const monthlyProfit = useMemo(() => {
    if (!selectedProject) return [];

    const map = new Map<string, { month: string; profit: number }>();

    for (const row of projectDaily) {
      const key = monthKey(row.date);
      const old = map.get(key) ?? { month: key, profit: 0 };
      old.profit += row.revenue - row.ad;
      map.set(key, old);
    }

    return Array.from(map.values());
  }, [projectDaily, selectedProject]);

  const selectedSummary = useMemo(() => {
    if (!selectedProject) return null;

    const selected = projects.find((p) => p.id === selectedProject);
    if (!selected) return null;

    const roasComparable = (revenue: number, ad: number, roas: number) => {
      if (ad > 0) return roas;
      if (revenue > 0) return 3; // Organic winner baseline for comparison scale
      return 0;
    };

    const otherProjects = projects.filter((p) => p.id !== selectedProject);
    const avgOtherRevenue =
      otherProjects.length > 0
        ? sum(otherProjects.map((p) => p.revenue)) / otherProjects.length
        : 0;
    const avgOtherRoas =
      otherProjects.length > 0
        ? sum(otherProjects.map((p) => roasComparable(p.revenue, p.ad, p.roas))) / otherProjects.length
        : 0;

    const selectedRoasComparable = roasComparable(selected.revenue, selected.ad, selected.roas);

    const portfolioContribution = totalRevenue > 0 ? (selected.revenue / totalRevenue) * 100 : 0;

    const revenueDelta = selected.revenue - avgOtherRevenue;
    const roasDelta = selectedRoasComparable - avgOtherRoas;

    const revenueDeltaPct =
      avgOtherRevenue > 0 ? Number(((revenueDelta / avgOtherRevenue) * 100).toFixed(1)) : 0;
    const roasDeltaPct = avgOtherRoas > 0 ? Number(((roasDelta / avgOtherRoas) * 100).toFixed(1)) : 0;

    const isOrganicWinner = selected.ad === 0 && selected.revenue > 0;
    const isNoSpendNoRevenue = selected.ad === 0 && selected.revenue === 0;

    const roasComparison = isOrganicWinner
      ? {
          label: 'ROAS 비교 제외',
          value: '광고비 0원 · 유기 성장(∞)',
          className: 'border-lime-500/40 bg-lime-500/10 text-lime-200',
          barClass: 'bg-lime-300',
          strengthPct: 100,
        }
      : isNoSpendNoRevenue
        ? {
            label: 'ROAS 비교 불가',
            value: '광고비/매출 데이터 없음',
            className: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
            barClass: 'bg-zinc-400',
            strengthPct: 0,
          }
        : {
            label: `ROAS ${roasDelta >= 0 ? '우위' : '열위'}`,
            value: `${roasDelta >= 0 ? '+' : ''}${roasDeltaPct}%`,
            className:
              roasDelta >= 0
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-200',
            barClass: roasDelta >= 0 ? 'bg-emerald-300' : 'bg-rose-300',
            strengthPct: Math.min(100, Math.abs(roasDeltaPct)),
          };

    const revenueBase = Math.max(selected.revenue, avgOtherRevenue, 1);
    const roasBase = Math.max(selectedRoasComparable, avgOtherRoas, 1);

    const benchmarkBars = [
      {
        metric: '매출',
        valueType: 'currency' as const,
        selectedRaw: selected.revenue,
        othersRaw: avgOtherRevenue,
        selectedIndex: (selected.revenue / revenueBase) * 100,
        othersIndex: (avgOtherRevenue / revenueBase) * 100,
      },
      {
        metric: 'ROAS',
        valueType: 'ratio' as const,
        selectedRaw: selectedRoasComparable,
        othersRaw: avgOtherRoas,
        selectedIndex: (selectedRoasComparable / roasBase) * 100,
        othersIndex: (avgOtherRoas / roasBase) * 100,
      },
    ];

    return {
      selected,
      avgOtherRevenue,
      avgOtherRoas,
      portfolioContribution,
      benchmarkBars,
      revenueDelta,
      roasDelta,
      revenueDeltaPct,
      roasDeltaPct,
      revenueStrengthPct: Math.min(100, Math.abs(revenueDeltaPct)),
      roasComparison,
    };
  }, [projects, selectedProject, totalRevenue]);

  const health = getHealthMeta(
    selectedSummary?.selected.revenue ?? 0,
    selectedSummary?.selected.ad ?? 0,
    selectedSummary?.selected.roas ?? 0,
  );
  const HealthIcon = health.icon;

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
            <Input
              type="date"
              value={startDate}
              max={todayIso}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              value={endDate}
              max={todayIso}
              onChange={(e) => setEndDate(e.target.value)}
            />
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
          <AnimatePresence mode="wait">
            {selectedProject && selectedSummary ? (
              <motion.div
                key={`deep-${selectedProject}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Project Deep-dive</p>
                    <h2 className="text-2xl font-semibold">{selectedProject} 상세 분석</h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${health.className}`}
                    >
                      <HealthIcon className="h-3.5 w-3.5" />
                      상태: {health.label}
                    </span>
                    <Button
                      onClick={() => setSelectedProject(null)}
                      className="inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      전체 개요로 돌아가기
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Card>
                    <p className="text-xs text-zinc-400">누적 매출</p>
                    <p className="mt-2 text-xl font-semibold">
                      {toCurrency(selectedSummary.selected.revenue, currency)}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs text-zinc-400">누적 광고비</p>
                    <p className="mt-2 text-xl font-semibold">
                      {toCurrency(selectedSummary.selected.ad, currency)}
                    </p>
                  </Card>
                  <Card>
                    <p className="text-xs text-zinc-400">프로젝트 ROAS</p>
                    <p className="mt-2 text-xl font-semibold">{health.roasDisplay}</p>
                  </Card>
                  <Card>
                    <p className="text-xs text-zinc-400">포트폴리오 기여도</p>
                    <p className="mt-2 text-xl font-semibold">
                      {selectedSummary.portfolioContribution.toLocaleString('en-US', {
                        maximumFractionDigits: 1,
                      })}
                      %
                    </p>
                  </Card>
                </div>

                <Card>
                  <h2 className="mb-3 text-sm font-medium">일별 매출 vs 광고비 추이</h2>
                  <div className="h-72">
                    <ResponsiveContainer>
                      <LineChart data={projectDaily} margin={{ top: 8, right: 16, bottom: 8, left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                        <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 11 }} minTickGap={24} />
                        <YAxis
                          width={78}
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
                          labelFormatter={(label) => `날짜: ${String(label)}`}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#22c55e" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="ad" stroke="#f97316" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <h2 className="mb-3 text-sm font-medium">월별 매출이익 (매출-광고비)</h2>
                    <div className="h-72">
                      <ResponsiveContainer>
                        <BarChart data={monthlyProfit} margin={{ top: 8, right: 12, bottom: 8, left: 18 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                          <XAxis dataKey="month" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                          <YAxis
                            width={72}
                            tick={{ fill: '#a1a1aa', fontSize: 12 }}
                            tickFormatter={(value) => toCompactNumber(Number(value))}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #d4d4d8' }}
                            labelStyle={{ color: '#111827', fontWeight: 700 }}
                            itemStyle={{ color: '#111827' }}
                            formatter={(value) => [toCurrency(Number(value), currency), '매출이익']}
                          />
                          <Bar dataKey="profit">
                            {monthlyProfit.map((entry, idx) => (
                              <Cell key={`profit-${entry.month}-${idx}`} fill={entry.profit < 0 ? '#ef4444' : '#60a5fa'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card>
                    <h2 className="mb-3 text-sm font-medium">벤치마크 비교 (선택 프로젝트 vs 타 프로젝트 평균)</h2>

                    <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          selectedSummary.revenueDelta >= 0
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                            : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                        }`}
                      >
                        <p className="font-semibold">매출 {selectedSummary.revenueDelta >= 0 ? '우위' : '열위'}</p>
                        <p className="mt-1">
                          {selectedSummary.revenueDelta >= 0 ? '+' : ''}
                          {selectedSummary.revenueDeltaPct}%
                        </p>
                        <div className="mt-2 h-1.5 rounded-full bg-black/20">
                          <div
                            className={`h-1.5 rounded-full ${selectedSummary.revenueDelta >= 0 ? 'bg-emerald-300' : 'bg-rose-300'}`}
                            style={{ width: `${selectedSummary.revenueStrengthPct}%` }}
                          />
                        </div>
                      </div>

                      <div className={`rounded-lg border px-3 py-2 text-xs ${selectedSummary.roasComparison.className}`}>
                        <p className="font-semibold">{selectedSummary.roasComparison.label}</p>
                        <p className="mt-1">{selectedSummary.roasComparison.value}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-black/20">
                          <div
                            className={`h-1.5 rounded-full ${selectedSummary.roasComparison.barClass}`}
                            style={{ width: `${selectedSummary.roasComparison.strengthPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="h-64">
                      <ResponsiveContainer>
                        <BarChart data={selectedSummary.benchmarkBars} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                          <XAxis dataKey="metric" tick={{ fill: '#d4d4d8', fontSize: 12 }} />
                          <YAxis
                            width={60}
                            domain={[0, 100]}
                            tick={{ fill: '#a1a1aa', fontSize: 12 }}
                            tickFormatter={(value) => `${Number(value)}%`}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #d4d4d8' }}
                            labelStyle={{ color: '#111827', fontWeight: 700 }}
                            itemStyle={{ color: '#111827' }}
                            formatter={(_value, _name, item) => {
                              const metric = String(item?.payload?.metric ?? '');
                              const series = String(item?.dataKey ?? '');
                              const isSelected = series === 'selectedIndex';
                              const who = isSelected ? selectedProject : '타 프로젝트 평균';
                              const rawValue = Number(
                                isSelected ? item?.payload?.selectedRaw ?? 0 : item?.payload?.othersRaw ?? 0,
                              );

                              if (metric === 'ROAS') {
                                return [
                                  rawValue.toLocaleString('en-US', { maximumFractionDigits: 2 }),
                                  who,
                                ];
                              }

                              return [toCurrency(rawValue, currency), who];
                            }}
                          />
                          <Legend />
                          <Bar dataKey="selectedIndex" name={selectedProject} fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="othersIndex" name="타 프로젝트 평균" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <p className="mt-2 text-xs text-zinc-400">
                      매출: {selectedProject} {toCurrency(selectedSummary.selected.revenue, currency)} / 평균{' '}
                      {toCurrency(selectedSummary.avgOtherRevenue, currency)}
                      <br />
                      ROAS: {selectedProject} {health.roasDisplay} / 평균{' '}
                      {selectedSummary.avgOtherRoas > 0
                        ? selectedSummary.avgOtherRoas.toLocaleString('en-US', {
                            maximumFractionDigits: 2,
                          })
                        : 'N/A'}
                    </p>
                  </Card>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
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
                    <motion.div
                      key={k.t}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
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
                      <AreaChart
                        data={trend}
                        syncId="main"
                        margin={{ top: 8, right: 16, bottom: 8, left: 28 }}
                      >
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
                          <Scatter data={top10} fill="#60a5fa">
                            <LabelList
                              dataKey="id"
                              position="top"
                              offset={8}
                              fill="#60a5fa"
                              fontSize={11}
                              fontWeight={600}
                            />
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">X축: 매출 · Y축: 광고비 · 원 크기: 이익</p>
                  </Card>

                  <Card>
                    <h2 className="mb-3 text-sm font-medium">프로젝트 성과 테이블</h2>
                    <ProjectTable
                      data={projects}
                      currency={currency}
                      onSelectProject={(projectId) => setSelectedProject(projectId)}
                    />
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default App;
