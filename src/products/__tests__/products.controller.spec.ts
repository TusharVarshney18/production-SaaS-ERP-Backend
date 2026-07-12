import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from '../products.controller';
import { ProductsService } from '../products.service';
import { AuthorizationService } from '../../authorization/authorization.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: jest.Mocked<Pick<ProductsService, keyof ProductsService>>;

  beforeEach(async () => {
    const mockService = {
      createCategory: jest.fn(),
      findAllCategories: jest.fn(),
      findOneCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      createUnit: jest.fn(),
      findAllUnits: jest.fn(),
      findOneUnit: jest.fn(),
      updateUnit: jest.fn(),
      deleteUnit: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockService },
        {
          provide: AuthorizationService,
          useValue: { authorize: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get(ProductsService);
  });

  const mockReq = { requestId: 'req-1' };
  const mockUser = {
    sub: 'user-1',
    org: 'org-1',
    email: 'a@b.com',
    roleVersion: 1,
    sessionId: 's1',
  };

  describe('createCategory', () => {
    it('should call service.createCategory', async () => {
      const dto = { name: 'Electronics' };
      await controller.createCategory('org-1', dto, mockUser, mockReq);
      expect(service.createCategory).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('findAllCategories', () => {
    it('should call service.findAllCategories', async () => {
      await controller.findAllCategories('org-1');
      expect(service.findAllCategories).toHaveBeenCalledWith('org-1');
    });
  });

  describe('createUnit', () => {
    it('should call service.createUnit', async () => {
      const dto = { name: 'Piece', shortName: 'pc' };
      await controller.createUnit('org-1', dto, mockUser, mockReq);
      expect(service.createUnit).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('create', () => {
    it('should call service.create', async () => {
      const dto = { sku: 'SKU-001', name: 'Widget Pro' };
      await controller.create('org-1', dto, mockUser, mockReq);
      expect(service.create).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('findAll', () => {
    it('should call service.findAll', async () => {
      const query = { search: 'Widget', page: 1 };
      await controller.findAll('org-1', query);
      expect(service.findAll).toHaveBeenCalledWith('org-1', query);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne', async () => {
      await controller.findOne('org-1', 'prod-1');
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'prod-1');
    });
  });

  describe('update', () => {
    it('should call service.update', async () => {
      const dto = { sellingPrice: 3999 };
      await controller.update('org-1', 'prod-1', dto, mockUser, mockReq);
      expect(service.update).toHaveBeenCalledWith('org-1', 'prod-1', dto, 'user-1', 'req-1');
    });
  });

  describe('archive', () => {
    it('should call service.archive', async () => {
      await controller.archive('org-1', 'prod-1', mockUser, mockReq);
      expect(service.archive).toHaveBeenCalledWith('org-1', 'prod-1', 'user-1', 'req-1');
    });
  });

  describe('restore', () => {
    it('should call service.restore', async () => {
      await controller.restore('org-1', 'prod-1', mockUser, mockReq);
      expect(service.restore).toHaveBeenCalledWith('org-1', 'prod-1', 'user-1', 'req-1');
    });
  });

  describe('delete', () => {
    it('should call service.delete', async () => {
      await controller.delete('org-1', 'prod-1', mockUser, mockReq);
      expect(service.delete).toHaveBeenCalledWith('org-1', 'prod-1', 'user-1', 'req-1');
    });
  });
});
