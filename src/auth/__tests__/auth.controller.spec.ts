import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshDto } from '../dto/refresh.dto';
import { LogoutDto } from '../dto/logout.dto';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'register' | 'login' | 'logout' | 'refresh' | 'me'>
  >;

  const mockJwtPayload: JwtPayload = {
    sub: 'user-1',
    org: 'org-1',
    email: 'john@acme.com',
    roleVersion: 1,
    sessionId: 'session-1',
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      refresh: jest.fn(),
      me: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('should call authService.register with the DTO', async () => {
      const dto: RegisterDto = {
        email: 'john@acme.com',
        password: 'P@ssw0rd!',
        firstName: 'John',
        lastName: 'Doe',
        organizationName: 'Acme Inc.',
        organizationCode: 'acme',
      };
      const expectedResult = {
        user: { id: 'u1', email: '', firstName: '', lastName: '', status: 'ACTIVE' as const },
        organization: { id: 'o1', name: '', code: '', slug: '' },
      };
      authService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('login', () => {
    it('should call authService.login with DTO and device info from request', async () => {
      const dto: LoginDto = { email: 'john@acme.com', password: 'P@ssw0rd!' };
      const mockReq = {
        ip: '192.168.1.1',
        socket: { remoteAddress: '10.0.0.1' },
        headers: {
          'user-agent': 'TestAgent',
          'x-device-name': 'MyDevice',
        },
      } as unknown as Request;
      const expectedResult = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: new Date(),
        user: {
          id: '',
          email: '',
          firstName: '',
          lastName: '',
          avatarUrl: null,
          status: 'ACTIVE' as const,
        },
        session: { id: '', createdAt: new Date() },
        organization: {
          id: '',
          name: '',
          code: '',
          slug: '',
          roleVersion: 0,
          status: 'ACTIVE' as const,
        },
      };
      authService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(dto, mockReq);

      expect(authService.login).toHaveBeenCalledWith(dto, {
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent',
        deviceName: 'MyDevice',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should fallback to socket.remoteAddress when req.ip is undefined', async () => {
      const dto: LoginDto = { email: 'john@acme.com', password: 'P@ssw0rd!' };
      const mockReq = {
        ip: undefined,
        socket: { remoteAddress: '10.0.0.1' },
        headers: {},
      } as unknown as Request;
      const result = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: new Date(),
        user: {
          id: '',
          email: '',
          firstName: '',
          lastName: '',
          avatarUrl: null,
          status: 'ACTIVE' as const,
        },
        session: { id: '', createdAt: new Date() },
        organization: {
          id: '',
          name: '',
          code: '',
          slug: '',
          roleVersion: 0,
          status: 'ACTIVE' as const,
        },
      };
      authService.login.mockResolvedValue(result);

      await controller.login(dto, mockReq);

      expect(authService.login).toHaveBeenCalledWith(dto, {
        ipAddress: '10.0.0.1',
        userAgent: undefined,
        deviceName: undefined,
      });
    });
  });

  describe('logout', () => {
    it('should call authService.logout with userId, sessionId, and optional refresh token', async () => {
      const dto: LogoutDto = { refreshToken: 'some-rt' };

      await controller.logout(mockJwtPayload, dto);

      expect(authService.logout).toHaveBeenCalledWith('user-1', 'session-1', 'some-rt');
    });

    it('should call authService.logout without refresh token when not provided', async () => {
      const dto: LogoutDto = {};

      const result = await controller.logout(mockJwtPayload, dto);

      expect(authService.logout).toHaveBeenCalledWith('user-1', 'session-1', undefined);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh with the refresh token string', async () => {
      const dto: RefreshDto = { refreshToken: 'my-refresh-token' };
      const expectedResult = {
        accessToken: 'new-at',
        refreshToken: 'new-rt',
        expiresAt: new Date(),
      };
      authService.refresh.mockResolvedValue(expectedResult);

      const result = await controller.refresh(dto);

      expect(authService.refresh).toHaveBeenCalledWith('my-refresh-token');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('me', () => {
    it('should call authService.me with user id from JWT payload', async () => {
      const expectedResult = {
        id: 'user-1',
        email: 'john@acme.com',
        firstName: '',
        lastName: '',
        avatarUrl: null,
        phone: null,
        status: 'ACTIVE' as const,
        emailVerifiedAt: null,
        lastLoginAt: null,
        createdAt: new Date(),
        organization: {
          id: '',
          name: '',
          code: '',
          slug: '',
          logoUrl: null,
          plan: 'FREE' as const,
          status: 'ACTIVE' as const,
          roleVersion: 0,
        },
        userRoles: [],
      };
      authService.me.mockResolvedValue(expectedResult);

      const result = await controller.me(mockJwtPayload);

      expect(authService.me).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expectedResult);
    });
  });
});
