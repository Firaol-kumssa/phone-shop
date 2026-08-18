import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PhoneStatus, Sale } from '@prisma/client';
import {
  PhonesUnavailableError,
  ProductsUnavailableError,
  SaleRepository,
} from '../repositories/sale.repository';
import { PhoneRepository } from '../repositories/phone.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { ProductRepository } from '../repositories/product.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { CreateSaleDto } from '../models/dto/create-sale.dto';

@Injectable()
export class SaleService {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly phoneRepository: PhoneRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly productRepository: ProductRepository,
    private readonly auditLogs: AuditLogRepository,
  ) {}

  listSales(): Promise<Sale[]> {
    return this.saleRepository.findAll();
  }

  async getSale(saleId: number): Promise<Sale> {
    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new NotFoundException(`Sale ${saleId} not found`);
    }
    return sale;
  }

  /**
   * Records a sale per Blueprint 3.2 / 8.2, supporting a mix of serialized
   * phones and quantity-tracked products: availability pre-check → atomic
   * transaction (sale + items + phones → Sold + product stock decrement)
   * → audit log after commit. Profit is captured at sale time (Blueprint 5.2).
   */
  async createSale(dto: CreateSaleDto, soldBy: number): Promise<Sale> {
    const phoneItems = dto.items ?? [];
    const productLines = dto.productItems ?? [];
    if (phoneItems.length + productLines.length === 0) {
      throw new BadRequestException('A sale needs at least one phone or product');
    }

    const phoneIds = phoneItems.map((item) => item.phoneId);
    if (new Set(phoneIds).size !== phoneIds.length) {
      throw new BadRequestException('The same phone appears more than once in the sale');
    }
    const productIds = productLines.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('The same product appears more than once — use quantity instead');
    }

    // Customer is optional (walk-ins, Blueprint 3.3) but must exist when given
    if (dto.customerId !== undefined) {
      const customer = await this.customerRepository.findById(dto.customerId);
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }
    }

    // Pre-transaction checks (8.2 failure path): abort before BEGIN TRANSACTION,
    // naming what became unavailable.
    const phones = await this.phoneRepository.findManyByIds(phoneIds);
    const phoneById = new Map(phones.map((p) => [p.phoneId, p]));
    const missingPhones = phoneIds.filter((id) => !phoneById.has(id));
    if (missingPhones.length > 0) {
      throw new NotFoundException(`Phones not found: ${missingPhones.join(', ')}`);
    }
    const unavailable = phones.filter((p) => p.status !== PhoneStatus.InStock);
    if (unavailable.length > 0) {
      throw new ConflictException(
        `Phones no longer In Stock: ${unavailable.map((p) => p.imei).join(', ')}`,
      );
    }

    const products =
      productIds.length > 0 ? await this.productRepository.findManyByIds(productIds) : [];
    const productById = new Map(products.map((p) => [p.productId, p]));
    const missingProducts = productIds.filter((id) => !productById.has(id));
    if (missingProducts.length > 0) {
      throw new NotFoundException(`Products not found: ${missingProducts.join(', ')}`);
    }
    const shortages = productLines.filter(
      (line) => productById.get(line.productId)!.quantityInStock < line.quantity,
    );
    if (shortages.length > 0) {
      throw new ConflictException(
        `Insufficient stock: ${shortages
          .map((line) => {
            const product = productById.get(line.productId)!;
            return `${product.name} (${product.quantityInStock} left, ${line.quantity} requested)`;
          })
          .join(', ')}`,
      );
    }

    const items = phoneItems.map((item) => ({
      phoneId: item.phoneId,
      sellingPrice: item.sellingPrice,
      profit: item.sellingPrice - phoneById.get(item.phoneId)!.purchasePrice.toNumber(),
    }));
    const productItems = productLines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      sellingPrice: line.sellingPrice,
      profit:
        (line.sellingPrice - productById.get(line.productId)!.costPrice.toNumber()) *
        line.quantity,
    }));
    const totalAmount =
      items.reduce((sum, item) => sum + item.sellingPrice, 0) +
      productItems.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);

    let sale: Sale;
    try {
      sale = await this.saleRepository.createSaleWithItems({
        customerId: dto.customerId,
        paymentMethod: dto.paymentMethod,
        soldBy,
        totalAmount,
        items,
        productItems,
      });
    } catch (error) {
      if (error instanceof PhonesUnavailableError || error instanceof ProductsUnavailableError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    // After commit, per sequence diagram 8.2
    await this.auditLogs.record({
      userId: soldBy,
      action: 'SALE_RECORDED',
      tableAffected: 'sales',
      recordId: String(sale.saleId),
      details: { totalAmount, phoneIds, productIds, customerId: dto.customerId ?? null },
    });

    return sale;
  }
}
