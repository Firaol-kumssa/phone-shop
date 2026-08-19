import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService, SafeUser } from '../services/auth.service';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../middleware/auth.middleware';
import { Roles, RolesGuard } from '../middleware/role.middleware';
import { LoginDto } from '../models/dto/login.dto';
import { RegisterUserDto } from '../models/dto/register-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Username + password login, returns a signed JWT (Blueprint Part 11.1). */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<{ accessToken: string; user: SafeUser }> {
    return this.authService.login(dto);
  }

  /** User management is Admin-only (Blueprint 11.2). */
  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  register(
    @Body() dto: RegisterUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SafeUser> {
    return this.authService.register(dto, user.userId);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  listUsers(): Promise<SafeUser[]> {
    return this.authService.listUsers();
  }

  /** Deactivate instead of delete — preserves the accountability trail. */
  @Patch('users/:id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SafeUser> {
    return this.authService.deactivateUser(id, user.userId);
  }

  @Patch('users/:id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  reactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SafeUser> {
    return this.authService.reactivateUser(id, user.userId);
  }
}
