import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Scatter, ScatterChart, ZAxis } from 'recharts';
import { BarChart3, DollarSign, Gauge, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rows, projectIds, groupedProjectIds } from '@/lib/data';
import { monthKey, normalizeAmount, projectAggregate, sum, toCurrency } from '@/lib/metrics';
import { ProjectTable } from '@/components/dashboard/ProjectTable';
import type { CurrencyMode } from '@/lib/types';

function App() {
  const [currency, setCurrency] = useState<CurrencyMode>('LOCAL');
  const [startDate, setStartDate] = useState(rows[0]?.Date ?? '2018-01-01');
  const [endDate, setEndDate] = useState(rows.at(-1)?.Date ?? '2030-01-01');
  const [granularity, setGranularity] = useState<'year' | 'month' | 'day'>('month');

  const inRange = useMemo(() => rows.filter((r) => r.Date >= startDate && r.Date <= endDate), [startDate, endDate]);

  const enriched = useMemo(() => inRange.map((r) => ({
    ...r,
    rev: normalizeAmount(r.Total_Revenue_Sum, r.Exchange_Rate, currency),
    net: normalizeAmount(r.Net_Revenue_Sum, r.Exchange_Rate, currency),
    ad: normalizeAmount(r.Total_Ad_Spend, r.Exchange_Rate, currency),
    profit: normalizeAmount(r.Gross_Profit, r.Exchange_Rate, currency),
  })), [currency, inRange]);

  const dateKey = (d: string) => (granularity === 'year' ? format(parseISO(d), 'yyyy') : granularity === 'month' ? monthKey(d) : d);

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

  const mom = trend.length > 1 ? ((trend.at(-1)!.revenue - trend.at(-2)!.revenue) / (trend.at(-2)!.revenue || 1)) * 100 : 0;
  const projects = projectAggregate(inRange, projectIds).sort((a, b) => b.revenue - a.revenue);
  const top10 = projects.slice(0, 10);

  const grouped = {
    P: sum(projects.filter((p) => groupedProjectIds.P.includes(p.id)).map((p) => p.revenue)),
    C: sum(projects.filter((p) => groupedProjectIds.C.includes(p.id)).map((p) => p.revenue)),
    PC: sum(projects.filter((p) => groupedProjectIds.PC.includes(p.id)).map((p) => p.revenue)),
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 lg:grid-cols-[250px_1fr]">
        <Card className="h-fit p-4">
          <h1 className="mb-4 text-xl font-semibold">ST Dashboard</h1>
          <div className="space-y-2 text-sm text-zinc-300"><div>Global Overview</div><div>Project Deep-dive</div><div>Ad Efficiency</div></div>
          <div className="mt-4 flex gap-2"><Button onClick={() => setCurrency('LOCAL')}>KRW</Button><Button onClick={() => setCurrency('USD')}>USD</Button></div>
          <div className="mt-4 space-y-2 text-xs">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => setGranularity('year')}>Year</Button>
              <Button onClick={() => setGranularity('month')}>Month</Button>
              <Button onClick={() => setGranularity('day')}>Day</Button>
            </div>
          </div>
          <div className="mt-4 text-xs text-zinc-400">Groups: P {toCurrency(grouped.P, currency)} · C {toCurrency(grouped.C, currency)} · PC {toCurrency(grouped.PC, currency)}</div>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[{t:'Total Portfolio Revenue',v:toCurrency(totalRevenue,currency),s:`MoM ${mom.toFixed(1)}%`,i:TrendingUp},{t:'Net Revenue Performance',v:toCurrency(totalNet,currency),s:'Net realized',i:DollarSign},{t:'Total ROAS',v:roas.toFixed(2),s:'Revenue / Ad Spend',i:Gauge},{t:'Profit Margin %',v:`${margin.toFixed(1)}%`,s:'Gross Profit / Revenue',i:BarChart3}].map((k)=>(
              <motion.div key={k.t} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}><Card><div className='flex items-center justify-between'><p className='text-xs text-zinc-400'>{k.t}</p><k.i size={16}/></div><p className='mt-2 text-xl font-semibold'>{k.v}</p><p className='text-xs text-zinc-400'>{k.s}</p></Card></motion.div>
            ))}
          </div>

          <Card><h2 className="mb-3 text-sm font-medium">Revenue vs Ad Spend Trend</h2><div className="h-72"><ResponsiveContainer><AreaChart data={trend} syncId="main"><CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" /><XAxis dataKey="period" tick={{ fill: '#a1a1aa', fontSize: 12 }} /><YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} /><Tooltip /><Area dataKey="revenue" stroke="#22c55e" fill="#22c55e55" /><Area dataKey="ad" stroke="#f97316" fill="#f9731655" /></AreaChart></ResponsiveContainer></div></Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card><h2 className="mb-3 text-sm font-medium">Top 10 Project Efficiency Matrix</h2><div className="h-72"><ResponsiveContainer><ScatterChart><CartesianGrid stroke="#3f3f46" /><XAxis dataKey="revenue" name="Revenue" /><YAxis dataKey="ad" name="Ad" /><ZAxis dataKey="profit" range={[60,300]} /><Tooltip cursor={{ strokeDasharray: '3 3' }} /><Scatter data={top10} fill="#60a5fa" /></ScatterChart></ResponsiveContainer></div></Card>
            <Card><h2 className="mb-3 text-sm font-medium">Project Performance Table</h2><ProjectTable data={projects} /></Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
