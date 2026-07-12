import { ExportService } from '../services/export.service';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    service = new ExportService();
  });

  const data = [
    { name: 'Widget', price: 100, qty: 5 },
    { name: 'Gadget', price: 200, qty: 3 },
  ];

  describe('toCsv', () => {
    it('should generate CSV string', () => {
      const csv = service.toCsv(data);
      expect(csv).toContain('name,price,qty');
      expect(csv).toContain('Widget,100,5');
      expect(csv).toContain('Gadget,200,3');
    });

    it('should escape commas', () => {
      const result = service.toCsv([{ name: 'Foo, Bar', value: 1 }]);
      expect(result).toContain('"Foo, Bar"');
    });
  });

  describe('toExcelXml', () => {
    it('should generate Excel XML', () => {
      const xml = service.toExcelXml(data, 'Test');
      expect(xml).toContain('<?xml');
      expect(xml).toContain('<Worksheet ss:Name="Test">');
      expect(xml).toContain('Widget');
    });
  });

  describe('toPdfHtml', () => {
    it('should generate HTML for PDF', () => {
      const html = service.toPdfHtml(data, 'Invoice');
      expect(html).toContain('<h1>Invoice</h1>');
      expect(html).toContain('<table>');
    });
  });
});
