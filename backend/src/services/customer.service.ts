import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { CustomerRepository } from '../repositories/customer.repository';
import { CreateCustomerDto } from '../models/dto/create-customer.dto';
import { UpdateCustomerDto } from '../models/dto/update-customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly customerRepository: CustomerRepository) {}

  listCustomers(): Promise<Customer[]> {
    return this.customerRepository.findAll();
  }

  /** Returns the customer with derived purchase history: sales + items (Blueprint 3.3). */
  async getCustomer(customerId: number): Promise<Customer> {
    const customer = await this.customerRepository.findWithPurchaseHistory(customerId);
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }
    return customer;
  }

  async createCustomer(dto: CreateCustomerDto): Promise<Customer> {
    try {
      return await this.customerRepository.create({
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        address: dto.address,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          `A customer with phone number ${dto.phoneNumber} already exists`,
        );
      }
      throw error;
    }
  }

  async updateCustomer(customerId: number, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }
    try {
      return await this.customerRepository.update(customerId, {
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        address: dto.address,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          `A customer with phone number ${dto.phoneNumber} already exists`,
        );
      }
      throw error;
    }
  }
}
