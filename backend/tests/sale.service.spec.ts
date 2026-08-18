// Business-rule tests for the Sales Module (Blueprint 9.3 / 3.2 / 8.2).
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PhoneStatus, Prisma } from '@prisma/client';
import { SaleService } from '../src/services/sale.service';
import { PhonesUnavailableError } from '../src/repositories/sale.repository';
import { CreateSaleDto } from '../src/models/dto/create-sale.dto';

const decimal = (n: number) => new Prisma.Decimal(n);

const phone = (phoneId: number, overrides: Record<string, unknown> = {}) => ({
  phoneId,
  imei: `86000000000000${phoneId}`,
  brand: 'Samsung',
  model: 'Galaxy A16',
  purchasePrice: decimal(180),
  sellingPrice: decimal(230),
  status: PhoneStatus.InStock,
  ...overrides,
});

const product = (productId: number, overrides: Record<string, unknown> = {}) => ({
  productId,
  name: 'USB-C Cable',
  category: 'Accessories',
  brand: 'Anker',
  costPrice: decimal(5),
  sellingPrice: decimal(10),
  quantityInStock: 20,
  ...overrides,
});

describe('SaleService.createSale', () => {
  let saleRepository: { createSaleWithItems: jest.Mock; findAll: jest.Mock; findById: jest.Mock };
  let phoneRepository: { findManyByIds: jest.Mock };
  let customerRepository: { findById: jest.Mock };
  let productRepository: { findManyByIds: jest.Mock };
  let auditLogs: { record: jest.Mock };
  let service: SaleService;

  const dto: CreateSaleDto = {
    paymentMethod: PaymentMethod.Cash,
    items: [{ phoneId: 1, sellingPrice: 230 }],
  };

  beforeEach(() => {
    saleRepository = {
      createSaleWithItems: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
    };
    phoneRepository = { findManyByIds: jest.fn().mockResolvedValue([]) };
    customerRepository = { findById: jest.fn() };
    productRepository = { findManyByIds: jest.fn().mockResolvedValue([]) };
    auditLogs = { record: jest.fn().mockResolvedValue(undefined) };
    service = new SaleService(
      saleRepository as never,
      phoneRepository as never,
      customerRepository as never,
      productRepository as never,
      auditLogs as never,
    );
  });

  it('records a sale atomically: sale + items + phone status handled as one unit of work', async () => {
    phoneRepository.findManyByIds.mockResolvedValue([phone(1)]);
    const created = { saleId: 7, totalAmount: decimal(230) };
    saleRepository.createSaleWithItems.mockResolvedValue(created);

    const result = await service.createSale(dto, 1);

    expect(saleRepository.createSaleWithItems).toHaveBeenCalledWith({
      customerId: undefined,
      paymentMethod: PaymentMethod.Cash,
      soldBy: 1,
      totalAmount: 230,
      items: [{ phoneId: 1, sellingPrice: 230, profit: 50 }],
      productItems: [],
    });
    expect(result).toBe(created);
    // Audit is written only after the transaction commits (Blueprint 8.2)
    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SALE_RECORDED', recordId: '7' }),
    );
  });

  it('selling the last unit of a phone twice fails the second time (Blueprint 9.3)', async () => {
    // First sale: phone is In Stock → succeeds
    phoneRepository.findManyByIds.mockResolvedValueOnce([phone(1)]);
    saleRepository.createSaleWithItems.mockResolvedValueOnce({ saleId: 1 });
    await service.createSale(dto, 1);

    // Second sale of the same phone: now Sold → 409 before any transaction starts
    phoneRepository.findManyByIds.mockResolvedValueOnce([
      phone(1, { status: PhoneStatus.Sold }),
    ]);
    await expect(service.createSale(dto, 1)).rejects.toBeInstanceOf(ConflictException);
    expect(saleRepository.createSaleWithItems).toHaveBeenCalledTimes(1);
  });

  it('concurrent double-sell: in-transaction re-check failure surfaces as 409, no partial sale', async () => {
    // Pre-check passes, but another staff member sold the phone in between
    phoneRepository.findManyByIds.mockResolvedValue([phone(1)]);
    saleRepository.createSaleWithItems.mockRejectedValue(
      new PhonesUnavailableError(['860000000000001']),
    );

    await expect(service.createSale(dto, 1)).rejects.toBeInstanceOf(ConflictException);
    // Nothing committed → nothing audited
    expect(auditLogs.record).not.toHaveBeenCalled();
  });

  it('stores profit = negotiated selling price − purchase price at sale time', async () => {
    phoneRepository.findManyByIds.mockResolvedValue([phone(1)]);
    saleRepository.createSaleWithItems.mockResolvedValue({ saleId: 2 });

    // Negotiated down from the listed 230 to 200
    await service.createSale(
      { ...dto, items: [{ phoneId: 1, sellingPrice: 200 }] },
      1,
    );

    expect(saleRepository.createSaleWithItems).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 200,
        items: [{ phoneId: 1, sellingPrice: 200, profit: 20 }],
      }),
    );
  });

  it('rejects a phone that is Reserved (only In Stock is sellable)', async () => {
    phoneRepository.findManyByIds.mockResolvedValue([
      phone(1, { status: PhoneStatus.Reserved }),
    ]);
    await expect(service.createSale(dto, 1)).rejects.toBeInstanceOf(ConflictException);
    expect(saleRepository.createSaleWithItems).not.toHaveBeenCalled();
  });

  it('rejects the same phone twice in one sale', async () => {
    const doubled: CreateSaleDto = {
      ...dto,
      items: [
        { phoneId: 1, sellingPrice: 230 },
        { phoneId: 1, sellingPrice: 230 },
      ],
    };
    await expect(service.createSale(doubled, 1)).rejects.toBeInstanceOf(BadRequestException);
    expect(phoneRepository.findManyByIds).not.toHaveBeenCalled();
  });

  it('rejects unknown phones with 404', async () => {
    phoneRepository.findManyByIds.mockResolvedValue([]);
    await expect(service.createSale(dto, 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an unknown customer with 404 but allows walk-ins', async () => {
    customerRepository.findById.mockResolvedValue(null);
    await expect(
      service.createSale({ ...dto, customerId: 999 }, 1),
    ).rejects.toBeInstanceOf(NotFoundException);

    // Walk-in (no customerId) never touches the customer repository
    phoneRepository.findManyByIds.mockResolvedValue([phone(1)]);
    saleRepository.createSaleWithItems.mockResolvedValue({ saleId: 3 });
    await service.createSale(dto, 1);
    expect(customerRepository.findById).toHaveBeenCalledTimes(1);
  });

  it('multi-phone sale: one sale item per phone, total = sum of negotiated prices', async () => {
    phoneRepository.findManyByIds.mockResolvedValue([
      phone(1),
      phone(2, { purchasePrice: decimal(120), sellingPrice: decimal(160) }),
    ]);
    saleRepository.createSaleWithItems.mockResolvedValue({ saleId: 4 });

    await service.createSale(
      {
        paymentMethod: PaymentMethod.Card,
        items: [
          { phoneId: 1, sellingPrice: 230 },
          { phoneId: 2, sellingPrice: 155 },
        ],
      },
      1,
    );

    expect(saleRepository.createSaleWithItems).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 385,
        items: [
          { phoneId: 1, sellingPrice: 230, profit: 50 },
          { phoneId: 2, sellingPrice: 155, profit: 35 },
        ],
      }),
    );
  });

  it('mixed sale: phone + product quantity, stock-aware totals and per-line profit', async () => {
    phoneRepository.findManyByIds.mockResolvedValue([phone(1)]);
    productRepository.findManyByIds.mockResolvedValue([product(7)]);
    saleRepository.createSaleWithItems.mockResolvedValue({ saleId: 5 });

    await service.createSale(
      {
        paymentMethod: PaymentMethod.Cash,
        items: [{ phoneId: 1, sellingPrice: 230 }],
        productItems: [{ productId: 7, quantity: 3, sellingPrice: 10 }],
      },
      1,
    );

    expect(saleRepository.createSaleWithItems).toHaveBeenCalledWith(
      expect.objectContaining({
        totalAmount: 260, // 230 + 3 × 10
        items: [{ phoneId: 1, sellingPrice: 230, profit: 50 }],
        productItems: [{ productId: 7, quantity: 3, sellingPrice: 10, profit: 15 }],
      }),
    );
  });

  it('product-only sale works (no phones required)', async () => {
    productRepository.findManyByIds.mockResolvedValue([product(7)]);
    saleRepository.createSaleWithItems.mockResolvedValue({ saleId: 6 });

    await service.createSale(
      {
        paymentMethod: PaymentMethod.Cash,
        productItems: [{ productId: 7, quantity: 2, sellingPrice: 12 }],
      },
      1,
    );

    expect(saleRepository.createSaleWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 24, items: [] }),
    );
  });

  it('rejects a product line exceeding available stock with 409', async () => {
    productRepository.findManyByIds.mockResolvedValue([product(7, { quantityInStock: 1 })]);

    await expect(
      service.createSale(
        {
          paymentMethod: PaymentMethod.Cash,
          productItems: [{ productId: 7, quantity: 5, sellingPrice: 10 }],
        },
        1,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(saleRepository.createSaleWithItems).not.toHaveBeenCalled();
  });

  it('rejects an empty sale with 400', async () => {
    await expect(
      service.createSale({ paymentMethod: PaymentMethod.Cash }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
