import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AuditLogController } from '../audit-log.controller';
import { AuditLogService } from '../audit-log.service';
import { AuthorizationService } from '../../authorization/authorization.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: jest.Mocked<Pick<AuditLogService, 'findAll' | 'findById'>>;

  const mockUser: JwtPayload = {
    sub: 'user-1',
    org: 'org-1',
    email: 'admin@acme.com',
    roleVersion: 1,
    sessionId: 'session-1',
  };

  const mockAuthService = { authorize: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        { provide: AuditLogService, useValue: service },
        { provide: AuthorizationService, useValue: mockAuthService },
        Reflector,
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
  });

  describe('findAll', () => {
    it('should call service.findAll with org and query', async () => {
      const query = { page: 1, limit: 50 };
      const expected = {
        data: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
      };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser, query);

      expect(service.findAll).toHaveBeenCalledWith('org-1', query);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should call service.findById with org and id', async () => {
      const expected = {
        id: 'log-1',
        organizationId: 'org-1',
        actorId: 'user-1',
        actorType: 'USER' as const,
        event: 'user.login',
        resource: 'user',
        resourceId: 'user-1',
        action: 'login',
        details: {},
        ipAddress: null,
        userAgent: null,
        severity: 'INFO' as const,
        requestId: 'req-1',
        correlationId: null,
        createdAt: new Date(),
      };
      service.findById.mockResolvedValue(expected);

      const result = await controller.findOne(mockUser, 'log-1');

      expect(service.findById).toHaveBeenCalledWith('org-1', 'log-1');
      expect(result).toEqual(expected);
    });
  });
});
