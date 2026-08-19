export interface SessionUser {
  userId: number;
  fullName: string;
  username: string;
  email: string | null;
  role: 'Admin' | 'SalesStaff';
  status: 'Active' | 'Inactive';
}

export interface StaffUser extends SessionUser {
  phoneNumber: string | null;
  digitalId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface RegisterUserPayload {
  fullName: string;
  username: string;
  password: string;
  role: 'Admin' | 'SalesStaff';
  phoneNumber?: string;
  digitalId?: string;
  email?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: SessionUser;
}

export type PhoneStatus = 'InStock' | 'Reserved' | 'Sold' | 'Returned';

export type PaymentMethod = 'Cash' | 'Card' | 'Telebirr' | 'BankTransfer';

export interface Customer {
  customerId: number;
  fullName: string;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
}

export interface SaleItem {
  saleItemId: number;
  saleId: number;
  phoneId: number | null;
  productId: number | null;
  quantity: number;
  sellingPrice: string;
  profit: string;
  createdAt: string;
}

export type ProductStatus = 'Active' | 'Discontinued';

/** Non-serialized accessory tracked by quantity — no IMEI. */
export interface Product {
  productId: number;
  name: string;
  category: string;
  brand: string | null;
  costPrice: string;
  sellingPrice: string;
  quantityInStock: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string | null;
}

export interface Sale {
  saleId: number;
  customerId: number | null;
  saleDate: string;
  totalAmount: string;
  paymentMethod: PaymentMethod;
  soldBy: number;
  createdAt: string;
  items?: SaleItem[];
}

export interface SaleDetail extends Sale {
  items: SaleItemWithPhone[];
  customer: Customer | null;
}

export interface ProcessReturnPayload {
  mode: 'return' | 'exchange';
  phoneId?: number;
  productId?: number;
  quantity?: number;
  replacement?: {
    phoneId?: number;
    productId?: number;
    quantity?: number;
    sellingPrice: number;
  };
}

export interface SaleItemWithPhone extends SaleItem {
  phone: Phone | null;
  product: Product | null;
}

export interface SaleWithItems extends Sale {
  items: SaleItemWithPhone[];
}

/** GET /customers/:id — history derived from sales, not stored (Blueprint 3.3). */
export interface CustomerDetail extends Customer {
  sales: SaleWithItems[];
}

export interface CreateSalePayload {
  customerId?: number;
  paymentMethod: PaymentMethod;
  items?: { phoneId: number; sellingPrice: number }[];
  productItems?: { productId: number; quantity: number; sellingPrice: number }[];
}

export interface Supplier {
  supplierId: number;
  name: string;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
}

export interface PurchaseItem {
  purchaseItemId: number;
  purchaseId: number;
  phoneId: number;
  purchasePrice: string;
  createdAt: string;
  phone: Phone;
}

export interface Purchase {
  purchaseId: number;
  supplierId: number;
  invoiceNumber: string | null;
  purchaseDate: string;
  totalAmount: string;
  createdBy: number;
  createdAt: string;
  items: PurchaseItem[];
}

export interface SupplierDetail extends Supplier {
  purchases: Purchase[];
}

export interface DeliveryItemPayload {
  imei: string;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  purchasePrice: number;
  sellingPrice: number;
}

export interface RecordDeliveryPayload {
  invoiceNumber?: string;
  purchaseDate: string;
  items: DeliveryItemPayload[];
}

export interface SalesReport {
  from: string;
  to: string;
  salesCount: number;
  unitsSold: number;
  totalRevenue: number;
  totalProfit: number;
}

export type ProfitGroupBy = 'model' | 'brand' | 'staff';

export interface ProfitRow {
  key: string;
  unitsSold: number;
  revenue: number;
  profit: number;
}

export interface ProfitReport {
  groupBy: ProfitGroupBy;
  rows: ProfitRow[];
}

export interface InventoryReport {
  totalUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  phones: { units: number; costValue: number; retailValue: number };
  products: { units: number; costValue: number; retailValue: number };
  byModel: {
    brand: string;
    model: string;
    units: number;
    costValue: number;
    retailValue: number;
  }[];
  byProduct: {
    name: string;
    category: string;
    units: number;
    costValue: number;
    retailValue: number;
  }[];
}

export interface SalesSplit {
  phones: { units: number; revenue: number; profit: number };
  products: { units: number; revenue: number; profit: number };
}

/** Decimal columns are serialized as strings by the API. */
export interface Phone {
  phoneId: number;
  imei: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  purchasePrice: string;
  sellingPrice: string;
  status: PhoneStatus;
  supplierId: number | null;
  addedDate: string;
  updatedAt: string | null;
}

export interface CreatePhonePayload {
  imei: string;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  purchasePrice: number;
  sellingPrice: number;
  supplierId?: number;
}
