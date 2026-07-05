import { ConflictException, NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { OrganizationsService } from '../organizations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockOrg = {
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
    deletedReason: null,
    deletedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new OrganizationsService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateOrganizationDto = {
      name: 'Acme Inc.',
      code: 'acme',
    };

    it('should create and return organization', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.organization.create as jest.Mock).mockResolvedValue(mockOrg);

      const result = await service.create(dto);

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { code: 'acme' },
        select: { id: true },
      });
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: 'Acme Inc.',
          code: 'acme',
          slug: 'acme',
          logoUrl: null,
          domain: null,
        },
      });
      expect(result).toEqual(mockOrg);
    });

    it('should throw ConflictException if code exists', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if slug exists', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing' });

      await expect(service.create({ ...dto, slug: 'custom-slug' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([mockOrg]);
      (prisma.organization.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should apply search filter', async () => {
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.organization.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ search: 'acme' });

      const where = (prisma.organization.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should return organization with counts', async () => {
      const orgWithRelations = {
        ...mockOrg,
        orgSettings: null,
        _count: { users: 5, roles: 3 },
      };
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(orgWithRelations);

      const result = await service.findById('org-1');

      expect(result).toEqual(orgWithRelations);
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateOrganizationDto = { name: 'Acme Corp.' };

    it('should update and return organization', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
      (prisma.organization.update as jest.Mock).mockResolvedValue({
        ...mockOrg,
        name: 'Acme Corp.',
      });

      const result = await service.update('org-1', dto, 'user-1');

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { name: 'Acme Corp.', logoUrl: undefined, domain: undefined },
      });
      expect(result.name).toBe('Acme Corp.');
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('nonexistent', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete organization', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);

      await service.softDelete('org-1', 'user-1', 'No longer needed');

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: {
          deletedAt: expect.any(Date),
          deletedByUserId: 'user-1',
          deletedReason: 'No longer needed',
        },
      });
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.softDelete('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('should restore deleted organization', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrg,
        deletedAt: new Date(),
      });

      await service.restore('org-1');

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { deletedAt: null, deletedByUserId: null, deletedReason: null },
      });
    });

    it('should throw NotFoundException if not deleted', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.restore('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
