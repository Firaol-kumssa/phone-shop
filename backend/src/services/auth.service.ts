import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { RegisterUserDto } from '../models/dto/register-user.dto';
import { LoginDto } from '../models/dto/login.dto';
import { AuthenticatedUser } from '../middleware/auth.middleware';

const BCRYPT_ROUNDS = 12;

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly auditLogs: AuditLogRepository,
  ) {}

  /** Creates a system operator; passwords are bcrypt-hashed, never stored (Blueprint 11.3). */
  async register(dto: RegisterUserDto, createdBy: number): Promise<SafeUser> {
    const existing = await this.userRepository.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException(`Username "${dto.username}" is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let user: User;
    try {
      user = await this.userRepository.create({
        fullName: dto.fullName,
        username: dto.username,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        digitalId: dto.digitalId,
        passwordHash,
        role: dto.role,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Username or email is already taken');
      }
      throw error;
    }

    await this.auditLogs.record({
      userId: createdBy,
      action: 'USER_CREATED',
      tableAffected: 'users',
      recordId: String(user.userId),
      details: { username: user.username, role: user.role },
    });

    return this.sanitize(user);
  }

  /** Verifies username + password and issues a signed JWT (Blueprint 11.1). */
  async login(dto: LoginDto): Promise<{ accessToken: string; user: SafeUser }> {
    const user = await this.userRepository.findByUsername(dto.username);

    // Same error for unknown user and wrong password — no username probing
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException('This account is inactive');
    }

    const payload: AuthenticatedUser = {
      userId: user.userId,
      username: user.username,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken, user: this.sanitize(user) };
  }

  /** Deactivation instead of deletion — accounts are never hard-deleted (Blueprint 5.1). */
  async deactivateUser(userId: number, actorId: number): Promise<SafeUser> {
    if (userId === actorId) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    if (user.status === UserStatus.Inactive) {
      throw new ConflictException(`${user.username} is already inactive`);
    }

    const updated = await this.userRepository.updateStatus(userId, UserStatus.Inactive);

    await this.auditLogs.record({
      userId: actorId,
      action: 'USER_DEACTIVATED',
      tableAffected: 'users',
      recordId: String(userId),
      details: { username: user.username, role: user.role },
    });

    return this.sanitize(updated);
  }

  async reactivateUser(userId: number, actorId: number): Promise<SafeUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    if (user.status === UserStatus.Active) {
      throw new ConflictException(`${user.username} is already active`);
    }

    const updated = await this.userRepository.updateStatus(userId, UserStatus.Active);

    await this.auditLogs.record({
      userId: actorId,
      action: 'USER_REACTIVATED',
      tableAffected: 'users',
      recordId: String(userId),
      details: { username: user.username, role: user.role },
    });

    return this.sanitize(updated);
  }

  async listUsers(): Promise<SafeUser[]> {
    const users = await this.userRepository.findAll();
    return users.map((user) => this.sanitize(user));
  }

  private sanitize(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
}
