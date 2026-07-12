import { NotFoundException, ConflictException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { DepartmentsService } from '../departments.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new DepartmentsService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockDept = {
    id: 'dept-1',
    organizationId: 'org-1',
    name: 'Engineering',
    code: 'ENG',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create a department', async () => {
      (prisma.department.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.department.create as jest.Mock).mockResolvedValue(mockDept);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.create(
        'org-1',
        { name: 'Engineering', code: 'ENG' },
        'user-1',
        'req-1',
      );
      expect(result.code).toBe('ENG');
    });
    it('should throw ConflictException for duplicate code', async () => {
      (prisma.department.findFirst as jest.Mock).mockResolvedValue(mockDept);
      await expect(
        service.create('org-1', { name: 'Engineering', code: 'ENG' }, 'user-1', 'req-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return department', async () => {
      (prisma.department.findFirst as jest.Mock).mockResolvedValue(mockDept);
      const result = await service.findOne('org-1', 'dept-1');
      expect(result.name).toBe('Engineering');
    });
  });

  describe('Organization isolation', () => {
    it('should scope queries to organizationId', async () => {
      (prisma.department.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'dept-1')).rejects.toThrow(NotFoundException);
    });
  });
});
