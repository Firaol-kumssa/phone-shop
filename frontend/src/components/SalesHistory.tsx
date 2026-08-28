import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePhones } from '@/hooks/usePhones';
import { useProducts } from '@/hooks/useProducts';
import { useProcessReturn, useSalesList } from '@/hooks/useSales';
import type { ProcessReturnPayload, SaleItemWithPhone } from '@/services/types';

const money = (value: string | number) => Number(value).toFixed(2);

function itemLabel(item: SaleItemWithPhone): string {
  if (item.phone) return `${item.phone.brand} ${item.phone.model} (${item.phone.imei})`;
  if (item.product) return `${item.product.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`;
  return `Item #${item.saleItemId}`;
}

function isReturnable(item: SaleItemWithPhone): boolean {
  if (item.phone) return item.quantity > 0 && item.phone.status === 'Sold';
  return item.quantity > 0;
}

export function SalesHistory() {
  const { data: sales, isLoading } = useSalesList();
  const { data: inStockPhones } = usePhones('InStock');
  const { data: products } = useProducts('Active');
  const processReturn = useProcessReturn();

  const [openSaleId, setOpenSaleId] = useState<number | null>(null);
  const [returnItemId, setReturnItemId] = useState<number | null>(null);
  const [mode, setMode] = useState<'return' | 'exchange'>('return');
  const [returnQty, setReturnQty] = useState('1');
  // "phone:<id>" or "product:<id>"
  const [replacementKey, setReplacementKey] = useState('');
  const [replacementQty, setReplacementQty] = useState('1');
  const [replacementPrice, setReplacementPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function startReturn(saleItemId: number) {
    setReturnItemId(saleItemId === returnItemId ? null : saleItemId);
    setMode('return');
    setReturnQty('1');
    setReplacementKey('');
    setReplacementQty('1');
    setReplacementPrice('');
    setError(null);
    setSuccess(null);
  }

  function selectReplacement(key: string) {
    setReplacementKey(key);
    const [kind, idStr] = key.split(':');
    const id = Number(idStr);
    if (kind === 'phone') {
      const phone = inStockPhones?.find((p) => p.phoneId === id);
      setReplacementPrice(phone ? money(phone.sellingPrice) : '');
    } else if (kind === 'product') {
      const product = products?.find((p) => p.productId === id);
      setReplacementPrice(product ? money(product.sellingPrice) : '');
    } else {
      setReplacementPrice('');
    }
  }

  async function submitReturn(saleId: number, item: SaleItemWithPhone) {
    setError(null);
    setSuccess(null);

    const payload: ProcessReturnPayload = {
      mode,
      phoneId: item.phoneId ?? undefined,
      productId: item.productId ?? undefined,
      quantity: item.productId ? Number(returnQty) : undefined,
    };

    if (item.productId) {
      const qty = Number(returnQty);
      if (!Number.isInteger(qty) || qty < 1 || qty > item.quantity) {
        setError(`Return quantity must be between 1 and ${item.quantity}.`);
        return;
      }
    }

    if (mode === 'exchange') {
      const [kind, idStr] = replacementKey.split(':');
      const id = Number(idStr);
      if (!kind || !id) {
        setError('Pick a replacement item.');
        return;
      }
      if (!(Number(replacementPrice) > 0)) {
        setError('Replacement needs a positive selling price.');
        return;
      }
      payload.replacement = {
        phoneId: kind === 'phone' ? id : undefined,
        productId: kind === 'product' ? id : undefined,
        quantity: kind === 'product' ? Number(replacementQty) : undefined,
        sellingPrice: Number(replacementPrice),
      };
    }

    try {
      await processReturn.mutateAsync({ saleId, payload });
      setSuccess(
        mode === 'return'
          ? `Return processed — refund ${money(Number(item.sellingPrice) * (item.productId ? Number(returnQty) : 1))}.`
          : 'Exchange processed — replacement added to the sale.',
      );
      setReturnItemId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Return failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales history & returns</CardTitle>
        <CardDescription>
          Click a sale to see its items; returned phones and accessories go straight back into
          sellable stock.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading sales…</p>}
        {sales && sales.length === 0 && (
          <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
        )}
        {success && <p className="text-sm text-emerald-600">{success}</p>}
        {sales?.map((sale) => (
          <div key={sale.saleId} className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent"
              onClick={() => setOpenSaleId(openSaleId === sale.saleId ? null : sale.saleId)}
            >
              <span className="font-medium">
                Sale #{sale.saleId} · {new Date(sale.saleDate).toLocaleString()}
                {sale.customer ? ` · ${sale.customer.fullName}` : ' · Walk-in'}
              </span>
              <span>
                {sale.paymentMethod} · {money(sale.totalAmount)}
              </span>
            </button>

            {openSaleId === sale.saleId && (
              <div className="space-y-2 border-t p-3">
                {sale.items.map((item) => (
                  <div key={item.saleItemId} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="font-medium">{itemLabel(item)}</span>{' '}
                        <span className="text-muted-foreground">
                          · {money(Number(item.sellingPrice) * item.quantity)}
                        </span>
                        {item.phone && (
                          <Badge
                            variant={item.quantity === 0 ? 'destructive' : 'secondary'}
                            className="ml-2"
                          >
                            {item.quantity === 0 ? 'Returned' : item.phone.status}
                          </Badge>
                        )}
                        {item.product && item.quantity === 0 && (
                          <Badge variant="destructive" className="ml-2">
                            Fully returned
                          </Badge>
                        )}
                      </div>
                      {isReturnable(item) && (
                        <Button size="sm" variant="outline" onClick={() => startReturn(item.saleItemId)}>
                          Process Return
                        </Button>
                      )}
                    </div>

                    {returnItemId === item.saleItemId && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        <div className="flex gap-1">
                          {(
                            [
                              ['return', 'Return (money back)'],
                              ['exchange', 'Exchange'],
                            ] as ['return' | 'exchange', string][]
                          ).map(([value, label]) => (
                            <Button
                              key={value}
                              size="sm"
                              variant={mode === value ? 'default' : 'outline'}
                              onClick={() => setMode(value)}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>

                        {item.productId && (
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`rqty-${item.saleItemId}`} className="whitespace-nowrap">
                              Return quantity (max {item.quantity})
                            </Label>
                            <Input
                              id={`rqty-${item.saleItemId}`}
                              type="number"
                              min="1"
                              max={item.quantity}
                              step="1"
                              className="h-8 w-24"
                              value={returnQty}
                              onChange={(e) => setReturnQty(e.target.value)}
                            />
                          </div>
                        )}

                        {mode === 'exchange' && (
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <Label htmlFor={`repl-${item.saleItemId}`}>Replacement item</Label>
                              <select
                                id={`repl-${item.saleItemId}`}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                                value={replacementKey}
                                onChange={(e) => selectReplacement(e.target.value)}
                              >
                                <option value="">Choose a replacement…</option>
                                <optgroup label="Phones (In Stock)">
                                  {inStockPhones?.map((p) => (
                                    <option key={`phone-${p.phoneId}`} value={`phone:${p.phoneId}`}>
                                      {p.brand} {p.model} — {p.imei} ({money(p.sellingPrice)})
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Products">
                                  {products
                                    ?.filter((p) => p.quantityInStock > 0)
                                    .map((p) => (
                                      <option
                                        key={`product-${p.productId}`}
                                        value={`product:${p.productId}`}
                                      >
                                        {p.name} — {p.quantityInStock} in stock ({money(p.sellingPrice)})
                                      </option>
                                    ))}
                                </optgroup>
                              </select>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {replacementKey.startsWith('product:') && (
                                <div className="space-y-1">
                                  <Label htmlFor={`replqty-${item.saleItemId}`}>Quantity</Label>
                                  <Input
                                    id={`replqty-${item.saleItemId}`}
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="h-8 w-24"
                                    value={replacementQty}
                                    onChange={(e) => setReplacementQty(e.target.value)}
                                  />
                                </div>
                              )}
                              {replacementKey && (
                                <div className="space-y-1">
                                  <Label htmlFor={`replprice-${item.saleItemId}`}>Selling price</Label>
                                  <Input
                                    id={`replprice-${item.saleItemId}`}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="h-8 w-28"
                                    value={replacementPrice}
                                    onChange={(e) => setReplacementPrice(e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <Button
                          size="sm"
                          disabled={processReturn.isPending}
                          onClick={() => submitReturn(sale.saleId, item)}
                        >
                          {processReturn.isPending
                            ? 'Processing…'
                            : mode === 'return'
                              ? 'Confirm return'
                              : 'Confirm exchange'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
