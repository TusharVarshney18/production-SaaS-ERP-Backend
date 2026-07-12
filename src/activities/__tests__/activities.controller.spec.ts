import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesController } from '../activities.controller';
import { ActivitiesService } from '../activities.service';
import { AuthorizationService } from '../../authorization/authorization.service';

describe('ActivitiesController', () => {
  let controller: ActivitiesController;
  let service: jest.Mocked<Pick<ActivitiesService, keyof ActivitiesService>>;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      complete: jest.fn(),
      cancel: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
      delete: jest.fn(),
      assign: jest.fn(),
      changeDueDate: jest.fn(),
      changePriority: jest.fn(),
      getTimeline: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        { provide: ActivitiesService, useValue: mockService },
        {
          provide: AuthorizationService,
          useValue: { authorize: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    controller = module.get<ActivitiesController>(ActivitiesController);
    service = module.get(ActivitiesService);
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
    it('should call service.create', async () => {
      const dto = { entityType: 'deal', entityId: 'deal-1', type: 'TASK', title: 'Test' };
      await controller.create('org-1', dto, mockUser, mockReq);
      expect(service.create).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('findAll', () => {
    it('should call service.findAll', async () => {
      const query = { entityType: 'deal', page: 1, limit: 20 };
      await controller.findAll('org-1', query);
      expect(service.findAll).toHaveBeenCalledWith('org-1', query);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne', async () => {
      await controller.findOne('org-1', 'act-1');
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'act-1');
    });
  });

  describe('update', () => {
    it('should call service.update', async () => {
      const dto = { title: 'Updated' };
      await controller.update('org-1', 'act-1', dto, mockUser, mockReq);
      expect(service.update).toHaveBeenCalledWith('org-1', 'act-1', dto, 'user-1', 'req-1');
    });
  });

  describe('complete', () => {
    it('should call service.complete', async () => {
      await controller.complete('org-1', 'act-1', mockUser, mockReq);
      expect(service.complete).toHaveBeenCalledWith('org-1', 'act-1', 'user-1', 'req-1');
    });
  });

  describe('cancel', () => {
    it('should call service.cancel', async () => {
      await controller.cancel('org-1', 'act-1', mockUser, mockReq);
      expect(service.cancel).toHaveBeenCalledWith('org-1', 'act-1', 'user-1', 'req-1');
    });
  });

  describe('archive', () => {
    it('should call service.archive', async () => {
      await controller.archive('org-1', 'act-1', mockUser, mockReq);
      expect(service.archive).toHaveBeenCalledWith('org-1', 'act-1', 'user-1', 'req-1');
    });
  });

  describe('restore', () => {
    it('should call service.restore', async () => {
      await controller.restore('org-1', 'act-1', mockUser, mockReq);
      expect(service.restore).toHaveBeenCalledWith('org-1', 'act-1', 'user-1', 'req-1');
    });
  });

  describe('delete', () => {
    it('should call service.delete', async () => {
      await controller.delete('org-1', 'act-1', mockUser, mockReq);
      expect(service.delete).toHaveBeenCalledWith('org-1', 'act-1', 'user-1', 'req-1');
    });
  });

  describe('assign', () => {
    it('should call service.assign', async () => {
      const dto = { assignedToId: 'user-2' };
      await controller.assign('org-1', 'act-1', dto, mockUser, mockReq);
      expect(service.assign).toHaveBeenCalledWith('org-1', 'act-1', dto, 'user-1', 'req-1');
    });
  });

  describe('changeDueDate', () => {
    it('should call service.changeDueDate', async () => {
      const dto = { dueDate: '2026-09-01' };
      await controller.changeDueDate('org-1', 'act-1', dto, mockUser, mockReq);
      expect(service.changeDueDate).toHaveBeenCalledWith('org-1', 'act-1', dto, 'user-1', 'req-1');
    });
  });

  describe('changePriority', () => {
    it('should call service.changePriority', async () => {
      const dto = { priority: 'URGENT' };
      await controller.changePriority('org-1', 'act-1', dto, mockUser, mockReq);
      expect(service.changePriority).toHaveBeenCalledWith('org-1', 'act-1', dto, 'user-1', 'req-1');
    });
  });

  describe('getTimeline', () => {
    it('should call service.getTimeline', async () => {
      await controller.getTimeline('org-1', 'act-1', 1, 50);
      expect(service.getTimeline).toHaveBeenCalledWith('org-1', 'act-1', 1, 50);
    });
  });
});
