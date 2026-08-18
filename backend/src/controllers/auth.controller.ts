import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
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
}
