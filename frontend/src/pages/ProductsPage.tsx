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
import {
  useCreateProduct,
  useDiscontinueProduct,
  useProducts,
  useRestockProduct,
} from '@/hooks/useProducts';
import { useAuth } from '@/hooks/useAuth';
import type { ProductStatus } from '@/services/types';

const money = (value: string | number) => Number(value).toFixed(2);

const EMPTY_FORM = {
  name: '',
  category: '',
  brand: '',
  costPrice: '',
  sellingPrice: '',
  quantity: '',
};

export function ProductsPage() {
  const [statusView, setStatusView] = useState<ProductStatus>('Active');
  const { data: products, isLoading } = useProducts(statusView);
  const createProduct = useCreateProduct();
  const restock = useRestockProduct();
  const discontinue = useDiscontinueProduct();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // productId → quantity typed into that row's restock input
  const [restockQty, setRestockQty] = useState<Record<number, string>>({});

  async function submitProduct() {
    setFormError(null);
    if (!form.name.trim() || !form.category.trim()) {
      setFormError('Name and category are required.');
      return;
    }
    if (!(Number(form.costPrice) > 0) || !(Number(form.sellingPrice) > 0)) {
      setFormError('Both prices must be positive.');
      return;
    }
    const quantity = Number(form.quantity || 0);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setFormError('Quantity must be a whole number (0 or more).');
      return;
    }

    try {
      await createProduct.mutateAsync({
        name: form.name.trim(),
        category: form.category.trim(),
        brand: form.brand.trim() || undefined,
        costPrice: Number(form.costPrice),
        sellingPrice: Number(form.sellingPrice),
        quantity,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not add product');
    }
  }

  async function submitRestock(productId: number) {
    const quantity = Number(restockQty[productId]);
    if (!Number.isInteger(quantity) || quantity <= 0) return;
    await restock.mutateAsync({ productId, quantity });
    setRestockQty((prev) => ({ ...prev, [productId]: '' }));
  }

  async function submitDiscontinue(productId: number) {
    setActionError(null);
    try {
      await discontinue.mutateAsync(productId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not discontinue');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <div className="flex gap-1">
          {(['Active', 'Discontinued'] as ProductStatus[]).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusView === status ? 'default' : 'outline'}
              onClick={() => setStatusView(status)}
            >
              {status}
            </Button>
          ))}
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New product</CardTitle>
            <CardDescription>Accessories are tracked by quantity — no IMEI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="p-name">Name</Label>
                <Input
                  id="p-name"
                  placeholder="e.g. AirPods Pro case"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-category">Category</Label>
                <Input
                  id="p-category"
                  placeholder="e.g. Headsets, Cases, Speakers"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-brand">Brand (optional)</Label>
                <Input
                  id="p-brand"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-cost">Cost price</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min="0"
                  step="1"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-sell">Selling price</Label>
                <Input
                  id="p-sell"
                  type="number"
                  min="0"
                  step="1"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="p-qty">Initial quantity</Label>
                <Input
                  id="p-qty"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button disabled={createProduct.isPending} onClick={submitProduct}>
              {createProduct.isPending ? 'Saving…' : 'Save product'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {statusView} products{products ? ` (${products.length})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionError && <p className="mb-2 text-sm text-destructive">{actionError}</p>}
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {products && products.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {statusView === 'Active' ? 'No products yet — add one above.' : 'Nothing discontinued.'}
            </p>
          )}
          {products && products.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead className="w-44 text-right">Restock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{product.brand ?? '—'}</TableCell>
                    <TableCell className="text-right">{money(product.costPrice)}</TableCell>
                    <TableCell className="text-right">{money(product.sellingPrice)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={product.quantityInStock > 0 ? 'success' : 'destructive'}>
                        {product.quantityInStock}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {statusView === 'Active' ? (
                          <>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              className="h-8 w-20 text-right"
                              placeholder="Qty"
                              value={restockQty[product.productId] ?? ''}
                              onChange={(e) =>
                                setRestockQty((prev) => ({
                                  ...prev,
                                  [product.productId]: e.target.value,
                                }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={restock.isPending || !(Number(restockQty[product.productId]) > 0)}
                              onClick={() => submitRestock(product.productId)}
                            >
                              Add
                            </Button>
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={discontinue.isPending}
                                onClick={() => submitDiscontinue(product.productId)}
                              >
                                Discontinue
                              </Button>
                            )}
                          </>
                        ) : (
                          <Badge variant="destructive">Discontinued</Badge>
                        )}
                      </div>
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
