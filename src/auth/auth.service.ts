import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { randomBytes, createHash } from 'crypto';
import * as argon2 from 'argon2';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface DeviceInfo {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, password, firstName, lastName, organizationName, organizationCode } = dto;

    const existingOrg = await this.prisma.organization.findUnique({
      where: { code: organizationCode },
      select: { id: true },
    });
    if (existingOrg) {
      throw new ConflictException('Organization code already exists');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argon2.hash(password);

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          code: organizationCode,
          slug: organizationCode,
        },
      });

      const allPermissions = await tx.permission.findMany({
        select: { id: true, resource: true, action: true },
      });

      const ownerRole = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'Owner',
          slug: 'owner',
          description: 'Full system access. Exactly one per organization. Immutable.',
          isSystem: true,
          isOwner: true,
        },
      });

      const adminRole = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'Admin',
          slug: 'admin',
          description: 'Administrative access with full control over settings and users.',
          isSystem: true,
          isOwner: false,
        },
      });

      const managerRole = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'Manager',
          slug: 'manager',
          description: 'Departmental management access.',
          isSystem: true,
          isOwner: false,
        },
      });

      const employeeRole = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: 'Employee',
          slug: 'employee',
          description: 'Basic self-service access.',
          isSystem: true,
          isOwner: false,
        },
      });

      const adminPermissionIds = allPermissions.map((p) => p.id);

      await tx.rolePermission.createMany({
        data: adminPermissionIds.map((permissionId) => ({
          roleId: adminRole.id,
          permissionId,
        })),
      });

      const managerFilters = [
        { resource: 'invoice', action: '*' },
        { resource: 'product', action: '*' },
        { resource: 'lead', action: '*' },
        { resource: 'employee', action: 'read' },
        { resource: 'user', action: 'read' },
        { resource: 'role', action: 'read' },
        { resource: 'permission', action: 'read' },
        { resource: 'audit_log', action: 'read' },
      ];

      const managerPermissionIds = this.resolvePermissionIds(allPermissions, managerFilters);
      if (managerPermissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: managerPermissionIds.map((permissionId) => ({
            roleId: managerRole.id,
            permissionId,
          })),
        });
      }

      const employeeFilters = [
        { resource: 'invoice', action: 'read' },
        { resource: 'product', action: 'read' },
        { resource: 'lead', action: 'read' },
        { resource: 'employee', action: 'read' },
      ];

      const employeePermissionIds = this.resolvePermissionIds(allPermissions, employeeFilters);
      if (employeePermissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: employeePermissionIds.map((permissionId) => ({
            roleId: employeeRole.id,
            permissionId,
          })),
        });
      }

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash,
          firstName,
          lastName,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
        },
      });

      return { organization, user };
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        status: result.user.status,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        code: result.organization.code,
        slug: result.organization.slug,
      },
    };
  }

  async login(dto: LoginDto, deviceInfo: DeviceInfo) {
    const { email, password } = dto;

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: {
        organization: {
          select: { id: true, name: true, code: true, slug: true, roleVersion: true, status: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked');
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        lastLoginIp: deviceInfo.ipAddress || null,
      },
    });

    const refreshExpirationStr = this.configService.get<string>('jwt.refreshExpiration', '7d');
    const refreshExpiresInMs = this.parseDuration(refreshExpirationStr) * 1000;
    const refreshExpiresAt = new Date(Date.now() + refreshExpiresInMs);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        deviceName: deviceInfo.deviceName || null,
        userAgent: deviceInfo.userAgent || null,
        ipAddress: deviceInfo.ipAddress || null,
        expiresAt: refreshExpiresAt,
      },
    });

    const tokens = await this.generateTokenPair(
      user.id,
      user.organizationId,
      user.email,
      user.organization.roleVersion,
      session.id,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
      session: {
        id: session.id,
        createdAt: session.createdAt,
      },
      organization: user.organization,
    };
  }

  async logout(userId: string, sessionId: string, refreshTokenStr?: string) {
    const now = new Date();

    if (refreshTokenStr) {
      const tokenHash = createHash('sha256').update(refreshTokenStr).digest('hex');
      const token = await this.prisma.refreshToken.findUnique({
        where: { token: tokenHash },
        select: { family: true },
      });
      if (token) {
        await this.revokeTokenFamily(token.family);
      }
    }

    await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: now },
    });

    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async refresh(refreshTokenStr: string) {
    const tokenHash = createHash('sha256').update(refreshTokenStr).digest('hex');

    const token = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      include: {
        session: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                organizationId: true,
                status: true,
              },
            },
            organization: {
              select: { roleVersion: true },
            },
          },
        },
      },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (token.revokedAt) {
      await this.revokeTokenFamily(token.family);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (token.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    if (token.session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (token.session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const refreshExpirationStr = this.configService.get<string>('jwt.refreshExpiration', '7d');
    const refreshExpiresInMs = this.parseDuration(refreshExpirationStr) * 1000;
    const refreshExpiresAt = new Date(Date.now() + refreshExpiresInMs);

    const rawToken = randomBytes(48).toString('hex');
    const newTokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.$transaction(async (tx) => {
      const newTokenRecord = await tx.refreshToken.create({
        data: {
          sessionId: token.sessionId,
          token: newTokenHash,
          family: token.family,
          expiresAt: refreshExpiresAt,
        },
      });

      await tx.refreshToken.update({
        where: { id: token.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: newTokenRecord.id,
        },
      });
    });

    const accessToken = this.jwtService.sign({
      sub: token.session.user.id,
      org: token.session.user.organizationId,
      email: token.session.user.email,
      roleVersion: token.session.organization.roleVersion,
      sessionId: token.sessionId,
    } as JwtPayload);

    return {
      accessToken,
      refreshToken: rawToken,
      expiresAt: refreshExpiresAt,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        phone: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
            slug: true,
            logoUrl: true,
            plan: true,
            status: true,
            roleVersion: true,
          },
        },
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
                isSystem: true,
                isOwner: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async generateTokenPair(
    userId: string,
    organizationId: string,
    email: string,
    roleVersion: number,
    sessionId: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({
      sub: userId,
      org: organizationId,
      email,
      roleVersion,
      sessionId,
    } as JwtPayload);

    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const family = randomBytes(16).toString('hex');
    const refreshExpirationStr = this.configService.get<string>('jwt.refreshExpiration', '7d');
    const refreshExpiresInMs = this.parseDuration(refreshExpirationStr) * 1000;
    const expiresAt = new Date(Date.now() + refreshExpiresInMs);

    await this.prisma.refreshToken.create({
      data: {
        sessionId,
        token: tokenHash,
        family,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: rawToken, expiresAt };
  }

  private async revokeTokenFamily(family: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private resolvePermissionIds(
    permissions: { id: string; resource: string; action: string }[],
    filters: { resource: string; action: string }[],
  ): string[] {
    const result: string[] = [];
    for (const filter of filters) {
      const matching = permissions.filter((p) => {
        if (filter.action === '*') {
          return p.resource === filter.resource;
        }
        return p.resource === filter.resource && p.action === filter.action;
      });
      result.push(...matching.map((p) => p.id));
    }
    return [...new Set(result)];
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    const multiplier = multipliers[unit];
    if (!multiplier) {
      throw new Error(`Unknown duration unit: ${unit}`);
    }
    return value * multiplier;
  }
}
