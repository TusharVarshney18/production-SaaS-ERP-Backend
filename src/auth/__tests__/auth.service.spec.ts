import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;

  const mockOrg = { id: 'org-1', name: 'Acme Inc.', code: 'acme', slug: 'acme' };
  const mockUser = {
    id: 'user-1',
    email: 'john@acme.com',
    passwordHash: 'hashed_password',
    firstName: 'John',
    lastName: 'Doe',
    avatarUrl: null,
    phone: null,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date(),
    lastLoginAt: null,
    lastLoginIp: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    organizationId: 'org-1',
    deletedAt: null,
    deletedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockSession = {
    id: 'session-1',
    userId: 'user-1',
    organizationId: 'org-1',
    deviceName: null,
    userAgent: 'jest-test',
    ipAddress: '127.0.0.1',
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 86400000),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockPermissions = [
    {
      id: 'perm-1',
      resource: 'invoice',
      action: 'create',
      createdAt: new Date(),
      groupId: 'group-1',
      description: null,
    },
    {
      id: 'perm-2',
      resource: 'invoice',
      action: 'read',
      createdAt: new Date(),
      groupId: 'group-1',
      description: null,
    },
    {
      id: 'perm-3',
      resource: 'product',
      action: 'create',
      createdAt: new Date(),
      groupId: 'group-2',
      description: null,
    },
    {
      id: 'perm-4',
      resource: 'product',
      action: 'read',
      createdAt: new Date(),
      groupId: 'group-2',
      description: null,
    },
    {
      id: 'perm-5',
      resource: 'employee',
      action: 'read',
      createdAt: new Date(),
      groupId: 'group-5',
      description: null,
    },
    {
      id: 'perm-6',
      resource: 'user',
      action: 'read',
      createdAt: new Date(),
      groupId: 'group-7',
      description: null,
    },
    {
      id: 'perm-7',
      resource: 'role',
      action: 'read',
      createdAt: new Date(),
      groupId: 'group-7',
      description: null,
    },
    {
      id: 'perm-8',
      resource: 'audit_log',
      action: 'read',
      createdAt: new Date(),
      groupId: 'group-7',
      description: null,
    },
  ];

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    configService = { get: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('mock-access-token') };

    (configService.get as jest.Mock).mockImplementation((_key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        'jwt.refreshExpiration': '7d',
      };
      return config[_key] ?? defaultValue;
    });

    prisma.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: typeof prisma) => Promise<unknown>)(prisma),
    );

    service = new AuthService(
      prisma,
      configService as unknown as ConfigService,
      jwtService as unknown as JwtService,
    );

    (argon2.hash as jest.Mock).mockResolvedValue('hashed_password');
    (argon2.verify as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'john@acme.com',
      password: 'P@ssw0rd!',
      firstName: 'John',
      lastName: 'Doe',
      organizationName: 'Acme Inc.',
      organizationCode: 'acme',
    };

    it('should create organization, roles, user, and return formatted response', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.permission.findMany as jest.Mock).mockResolvedValue(mockPermissions);
      (prisma.role.create as jest.Mock).mockResolvedValue({
        id: 'role-1',
        organizationId: 'org-1',
      });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { code: 'acme' },
        select: { id: true },
      });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'john@acme.com' },
        select: { id: true },
      });
      expect(argon2.hash).toHaveBeenCalledWith('P@ssw0rd!');
      expect(prisma.$transaction).toHaveBeenCalled();

      expect(result).toEqual({
        user: {
          id: 'user-1',
          email: 'john@acme.com',
          firstName: 'John',
          lastName: 'Doe',
          status: UserStatus.ACTIVE,
        },
        organization: {
          id: 'org-1',
          name: 'Acme Inc.',
          code: 'acme',
          slug: 'acme',
        },
      });
    });

    it('should create 4 roles with correct properties', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.permission.findMany as jest.Mock).mockResolvedValue(mockPermissions);
      (prisma.role.create as jest.Mock).mockResolvedValue({ id: 'role-1' });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await service.register(registerDto);

      expect(prisma.role.create).toHaveBeenCalledTimes(4);
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'owner', isOwner: true }),
        }),
      );
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'admin', isOwner: false }),
        }),
      );
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'manager' }) }),
      );
      expect(prisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'employee' }) }),
      );
    });

    it('should assign all permissions to admin role', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.permission.findMany as jest.Mock).mockResolvedValue(mockPermissions);
      (prisma.role.create as jest.Mock).mockResolvedValue({ id: 'role-1' });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await service.register(registerDto);

      expect(prisma.rolePermission.createMany).toHaveBeenCalledTimes(3);
      const adminCall = (prisma.rolePermission.createMany as jest.Mock).mock.calls.find(
        (call: unknown[]) => {
          const args = call[0] as { data: unknown[] };
          return Array.isArray(args.data) && args.data.length > 5;
        },
      );
      expect(adminCall).toBeDefined();
      expect(adminCall[0].data.length).toBe(mockPermissions.length);
    });

    it('should assign owner role to the created user', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.permission.findMany as jest.Mock).mockResolvedValue(mockPermissions);
      (prisma.role.create as jest.Mock).mockResolvedValue({ id: 'role-owner' });
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      await service.register(registerDto);

      expect(prisma.userRole.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          roleId: 'role-owner',
        },
      });
    });

    it('should throw ConflictException if organization code exists', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-org',
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow(
        'Organization code already exists',
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      await expect(service.register(registerDto)).rejects.toThrow('Email is already registered');
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = { email: 'john@acme.com', password: 'P@ssw0rd!' };
    const deviceInfo = { ipAddress: '127.0.0.1', userAgent: 'jest-test', deviceName: 'Test' };

    const mockUserWithOrg = {
      ...mockUser,
      organization: {
        id: 'org-1',
        name: 'Acme Inc.',
        code: 'acme',
        slug: 'acme',
        roleVersion: 1,
        status: 'ACTIVE',
      },
    };

    it('should return tokens, user, session, and organization on success', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUserWithOrg);
      (prisma.session.create as jest.Mock).mockResolvedValue(mockSession);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: 'rt-1' });

      const result = await service.login(loginDto, deviceInfo);

      expect(argon2.verify).toHaveBeenCalledWith('hashed_password', 'P@ssw0rd!');
      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            organizationId: 'org-1',
            ipAddress: '127.0.0.1',
            userAgent: 'jest-test',
          }),
        }),
      );
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(result.user.id).toBe('user-1');
      expect(result.session.id).toBe('session-1');
      expect(result.organization.id).toBe('org-1');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto, deviceInfo)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
        organization: { roleVersion: 1 },
      });

      await expect(service.login(loginDto, deviceInfo)).rejects.toThrow('Account is not active');
    });

    it('should throw UnauthorizedException when account is locked', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 3600000),
        organization: { roleVersion: 1 },
      });

      await expect(service.login(loginDto, deviceInfo)).rejects.toThrow(
        'Account is temporarily locked',
      );
    });

    it('should throw UnauthorizedException and increment failed attempts on wrong password', async () => {
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockUser,
        organization: { roleVersion: 1 },
      });

      await expect(service.login(loginDto, deviceInfo)).rejects.toThrow(
        'Invalid email or password',
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { failedLoginAttempts: { increment: 1 } },
        }),
      );
    });
  });

  describe('logout', () => {
    it('should revoke session and all active refresh tokens', async () => {
      await service.logout('user-1', 'session-1');

      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should revoke refresh token family when token string is provided', async () => {
      const rtStr = 'some-refresh-token';
      const rtHash = createHash('sha256').update(rtStr).digest('hex');
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({ family: 'family-1' });

      await service.logout('user-1', 'session-1', rtStr);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: rtHash },
        select: { family: true },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.session.updateMany).toHaveBeenCalled();
    });

    it('should still revoke session even if refresh token lookup fails', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await service.logout('user-1', 'session-1', 'invalid-token');

      expect(prisma.session.updateMany).toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    const refreshTokenStr = 'valid-refresh-token';
    const tokenHash = createHash('sha256').update(refreshTokenStr).digest('hex');

    const mockRefreshTokenRecord = {
      id: 'rt-1',
      sessionId: 'session-1',
      token: tokenHash,
      family: 'family-1',
      expiresAt: new Date(Date.now() + 7 * 86400000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      session: {
        id: 'session-1',
        revokedAt: null,
        userId: 'user-1',
        organizationId: 'org-1',
        deviceName: null,
        userAgent: null,
        ipAddress: null,
        lastActiveAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 'user-1',
          email: 'john@acme.com',
          organizationId: 'org-1',
          passwordHash: 'hash',
          firstName: 'John',
          lastName: 'Doe',
          avatarUrl: null,
          phone: null,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: null,
          lastLoginAt: null,
          lastLoginIp: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          deletedAt: null,
          deletedByUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        organization: {
          id: 'org-1',
          name: 'Acme Inc.',
          code: 'acme',
          slug: 'acme',
          logoUrl: null,
          domain: null,
          plan: 'FREE' as const,
          status: 'ACTIVE' as const,
          roleVersion: 1,
          trialEndsAt: null,
          settings: null,
          deletedAt: null,
          deletedByUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        refreshTokens: [],
      },
    };

    it('should rotate tokens and return new access + refresh tokens', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(mockRefreshTokenRecord);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({ id: 'rt-2' });

      const result = await service.refresh(refreshTokenStr);

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { token: tokenHash },
        include: expect.any(Object),
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(refreshTokenStr);
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should revoke entire family and throw when a revoked token is reused', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        ...mockRefreshTokenRecord,
        revokedAt: new Date(),
      });

      await expect(service.refresh(refreshTokenStr)).rejects.toThrow(
        'Refresh token has been revoked',
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw UnauthorizedException for expired token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        ...mockRefreshTokenRecord,
        expiresAt: new Date(Date.now() - 86400000),
      });

      await expect(service.refresh(refreshTokenStr)).rejects.toThrow('Refresh token has expired');
    });

    it('should throw UnauthorizedException if session is revoked', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        ...mockRefreshTokenRecord,
        session: { ...mockRefreshTokenRecord.session, revokedAt: new Date() },
      });

      await expect(service.refresh(refreshTokenStr)).rejects.toThrow('Session has been revoked');
    });

    it('should throw UnauthorizedException if user account is not active', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        ...mockRefreshTokenRecord,
        session: {
          ...mockRefreshTokenRecord.session,
          user: { ...mockRefreshTokenRecord.session.user, status: UserStatus.SUSPENDED },
        },
      });

      await expect(service.refresh(refreshTokenStr)).rejects.toThrow('Account is not active');
    });
  });

  describe('me', () => {
    it('should return user with organization and roles', async () => {
      const userData = {
        id: 'user-1',
        email: 'john@acme.com',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: null,
        phone: null,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        lastLoginAt: null,
        createdAt: new Date(),
        organization: {
          id: 'org-1',
          name: 'Acme Inc.',
          code: 'acme',
          slug: 'acme',
          logoUrl: null,
          plan: 'FREE' as const,
          status: 'ACTIVE' as const,
          roleVersion: 1,
        },
        userRoles: [
          {
            role: {
              id: 'role-1',
              name: 'Owner',
              slug: 'owner',
              isSystem: true,
              isOwner: true,
            },
          },
        ],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(userData);

      const result = await service.me('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.any(Object),
      });
      expect(result).toEqual(userData);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.me('non-existent')).rejects.toThrow(UnauthorizedException);
    });
  });
});
