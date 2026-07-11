import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class SuperAdminGuard extends JwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    const superAdminEmails = (this.configService.get<string>('SUPER_ADMIN_EMAILS') || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (superAdminEmails.length === 0) {
      throw new UnauthorizedException('Super admin access is not configured');
    }

    if (!superAdminEmails.includes(user.email.toLowerCase())) {
      throw new UnauthorizedException('Insufficient permissions. Super admin access required.');
    }

    return true;
  }
}
