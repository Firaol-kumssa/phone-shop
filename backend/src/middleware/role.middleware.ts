import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from './auth.middleware';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles, e.g. @Roles(UserRole.Admin). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** RBAC enforcement (Blueprint Part 11.2) — runs after JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    if (!user || !required.includes(user.role as UserRole)) {
      throw new ForbiddenException('Insufficient role for this action');
    }

    return true;
  }
}
