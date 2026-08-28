import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
import {
  useInventoryReport,
  useProfitReport,
  useReturnsReport,
  useSalesReport,
  useSalesSeries,
  useSalesSplit,
} from '@/hooks/useReports';
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

const CHART_COLORS = { revenue: '#2563eb', profit: '#10b981' };
const PIE_COLORS = ['#2563eb', '#f59e0b'];

function bucketLabel(period: SalesPeriod, fromIso: string): string {
  const d = new Date(fromIso);
  if (period === 'monthly') {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return period === 'weekly' ? `wk ${label}` : label;
}

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
  const [showReturnDetails, setShowReturnDetails] = useState(false);

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
  const series = useSalesSeries(period, isSalesTab);
  const split = useSalesSplit(isSalesTab);
  // Returns are scoped to the same [from, to) window as the sales report
  const returns = useReturnsReport(
    sales.data?.from,
    sales.data?.to,
    isSalesTab && !!sales.data,
  );

  const bestSellers = profit.data
    ? [...profit.data.rows].sort((a, b) => b[sortBy] - a[sortBy])
    : [];

  const chartData = (series.data ?? []).map((bucket) => ({
    name: bucketLabel(period, bucket.from),
    revenue: Number(bucket.totalRevenue.toFixed(2)),
    profit: Number(bucket.totalProfit.toFixed(2)),
  }));

  const splitData = split.data
    ? [
        { name: 'Phones', value: Number(split.data.phones.revenue.toFixed(2)) },
        { name: 'Products', value: Number(split.data.products.revenue.toFixed(2)) },
      ].filter((entry) => entry.value > 0)
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

          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <Card>
              <CardHeader>
                <CardTitle>
                  Last 7 {tab === 'daily' ? 'days' : tab === 'weekly' ? 'weeks' : 'months'}
                </CardTitle>
                <CardDescription>Revenue vs profit per period, oldest first.</CardDescription>
              </CardHeader>
              <CardContent>
                {series.isLoading && (
                  <p className="text-sm text-muted-foreground">Loading chart…</p>
                )}
                {chartData.length > 0 && (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="revenue"
                        name="Revenue"
                        fill={CHART_COLORS.revenue}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="profit"
                        name="Profit"
                        fill={CHART_COLORS.profit}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Phones vs products</CardTitle>
                <CardDescription>All-time revenue split.</CardDescription>
              </CardHeader>
              <CardContent>
                {split.isLoading && (
                  <p className="text-sm text-muted-foreground">Loading chart…</p>
                )}
                {split.data && splitData.length === 0 && (
                  <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
                )}
                {splitData.length > 0 && (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={splitData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        label={(entry) => money(Number(entry.value))}
                      >
                        {splitData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Returns this period</CardTitle>
                <CardDescription>
                  {returns.data
                    ? `${returns.data.totalReturns} return${
                        returns.data.totalReturns === 1 ? '' : 's'
                      } · refunded ${money(returns.data.totalRefunded)} · profit voided ${money(
                        returns.data.totalProfitVoided,
                      )}`
                    : 'Loading…'}
                </CardDescription>
              </div>
              {returns.data && returns.data.rows.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShowReturnDetails((v) => !v)}>
                  {showReturnDetails ? 'Hide details' : 'Show details'}
                </Button>
              )}
            </CardHeader>
            {showReturnDetails && returns.data && returns.data.rows.length > 0 && (
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Sale</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Replacement</TableHead>
                      <TableHead className="text-right">Refund</TableHead>
                      <TableHead>Staff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returns.data.rows.map((row, index) => (
                      <TableRow key={`${row.saleId}-${row.date}-${index}`}>
                        <TableCell>{new Date(row.date).toLocaleString()}</TableCell>
                        <TableCell>#{row.saleId}</TableCell>
                        <TableCell className="font-medium">{row.item}</TableCell>
                        <TableCell className="text-right">{row.quantity}</TableCell>
                        <TableCell className="capitalize">{row.mode}</TableCell>
                        <TableCell>{row.replacement ?? '—'}</TableCell>
                        <TableCell className="text-right">{money(row.refundAmount)}</TableCell>
                        <TableCell>{row.staff}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
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
              <div className="grid gap-4 sm:grid-cols-2">
                {(['phones', 'products'] as const).map((kind) => (
                  <Card key={kind}>
                    <CardHeader className="pb-2">
                      <CardDescription>{kind === 'phones' ? 'Phones' : 'Products'}</CardDescription>
                      <CardTitle className="text-2xl">
                        {inventory.data[kind].units} unit{inventory.data[kind].units === 1 ? '' : 's'}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        cost {money(inventory.data[kind].costValue)} · retail{' '}
                        {money(inventory.data[kind].retailValue)}
                      </p>
                    </CardHeader>
                  </Card>
                ))}
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
              <Card>
                <CardHeader>
                  <CardTitle>Breakdown by product</CardTitle>
                </CardHeader>
                <CardContent>
                  {inventory.data.byProduct.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No products in stock.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Units</TableHead>
                          <TableHead className="text-right">Cost value</TableHead>
                          <TableHead className="text-right">Retail value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventory.data.byProduct.map((row) => (
                          <TableRow key={`${row.category}-${row.name}`}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>{row.category}</TableCell>
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
