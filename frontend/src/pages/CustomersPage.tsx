import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { useCreateCustomer, useCustomer, useCustomers } from '@/hooks/useCustomers';

const money = (value: string | number) => Number(value).toFixed(2);

const EMPTY_FORM = { fullName: '', phoneNumber: '', email: '', address: '' };

export function CustomersPage() {
  const { data: customers, isLoading } = useCustomers();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const customer = useCustomer(selectedId);
  const createCustomer = useCreateCustomer();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [c.fullName, c.phoneNumber ?? '', c.email ?? ''].some((field) =>
        field.toLowerCase().includes(term),
      ),
    );
  }, [customers, search]);

  async function submitNewCustomer() {
    setFormError(null);
    if (!form.fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    try {
      const created = await createCustomer.mutateAsync({
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSelectedId(created.customerId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create customer');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New customer
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New customer</CardTitle>
            <CardDescription>Phone number is the practical unique identifier.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="c-name">Full name</Label>
                <Input
                  id="c-name"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-phone">Phone number</Label>
                <Input
                  id="c-phone"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-email">Email (optional)</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-address">Address (optional)</Label>
                <Input
                  id="c-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button disabled={createCustomer.isPending} onClick={submitNewCustomer}>
              {createCustomer.isPending ? 'Saving…' : 'Save customer'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>All customers{customers ? ` (${customers.length})` : ''}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Search by name, phone, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            <div className="space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.customerId}
                  type="button"
                  onClick={() => setSelectedId(c.customerId)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === c.customerId
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="font-medium">{c.fullName}</div>
                  <div className="text-xs opacity-70">{c.phoneNumber ?? 'no phone'}</div>
                </button>
              ))}
              {customers && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No customers match.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedId === null && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Select a customer to see their purchase history.
              </CardContent>
            </Card>
          )}

          {customer.data && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{customer.data.fullName}</CardTitle>
                  <CardDescription>
                    {[customer.data.phoneNumber, customer.data.email, customer.data.address]
                      .filter(Boolean)
                      .join(' · ') || 'No contact details'}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Purchase history ({customer.data.sales.length})</CardTitle>
                  <CardDescription>
                    Derived live from this customer's sales — nothing stored separately.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customer.data.sales.length === 0 && (
                    <p className="text-sm text-muted-foreground">No purchases yet.</p>
                  )}
                  {customer.data.sales.map((sale) => (
                    <div key={sale.saleId} className="rounded-md border">
                      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm">
                        <span className="font-medium">
                          Sale #{sale.saleId} · {new Date(sale.saleDate).toLocaleString()}
                        </span>
                        <span>
                          {sale.paymentMethod} · {money(sale.totalAmount)}
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>IMEI</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sale.items.map((item) => (
                            <TableRow key={item.saleItemId}>
                              <TableCell>
                                {item.phone
                                  ? `${item.phone.brand} ${item.phone.model}${
                                      item.phone.storage ? ` · ${item.phone.storage}` : ''
                                    }`
                                  : item.product
                                    ? `${item.product.name}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`
                                    : `Item #${item.saleItemId}`}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {item.phone?.imei ?? '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                {money(Number(item.sellingPrice) * item.quantity)}
                              </TableCell>
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
