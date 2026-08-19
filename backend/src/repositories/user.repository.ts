import { Injectable } from '@nestjs/common';
import { User, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: { fullName: 'asc' } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(userId: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { userId } });
  }

  create(data: {
    fullName: string;
    username: string;
    email?: string;
    phoneNumber?: string;
    digitalId?: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  updateStatus(userId: number, status: UserStatus): Promise<User> {
    return this.prisma.user.update({ where: { userId }, data: { status } });
  }
}
