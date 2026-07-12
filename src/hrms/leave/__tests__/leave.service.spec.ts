import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { LeaveService } from '../leave.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('LeaveService', () => {
  let service: LeaveService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new LeaveService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockLeave = {
    id: 'leave-1',
    employeeId: 'emp-1',
    organizationId: 'org-1',
    leaveType: 'ANNUAL',
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-05'),
    reason: 'Vacation',
    status: 'PENDING',
    approvedBy: null,
    rejectedBy: null,
    rejectionReason: null,
    approvedAt: null,
    rejectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('apply', () => {
    it('should apply for leave', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue({
        id: 'emp-1',
        organizationId: 'org-1',
      });
      (prisma.leaveRequest.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.leaveRequest.create as jest.Mock).mockResolvedValue(mockLeave);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.apply(
        'org-1',
        {
          employeeId: 'emp-1',
          leaveType: 'ANNUAL',
          startDate: '2026-08-01',
          endDate: '2026-08-05',
          reason: 'Vacation',
        },
        'user-1',
        'req-1',
      );
      expect(result.status).toBe('PENDING');
    });

    it('should throw for overlapping leave', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue({
        id: 'emp-1',
        organizationId: 'org-1',
      });
      (prisma.leaveRequest.findFirst as jest.Mock).mockResolvedValue(mockLeave);
      await expect(
        service.apply(
          'org-1',
          {
            employeeId: 'emp-1',
            leaveType: 'ANNUAL',
            startDate: '2026-08-01',
            endDate: '2026-08-05',
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve pending leave', async () => {
      (prisma.leaveRequest.findFirst as jest.Mock).mockResolvedValue(mockLeave);
      (prisma.leaveRequest.update as jest.Mock).mockResolvedValue({
        ...mockLeave,
        status: 'APPROVED',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.approve('org-1', 'leave-1', 'user-1', 'req-1');
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('reject', () => {
    it('should reject pending leave', async () => {
      (prisma.leaveRequest.findFirst as jest.Mock).mockResolvedValue(mockLeave);
      (prisma.leaveRequest.update as jest.Mock).mockResolvedValue({
        ...mockLeave,
        status: 'REJECTED',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.reject(
        'org-1',
        'leave-1',
        'Insufficient leave balance',
        'user-1',
        'req-1',
      );
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('Organization isolation', () => {
    it('should scope queries to organizationId', async () => {
      (prisma.leaveRequest.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'leave-1')).rejects.toThrow(NotFoundException);
    });
  });
});
