import { useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';

type Row = { id: string; revenue: number; ad: number; profit: number; roas: number };

export function ProjectTable({ data }: { data: Row[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => data.filter((d) => d.id.toLowerCase().includes(query.toLowerCase())), [data, query]);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: 'id', header: 'Project' },
    { accessorKey: 'revenue', header: 'Revenue' },
    { accessorKey: 'ad', header: 'Ad Spend' },
    { accessorKey: 'profit', header: 'Profitability' },
    { accessorKey: 'roas', header: 'ROAS', cell: ({ row }) => row.original.roas.toFixed(2) },
  ], []);

  const table = useReactTable({ data: filtered, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <div className="space-y-3">
      <Input placeholder="Search project..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="overflow-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/80">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id} className="p-2 text-left">{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-800">
                {r.getVisibleCells().map((c) => <td key={c.id} className="p-2">{flexRender(c.column.columnDef.cell, c.getContext()) ?? String(c.getValue() ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
