import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async log(
    orgId: string,
    actorId: string,
    event: string,
    action: string,
    resourceId: string,
    details: Record<string, unknown>,
    requestId: string,
  ) {
    await this.auditLog.create({
      organizationId: orgId,
      actorId,
      actorType: 'USER',
      event,
      resource: 'employee',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateEmployeeDto, userId: string, requestId: string) {
    const existing = await this.prisma.employee.findFirst({
      where: { organizationId: orgId, employeeCode: dto.employeeCode },
    });
    if (existing) throw new ConflictException('Employee code already exists');
    if (dto.email) {
      const existingEmail = await this.prisma.employee.findFirst({
        where: { organizationId: orgId, email: dto.email },
      });
      if (existingEmail) throw new ConflictException('Email already exists');
    }
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, organizationId: orgId },
      });
      if (!dept) throw new NotFoundException('Department not found');
    }
    if (dto.designationId) {
      const desig = await this.prisma.designation.findFirst({
        where: { id: dto.designationId, organizationId: orgId },
      });
      if (!desig) throw new NotFoundException('Designation not found');
    }

    const employee = await this.prisma.employee.create({
      data: {
        organizationId: orgId,
        employeeCode: dto.employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email || null,
        phone: dto.phone || null,
        departmentId: dto.departmentId || null,
        designationId: dto.designationId || null,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : null,
        employmentStatus: (dto.employmentStatus as never) || 'ACTIVE',
        managerId: dto.managerId || null,
        metadata:
          dto.metadata !== undefined ? (dto.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, name: true, code: true } },
      },
    });
    await this.log(
      orgId,
      userId,
      'employee.created',
      'CREATE',
      employee.id,
      { employeeCode: employee.employeeCode, name: `${employee.firstName} ${employee.lastName}` },
      requestId,
    );
    return employee;
  }

  async findAll(orgId: string, query: EmployeeQueryDto) {
    const {
      search,
      employmentStatus,
      departmentId,
      designationId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const where: Record<string, unknown> = { organizationId: orgId };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (employmentStatus) where.employmentStatus = employmentStatus;
    if (departmentId) where.departmentId = departmentId;
    if (designationId) where.designationId = designationId;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          department: { select: { id: true, name: true, code: true } },
          designation: { select: { id: true, name: true, code: true, level: true } },
          manager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: orgId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, name: true, code: true, level: true } },
        manager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        subordinates: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            employmentStatus: true,
          },
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateEmployeeDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, id);
    const data: Record<string, unknown> = {};
    if (dto.employeeCode !== undefined) data.employeeCode = dto.employeeCode;
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.designationId !== undefined) data.designationId = dto.designationId;
    if (dto.joiningDate !== undefined) data.joiningDate = new Date(dto.joiningDate);
    if (dto.employmentStatus !== undefined) data.employmentStatus = dto.employmentStatus;
    if (dto.managerId !== undefined) data.managerId = dto.managerId;
    if (dto.metadata !== undefined) data.metadata = dto.metadata as Prisma.InputJsonValue;

    const employee = await this.prisma.employee.update({
      where: { id },
      data: data as never,
      include: {
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, name: true, code: true } },
      },
    });
    await this.log(
      orgId,
      userId,
      'employee.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return employee;
  }
}
