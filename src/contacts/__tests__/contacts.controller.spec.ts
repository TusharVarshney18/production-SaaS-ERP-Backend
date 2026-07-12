import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { ContactsController } from '../contacts.controller';
import { ContactsService } from '../contacts.service';

describe('ContactsController', () => {
  let controller: ContactsController;
  let service: jest.Mocked<Pick<ContactsService, keyof ContactsService>>;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
      delete: jest.fn(),
      setPrimary: jest.fn(),
      setDecisionMaker: jest.fn(),
      moveCompany: jest.fn(),
      getTimeline: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ContactsController>(ContactsController);
    service = module.get(ContactsService);
  });

  const mockReq = { requestId: 'req-1' };
  const mockUser = {
    sub: 'user-1',
    org: 'org-1',
    email: 'a@b.com',
    roleVersion: 1,
    sessionId: 's1',
  };

  describe('create', () => {
    it('should call service.create with orgId, dto, userId, requestId', async () => {
      const dto = { firstName: 'John', lastName: 'Doe' };
      await controller.create('org-1', dto, mockUser, mockReq);
      expect(service.create).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with orgId and query', async () => {
      const query = { search: 'John', page: 1, limit: 20 };
      await controller.findAll('org-1', query);
      expect(service.findAll).toHaveBeenCalledWith('org-1', query);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with orgId and id', async () => {
      await controller.findOne('org-1', 'contact-1');
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'contact-1');
    });
  });

  describe('update', () => {
    it('should call service.update with correct params', async () => {
      const dto = { designation: 'Senior Engineer' };
      await controller.update('org-1', 'contact-1', dto, mockUser, mockReq);
      expect(service.update).toHaveBeenCalledWith('org-1', 'contact-1', dto, 'user-1', 'req-1');
    });
  });

  describe('archive', () => {
    it('should call service.archive', async () => {
      await controller.archive('org-1', 'contact-1', mockUser, mockReq);
      expect(service.archive).toHaveBeenCalledWith('org-1', 'contact-1', 'user-1', 'req-1');
    });
  });

  describe('restore', () => {
    it('should call service.restore', async () => {
      await controller.restore('org-1', 'contact-1', mockUser, mockReq);
      expect(service.restore).toHaveBeenCalledWith('org-1', 'contact-1', 'user-1', 'req-1');
    });
  });

  describe('delete', () => {
    it('should call service.delete', async () => {
      await controller.delete('org-1', 'contact-1', mockUser, mockReq);
      expect(service.delete).toHaveBeenCalledWith('org-1', 'contact-1', 'user-1', 'req-1');
    });
  });

  describe('setPrimary', () => {
    it('should call service.setPrimary', async () => {
      await controller.setPrimary('org-1', 'contact-1', mockUser, mockReq);
      expect(service.setPrimary).toHaveBeenCalledWith('org-1', 'contact-1', 'user-1', 'req-1');
    });
  });

  describe('setDecisionMaker', () => {
    it('should call service.setDecisionMaker', async () => {
      await controller.setDecisionMaker('org-1', 'contact-1', mockUser, mockReq);
      expect(service.setDecisionMaker).toHaveBeenCalledWith(
        'org-1',
        'contact-1',
        'user-1',
        'req-1',
      );
    });
  });

  describe('moveCompany', () => {
    it('should call service.moveCompany', async () => {
      const dto = { companyId: 'comp-2' };
      await controller.moveCompany('org-1', 'contact-1', dto, mockUser, mockReq);
      expect(service.moveCompany).toHaveBeenCalledWith(
        'org-1',
        'contact-1',
        dto,
        'user-1',
        'req-1',
      );
    });
  });

  describe('getTimeline', () => {
    it('should call service.getTimeline', async () => {
      await controller.getTimeline('org-1', 'contact-1', 1, 50);
      expect(service.getTimeline).toHaveBeenCalledWith('org-1', 'contact-1', 1, 50);
    });
  });
});
