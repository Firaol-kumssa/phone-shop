import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PhoneStatus, ProductStatus, Sale, SaleItem } from '@prisma/client';
import {
  PhonesUnavailableError,
  ProductsUnavailableError,
  ReturnNotPossibleError,
  SaleRepository,
} from '../repositories/sale.repository';
import { PhoneRepository } from '../repositories/phone.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { ProductRepository } from '../repositories/product.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { CreateSaleDto } from '../models/dto/create-sale.dto';
import { ProcessReturnDto } from '../models/dto/process-return.dto';

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
    const discontinued = products.filter((p) => p.status === ProductStatus.Discontinued);
    if (discontinued.length > 0) {
      throw new ConflictException(
        `Discontinued products cannot be sold: ${discontinued.map((p) => p.name).join(', ')}`,
      );
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

  /**
   * Return/exchange per Blueprint Part 13. Plain return: restore the item and
   * void its profit. Exchange: same transaction also sells the replacement
   * (availability checked first). Audit-logged as RETURN_PROCESSED.
   */
  async processReturn(saleId: number, dto: ProcessReturnDto, userId: number): Promise<Sale> {
    if ((dto.phoneId === undefined) === (dto.productId === undefined)) {
      throw new BadRequestException('Specify exactly one of phoneId or productId to return');
    }
    if (dto.mode === 'exchange' && !dto.replacement) {
      throw new BadRequestException('Exchange mode requires a replacement item');
    }
    if (dto.mode === 'return' && dto.replacement) {
      throw new BadRequestException('Plain return cannot include a replacement');
    }
    if (
      dto.replacement &&
      (dto.replacement.phoneId === undefined) === (dto.replacement.productId === undefined)
    ) {
      throw new BadRequestException('Replacement needs exactly one of phoneId or productId');
    }

    const sale = await this.saleRepository.findById(saleId);
    if (!sale) {
      throw new NotFoundException(`Sale ${saleId} not found`);
    }

    const items = (sale as Sale & { items: SaleItem[] }).items;
    const line =
      dto.phoneId !== undefined
        ? items.find((item) => item.phoneId === dto.phoneId)
        : items.find((item) => item.productId === dto.productId && item.quantity > 0);
    if (!line) {
      throw new NotFoundException('That item is not on this sale (or was fully returned)');
    }

    const returnQuantity = dto.phoneId !== undefined ? 1 : (dto.quantity ?? 1);

    // Pre-checks; the transaction re-verifies with conditional updates
    if (dto.phoneId !== undefined) {
      const phone = await this.phoneRepository.findById(dto.phoneId);
      if (!phone || phone.status !== PhoneStatus.Sold) {
        throw new ConflictException('Phone is not in Sold state (already returned?)');
      }
    } else if (line.quantity < returnQuantity) {
      throw new ConflictException(
        `Only ${line.quantity} unit(s) of that product remain on this sale`,
      );
    }

    const unitPrice = Number(line.sellingPrice);
    const refundAmount = unitPrice * returnQuantity;
    const profitVoid =
      dto.phoneId !== undefined
        ? Number(line.profit)
        : (Number(line.profit) / line.quantity) * returnQuantity;

    let replacement: { phoneId?: number; productId?: number; quantity: number; sellingPrice: number; profit: number } | undefined;
    if (dto.replacement) {
      const replacementQuantity = dto.replacement.productId !== undefined ? (dto.replacement.quantity ?? 1) : 1;
      if (dto.replacement.phoneId !== undefined) {
        const phone = await this.phoneRepository.findById(dto.replacement.phoneId);
        if (!phone) {
          throw new NotFoundException(`Replacement phone ${dto.replacement.phoneId} not found`);
        }
        if (phone.status !== PhoneStatus.InStock) {
          throw new ConflictException(`Replacement phone ${phone.imei} is not In Stock`);
        }
        replacement = {
          phoneId: phone.phoneId,
          quantity: 1,
          sellingPrice: dto.replacement.sellingPrice,
          profit: dto.replacement.sellingPrice - phone.purchasePrice.toNumber(),
        };
      } else {
        const product = await this.productRepository.findById(dto.replacement.productId!);
        if (!product) {
          throw new NotFoundException(`Replacement product ${dto.replacement.productId} not found`);
        }
        if (product.status === ProductStatus.Discontinued) {
          throw new ConflictException(`${product.name} is discontinued and cannot be sold`);
        }
        if (product.quantityInStock < replacementQuantity) {
          throw new ConflictException(
            `Insufficient stock: ${product.name} (${product.quantityInStock} left)`,
          );
        }
        replacement = {
          productId: product.productId,
          quantity: replacementQuantity,
          sellingPrice: dto.replacement.sellingPrice,
          profit:
            (dto.replacement.sellingPrice - product.costPrice.toNumber()) * replacementQuantity,
        };
      }
    }

    let updated: Sale;
    try {
      updated = await this.saleRepository.processReturn({
        saleId,
        returned: {
          saleItemId: line.saleItemId,
          phoneId: dto.phoneId,
          productId: dto.productId,
          quantity: returnQuantity,
          refundAmount,
          profitVoid,
        },
        replacement,
      });
    } catch (error) {
      if (
        error instanceof ReturnNotPossibleError ||
        error instanceof PhonesUnavailableError ||
        error instanceof ProductsUnavailableError
      ) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    await this.auditLogs.record({
      userId,
      action: 'RETURN_PROCESSED',
      tableAffected: 'sales',
      recordId: String(saleId),
      details: {
        mode: dto.mode,
        returned: {
          phoneId: dto.phoneId ?? null,
          productId: dto.productId ?? null,
          quantity: returnQuantity,
          refundAmount,
          profitVoided: profitVoid,
        },
        replacement: replacement
          ? {
              phoneId: replacement.phoneId ?? null,
              productId: replacement.productId ?? null,
              quantity: replacement.quantity,
              sellingPrice: replacement.sellingPrice,
            }
          : null,
      },
    });

    return updated;
  }
}
