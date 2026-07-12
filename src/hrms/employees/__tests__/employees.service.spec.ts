import { NotFoundException, ConflictException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EmployeesService } from '../employees.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new EmployeesService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockEmployee = {
    id: 'emp-1',
    organizationId: 'org-1',
    employeeCode: 'EMP-001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@acme.com',
    phone: null,
    departmentId: null,
    designationId: null,
    joiningDate: null,
    employmentStatus: 'ACTIVE',
    managerId: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create an employee', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.employee.create as jest.Mock).mockResolvedValue(mockEmployee);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.create(
        'org-1',
        { employeeCode: 'EMP-001', firstName: 'John', lastName: 'Doe', email: 'john@acme.com' },
        'user-1',
        'req-1',
      );
      expect(result.employeeCode).toBe('EMP-001');
    });

    it('should throw ConflictException for duplicate code', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue(mockEmployee);
      await expect(
        service.create(
          'org-1',
          { employeeCode: 'EMP-001', firstName: 'John', lastName: 'Doe' },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated employees', async () => {
      (prisma.employee.findMany as jest.Mock).mockResolvedValue([mockEmployee]);
      (prisma.employee.count as jest.Mock).mockResolvedValue(1);
      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return employee with relations', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue({
        ...mockEmployee,
        department: null,
        designation: null,
        manager: null,
        subordinates: [],
      });
      const result = await service.findOne('org-1', 'emp-1');
      expect(result.id).toBe('emp-1');
    });
  });

  describe('Organization isolation', () => {
    it('should scope queries to organizationId', async () => {
      (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'emp-1')).rejects.toThrow(NotFoundException);
    });
  });
});
