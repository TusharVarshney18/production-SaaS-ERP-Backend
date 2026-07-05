import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { OrganizationsController } from '../organizations.controller';
import { OrganizationsService } from '../organizations.service';
import { AuthorizationService } from '../../authorization/authorization.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let service: jest.Mocked<Pick<OrganizationsService, keyof OrganizationsService>>;

  const mockJwtPayload: JwtPayload = {
    sub: 'user-1',
    org: 'org-1',
    email: 'admin@acme.com',
    roleVersion: 1,
    sessionId: 'session-1',
  };

  const fullOrg = {
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthService = { authorize: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
    } as unknown as jest.Mocked<Pick<OrganizationsService, keyof OrganizationsService>>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        { provide: OrganizationsService, useValue: service },
        { provide: AuthorizationService, useValue: mockAuthService },
        Reflector,
      ],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  describe('create', () => {
    it('should call service.create with DTO', async () => {
      const dto: CreateOrganizationDto = { name: 'Acme Inc.', code: 'acme' };
      service.create.mockResolvedValue(fullOrg);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(fullOrg);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with query', async () => {
      const query = { page: 1, limit: 20 };
      const expected = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('findOne', () => {
    it('should call service.findById with id', async () => {
      const orgWithDetails = {
        ...fullOrg,
        orgSettings: null,
        _count: { users: 1, roles: 1 },
      };
      service.findById.mockResolvedValue(orgWithDetails);

      const result = await controller.findOne('org-1');

      expect(service.findById).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(orgWithDetails);
    });
  });

  describe('update', () => {
    it('should call service.update with id, dto, and user', async () => {
      const dto: UpdateOrganizationDto = { name: 'Acme Corp.' };
      service.update.mockResolvedValue(fullOrg);

      const result = await controller.update('org-1', dto, mockJwtPayload);

      expect(service.update).toHaveBeenCalledWith('org-1', dto, 'user-1');
      expect(result).toEqual(fullOrg);
    });
  });

  describe('remove', () => {
    it('should call service.softDelete with id and user', async () => {
      service.softDelete.mockResolvedValue(undefined);

      const result = await controller.remove('org-1', mockJwtPayload);

      expect(service.softDelete).toHaveBeenCalledWith('org-1', 'user-1', undefined);
      expect(result).toEqual({ message: 'Organization deleted successfully' });
    });
  });

  describe('restore', () => {
    it('should call service.restore with id', async () => {
      service.restore.mockResolvedValue(undefined);

      const result = await controller.restore('org-1');

      expect(service.restore).toHaveBeenCalledWith('org-1');
      expect(result).toEqual({ message: 'Organization restored successfully' });
    });
  });
});
