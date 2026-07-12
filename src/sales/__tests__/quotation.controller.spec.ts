import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { QuotationController } from '../quotation.controller';
import { QuotationService } from '../quotation.service';

describe('QuotationController', () => {
  let controller: QuotationController;
  let service: DeepMockProxy<QuotationService>;

  beforeEach(() => {
    service = mockDeep<QuotationService>();
    controller = new QuotationController(service);
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
        issueDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ productId: 'prod-1', quantity: 5, unitPrice: 1000 }],
      };

      await controller.create('org-1', dto, mockUser, mockReq);
      expect(service.create).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
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
      await controller.findOne('org-1', 'qtn-1');
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'qtn-1');
    });
  });

  describe('update', () => {
    it('should delegate to service.update', async () => {
      await controller.update('org-1', 'qtn-1', { notes: 'test' }, mockUser, mockReq);
      expect(service.update).toHaveBeenCalledWith(
        'org-1',
        'qtn-1',
        { notes: 'test' },
        'user-1',
        'req-1',
      );
    });
  });

  describe('archive', () => {
    it('should delegate to service.archive', async () => {
      await controller.archive('org-1', 'qtn-1', mockUser, mockReq);
      expect(service.archive).toHaveBeenCalledWith('org-1', 'qtn-1', 'user-1', 'req-1');
    });
  });

  describe('restore', () => {
    it('should delegate to service.restore', async () => {
      await controller.restore('org-1', 'qtn-1', mockUser, mockReq);
      expect(service.restore).toHaveBeenCalledWith('org-1', 'qtn-1', 'user-1', 'req-1');
    });
  });

  describe('delete', () => {
    it('should delegate to service.delete', async () => {
      await controller.delete('org-1', 'qtn-1', mockUser, mockReq);
      expect(service.delete).toHaveBeenCalledWith('org-1', 'qtn-1', 'user-1', 'req-1');
    });
  });

  describe('send', () => {
    it('should delegate to service.send', async () => {
      await controller.send('org-1', 'qtn-1', mockUser, mockReq);
      expect(service.send).toHaveBeenCalledWith('org-1', 'qtn-1', 'user-1', 'req-1');
    });
  });

  describe('accept', () => {
    it('should delegate to service.accept', async () => {
      await controller.accept('org-1', 'qtn-1', mockUser, mockReq);
      expect(service.accept).toHaveBeenCalledWith('org-1', 'qtn-1', 'user-1', 'req-1');
    });
  });

  describe('reject', () => {
    it('should delegate to service.reject with reason', async () => {
      await controller.reject('org-1', 'qtn-1', { reason: 'Not interested' }, mockUser, mockReq);
      expect(service.reject).toHaveBeenCalledWith(
        'org-1',
        'qtn-1',
        'user-1',
        'req-1',
        'Not interested',
      );
    });
  });

  describe('cancel', () => {
    it('should delegate to service.cancel with reason', async () => {
      await controller.cancel('org-1', 'qtn-1', { reason: 'Out of stock' }, mockUser, mockReq);
      expect(service.cancel).toHaveBeenCalledWith(
        'org-1',
        'qtn-1',
        'user-1',
        'req-1',
        'Out of stock',
      );
    });
  });

  describe('duplicate', () => {
    it('should delegate to service.duplicate', async () => {
      await controller.duplicate('org-1', 'qtn-1', mockUser, mockReq);
      expect(service.duplicate).toHaveBeenCalledWith('org-1', 'qtn-1', 'user-1', 'req-1');
    });
  });

  describe('addItem', () => {
    it('should delegate to service.addItem', async () => {
      const dto = { productId: 'prod-1', quantity: 2, unitPrice: 1000 };
      await controller.addItem('org-1', 'qtn-1', dto, mockUser, mockReq);
      expect(service.addItem).toHaveBeenCalledWith('org-1', 'qtn-1', dto, 'user-1', 'req-1');
    });
  });

  describe('updateItem', () => {
    it('should delegate to service.updateItem', async () => {
      await controller.updateItem('org-1', 'qtn-1', 'item-1', { quantity: 3 }, mockUser, mockReq);
      expect(service.updateItem).toHaveBeenCalledWith(
        'org-1',
        'qtn-1',
        'item-1',
        { quantity: 3 },
        'user-1',
        'req-1',
      );
    });
  });

  describe('deleteItem', () => {
    it('should delegate to service.deleteItem', async () => {
      await controller.deleteItem('org-1', 'qtn-1', 'item-1', mockUser, mockReq);
      expect(service.deleteItem).toHaveBeenCalledWith(
        'org-1',
        'qtn-1',
        'item-1',
        'user-1',
        'req-1',
      );
    });
  });

  describe('reorderItems', () => {
    it('should delegate to service.reorderItems', async () => {
      const dto = { items: [{ id: 'item-1', displayOrder: 2 }] };
      await controller.reorderItems('org-1', 'qtn-1', dto, mockUser, mockReq);
      expect(service.reorderItems).toHaveBeenCalledWith('org-1', 'qtn-1', dto, 'user-1', 'req-1');
    });
  });

  describe('getTimeline', () => {
    it('should delegate to service.getTimeline', async () => {
      await controller.getTimeline('org-1', 'qtn-1', 1, 50);
      expect(service.getTimeline).toHaveBeenCalledWith('org-1', 'qtn-1', 1, 50);
    });
  });
});
