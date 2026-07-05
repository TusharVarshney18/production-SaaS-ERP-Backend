import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { OrganizationSettingsService } from '../organization-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateOrganizationSettingsDto } from '../dto/update-organization-settings.dto';

describe('OrganizationSettingsService', () => {
  let service: OrganizationSettingsService;
  let prisma: DeepMockProxy<PrismaService>;

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

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new OrganizationSettingsService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByOrganizationId', () => {
    it('should return settings', async () => {
      (prisma.organizationSettings.findUnique as jest.Mock).mockResolvedValue(mockSettings);

      const result = await service.findByOrganizationId('org-1');

      expect(result).toEqual(mockSettings);
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.organizationSettings.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findByOrganizationId('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsert', () => {
    const dto: UpdateOrganizationSettingsDto = {
      timezone: 'America/New_York',
      currency: 'USD',
    };

    it('should create settings if not exist', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({ id: 'org-1' });
      (prisma.organizationSettings.upsert as jest.Mock).mockResolvedValue({
        ...mockSettings,
        timezone: 'America/New_York',
      });

      const result = await service.upsert('org-1', dto);

      expect(prisma.organizationSettings.upsert).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        create: {
          organizationId: 'org-1',
          timezone: 'America/New_York',
          currency: 'USD',
          dateFormat: 'YYYY-MM-DD',
          fiscalYearStart: '01-01',
        },
        update: {
          timezone: 'America/New_York',
          currency: 'USD',
          dateFormat: undefined,
          fiscalYearStart: undefined,
        },
      });
      expect(result.timezone).toBe('America/New_York');
    });

    it('should throw NotFoundException if org not found', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.upsert('nonexistent', dto)).rejects.toThrow(NotFoundException);
    });
  });
});
