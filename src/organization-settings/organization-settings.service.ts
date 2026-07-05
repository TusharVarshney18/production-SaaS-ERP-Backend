import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';

@Injectable()
export class OrganizationSettingsService {
  private readonly logger = new Logger(OrganizationSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByOrganizationId(organizationId: string) {
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { organizationId },
    });

    if (!settings) {
      throw new NotFoundException('Organization settings not found');
    }

    return settings;
  }

  async upsert(organizationId: string, dto: UpdateOrganizationSettingsDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const settings = await this.prisma.organizationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        timezone: dto.timezone || 'UTC',
        currency: dto.currency || 'USD',
        dateFormat: dto.dateFormat || 'YYYY-MM-DD',
        fiscalYearStart: dto.fiscalYearStart || '01-01',
      },
      update: {
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.dateFormat !== undefined && { dateFormat: dto.dateFormat }),
        ...(dto.fiscalYearStart !== undefined && { fiscalYearStart: dto.fiscalYearStart }),
      },
    });

    this.logger.log(`Organization settings updated: ${organizationId}`);
    return settings;
  }
}
