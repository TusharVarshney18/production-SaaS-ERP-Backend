import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { OrganizationSettingsController } from '../organization-settings.controller';
import { OrganizationSettingsService } from '../organization-settings.service';
import { AuthorizationService } from '../../authorization/authorization.service';
import { UpdateOrganizationSettingsDto } from '../dto/update-organization-settings.dto';

describe('OrganizationSettingsController', () => {
  let controller: OrganizationSettingsController;
  let service: jest.Mocked<Pick<OrganizationSettingsService, 'findByOrganizationId' | 'upsert'>>;

  const mockSettings = {
    id: 'settings-1',
    organizationId: 'org-1',
    timezone: 'UTC',
    currency: 'USD',
    dateFormat: 'YYYY-MM-DD',
    fiscalYearStart: '01-01',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuthService = { authorize: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    service = {
      findByOrganizationId: jest.fn(),
      upsert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationSettingsController],
      providers: [
        { provide: OrganizationSettingsService, useValue: service },
        { provide: AuthorizationService, useValue: mockAuthService },
        Reflector,
      ],
    }).compile();

    controller = module.get<OrganizationSettingsController>(OrganizationSettingsController);
  });

  describe('findOne', () => {
    it('should call service.findByOrganizationId', async () => {
      service.findByOrganizationId.mockResolvedValue(mockSettings);

      const result = await controller.findOne('org-1');

      expect(service.findByOrganizationId).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockSettings);
    });
  });

  describe('update', () => {
    it('should call service.upsert with orgId and dto', async () => {
      const dto: UpdateOrganizationSettingsDto = { timezone: 'America/New_York' };
      const updated = { ...mockSettings, timezone: 'America/New_York' };
      service.upsert.mockResolvedValue(updated);

      const result = await controller.update('org-1', dto);

      expect(service.upsert).toHaveBeenCalledWith('org-1', dto);
      expect(result).toEqual(updated);
    });
  });
});
