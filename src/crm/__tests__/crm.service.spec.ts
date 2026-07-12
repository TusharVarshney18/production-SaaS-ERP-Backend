import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CrmService } from '../crm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

describe('CrmService', () => {
  let service: CrmService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new CrmService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockLead = {
    id: 'lead-1',
    organizationId: 'org-1',
    ownerId: 'user-1',
    assignedToId: 'user-1',
    contactName: 'John Doe',
    companyName: 'Acme Inc',
    email: 'john@acme.com',
    status: 'NEW',
    source: 'OTHER',
    priority: 'MEDIUM',
    estimatedValue: 0,
    isArchived: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: [],
  };

  describe('create', () => {
    it('should create a lead with timeline and audit log', async () => {
      (prisma.lead.create as jest.Mock).mockResolvedValue(mockLead);
      (prisma.leadTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create('org-1', { contactName: 'John Doe' }, 'user-1', 'req-1');

      expect(prisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contactName: 'John Doe', organizationId: 'org-1' }),
        }),
      );
      expect(result.contactName).toBe('John Doe');
    });
  });

  describe('findAll', () => {
    it('should return paginated leads', async () => {
      (prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead]);
      (prisma.lead.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return lead with relations', async () => {
      const fullLead = { ...mockLead, notes: [], activities: [], timeline: [], tags: [] };
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(fullLead);

      const result = await service.findOne('org-1', 'lead-1');
      expect(result.id).toBe('lead-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'lead-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update lead and record status change timeline', async () => {
      const existing = { ...mockLead, status: 'NEW' };
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(existing);
      (prisma.lead.update as jest.Mock).mockResolvedValue({ ...existing, status: 'QUALIFIED' });
      (prisma.leadTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.update(
        'org-1',
        'lead-1',
        { status: 'QUALIFIED' },
        'user-1',
        'req-1',
      );

      expect(result.status).toBe('QUALIFIED');
    });
  });

  describe('archive', () => {
    it('should archive lead', async () => {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prisma.lead.update as jest.Mock).mockResolvedValue({ ...mockLead, isArchived: true });
      (prisma.leadTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.archive('org-1', 'lead-1', 'user-1', 'req-1');
      expect(result.isArchived).toBe(true);
    });
  });

  describe('delete', () => {
    it('should soft delete lead', async () => {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prisma.lead.update as jest.Mock).mockResolvedValue(mockLead);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.delete('org-1', 'lead-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('assign', () => {
    it('should assign lead and record history', async () => {
      const leadWithAssignee = {
        ...mockLead,
        assignedTo: { id: 'user-2', email: '', firstName: 'Jane', lastName: 'Doe' },
      };
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prisma.leadAssignmentHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.lead.update as jest.Mock).mockResolvedValue(leadWithAssignee);
      (prisma.leadTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.assign(
        'org-1',
        'lead-1',
        { assignedToId: 'user-2' },
        'user-1',
        'req-1',
      );
      expect(result.assignedTo).toBeDefined();
    });
  });

  describe('createNote', () => {
    it('should create note with timeline', async () => {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prisma.leadNote.create as jest.Mock).mockResolvedValue({
        id: 'note-1',
        content: 'Test note',
        user: {},
      });
      (prisma.leadTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createNote(
        'org-1',
        'lead-1',
        { content: 'Test note' },
        'user-1',
        'req-1',
      );
      expect(result.content).toBe('Test note');
    });
  });

  describe('createActivity', () => {
    it('should create activity with timeline', async () => {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prisma.leadActivity.create as jest.Mock).mockResolvedValue({
        id: 'act-1',
        type: 'CALL',
        subject: 'Call John',
        user: {},
      });
      (prisma.leadTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createActivity(
        'org-1',
        'lead-1',
        { type: 'CALL', subject: 'Call John' },
        'user-1',
        'req-1',
      );
      expect(result.subject).toBe('Call John');
    });
  });

  describe('getTimeline', () => {
    it('should return paginated timeline', async () => {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prisma.leadTimeline.findMany as jest.Mock).mockResolvedValue([
        { id: 't-1', event: 'lead.created' },
      ]);
      (prisma.leadTimeline.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getTimeline('org-1', 'lead-1');
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getAssignmentHistory', () => {
    it('should return assignment history', async () => {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prisma.leadAssignmentHistory.findMany as jest.Mock).mockResolvedValue([
        { id: 'ah-1', fromUserId: null, toUserId: 'user-1' },
      ]);

      const result = await service.getAssignmentHistory('org-1', 'lead-1');
      expect(result).toHaveLength(1);
    });
  });

  // ─── Companies ───────────────────────────

  const mockCompany = {
    id: 'comp-1',
    organizationId: 'org-1',
    ownerId: 'user-1',
    name: 'Acme Corp',
    industry: 'Technology',
    isArchived: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('createCompany', () => {
    it('should create a company with timeline and audit log', async () => {
      (prisma.company.create as jest.Mock).mockResolvedValue(mockCompany);
      (prisma.companyTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createCompany('org-1', { name: 'Acme Corp' }, 'user-1', 'req-1');
      expect(result.name).toBe('Acme Corp');
    });
  });

  describe('findAllCompanies', () => {
    it('should return paginated companies', async () => {
      (prisma.company.findMany as jest.Mock).mockResolvedValue([mockCompany]);
      (prisma.company.count as jest.Mock).mockResolvedValue(1);
      const result = await service.findAllCompanies('org-1', {});
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOneCompany', () => {
    it('should return company with relations', async () => {
      (prisma.company.findFirst as jest.Mock).mockResolvedValue({
        ...mockCompany,
        leads: [],
        notes: [],
        activities: [],
        timeline: [],
      });
      const result = await service.findOneCompany('org-1', 'comp-1');
      expect(result.id).toBe('comp-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.company.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOneCompany('org-2', 'comp-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveCompany', () => {
    it('should archive company', async () => {
      (prisma.company.findFirst as jest.Mock).mockResolvedValue(mockCompany);
      (prisma.company.update as jest.Mock).mockResolvedValue({ ...mockCompany, isArchived: true });
      (prisma.companyTimeline.create as jest.Mock).mockResolvedValue({});
      const result = await service.archiveCompany('org-1', 'comp-1', 'user-1', 'req-1');
      expect(result.isArchived).toBe(true);
    });
  });

  describe('deleteCompany', () => {
    it('should soft delete company', async () => {
      (prisma.company.findFirst as jest.Mock).mockResolvedValue(mockCompany);
      (prisma.company.update as jest.Mock).mockResolvedValue(mockCompany);
      const result = await service.deleteCompany('org-1', 'comp-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('createCompanyNote', () => {
    it('should create note with timeline', async () => {
      (prisma.company.findFirst as jest.Mock).mockResolvedValue(mockCompany);
      (prisma.companyNote.create as jest.Mock).mockResolvedValue({
        id: 'n-1',
        content: 'Test note',
        user: {},
      });
      (prisma.companyTimeline.create as jest.Mock).mockResolvedValue({});
      const result = await service.createCompanyNote(
        'org-1',
        'comp-1',
        'Test note',
        'user-1',
        'req-1',
      );
      expect(result.content).toBe('Test note');
    });
  });

  describe('createCompanyActivity', () => {
    it('should create activity with timeline', async () => {
      (prisma.company.findFirst as jest.Mock).mockResolvedValue(mockCompany);
      (prisma.companyActivity.create as jest.Mock).mockResolvedValue({
        id: 'a-1',
        type: 'CALL',
        subject: 'Call',
        user: {},
      });
      (prisma.companyTimeline.create as jest.Mock).mockResolvedValue({});
      const result = await service.createCompanyActivity(
        'org-1',
        'comp-1',
        { type: 'CALL', subject: 'Call' },
        'user-1',
        'req-1',
      );
      expect(result.subject).toBe('Call');
    });
  });

  describe('getCompanyTimeline', () => {
    it('should return paginated timeline', async () => {
      (prisma.company.findFirst as jest.Mock).mockResolvedValue(mockCompany);
      (prisma.companyTimeline.findMany as jest.Mock).mockResolvedValue([
        { id: 't-1', event: 'company.created' },
      ]);
      (prisma.companyTimeline.count as jest.Mock).mockResolvedValue(1);
      const result = await service.getCompanyTimeline('org-1', 'comp-1');
      expect(result.data).toHaveLength(1);
    });
  });
});
