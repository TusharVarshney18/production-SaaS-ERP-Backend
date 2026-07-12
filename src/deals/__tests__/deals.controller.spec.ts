import { Test, TestingModule } from '@nestjs/testing';
import { DealsController } from '../deals.controller';
import { DealsService } from '../deals.service';
import { AuthorizationService } from '../../authorization/authorization.service';

describe('DealsController', () => {
  let controller: DealsController;
  let service: jest.Mocked<Pick<DealsService, keyof DealsService>>;

  beforeEach(async () => {
    const mockService = {
      createPipeline: jest.fn(),
      listPipelines: jest.fn(),
      findOnePipeline: jest.fn(),
      updatePipeline: jest.fn(),
      archivePipeline: jest.fn(),
      restorePipeline: jest.fn(),
      deletePipeline: jest.fn(),
      createStage: jest.fn(),
      updateStage: jest.fn(),
      reorderStages: jest.fn(),
      deleteStage: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      moveStage: jest.fn(),
      changeOwner: jest.fn(),
      markWon: jest.fn(),
      markLost: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
      delete: jest.fn(),
      getTimeline: jest.fn(),
      getDashboardStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DealsController],
      providers: [
        { provide: DealsService, useValue: mockService },
        {
          provide: AuthorizationService,
          useValue: { authorize: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    controller = module.get<DealsController>(DealsController);
    service = module.get(DealsService);
  });

  const mockReq = { requestId: 'req-1' };
  const mockUser = {
    sub: 'user-1',
    org: 'org-1',
    email: 'a@b.com',
    roleVersion: 1,
    sessionId: 's1',
  };

  describe('createPipeline', () => {
    it('should call service.createPipeline', async () => {
      const dto = { name: 'Sales Pipeline' };
      await controller.createPipeline('org-1', dto, mockUser, mockReq);
      expect(service.createPipeline).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('listPipelines', () => {
    it('should call service.listPipelines', async () => {
      await controller.listPipelines('org-1');
      expect(service.listPipelines).toHaveBeenCalledWith('org-1');
    });
  });

  describe('create', () => {
    it('should call service.create with correct params', async () => {
      const dto = { title: 'Big Deal', pipelineId: 'pipe-1', stageId: 'stage-1' };
      await controller.create('org-1', dto, mockUser, mockReq);
      expect(service.create).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with orgId and query', async () => {
      const query = { search: 'test', page: 1, limit: 20 };
      await controller.findAll('org-1', query);
      expect(service.findAll).toHaveBeenCalledWith('org-1', query);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne', async () => {
      await controller.findOne('org-1', 'deal-1');
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'deal-1');
    });
  });

  describe('update', () => {
    it('should call service.update', async () => {
      const dto = { value: 75000 };
      await controller.update('org-1', 'deal-1', dto, mockUser, mockReq);
      expect(service.update).toHaveBeenCalledWith('org-1', 'deal-1', dto, 'user-1', 'req-1');
    });
  });

  describe('moveStage', () => {
    it('should call service.moveStage', async () => {
      const dto = { stageId: 'stage-2' };
      await controller.moveStage('org-1', 'deal-1', dto, mockUser, mockReq);
      expect(service.moveStage).toHaveBeenCalledWith('org-1', 'deal-1', dto, 'user-1', 'req-1');
    });
  });

  describe('changeOwner', () => {
    it('should call service.changeOwner', async () => {
      const dto = { ownerId: 'user-2' };
      await controller.changeOwner('org-1', 'deal-1', dto, mockUser, mockReq);
      expect(service.changeOwner).toHaveBeenCalledWith('org-1', 'deal-1', dto, 'user-1', 'req-1');
    });
  });

  describe('markWon', () => {
    it('should call service.markWon', async () => {
      const dto = { wonReason: 'Great deal' };
      await controller.markWon('org-1', 'deal-1', dto, mockUser, mockReq);
      expect(service.markWon).toHaveBeenCalledWith('org-1', 'deal-1', dto, 'user-1', 'req-1');
    });
  });

  describe('markLost', () => {
    it('should call service.markLost', async () => {
      const dto = { lossReason: 'Budget' };
      await controller.markLost('org-1', 'deal-1', dto, mockUser, mockReq);
      expect(service.markLost).toHaveBeenCalledWith('org-1', 'deal-1', dto, 'user-1', 'req-1');
    });
  });

  describe('archive', () => {
    it('should call service.archive', async () => {
      await controller.archive('org-1', 'deal-1', mockUser, mockReq);
      expect(service.archive).toHaveBeenCalledWith('org-1', 'deal-1', 'user-1', 'req-1');
    });
  });

  describe('restore', () => {
    it('should call service.restore', async () => {
      await controller.restore('org-1', 'deal-1', mockUser, mockReq);
      expect(service.restore).toHaveBeenCalledWith('org-1', 'deal-1', 'user-1', 'req-1');
    });
  });

  describe('delete', () => {
    it('should call service.delete', async () => {
      await controller.delete('org-1', 'deal-1', mockUser, mockReq);
      expect(service.delete).toHaveBeenCalledWith('org-1', 'deal-1', 'user-1', 'req-1');
    });
  });

  describe('getTimeline', () => {
    it('should call service.getTimeline', async () => {
      await controller.getTimeline('org-1', 'deal-1', 1, 50);
      expect(service.getTimeline).toHaveBeenCalledWith('org-1', 'deal-1', 1, 50);
    });
  });

  describe('getStats', () => {
    it('should call service.getDashboardStats', async () => {
      await controller.getStats('org-1');
      expect(service.getDashboardStats).toHaveBeenCalledWith('org-1');
    });
  });
});
