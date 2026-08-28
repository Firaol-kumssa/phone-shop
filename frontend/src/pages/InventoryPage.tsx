import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCreatePhone, usePhones } from '@/hooks/usePhones';
import { useSuppliers } from '@/hooks/useSuppliers';
import type { PhoneStatus } from '@/services/types';

const FILTERS: { label: string; value?: PhoneStatus }[] = [
  { label: 'In Stock', value: 'InStock' },
  { label: 'Reserved', value: 'Reserved' },
  { label: 'Sold', value: 'Sold' },
  { label: 'All' },
];

const STATUS_BADGE: Record<PhoneStatus, 'success' | 'warning' | 'secondary' | 'destructive'> = {
  InStock: 'success',
  Reserved: 'warning',
  Sold: 'secondary',
  Returned: 'destructive',
};

const money = (value: string) => Number(value).toFixed(2);

const EMPTY_PHONE_FORM = {
  imei: '',
  brand: '',
  model: '',
  storage: '',
  color: '',
  purchasePrice: '',
  sellingPrice: '',
  supplierId: '',
};

export function InventoryPage() {
  const [status, setStatus] = useState<PhoneStatus | undefined>('InStock');
  const { data: phones, isLoading, isError, error } = usePhones(status);
  const { data: suppliers } = useSuppliers();
  const createPhone = useCreatePhone();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_PHONE_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  async function submitPhone() {
    setFormError(null);
    if (!/^\d{14,16}$/.test(form.imei.trim())) {
      setFormError('IMEI must be 14-16 digits.');
      return;
    }
    if (!form.brand.trim() || !form.model.trim()) {
      setFormError('Brand and model are required.');
      return;
    }
    if (!(Number(form.purchasePrice) > 0) || !(Number(form.sellingPrice) > 0)) {
      setFormError('Both prices must be positive.');
      return;
    }
    try {
      await createPhone.mutateAsync({
        imei: form.imei.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        storage: form.storage.trim() || undefined,
        color: form.color.trim() || undefined,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        supplierId: form.supplierId ? Number(form.supplierId) : undefined,
      });
      setForm(EMPTY_PHONE_FORM);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add phone');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="flex items-center gap-2">
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
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add phone
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add phone</CardTitle>
            <CardDescription>Enters stock immediately with status In Stock.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="p-imei">IMEI</Label>
                <Input
                  id="p-imei"
                  value={form.imei}
                  onChange={(e) => setForm({ ...form, imei: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-brand">Brand</Label>
                <Input
                  id="p-brand"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-model">Model</Label>
                <Input
                  id="p-model"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-storage">Storage (optional)</Label>
                <Input
                  id="p-storage"
                  value={form.storage}
                  onChange={(e) => setForm({ ...form, storage: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-color">Color (optional)</Label>
                <Input
                  id="p-color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-cost">Purchase price</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-price">Selling price</Label>
                <Input
                  id="p-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-supplier">Supplier (optional)</Label>
                <select
                  id="p-supplier"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                >
                  <option value="">No supplier</option>
                  {suppliers?.map((s) => (
                    <option key={s.supplierId} value={s.supplierId}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button disabled={createPhone.isPending} onClick={submitPhone}>
              {createPhone.isPending ? 'Saving…' : 'Save phone'}
            </Button>
          </CardContent>
        </Card>
      )}

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
