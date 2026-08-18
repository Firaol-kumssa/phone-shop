import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

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
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // TODO: updateStatus (Admin user management)
}
