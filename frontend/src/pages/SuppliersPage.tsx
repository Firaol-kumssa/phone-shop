import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { useRecordDelivery, useCreateSupplier, useSupplier, useSuppliers } from '@/hooks/useSuppliers';

interface ItemRow {
  imei: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  purchasePrice: string;
  sellingPrice: string;
}

const EMPTY_ROW: ItemRow = {
  imei: '',
  brand: '',
  model: '',
  storage: '',
  color: '',
  purchasePrice: '',
  sellingPrice: '',
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: string | number) => Number(value).toFixed(2);

const EMPTY_SUPPLIER_FORM = { name: '', phoneNumber: '', email: '', address: '' };

export function SuppliersPage() {
  const { data: suppliers, isLoading } = useSuppliers();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const supplier = useSupplier(selectedId);
  const record = useRecordDelivery();
  const createSupplier = useCreateSupplier();

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [rows, setRows] = useState<ItemRow[]>([{ ...EMPTY_ROW }]);
  const [formError, setFormError] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function submitNewSupplier() {
    setSupplierFormError(null);
    if (!supplierForm.name.trim()) {
      setSupplierFormError('Supplier name is required.');
      return;
    }
    try {
      const created = await createSupplier.mutateAsync({
        name: supplierForm.name.trim(),
        phoneNumber: supplierForm.phoneNumber.trim() || undefined,
        email: supplierForm.email.trim() || undefined,
        address: supplierForm.address.trim() || undefined,
      });
      setSupplierForm(EMPTY_SUPPLIER_FORM);
      setShowSupplierForm(false);
      setSelectedId(created.supplierId);
    } catch (error) {
      setSupplierFormError(error instanceof Error ? error.message : 'Could not create supplier');
    }
  }

  async function submitDelivery() {
    setFormError(null);
    if (selectedId === null) return;

    for (const [i, row] of rows.entries()) {
      if (!/^\d{14,16}$/.test(row.imei.trim())) {
        setFormError(`Row ${i + 1}: IMEI must be 14-16 digits.`);
        return;
      }
      if (!row.brand.trim() || !row.model.trim()) {
        setFormError(`Row ${i + 1}: brand and model are required.`);
        return;
      }
      if (!(Number(row.purchasePrice) > 0) || !(Number(row.sellingPrice) > 0)) {
        setFormError(`Row ${i + 1}: both prices must be positive.`);
        return;
      }
    }

    try {
      await record.mutateAsync({
        supplierId: selectedId,
        payload: {
          invoiceNumber: invoiceNumber.trim() || undefined,
          purchaseDate,
          items: rows.map((row) => ({
            imei: row.imei.trim(),
            brand: row.brand.trim(),
            model: row.model.trim(),
            storage: row.storage.trim() || undefined,
            color: row.color.trim() || undefined,
            purchasePrice: Number(row.purchasePrice),
            sellingPrice: Number(row.sellingPrice),
          })),
        },
      });
      setShowForm(false);
      setInvoiceNumber('');
      setPurchaseDate(today());
      setRows([{ ...EMPTY_ROW }]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Delivery failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <Button size="sm" onClick={() => setShowSupplierForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New supplier
        </Button>
      </div>

      {showSupplierForm && (
        <Card>
          <CardHeader>
            <CardTitle>New supplier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="s-name">Name</Label>
                <Input
                  id="s-name"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-phone">Phone (optional)</Label>
                <Input
                  id="s-phone"
                  value={supplierForm.phoneNumber}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phoneNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-email">Email (optional)</Label>
                <Input
                  id="s-email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-address">Address (optional)</Label>
                <Input
                  id="s-address"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                />
              </div>
            </div>
            {supplierFormError && <p className="text-sm text-destructive">{supplierFormError}</p>}
            <Button disabled={createSupplier.isPending} onClick={submitNewSupplier}>
              {createSupplier.isPending ? 'Saving…' : 'Save supplier'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>All suppliers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {suppliers?.map((s) => (
              <button
                key={s.supplierId}
                type="button"
                onClick={() => {
                  setSelectedId(s.supplierId);
                  setShowForm(false);
                }}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === s.supplierId
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-xs opacity-70">{s.phoneNumber ?? 'no phone'}</div>
              </button>
            ))}
            {suppliers && suppliers.length === 0 && (
              <p className="text-sm text-muted-foreground">No suppliers yet.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedId === null && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Select a supplier to see purchase history and record deliveries.
              </CardContent>
            </Card>
          )}

          {supplier.data && (
            <>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>{supplier.data.name}</CardTitle>
                    <CardDescription>
                      {[supplier.data.phoneNumber, supplier.data.email, supplier.data.address]
                        .filter(Boolean)
                        .join(' · ') || 'No contact details'}
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowForm((v) => !v)}>
                    <Plus className="h-4 w-4" />
                    Record delivery
                  </Button>
                </CardHeader>
              </Card>

              {showForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>New delivery from {supplier.data.name}</CardTitle>
                    <CardDescription>
                      Each unit becomes an In Stock phone the moment the delivery is saved.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="invoice">Invoice # (optional)</Label>
                        <Input
                          id="invoice"
                          className="w-40"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="pdate">Purchase date</Label>
                        <Input
                          id="pdate"
                          type="date"
                          className="w-40"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {rows.map((row, index) => (
                        <div key={index} className="rounded-md border p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-medium">Phone {index + 1}</span>
                            {rows.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                                aria-label={`Remove phone ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <Input
                              placeholder="IMEI (14-16 digits)"
                              value={row.imei}
                              onChange={(e) => updateRow(index, { imei: e.target.value })}
                            />
                            <Input
                              placeholder="Brand"
                              value={row.brand}
                              onChange={(e) => updateRow(index, { brand: e.target.value })}
                            />
                            <Input
                              placeholder="Model"
                              value={row.model}
                              onChange={(e) => updateRow(index, { model: e.target.value })}
                            />
                            <Input
                              placeholder="Storage (optional)"
                              value={row.storage}
                              onChange={(e) => updateRow(index, { storage: e.target.value })}
                            />
                            <Input
                              placeholder="Color (optional)"
                              value={row.color}
                              onChange={(e) => updateRow(index, { color: e.target.value })}
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Purchase price"
                              value={row.purchasePrice}
                              onChange={(e) => updateRow(index, { purchasePrice: e.target.value })}
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Selling price"
                              value={row.sellingPrice}
                              onChange={(e) => updateRow(index, { sellingPrice: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW }])}
                      >
                        <Plus className="h-4 w-4" />
                        Add phone
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Total cost:{' '}
                        {money(rows.reduce((sum, r) => sum + (Number(r.purchasePrice) || 0), 0))}
                      </span>
                    </div>

                    {formError && <p className="text-sm text-destructive">{formError}</p>}
                    <Button className="w-full" disabled={record.isPending} onClick={submitDelivery}>
                      {record.isPending ? 'Saving…' : `Save delivery (${rows.length} phone${rows.length === 1 ? '' : 's'})`}
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Purchase history ({supplier.data.purchases.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {supplier.data.purchases.length === 0 && (
                    <p className="text-sm text-muted-foreground">No purchases recorded yet.</p>
                  )}
                  {supplier.data.purchases.map((purchase) => (
                    <div key={purchase.purchaseId} className="rounded-md border">
                      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm">
                        <span className="font-medium">
                          {purchase.invoiceNumber ?? `Purchase #${purchase.purchaseId}`} ·{' '}
                          {new Date(purchase.purchaseDate).toLocaleDateString()}
                        </span>
                        <span>
                          {purchase.items.length} unit{purchase.items.length === 1 ? '' : 's'} ·{' '}
                          {money(purchase.totalAmount)}
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Phone</TableHead>
                            <TableHead>IMEI</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {purchase.items.map((item) => (
                            <TableRow key={item.purchaseItemId}>
                              <TableCell>
                                {item.phone.brand} {item.phone.model}
                                {item.phone.storage ? ` · ${item.phone.storage}` : ''}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{item.phone.imei}</TableCell>
                              <TableCell className="text-right">{money(item.purchasePrice)}</TableCell>
                              <TableCell>{item.phone.status}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
