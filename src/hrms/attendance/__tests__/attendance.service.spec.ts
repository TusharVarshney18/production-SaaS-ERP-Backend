import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AttendanceService } from '../attendance.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new AttendanceService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const mockRecord = {
    id: 'att-1',
    employeeId: 'emp-1',
    organizationId: 'org-1',
    date: today,
    checkIn: new Date(),
    checkOut: null,
    status: 'PRESENT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('checkIn', () => {
    it('should check in employee', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue({
        id: 'emp-1',
        organizationId: 'org-1',
      });
      (prisma.attendance.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.attendance.create as jest.Mock).mockResolvedValue(mockRecord);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.checkIn('org-1', { employeeId: 'emp-1' }, 'user-1', 'req-1');
      expect(result.status).toBe('PRESENT');
    });

    it('should throw if already checked in', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue({
        id: 'emp-1',
        organizationId: 'org-1',
      });
      (prisma.attendance.findFirst as jest.Mock).mockResolvedValue(mockRecord);
      await expect(
        service.checkIn('org-1', { employeeId: 'emp-1' }, 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for invalid employee', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.checkIn('org-1', { employeeId: 'emp-1' }, 'user-1', 'req-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkOut', () => {
    it('should check out employee', async () => {
      (prisma.attendance.findFirst as jest.Mock).mockResolvedValue(mockRecord);
      (prisma.attendance.update as jest.Mock).mockResolvedValue({
        ...mockRecord,
        checkOut: new Date(),
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.checkOut('org-1', { employeeId: 'emp-1' }, 'user-1', 'req-1');
      expect(result.checkOut).toBeDefined();
    });

    it('should throw if no check-in record', async () => {
      (prisma.attendance.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.checkOut('org-1', { employeeId: 'emp-1' }, 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Organization isolation', () => {
    it('should scope queries to organizationId', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.checkIn('org-2', { employeeId: 'emp-1' }, 'user-1', 'req-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
