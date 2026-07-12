import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { InvoicesController } from '../invoices.controller';
import { InvoicesService } from '../invoices.service';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: DeepMockProxy<InvoicesService>;

  beforeEach(() => {
    service = mockDeep<InvoicesService>();
    controller = new InvoicesController(service);
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
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ productId: 'prod-1', quantity: 5, unitPrice: 1000 }],
      };

      await controller.create('org-1', dto, mockUser, mockReq);
      expect(service.create).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('createFromSalesOrder', () => {
    it('should delegate to service.createFromSalesOrder', async () => {
      await controller.createFromSalesOrder('org-1', 'ord-1', mockUser, mockReq);
      expect(service.createFromSalesOrder).toHaveBeenCalledWith(
        'org-1',
        'ord-1',
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
      await controller.findOne('org-1', 'inv-1');
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'inv-1');
    });
  });

  describe('update', () => {
    it('should delegate to service.update', async () => {
      await controller.update('org-1', 'inv-1', { notes: 'test' }, mockUser, mockReq);
      expect(service.update).toHaveBeenCalledWith(
        'org-1',
        'inv-1',
        { notes: 'test' },
        'user-1',
        'req-1',
      );
    });
  });

  describe('send', () => {
    it('should delegate to service.send', async () => {
      await controller.send('org-1', 'inv-1', mockUser, mockReq);
      expect(service.send).toHaveBeenCalledWith('org-1', 'inv-1', 'user-1', 'req-1');
    });
  });

  describe('void', () => {
    it('should delegate to service.void with reason', async () => {
      await controller.void('org-1', 'inv-1', { reason: 'Customer requested' }, mockUser, mockReq);
      expect(service.void).toHaveBeenCalledWith(
        'org-1',
        'inv-1',
        'user-1',
        'req-1',
        'Customer requested',
      );
    });
  });

  describe('duplicate', () => {
    it('should delegate to service.duplicate', async () => {
      await controller.duplicate('org-1', 'inv-1', mockUser, mockReq);
      expect(service.duplicate).toHaveBeenCalledWith('org-1', 'inv-1', 'user-1', 'req-1');
    });
  });

  describe('archive', () => {
    it('should delegate to service.archive', async () => {
      await controller.archive('org-1', 'inv-1', mockUser, mockReq);
      expect(service.archive).toHaveBeenCalledWith('org-1', 'inv-1', 'user-1', 'req-1');
    });
  });

  describe('restore', () => {
    it('should delegate to service.restore', async () => {
      await controller.restore('org-1', 'inv-1', mockUser, mockReq);
      expect(service.restore).toHaveBeenCalledWith('org-1', 'inv-1', 'user-1', 'req-1');
    });
  });

  describe('delete', () => {
    it('should delegate to service.delete', async () => {
      await controller.delete('org-1', 'inv-1', mockUser, mockReq);
      expect(service.delete).toHaveBeenCalledWith('org-1', 'inv-1', 'user-1', 'req-1');
    });
  });

  describe('getTimeline', () => {
    it('should delegate to service.getTimeline', async () => {
      await controller.getTimeline('org-1', 'inv-1', 1, 50);
      expect(service.getTimeline).toHaveBeenCalledWith('org-1', 'inv-1', 1, 50);
    });
  });
});
