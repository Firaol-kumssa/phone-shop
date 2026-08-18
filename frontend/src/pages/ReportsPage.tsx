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
import { useInventoryReport, useSalesReport } from '@/hooks/useReports';
import type { SalesPeriod } from '@/services/report.service';

type Tab = SalesPeriod | 'inventory';

const TABS: { value: Tab; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'inventory', label: 'Inventory Value' },
];

const money = (value: number) => value.toFixed(2);
const day = (iso: string) => new Date(iso).toLocaleDateString();

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('daily');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');

  const isSalesTab = tab !== 'inventory';
  const period = isSalesTab ? tab : 'daily';
  const param = tab === 'monthly' ? month || undefined : date || undefined;

  const sales = useSalesReport(period, param, isSalesTab);
  const inventory = useInventoryReport(tab === 'inventory');

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
              <SummaryCard label="Revenue" value={money(sales.data.totalRevenue)} />
              <SummaryCard label="Profit" value={money(sales.data.totalProfit)} />
              <SummaryCard label="Units sold" value={String(sales.data.unitsSold)} />
              <SummaryCard label="Sales" value={String(sales.data.salesCount)} />
            </div>
          )}
        </>
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
