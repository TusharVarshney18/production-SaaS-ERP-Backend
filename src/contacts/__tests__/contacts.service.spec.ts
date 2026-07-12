import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ContactsService } from '../contacts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new ContactsService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockContact = {
    id: 'contact-1',
    organizationId: 'org-1',
    companyId: null,
    ownerId: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    designation: 'Engineer',
    department: 'Engineering',
    email: 'john@example.com',
    phone: '+1234567890',
    mobile: '+0987654321',
    whatsapp: null,
    linkedin: null,
    website: null,
    birthday: null,
    preferredLanguage: null,
    timezone: 'UTC',
    status: 'ACTIVE',
    isPrimary: false,
    isDecisionMaker: false,
    notes: null,
    avatar: null,
    isArchived: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create a contact with fullName, timeline and audit log', async () => {
      (prisma.contact.create as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contactTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        { firstName: 'John', lastName: 'Doe' },
        'user-1',
        'req-1',
      );

      expect(prisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: 'John',
            lastName: 'Doe',
            fullName: 'John Doe',
            organizationId: 'org-1',
            ownerId: 'user-1',
          }),
        }),
      );
      expect(result.fullName).toBe('John Doe');
    });
  });

  describe('findAll', () => {
    it('should return paginated contacts', async () => {
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([mockContact]);
      (prisma.contact.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by search across multiple fields', async () => {
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contact.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('org-1', { search: 'John' });

      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([expect.objectContaining({ fullName: expect.anything() })]),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return contact with relations', async () => {
      const fullContact = { ...mockContact, company: null, owner: {}, timeline: [] };
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(fullContact);

      const result = await service.findOne('org-1', 'contact-1');
      expect(result.id).toBe('contact-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'contact-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update contact and record timeline', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contact.update as jest.Mock).mockResolvedValue({
        ...mockContact,
        designation: 'Senior Engineer',
      });
      (prisma.contactTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.update(
        'org-1',
        'contact-1',
        { designation: 'Senior Engineer' },
        'user-1',
        'req-1',
      );

      expect(result.designation).toBe('Senior Engineer');
    });
  });

  describe('archive', () => {
    it('should archive contact', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contact.update as jest.Mock).mockResolvedValue({ ...mockContact, isArchived: true });
      (prisma.contactTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.archive('org-1', 'contact-1', 'user-1', 'req-1');
      expect(result.isArchived).toBe(true);
    });
  });

  describe('restore', () => {
    it('should restore contact from archive', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue({
        ...mockContact,
        isArchived: true,
      });
      (prisma.contact.update as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contactTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.restore('org-1', 'contact-1', 'user-1', 'req-1');
      expect(result.isArchived).toBe(false);
    });
  });

  describe('delete', () => {
    it('should soft delete contact', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contact.update as jest.Mock).mockResolvedValue(mockContact);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.delete('org-1', 'contact-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('setPrimary', () => {
    it('should unset other primary contacts and set this one', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contact.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.contact.update as jest.Mock).mockResolvedValue({ ...mockContact, isPrimary: true });
      (prisma.contactTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.setPrimary('org-1', 'contact-1', 'user-1', 'req-1');
      expect(result.isPrimary).toBe(true);
      expect(prisma.contact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            isPrimary: true,
            id: { not: 'contact-1' },
          }),
        }),
      );
    });
  });

  describe('setDecisionMaker', () => {
    it('should set contact as decision maker', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contact.update as jest.Mock).mockResolvedValue({
        ...mockContact,
        isDecisionMaker: true,
      });
      (prisma.contactTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.setDecisionMaker('org-1', 'contact-1', 'user-1', 'req-1');
      expect(result.isDecisionMaker).toBe(true);
    });
  });

  describe('moveCompany', () => {
    it('should move contact to another company', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contact.update as jest.Mock).mockResolvedValue({
        ...mockContact,
        companyId: 'comp-2',
        company: { id: 'comp-2', name: 'New Corp' },
      });
      (prisma.contactTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.moveCompany(
        'org-1',
        'contact-1',
        { companyId: 'comp-2' },
        'user-1',
        'req-1',
      );
      expect(result.companyId).toBe('comp-2');
    });
  });

  describe('getTimeline', () => {
    it('should return paginated timeline', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prisma.contactTimeline.findMany as jest.Mock).mockResolvedValue([
        { id: 't-1', event: 'contact.created' },
      ]);
      (prisma.contactTimeline.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getTimeline('org-1', 'contact-1');
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('Organization isolation', () => {
    it('should scope all queries to organizationId', async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'contact-1')).rejects.toThrow(NotFoundException);
      expect(prisma.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
