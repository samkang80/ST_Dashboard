import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toCurrency } from '@/lib/metrics';
import type { CurrencyMode } from '@/lib/types';

type Row = {
  id: string;
  revenue: number;
  ad: number;
  profit: number;
  roas: number;
};

function healthByRoas(roas: number) {
  if (roas > 2) return { label: '양호', className: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' };
  if (roas >= 1) return { label: '주의', className: 'bg-amber-500/20 text-amber-200 border-amber-500/40' };
  return { label: '위험', className: 'bg-rose-500/20 text-rose-200 border-rose-500/40' };
}

export function ProjectTable({ data, currency }: { data: Row[]; currency: CurrencyMode }) {
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'revenue', desc: true }]);

  const filtered = useMemo(
    () => data.filter((d) => d.id.toLowerCase().includes(query.toLowerCase())),
    [data, query],
  );

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      { accessorKey: 'id', header: '프로젝트' },
      {
        accessorKey: 'revenue',
        header: '매출',
        cell: ({ row }) => toCurrency(row.original.revenue, currency),
      },
      {
        accessorKey: 'ad',
        header: '광고비',
        cell: ({ row }) => toCurrency(row.original.ad, currency),
      },
      {
        accessorKey: 'profit',
        header: '수익성',
        cell: ({ row }) => toCurrency(row.original.profit, currency),
      },
      {
        accessorKey: 'roas',
        header: 'ROAS',
        cell: ({ row }) => row.original.roas.toLocaleString('en-US', { maximumFractionDigits: 2 }),
      },
      {
        id: 'health',
        header: '상태',
        sortingFn: (a, b) => a.original.roas - b.original.roas,
        cell: ({ row }) => {
          const health = healthByRoas(row.original.roas);
          return (
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${health.className}`}>
              {health.label}
            </span>
          );
        },
      },
    ],
    [currency],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortIcon = (isSorted: false | 'asc' | 'desc') => {
    if (isSorted === 'asc') return <ArrowUp className="h-3.5 w-3.5" />;
    if (isSorted === 'desc') return <ArrowDown className="h-3.5 w-3.5" />;
    return <ArrowUpDown className="h-3.5 w-3.5" />;
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder="프로젝트 검색..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="min-w-[860px] w-full text-xs sm:text-sm">
          <thead className="bg-zinc-900/80">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const isSorted = h.column.getIsSorted();
                  const canSort = h.column.getCanSort();

                  return (
                    <th key={h.id} className="p-2 text-left whitespace-nowrap">
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 font-medium text-zinc-200 hover:text-white"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sortIcon(isSorted)}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800">
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} className="p-2 whitespace-nowrap">
                    {flexRender(c.column.columnDef.cell, c.getContext()) ??
                      String(c.getValue() ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
