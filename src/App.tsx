import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
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

function getHealthMeta(roas: number) {
  if (roas > 2) {
    return {
      label: '양호',
      icon: CheckCircle2,
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
      dotClass: 'bg-emerald-400',
    };
  }

  if (roas >= 1) {
    return {
      label: '주의',
      icon: AlertTriangle,
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
      dotClass: 'bg-amber-400',
    };
  }

  return {
    label: '위험',
    icon: AlertOctagon,
    className: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
    dotClass: 'bg-rose-400',
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

    return inRange.map((r) => ({
      date: r.Date,
      revenue: normalizeAmount(Number(r[`${selectedProject}_Total_Revenue`] || 0), r.Exchange_Rate, currency),
      ad: normalizeAmount(Number(r[`${selectedProject}_Ad_Spend`] || 0), r.Exchange_Rate, currency),
    }));
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

    const otherProjects = projects.filter((p) => p.id !== selectedProject);
    const avgOtherRevenue =
      otherProjects.length > 0
        ? sum(otherProjects.map((p) => p.revenue)) / otherProjects.length
        : 0;
    const avgOtherRoas =
      otherProjects.length > 0
        ? sum(otherProjects.map((p) => p.roas)) / otherProjects.length
        : 0;

    const portfolioContribution = totalRevenue > 0 ? (selected.revenue / totalRevenue) * 100 : 0;

    const revenueBase = Math.max(selected.revenue, avgOtherRevenue, 1);
    const roasBase = Math.max(selected.roas, avgOtherRoas, 1);

    const benchmarkData = [
      {
        metric: '매출',
        selected: (selected.revenue / revenueBase) * 100,
        others: (avgOtherRevenue / revenueBase) * 100,
      },
      {
        metric: 'ROAS',
        selected: (selected.roas / roasBase) * 100,
        others: (avgOtherRoas / roasBase) * 100,
      },
    ];

    return {
      selected,
      avgOtherRevenue,
      avgOtherRoas,
      portfolioContribution,
      benchmarkData,
    };
  }, [projects, selectedProject, totalRevenue]);

  const health = getHealthMeta(selectedSummary?.selected.roas ?? 0);
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
                      Health: {health.label}
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
                    <p className="mt-2 text-xl font-semibold">
                      {selectedSummary.selected.roas.toLocaleString('en-US', {
                        maximumFractionDigits: 2,
                      })}
                    </p>
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
                          <Bar dataKey="profit" fill="#60a5fa" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card>
                    <h2 className="mb-3 text-sm font-medium">벤치마크 비교 (선택 프로젝트 vs 타 프로젝트 평균)</h2>
                    <div className="h-72">
                      <ResponsiveContainer>
                        <RadarChart data={selectedSummary.benchmarkData}>
                          <PolarGrid stroke="#3f3f46" />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: '#d4d4d8', fontSize: 12 }} />
                          <Tooltip
                            formatter={(value, name) => [
                              `${Number(value).toLocaleString('en-US', {
                                maximumFractionDigits: 1,
                              })}%`,
                              name === 'selected' ? selectedProject : '타 프로젝트 평균',
                            ]}
                          />
                          <Legend />
                          <Radar
                            dataKey="selected"
                            name={selectedProject}
                            stroke="#22c55e"
                            fill="#22c55e"
                            fillOpacity={0.28}
                          />
                          <Radar
                            dataKey="others"
                            name="타 프로젝트 평균"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.2}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      매출: {selectedProject} {toCurrency(selectedSummary.selected.revenue, currency)} / 평균{' '}
                      {toCurrency(selectedSummary.avgOtherRevenue, currency)}
                      <br />
                      ROAS: {selectedProject}{' '}
                      {selectedSummary.selected.roas.toLocaleString('en-US', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      / 평균{' '}
                      {selectedSummary.avgOtherRoas.toLocaleString('en-US', {
                        maximumFractionDigits: 2,
                      })}
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
                          <Scatter data={top10} fill="#60a5fa" />
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
