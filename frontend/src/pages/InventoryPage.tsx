import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePhones } from '@/hooks/usePhones';
import type { PhoneStatus } from '@/services/types';

const FILTERS: { label: string; value?: PhoneStatus }[] = [
  { label: 'In Stock', value: 'InStock' },
  { label: 'Reserved', value: 'Reserved' },
  { label: 'Sold', value: 'Sold' },
  { label: 'Returned', value: 'Returned' },
  { label: 'All' },
];

const STATUS_BADGE: Record<PhoneStatus, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  InStock: 'success',
  Reserved: 'warning',
  Sold: 'secondary',
  Returned: 'destructive',
};

const money = (value: string) => Number(value).toFixed(2);

export function InventoryPage() {
  const [status, setStatus] = useState<PhoneStatus | undefined>('InStock');
  const { data: phones, isLoading, isError, error } = usePhones(status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="flex gap-1">
          {FILTERS.map((filter) => (
            <Button
              key={filter.label}
              size="sm"
              variant={status === filter.value ? 'default' : 'outline'}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {status ?? 'All'} phones{phones ? ` (${phones.length})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading stock…</p>}
          {isError && <p className="text-sm text-destructive">{error.message}</p>}
          {phones && phones.length === 0 && (
            <p className="text-sm text-muted-foreground">No phones match this filter.</p>
          )}
          {phones && phones.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phones.map((phone) => (
                  <TableRow key={phone.phoneId}>
                    <TableCell className="font-mono text-xs">{phone.imei}</TableCell>
                    <TableCell>{phone.brand}</TableCell>
                    <TableCell>{phone.model}</TableCell>
                    <TableCell>{phone.storage ?? '—'}</TableCell>
                    <TableCell>{phone.color ?? '—'}</TableCell>
                    <TableCell className="text-right">{money(phone.purchasePrice)}</TableCell>
                    <TableCell className="text-right">{money(phone.sellingPrice)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[phone.status]}>{phone.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
