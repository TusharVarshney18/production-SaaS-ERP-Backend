import { DocumentParserService } from '../documents/document-parser.service';

describe('DocumentParserService', () => {
  let parser: DocumentParserService;

  beforeEach(() => {
    parser = new DocumentParserService();
  });

  it('should parse TXT files', async () => {
    const buffer = Buffer.from('Hello\nWorld');
    const result = await parser.parse(buffer, 'text/plain');
    expect(result.text).toBe('Hello\nWorld');
    expect(result.metadata.lineCount).toBe(2);
  });

  it('should parse Markdown files', async () => {
    const buffer = Buffer.from('# Title\n\nSome content\n## Subtitle');
    const result = await parser.parse(buffer, 'text/markdown');
    expect(result.text).toContain('# Title');
    expect(result.metadata.headingCount).toBe(2);
  });

  it('should parse CSV files', async () => {
    const buffer = Buffer.from('name,age\nAlice,30\nBob,25');
    const result = await parser.parse(buffer, 'text/csv');
    expect(result.text).toContain('Row 1');
    expect(result.text).toContain('Alice');
    expect(result.metadata.rowCount).toBe(2);
    expect(result.metadata.columnCount).toBe(2);
  });

  it('should parse CSV with quoted fields', async () => {
    const buffer = Buffer.from('name,note\nAlice,"Hello, World"\nBob,test');
    const result = await parser.parse(buffer, 'text/csv');
    expect(result.text).toContain('Hello, World');
  });

  it('should parse PDF files', async () => {
    const buffer = Buffer.from('PDF mock content');
    const result = await parser.parse(buffer, 'application/pdf');
    expect(result.text).toBeDefined();
    expect(result.metadata.extractedVia).toBe('basic');
  });

  it('should parse DOCX files', async () => {
    const buffer = Buffer.from('DOCX mock content');
    const result = await parser.parse(
      buffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(result.text).toBeDefined();
  });

  it('should throw for unsupported types', async () => {
    const buffer = Buffer.from('test');
    await expect(parser.parse(buffer, 'image/png')).rejects.toThrow('Unsupported mime type');
  });

  it('should list supported MIME types', () => {
    expect(parser.supportedMimeTypes).toContain('text/plain');
    expect(parser.supportedMimeTypes).toContain('text/markdown');
    expect(parser.supportedMimeTypes).toContain('text/csv');
    expect(parser.supportedMimeTypes).toContain('application/pdf');
    expect(parser.supportedMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });
});
