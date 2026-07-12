import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { DesignationsService } from '../designations.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('DesignationsService', () => {
  let service: DesignationsService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new DesignationsService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockDesig = {
    id: 'des-1',
    organizationId: 'org-1',
    name: 'Senior Engineer',
    code: 'SR-ENG',
    level: 3,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create a designation', async () => {
      (prisma.designation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.designation.create as jest.Mock).mockResolvedValue(mockDesig);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.create(
        'org-1',
        { name: 'Senior Engineer', code: 'SR-ENG', level: 3 },
        'user-1',
        'req-1',
      );
      expect(result.level).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return designation', async () => {
      (prisma.designation.findFirst as jest.Mock).mockResolvedValue(mockDesig);
      const result = await service.findOne('org-1', 'des-1');
      expect(result.code).toBe('SR-ENG');
    });
  });

  describe('Organization isolation', () => {
    it('should scope queries to organizationId', async () => {
      (prisma.designation.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'des-1')).rejects.toThrow(NotFoundException);
    });
  });
});
