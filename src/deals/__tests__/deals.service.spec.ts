import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { DealsService } from '../deals.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

describe('DealsService', () => {
  let service: DealsService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new DealsService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockPipeline = {
    id: 'pipe-1',
    organizationId: 'org-1',
    name: 'Sales Pipeline',
    isDefault: true,
    displayOrder: 0,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStage = {
    id: 'stage-1',
    pipelineId: 'pipe-1',
    name: 'Qualification',
    probability: 20,
    displayOrder: 0,
    color: '#6366f1',
    isWon: false,
    isLost: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDeal = {
    id: 'deal-1',
    organizationId: 'org-1',
    pipelineId: 'pipe-1',
    stageId: 'stage-1',
    companyId: null,
    primaryContactId: null,
    leadId: null,
    ownerId: 'user-1',
    title: 'Big Deal',
    description: null,
    value: 50000,
    currency: 'USD',
    probability: 20,
    expectedCloseDate: null,
    actualCloseDate: null,
    status: 'OPEN',
    lossReason: null,
    wonReason: null,
    isArchived: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ─── Pipelines ────────────────────────────

  describe('createPipeline', () => {
    it('should create a pipeline', async () => {
      (prisma.pipeline.create as jest.Mock).mockResolvedValue(mockPipeline);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createPipeline(
        'org-1',
        { name: 'Sales Pipeline' },
        'user-1',
        'req-1',
      );
      expect(result.name).toBe('Sales Pipeline');
    });
  });

  describe('listPipelines', () => {
    it('should list pipelines with stages', async () => {
      (prisma.pipeline.findMany as jest.Mock).mockResolvedValue([mockPipeline]);
      const result = await service.listPipelines('org-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOnePipeline', () => {
    it('should return pipeline', async () => {
      (prisma.pipeline.findFirst as jest.Mock).mockResolvedValue(mockPipeline);
      const result = await service.findOnePipeline('org-1', 'pipe-1');
      expect(result.id).toBe('pipe-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.pipeline.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOnePipeline('org-2', 'pipe-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('archivePipeline', () => {
    it('should archive pipeline', async () => {
      (prisma.pipeline.findFirst as jest.Mock).mockResolvedValue(mockPipeline);
      (prisma.pipeline.update as jest.Mock).mockResolvedValue({
        ...mockPipeline,
        isArchived: true,
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.archivePipeline('org-1', 'pipe-1', 'user-1', 'req-1');
      expect(result.isArchived).toBe(true);
    });
  });

  describe('deletePipeline', () => {
    it('should delete pipeline', async () => {
      (prisma.pipeline.findFirst as jest.Mock).mockResolvedValue(mockPipeline);
      (prisma.pipeline.delete as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.deletePipeline('org-1', 'pipe-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  // ─── Stages ───────────────────────────────

  describe('createStage', () => {
    it('should create a stage', async () => {
      (prisma.pipeline.findFirst as jest.Mock).mockResolvedValue(mockPipeline);
      (prisma.pipelineStage.aggregate as jest.Mock).mockResolvedValue({
        _max: { displayOrder: 2 },
      });
      (prisma.pipelineStage.create as jest.Mock).mockResolvedValue(mockStage);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createStage(
        'org-1',
        'pipe-1',
        { name: 'Qualification' },
        'user-1',
        'req-1',
      );
      expect(result.name).toBe('Qualification');
    });
  });

  // ─── Deals ────────────────────────────────

  describe('create', () => {
    it('should create a deal with timeline and audit log', async () => {
      (prisma.pipelineStage.findFirst as jest.Mock).mockResolvedValue(mockStage);
      (prisma.deal.create as jest.Mock).mockResolvedValue(mockDeal);
      (prisma.dealTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        { title: 'Big Deal', pipelineId: 'pipe-1', stageId: 'stage-1' },
        'user-1',
        'req-1',
      );

      expect(prisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Big Deal', organizationId: 'org-1' }),
        }),
      );
      expect(result.title).toBe('Big Deal');
    });
  });

  describe('findAll', () => {
    it('should return paginated deals', async () => {
      (prisma.deal.findMany as jest.Mock).mockResolvedValue([mockDeal]);
      (prisma.deal.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return deal with relations', async () => {
      const fullDeal = {
        ...mockDeal,
        pipeline: {},
        stage: {},
        company: null,
        primaryContact: null,
        lead: null,
        owner: {},
        timeline: [],
      };
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(fullDeal);

      const result = await service.findOne('org-1', 'deal-1');
      expect(result.id).toBe('deal-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'deal-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update deal and record value change timeline', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(mockDeal);
      (prisma.deal.update as jest.Mock).mockResolvedValue({ ...mockDeal, value: 75000 });
      (prisma.dealTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.update('org-1', 'deal-1', { value: 75000 }, 'user-1', 'req-1');
      expect(result.value).toBe(75000);
    });
  });

  describe('moveStage', () => {
    it('should move deal to another stage', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue({ ...mockDeal, stage: mockStage });
      (prisma.pipelineStage.findFirst as jest.Mock).mockResolvedValue({
        ...mockStage,
        id: 'stage-2',
        name: 'Proposal',
      });
      (prisma.deal.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        stageId: 'stage-2',
        stage: { id: 'stage-2', name: 'Proposal', color: '#000' },
      });
      (prisma.dealTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.moveStage(
        'org-1',
        'deal-1',
        { stageId: 'stage-2' },
        'user-1',
        'req-1',
      );
      expect(result.stageId).toBe('stage-2');
    });
  });

  describe('changeOwner', () => {
    it('should change deal owner', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(mockDeal);
      (prisma.deal.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        ownerId: 'user-2',
        owner: { id: 'user-2', email: '', firstName: 'Jane', lastName: 'Doe' },
      });
      (prisma.dealTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.changeOwner(
        'org-1',
        'deal-1',
        { ownerId: 'user-2' },
        'user-1',
        'req-1',
      );
      expect(result.ownerId).toBe('user-2');
    });
  });

  describe('markWon', () => {
    it('should mark deal as won', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(mockDeal);
      (prisma.deal.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        status: 'WON',
        wonReason: 'Good deal',
      });
      (prisma.dealTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.markWon(
        'org-1',
        'deal-1',
        { wonReason: 'Good deal' },
        'user-1',
        'req-1',
      );
      expect(result.status).toBe('WON');
    });
  });

  describe('markLost', () => {
    it('should mark deal as lost', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(mockDeal);
      (prisma.deal.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        status: 'LOST',
        lossReason: 'Budget',
      });
      (prisma.dealTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.markLost(
        'org-1',
        'deal-1',
        { lossReason: 'Budget' },
        'user-1',
        'req-1',
      );
      expect(result.status).toBe('LOST');
    });
  });

  describe('archive', () => {
    it('should archive deal', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(mockDeal);
      (prisma.deal.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        isArchived: true,
        status: 'ARCHIVED',
      });
      (prisma.dealTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.archive('org-1', 'deal-1', 'user-1', 'req-1');
      expect(result.isArchived).toBe(true);
    });
  });

  describe('restore', () => {
    it('should restore deal from archive', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue({ ...mockDeal, isArchived: true });
      (prisma.deal.update as jest.Mock).mockResolvedValue(mockDeal);
      (prisma.dealTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.restore('org-1', 'deal-1', 'user-1', 'req-1');
      expect(result.isArchived).toBe(false);
    });
  });

  describe('delete', () => {
    it('should soft delete deal', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(mockDeal);
      (prisma.deal.update as jest.Mock).mockResolvedValue(mockDeal);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.delete('org-1', 'deal-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      (prisma.deal.count as jest.Mock).mockResolvedValue(5);
      (prisma.deal.aggregate as jest.Mock).mockResolvedValue({
        _sum: { value: 100000 },
        _count: { id: 10 },
        _avg: { value: 20000 },
      });

      const result = await service.getDashboardStats('org-1');
      expect(result).toHaveProperty('openDeals');
      expect(result).toHaveProperty('winRate');
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'deal-1')).rejects.toThrow(NotFoundException);
      expect(prisma.deal.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
