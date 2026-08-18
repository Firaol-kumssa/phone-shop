import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { usePhones } from '@/hooks/usePhones';
import { useCreateCustomer, useCustomers } from '@/hooks/useCustomers';
import { useCreateSale } from '@/hooks/useSales';
import type { Customer, PaymentMethod, Phone, Sale } from '@/services/types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'MobileMoney', label: 'Mobile Money' },
  { value: 'BankTransfer', label: 'Bank Transfer' },
];

type CustomerMode = 'walkin' | 'existing' | 'new';

const money = (value: string | number) => Number(value).toFixed(2);

export function SalesPage() {
  const navigate = useNavigate();
  const { data: phones, isLoading } = usePhones('InStock');
  const { data: customers } = useCustomers();
  const createCustomer = useCreateCustomer();
  const createSale = useCreateSale();

  const [search, setSearch] = useState('');
  // phoneId → editable selling price (pre-filled from the listed price)
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [customerMode, setCustomerMode] = useState<CustomerMode>('walkin');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomer, setNewCustomer] = useState({ fullName: '', phoneNumber: '' });
  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ sale: Sale; phones: Phone[]; customer: Customer | null } | null>(null);

  const filteredPhones = useMemo(() => {
    if (!phones) return [];
    const term = search.trim().toLowerCase();
    if (!term) return phones;
    return phones.filter((p) =>
      [p.imei, p.brand, p.model].some((field) => field.toLowerCase().includes(term)),
    );
  }, [phones, search]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const term = customerSearch.trim().toLowerCase();
    const matches = term
      ? customers.filter((c) =>
          [c.fullName, c.phoneNumber ?? ''].some((f) => f.toLowerCase().includes(term)),
        )
      : customers;
    return matches.slice(0, 5);
  }, [customers, customerSearch]);

  const total = [...selected.values()].reduce((sum, price) => sum + (Number(price) || 0), 0);

  function togglePhone(phone: Phone) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(phone.phoneId)) {
        next.delete(phone.phoneId);
      } else {
        next.set(phone.phoneId, money(phone.sellingPrice));
      }
      return next;
    });
  }

  function setPrice(phoneId: number, value: string) {
    setSelected((prev) => new Map(prev).set(phoneId, value));
  }

  async function submitSale() {
    setFormError(null);
    if (selected.size === 0) {
      setFormError('Select at least one phone.');
      return;
    }
    for (const [, price] of selected) {
      if (!(Number(price) > 0)) {
        setFormError('Every selected phone needs a positive selling price.');
        return;
      }
    }

    try {
      let saleCustomer: Customer | null = null;
      if (customerMode === 'existing') {
        saleCustomer = customers?.find((c) => c.customerId === customerId) ?? null;
        if (!saleCustomer) {
          setFormError('Pick a customer, or switch to walk-in.');
          return;
        }
      } else if (customerMode === 'new') {
        if (!newCustomer.fullName.trim()) {
          setFormError('New customer needs at least a name.');
          return;
        }
        saleCustomer = await createCustomer.mutateAsync({
          fullName: newCustomer.fullName.trim(),
          phoneNumber: newCustomer.phoneNumber.trim() || undefined,
        });
      }

      const soldPhones = (phones ?? []).filter((p) => selected.has(p.phoneId));
      const sale = await createSale.mutateAsync({
        customerId: saleCustomer?.customerId,
        paymentMethod: payment,
        items: [...selected.entries()].map(([phoneId, price]) => ({
          phoneId,
          sellingPrice: Number(price),
        })),
      });

      setReceipt({ sale, phones: soldPhones, customer: saleCustomer });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Sale failed');
    }
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold">Sale recorded</h1>
        <Card>
          <CardHeader>
            <CardTitle>Receipt — Sale #{receipt.sale.saleId}</CardTitle>
            <CardDescription>
              {new Date(receipt.sale.saleDate).toLocaleString()} ·{' '}
              {PAYMENT_METHODS.find((m) => m.value === receipt.sale.paymentMethod)?.label} ·{' '}
              {receipt.customer ? receipt.customer.fullName : 'Walk-in customer'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableBody>
                {(receipt.sale.items ?? []).map((item) => {
                  const phone = receipt.phones.find((p) => p.phoneId === item.phoneId);
                  return (
                    <TableRow key={item.saleItemId}>
                      <TableCell>
                        <div className="font-medium">
                          {phone ? `${phone.brand} ${phone.model}` : `Phone #${item.phoneId}`}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">{phone?.imei}</div>
                      </TableCell>
                      <TableCell className="text-right">{money(item.sellingPrice)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold">
                    {money(receipt.sale.totalAmount)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Button className="w-full" onClick={() => navigate('/inventory')}>
              Done — view updated inventory
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Record Sale</h1>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>1. Select phones ({selected.size} selected)</CardTitle>
            <CardDescription>Only In Stock phones can be sold.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by IMEI, brand, or model…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {isLoading && <p className="text-sm text-muted-foreground">Loading stock…</p>}
            {!isLoading && filteredPhones.length === 0 && (
              <p className="text-sm text-muted-foreground">No In Stock phones match.</p>
            )}
            {filteredPhones.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Listed</TableHead>
                    <TableHead className="w-32 text-right">Sell for</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPhones.map((phone) => {
                    const isSelected = selected.has(phone.phoneId);
                    return (
                      <TableRow key={phone.phoneId}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={isSelected}
                            onChange={() => togglePhone(phone)}
                            aria-label={`Select ${phone.brand} ${phone.model}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {phone.brand} {phone.model}
                            {phone.storage ? ` · ${phone.storage}` : ''}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">{phone.imei}</div>
                        </TableCell>
                        <TableCell className="text-right">{money(phone.sellingPrice)}</TableCell>
                        <TableCell className="text-right">
                          {isSelected ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-8 text-right"
                              value={selected.get(phone.phoneId)}
                              onChange={(e) => setPrice(phone.phoneId, e.target.value)}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>2. Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1">
                {(
                  [
                    ['walkin', 'Walk-in'],
                    ['existing', 'Existing'],
                    ['new', 'New'],
                  ] as [CustomerMode, string][]
                ).map(([mode, label]) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={customerMode === mode ? 'default' : 'outline'}
                    onClick={() => setCustomerMode(mode)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {customerMode === 'existing' && (
                <div className="space-y-2">
                  <Input
                    placeholder="Search customers…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                  <div className="space-y-1">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.customerId}
                        type="button"
                        onClick={() => setCustomerId(customer.customerId)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          customerId === customer.customerId
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <div className="font-medium">{customer.fullName}</div>
                        <div className="text-xs opacity-70">{customer.phoneNumber ?? 'no phone'}</div>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <p className="text-sm text-muted-foreground">No customers found.</p>
                    )}
                  </div>
                </div>
              )}

              {customerMode === 'new' && (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="new-name">Full name</Label>
                    <Input
                      id="new-name"
                      value={newCustomer.fullName}
                      onChange={(e) => setNewCustomer({ ...newCustomer, fullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-phone">Phone number (optional)</Label>
                    <Input
                      id="new-phone"
                      value={newCustomer.phoneNumber}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, phoneNumber: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Payment & confirm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {PAYMENT_METHODS.map((method) => (
                  <Button
                    key={method.value}
                    size="sm"
                    variant={payment === method.value ? 'default' : 'outline'}
                    onClick={() => setPayment(method.value)}
                  >
                    {method.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">
                  Total ({selected.size} phone{selected.size === 1 ? '' : 's'})
                </span>
                <Badge variant="secondary" className="text-base">
                  {money(total)}
                </Badge>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button
                className="w-full"
                disabled={createSale.isPending || createCustomer.isPending}
                onClick={submitSale}
              >
                {createSale.isPending ? 'Recording…' : 'Record sale'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
