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
import { useProducts } from '@/hooks/useProducts';
import { useCreateCustomer, useCustomers } from '@/hooks/useCustomers';
import { useCreateSale } from '@/hooks/useSales';
import { SalesHistory } from '@/components/SalesHistory';
import type { Customer, PaymentMethod, Phone, Product, Sale } from '@/services/types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'Telebirr', label: 'Telebirr' },
  { value: 'BankTransfer', label: 'Bank Transfer' },
];

type CustomerMode = 'walkin' | 'existing' | 'new';

const money = (value: string | number) => Number(value).toFixed(2);

export function SalesPage() {
  const navigate = useNavigate();
  const { data: phones, isLoading } = usePhones('InStock');
  const { data: products, isLoading: productsLoading } = useProducts('Active');
  const { data: customers } = useCustomers();
  const createCustomer = useCreateCustomer();
  const createSale = useCreateSale();

  const [search, setSearch] = useState('');
  // phoneId → editable selling price (pre-filled from the listed price)
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [productSearch, setProductSearch] = useState('');
  // productId → editable quantity + selling price (pre-filled from the listed price)
  const [selectedProducts, setSelectedProducts] = useState<
    Map<number, { quantity: string; price: string }>
  >(new Map());
  const [customerMode, setCustomerMode] = useState<CustomerMode>('walkin');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomer, setNewCustomer] = useState({ fullName: '', phoneNumber: '' });
  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    sale: Sale;
    phones: Phone[];
    products: Product[];
    customer: Customer | null;
  } | null>(null);

  const filteredPhones = useMemo(() => {
    if (!phones) return [];
    const term = search.trim().toLowerCase();
    if (!term) return phones;
    return phones.filter((p) =>
      [p.imei, p.brand, p.model].some((field) => field.toLowerCase().includes(term)),
    );
  }, [phones, search]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const inStock = products.filter((p) => p.quantityInStock > 0 || selectedProducts.has(p.productId));
    const term = productSearch.trim().toLowerCase();
    if (!term) return inStock;
    return inStock.filter((p) =>
      [p.name, p.category, p.brand ?? ''].some((field) => field.toLowerCase().includes(term)),
    );
  }, [products, productSearch, selectedProducts]);

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

  const phonesTotal = [...selected.values()].reduce((sum, price) => sum + (Number(price) || 0), 0);
  const productsTotal = [...selectedProducts.values()].reduce(
    (sum, { quantity, price }) => sum + (Number(quantity) || 0) * (Number(price) || 0),
    0,
  );
  const total = phonesTotal + productsTotal;
  const itemCount = selected.size + selectedProducts.size;

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

  function toggleProduct(product: Product) {
    setSelectedProducts((prev) => {
      const next = new Map(prev);
      if (next.has(product.productId)) {
        next.delete(product.productId);
      } else {
        next.set(product.productId, { quantity: '1', price: money(product.sellingPrice) });
      }
      return next;
    });
  }

  function setProductField(productId: number, field: 'quantity' | 'price', value: string) {
    setSelectedProducts((prev) => {
      const current = prev.get(productId);
      if (!current) return prev;
      return new Map(prev).set(productId, { ...current, [field]: value });
    });
  }

  async function submitSale() {
    setFormError(null);
    if (selected.size === 0 && selectedProducts.size === 0) {
      setFormError('Select at least one phone or product.');
      return;
    }
    for (const [, price] of selected) {
      if (!(Number(price) > 0)) {
        setFormError('Every selected phone needs a positive selling price.');
        return;
      }
    }
    for (const [productId, { quantity, price }] of selectedProducts) {
      const product = products?.find((p) => p.productId === productId);
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        setFormError('Every selected product needs a whole quantity of at least 1.');
        return;
      }
      if (product && qty > product.quantityInStock) {
        setFormError(`Only ${product.quantityInStock} × ${product.name} in stock.`);
        return;
      }
      if (!(Number(price) > 0)) {
        setFormError('Every selected product needs a positive selling price.');
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
      const soldProducts = (products ?? []).filter((p) => selectedProducts.has(p.productId));
      const sale = await createSale.mutateAsync({
        customerId: saleCustomer?.customerId,
        paymentMethod: payment,
        items:
          selected.size > 0
            ? [...selected.entries()].map(([phoneId, price]) => ({
                phoneId,
                sellingPrice: Number(price),
              }))
            : undefined,
        productItems:
          selectedProducts.size > 0
            ? [...selectedProducts.entries()].map(([productId, { quantity, price }]) => ({
                productId,
                quantity: Number(quantity),
                sellingPrice: Number(price),
              }))
            : undefined,
      });

      setReceipt({ sale, phones: soldPhones, products: soldProducts, customer: saleCustomer });
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
                  if (item.productId != null) {
                    const product = receipt.products.find((p) => p.productId === item.productId);
                    return (
                      <TableRow key={item.saleItemId}>
                        <TableCell>
                          <div className="font-medium">
                            {product ? product.name : `Product #${item.productId}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.quantity} × {money(item.sellingPrice)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {money(item.quantity * Number(item.sellingPrice))}
                        </TableCell>
                      </TableRow>
                    );
                  }
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
        <div className="space-y-4">
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

        <Card>
          <CardHeader>
            <CardTitle>2. Add products ({selectedProducts.size} selected)</CardTitle>
            <CardDescription>Accessories and other stock sold by quantity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search products by name, category, or brand…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            {productsLoading && <p className="text-sm text-muted-foreground">Loading products…</p>}
            {!productsLoading && filteredProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">No in-stock products match.</p>
            )}
            {filteredProducts.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Listed</TableHead>
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-32 text-right">Sell for</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const entry = selectedProducts.get(product.productId);
                    return (
                      <TableRow key={product.productId}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={!!entry}
                            onChange={() => toggleProduct(product)}
                            aria-label={`Select ${product.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {product.category}
                            {product.brand ? ` · ${product.brand}` : ''} · {product.quantityInStock}{' '}
                            in stock
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{money(product.sellingPrice)}</TableCell>
                        <TableCell className="text-right">
                          {entry ? (
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              max={product.quantityInStock}
                              className="h-8 text-right"
                              value={entry.quantity}
                              onChange={(e) =>
                                setProductField(product.productId, 'quantity', e.target.value)
                              }
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-8 text-right"
                              value={entry.price}
                              onChange={(e) =>
                                setProductField(product.productId, 'price', e.target.value)
                              }
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
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>3. Customer</CardTitle>
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
              <CardTitle>4. Payment & confirm</CardTitle>
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
                  Total ({itemCount} item{itemCount === 1 ? '' : 's'})
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

      <SalesHistory />
    </div>
  );
}
