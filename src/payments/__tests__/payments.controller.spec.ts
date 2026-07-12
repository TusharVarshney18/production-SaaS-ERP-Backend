import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';
import { PaymentGatewayType } from '@prisma/client';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: DeepMockProxy<PaymentsService>;

  beforeEach(() => {
    service = mockDeep<PaymentsService>();
    controller = new PaymentsController(service);
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

  describe('createManual', () => {
    it('should delegate to service.createManual', async () => {
      const dto = {
        invoiceId: 'inv-1',
        amount: 5700,
        transactionId: 'TXN-001',
        paymentMethod: 'bank_transfer',
      };

      await controller.createManual('org-1', dto, mockUser, mockReq);
      expect(service.createManual).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('captureGateway', () => {
    it('should delegate to service.captureGateway', async () => {
      const dto = {
        invoiceId: 'inv-1',
        gateway: PaymentGatewayType.STRIPE,
        transactionId: 'pi_123',
        amount: 5700,
      };

      await controller.captureGateway('org-1', dto, mockUser, mockReq);
      expect(service.captureGateway).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
    });
  });

  describe('allocate', () => {
    it('should delegate to service.allocate', async () => {
      await controller.allocate('org-1', 'pay-1', 'inv-1', 5700, mockUser, mockReq);
      expect(service.allocate).toHaveBeenCalledWith(
        'org-1',
        'pay-1',
        'inv-1',
        5700,
        'user-1',
        'req-1',
      );
    });
  });

  describe('refund', () => {
    it('should delegate to service.refund', async () => {
      const dto = { paymentId: 'pay-1', reason: 'Customer request' };

      await controller.refund('org-1', dto, mockUser, mockReq);
      expect(service.refund).toHaveBeenCalledWith('org-1', dto, 'user-1', 'req-1');
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
      await controller.findOne('org-1', 'pay-1');
      expect(service.findOne).toHaveBeenCalledWith('org-1', 'pay-1');
    });
  });

  describe('findByInvoice', () => {
    it('should delegate to service.findByInvoice', async () => {
      await controller.findByInvoice('org-1', 'inv-1');
      expect(service.findByInvoice).toHaveBeenCalledWith('org-1', 'inv-1');
    });
  });
});
