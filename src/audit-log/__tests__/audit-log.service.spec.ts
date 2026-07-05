import { NotFoundException } from '@nestjs/common';
import { AuditSeverity, ActorType, Prisma } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AuditLogService, CreateAuditLogParams } from '../audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockAuditLog = {
    id: 'log-1',
    organizationId: 'org-1',
    actorId: 'user-1',
    actorType: ActorType.USER,
    event: 'user.login',
    resource: 'user',
    resourceId: 'user-1',
    action: 'login',
    details: { ip: '127.0.0.1' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    severity: AuditSeverity.INFO,
    requestId: 'req-1',
    correlationId: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new AuditLogService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const params: CreateAuditLogParams = {
      organizationId: 'org-1',
      actorId: 'user-1',
      actorType: ActorType.USER,
      event: 'user.login',
      resource: 'user',
      resourceId: 'user-1',
      action: 'login',
      details: { ip: '127.0.0.1' },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      severity: AuditSeverity.INFO,
      requestId: 'req-1',
    };

    it('should create audit log entry', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue(mockAuditLog);

      const result = await service.create(params);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          actorId: 'user-1',
          actorType: ActorType.USER,
          event: 'user.login',
          resource: 'user',
          resourceId: 'user-1',
          action: 'login',
          details: { ip: '127.0.0.1' },
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          severity: AuditSeverity.INFO,
          requestId: 'req-1',
          correlationId: null,
        },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should handle null details and optional fields', async () => {
      const minimalParams: CreateAuditLogParams = {
        organizationId: 'org-1',
        actorType: ActorType.SYSTEM,
        event: 'system.task',
        resource: 'system',
        action: 'run',
        requestId: 'req-2',
      };

      (prisma.auditLog.create as jest.Mock).mockResolvedValue({
        ...mockAuditLog,
        actorId: null,
        actorType: ActorType.SYSTEM,
        event: 'system.task',
        details: null,
      });

      await service.create(minimalParams);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          actorId: null,
          actorType: ActorType.SYSTEM,
          event: 'system.task',
          resource: 'system',
          resourceId: null,
          action: 'run',
          details: Prisma.JsonNull,
          ipAddress: null,
          userAgent: null,
          severity: AuditSeverity.INFO,
          requestId: 'req-2',
          correlationId: null,
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([mockAuditLog]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply event filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('org-1', { event: 'user.login' });

      const where = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.event).toBe('user.login');
    });

    it('should apply date range filter', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('org-1', {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
      });

      const where = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.createdAt.gte).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(where.createdAt.lte).toEqual(new Date('2024-12-31T23:59:59Z'));
    });
  });

  describe('findById', () => {
    it('should return audit log entry', async () => {
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(mockAuditLog);

      const result = await service.findById('org-1', 'log-1');

      expect(result).toEqual(mockAuditLog);
    });

    it('should throw NotFoundException', async () => {
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('org-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
