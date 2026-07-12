import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ActivitiesService } from '../activities.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new ActivitiesService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockActivity = {
    id: 'act-1',
    organizationId: 'org-1',
    entityType: 'deal',
    entityId: 'deal-1',
    ownerId: 'user-1',
    assignedToId: null,
    type: 'TASK',
    title: 'Follow up with client',
    description: 'Call John about the proposal',
    status: 'PENDING',
    priority: 'HIGH',
    dueDate: new Date('2026-08-01'),
    completedAt: null,
    isArchived: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create an activity with timeline and audit log', async () => {
      (prisma.activity.create as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activityTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        { entityType: 'deal', entityId: 'deal-1', type: 'TASK', title: 'Follow up with client' },
        'user-1',
        'req-1',
      );

      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Follow up with client',
            organizationId: 'org-1',
            entityType: 'deal',
          }),
        }),
      );
      expect(result.title).toBe('Follow up with client');
    });
  });

  describe('findAll', () => {
    it('should return paginated activities', async () => {
      (prisma.activity.findMany as jest.Mock).mockResolvedValue([mockActivity]);
      (prisma.activity.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by entity type', async () => {
      (prisma.activity.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.activity.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('org-1', { entityType: 'deal' });

      expect(prisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityType: 'deal' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return activity with relations', async () => {
      const full = { ...mockActivity, owner: {}, assignedTo: null, timeline: [] };
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(full);

      const result = await service.findOne('org-1', 'act-1');
      expect(result.id).toBe('act-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'act-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update activity', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activity.update as jest.Mock).mockResolvedValue({
        ...mockActivity,
        title: 'Updated task',
      });
      (prisma.activityTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.update(
        'org-1',
        'act-1',
        { title: 'Updated task' },
        'user-1',
        'req-1',
      );
      expect(result.title).toBe('Updated task');
    });
  });

  describe('complete', () => {
    it('should mark activity as completed', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activity.update as jest.Mock).mockResolvedValue({
        ...mockActivity,
        status: 'COMPLETED',
        completedAt: new Date(),
      });
      (prisma.activityTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.complete('org-1', 'act-1', 'user-1', 'req-1');
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('cancel', () => {
    it('should cancel activity', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activity.update as jest.Mock).mockResolvedValue({
        ...mockActivity,
        status: 'CANCELLED',
      });
      (prisma.activityTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.cancel('org-1', 'act-1', 'user-1', 'req-1');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('archive', () => {
    it('should archive activity', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activity.update as jest.Mock).mockResolvedValue({
        ...mockActivity,
        isArchived: true,
      });
      (prisma.activityTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.archive('org-1', 'act-1', 'user-1', 'req-1');
      expect(result.isArchived).toBe(true);
    });
  });

  describe('restore', () => {
    it('should restore activity from archive', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue({
        ...mockActivity,
        isArchived: true,
      });
      (prisma.activity.update as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activityTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.restore('org-1', 'act-1', 'user-1', 'req-1');
      expect(result.isArchived).toBe(false);
    });
  });

  describe('delete', () => {
    it('should soft delete activity', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activity.update as jest.Mock).mockResolvedValue(mockActivity);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.delete('org-1', 'act-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('assign', () => {
    it('should assign activity to user', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activity.update as jest.Mock).mockResolvedValue({
        ...mockActivity,
        assignedToId: 'user-2',
        assignedTo: { id: 'user-2', email: '', firstName: 'Jane', lastName: 'Doe' },
      });
      (prisma.activityTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.assign(
        'org-1',
        'act-1',
        { assignedToId: 'user-2' },
        'user-1',
        'req-1',
      );
      expect(result.assignedToId).toBe('user-2');
    });
  });

  describe('changeDueDate', () => {
    it('should change due date', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activity.update as jest.Mock).mockResolvedValue({
        ...mockActivity,
        dueDate: new Date('2026-09-01'),
      });
      (prisma.activityTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.changeDueDate(
        'org-1',
        'act-1',
        { dueDate: '2026-09-01' },
        'user-1',
        'req-1',
      );
      expect(result).toBeDefined();
    });
  });

  describe('changePriority', () => {
    it('should change priority', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activity.update as jest.Mock).mockResolvedValue({
        ...mockActivity,
        priority: 'URGENT',
      });
      (prisma.activityTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.changePriority(
        'org-1',
        'act-1',
        { priority: 'URGENT' },
        'user-1',
        'req-1',
      );
      expect(result.priority).toBe('URGENT');
    });
  });

  describe('getTimeline', () => {
    it('should return paginated timeline', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(mockActivity);
      (prisma.activityTimeline.findMany as jest.Mock).mockResolvedValue([
        { id: 't-1', event: 'activity.created' },
      ]);
      (prisma.activityTimeline.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getTimeline('org-1', 'act-1');
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.activity.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'act-1')).rejects.toThrow(NotFoundException);
      expect(prisma.activity.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
