import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useInventoryReport, useProfitReport, useSalesReport } from '@/hooks/useReports';
import type { SalesPeriod } from '@/services/report.service';
import type { ProfitGroupBy } from '@/services/types';

type Tab = SalesPeriod | 'bestsellers' | 'inventory';

const TABS: { value: Tab; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'bestsellers', label: 'Best Sellers' },
  { value: 'inventory', label: 'Inventory Value' },
];

const GROUP_BYS: { value: ProfitGroupBy; label: string }[] = [
  { value: 'model', label: 'By model' },
  { value: 'brand', label: 'By brand' },
  { value: 'staff', label: 'By staff' },
];

const money = (value: number) => value.toFixed(2);
const day = (iso: string) => new Date(iso).toLocaleDateString();

/** Any day inside the previous period; backend snaps it to the period start. */
function previousParam(period: SalesPeriod, currentFrom: string): string {
  const d = new Date(currentFrom);
  d.setDate(d.getDate() - 1);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return period === 'monthly' ? iso.slice(0, 7) : iso;
}

function SummaryCard({
  label,
  value,
  previous,
  current,
}: {
  label: string;
  value: string;
  previous?: number;
  current?: number;
}) {
  let trend: { text: string; className: string } | null = null;
  if (previous !== undefined && current !== undefined) {
    if (previous === 0) {
      trend =
        current > 0
          ? { text: 'new — nothing in previous period', className: 'text-emerald-600' }
          : { text: 'no change vs previous period', className: 'text-muted-foreground' };
    } else {
      const pct = ((current - previous) / previous) * 100;
      trend = {
        text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs previous (${
          Number.isInteger(previous) ? previous : money(previous)
        })`,
        className: pct >= 0 ? 'text-emerald-600' : 'text-destructive',
      };
    }
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {trend && <p className={`text-xs ${trend.className}`}>{trend.text}</p>}
      </CardHeader>
    </Card>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('daily');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [groupBy, setGroupBy] = useState<ProfitGroupBy>('model');
  const [sortBy, setSortBy] = useState<'unitsSold' | 'revenue'>('unitsSold');

  const isSalesTab = tab === 'daily' || tab === 'weekly' || tab === 'monthly';
  const period = isSalesTab ? tab : 'daily';
  const param = tab === 'monthly' ? month || undefined : date || undefined;

  const sales = useSalesReport(period, param, isSalesTab);
  const prevSales = useSalesReport(
    period,
    sales.data ? previousParam(period, sales.data.from) : undefined,
    isSalesTab && !!sales.data,
  );
  const profit = useProfitReport(groupBy, tab === 'bestsellers');
  const inventory = useInventoryReport(tab === 'inventory');

  const bestSellers = profit.data
    ? [...profit.data.rows].sort((a, b) => b[sortBy] - a[sortBy])
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={tab === t.value ? 'default' : 'outline'}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {isSalesTab && (
        <div className="flex items-center gap-2">
          {tab === 'monthly' ? (
            <Input
              type="month"
              className="w-44"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          ) : (
            <Input
              type="date"
              className="w-44"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
          <span className="text-sm text-muted-foreground">
            {sales.data
              ? `${day(sales.data.from)} – ${day(sales.data.to)}`
              : 'Leave empty for the current period'}
          </span>
        </div>
      )}

      {isSalesTab && (
        <>
          {sales.isLoading && <p className="text-sm text-muted-foreground">Loading report…</p>}
          {sales.isError && <p className="text-sm text-destructive">{sales.error.message}</p>}
          {sales.data && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Revenue"
                value={money(sales.data.totalRevenue)}
                current={sales.data.totalRevenue}
                previous={prevSales.data?.totalRevenue}
              />
              <SummaryCard
                label="Profit"
                value={money(sales.data.totalProfit)}
                current={sales.data.totalProfit}
                previous={prevSales.data?.totalProfit}
              />
              <SummaryCard
                label="Units sold"
                value={String(sales.data.unitsSold)}
                current={sales.data.unitsSold}
                previous={prevSales.data?.unitsSold}
              />
              <SummaryCard
                label="Sales"
                value={String(sales.data.salesCount)}
                current={sales.data.salesCount}
                previous={prevSales.data?.salesCount}
              />
            </div>
          )}
        </>
      )}

      {tab === 'bestsellers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {GROUP_BYS.map((g) => (
                <Button
                  key={g.value}
                  size="sm"
                  variant={groupBy === g.value ? 'default' : 'outline'}
                  onClick={() => setGroupBy(g.value)}
                >
                  {g.label}
                </Button>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">Rank by</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={sortBy === 'unitsSold' ? 'default' : 'outline'}
                onClick={() => setSortBy('unitsSold')}
              >
                Units sold
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'revenue' ? 'default' : 'outline'}
                onClick={() => setSortBy('revenue')}
              >
                Revenue
              </Button>
            </div>
          </div>

          {profit.isLoading && <p className="text-sm text-muted-foreground">Loading report…</p>}
          {profit.isError && <p className="text-sm text-destructive">{profit.error.message}</p>}
          {profit.data && (
            <Card>
              <CardHeader>
                <CardTitle>Best sellers {GROUP_BYS.find((g) => g.value === groupBy)?.label.toLowerCase()}</CardTitle>
                <CardDescription>All-time totals derived from recorded sale items.</CardDescription>
              </CardHeader>
              <CardContent>
                {bestSellers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>
                          {groupBy === 'staff' ? 'Staff member' : groupBy === 'brand' ? 'Brand' : 'Model'}
                        </TableHead>
                        <TableHead className="text-right">Units sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bestSellers.map((row, index) => (
                        <TableRow key={row.key}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{row.key}</TableCell>
                          <TableCell className="text-right">{row.unitsSold}</TableCell>
                          <TableCell className="text-right">{money(row.revenue)}</TableCell>
                          <TableCell className="text-right">{money(row.profit)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'inventory' && (
        <>
          {inventory.isLoading && <p className="text-sm text-muted-foreground">Loading report…</p>}
          {inventory.isError && (
            <p className="text-sm text-destructive">{inventory.error.message}</p>
          )}
          {inventory.data && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <SummaryCard label="Units in stock" value={String(inventory.data.totalUnits)} />
                <SummaryCard label="Cost value" value={money(inventory.data.totalCostValue)} />
                <SummaryCard label="Retail value" value={money(inventory.data.totalRetailValue)} />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown by model</CardTitle>
                </CardHeader>
                <CardContent>
                  {inventory.data.byModel.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No phones in stock.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Brand</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead className="text-right">Units</TableHead>
                          <TableHead className="text-right">Cost value</TableHead>
                          <TableHead className="text-right">Retail value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventory.data.byModel.map((row) => (
                          <TableRow key={`${row.brand}-${row.model}`}>
                            <TableCell>{row.brand}</TableCell>
                            <TableCell>{row.model}</TableCell>
                            <TableCell className="text-right">{row.units}</TableCell>
                            <TableCell className="text-right">{money(row.costValue)}</TableCell>
                            <TableCell className="text-right">{money(row.retailValue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
