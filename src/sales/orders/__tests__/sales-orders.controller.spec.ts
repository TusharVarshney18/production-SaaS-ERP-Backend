import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SalesOrdersController } from '../sales-orders.controller';
import { SalesOrdersService } from '../sales-orders.service';
import { SalesOrderStatus } from '@prisma/client';

describe('SalesOrdersController', () => {
  let controller: SalesOrdersController;
  let service: DeepMockProxy<SalesOrdersService>;

  beforeEach(() => {
    service = mockDeep<SalesOrdersService>();
    controller = new SalesOrdersController(service);
  });

  afterEach(() => jest.clearAllMocks());

  const mockUser = {
    sub: 'user-1',
    org: 'org-1',
    email: 'admin@example.com',
    roleVersion: 1,
    sessionId: 'session-1',
  };

  const mockReq = { requestId: 'req-1' };

  describe('create', () => {
    it('should delegate to service.create', async () => {
      const dto = {
        companyId: 'comp-1',
        contactId: 'cont-1',
        orderDate: new Date().toISOString(),
        items: [{ productId: 'prod-1', quantity: 5, unitPrice: 1000 }],
      };

      await controller.create('org-1', dto, mockUser, mockReq);
      expect(service.create).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('convertFromQuotation', () => {
    it('should delegate to service.convertFromQuotation', async () => {
      await controller.convertFromQuotation('org-1', 'qtn-1', mockUser, mockReq);
      expect(service.convertFromQuotation).toHaveBeenCalledWith(
        'org-1',
        'qtn-1',
        'user-1',
        'req-1',
      );
    });
  });

  describe('findAll', () => {
    it('should delegate to service.findAll', async () => {
      await controller.findAll('org-1', {});
      expect(service.findAll).toHaveBeenCalledWith('org-1', {});
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne', async () => {
      await controller.findOne('org-1', 'ord-1');
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'ord-1');
    });
  });

  describe('update', () => {
    it('should delegate to service.update', async () => {
      await controller.update('org-1', 'ord-1', { notes: 'test' }, mockUser, mockReq);
      expect(service.update).toHaveBeenCalledWith(
        'org-1',
        'ord-1',
        { notes: 'test' },
        'user-1',
        'req-1',
      );
    });
  });

  describe('confirm', () => {
    it('should delegate to service.confirm', async () => {
      await controller.confirm('org-1', 'ord-1', mockUser, mockReq);
      expect(service.confirm).toHaveBeenCalledWith('org-1', 'ord-1', 'user-1', 'req-1');
    });
  });

  describe('cancel', () => {
    it('should delegate to service.cancel with reason', async () => {
      await controller.cancel('org-1', 'ord-1', { reason: 'No longer needed' }, mockUser, mockReq);
      expect(service.cancel).toHaveBeenCalledWith(
        'org-1',
        'ord-1',
        'user-1',
        'req-1',
        'No longer needed',
      );
    });
  });

  describe('changeStatus', () => {
    it('should delegate to service.changeStatus', async () => {
      await controller.changeStatus(
        'org-1',
        'ord-1',
        SalesOrderStatus.PROCESSING,
        mockUser,
        mockReq,
      );
      expect(service.changeStatus).toHaveBeenCalledWith(
        'org-1',
        'ord-1',
        SalesOrderStatus.PROCESSING,
        'user-1',
        'req-1',
      );
    });
  });

  describe('duplicate', () => {
    it('should delegate to service.duplicate', async () => {
      await controller.duplicate('org-1', 'ord-1', mockUser, mockReq);
      expect(service.duplicate).toHaveBeenCalledWith('org-1', 'ord-1', 'user-1', 'req-1');
    });
  });

  describe('archive', () => {
    it('should delegate to service.archive', async () => {
      await controller.archive('org-1', 'ord-1', mockUser, mockReq);
      expect(service.archive).toHaveBeenCalledWith('org-1', 'ord-1', 'user-1', 'req-1');
    });
  });

  describe('restore', () => {
    it('should delegate to service.restore', async () => {
      await controller.restore('org-1', 'ord-1', mockUser, mockReq);
      expect(service.restore).toHaveBeenCalledWith('org-1', 'ord-1', 'user-1', 'req-1');
    });
  });

  describe('delete', () => {
    it('should delegate to service.delete', async () => {
      await controller.delete('org-1', 'ord-1', mockUser, mockReq);
      expect(service.delete).toHaveBeenCalledWith('org-1', 'ord-1', 'user-1', 'req-1');
    });
  });

  describe('getTimeline', () => {
    it('should delegate to service.getTimeline', async () => {
      await controller.getTimeline('org-1', 'ord-1', 1, 50);
      expect(service.getTimeline).toHaveBeenCalledWith('org-1', 'ord-1', 1, 50);
    });
  });
});
