import { DocumentProcessorService } from '../documents/document-processor.service';
import { DocumentParserService } from '../documents/document-parser.service';

describe('DocumentProcessorService', () => {
  let processor: DocumentProcessorService;
  let parser: DocumentParserService;

  beforeEach(() => {
    parser = new DocumentParserService();
    processor = new DocumentProcessorService(parser);
  });

  it('should process a valid TXT file', async () => {
    const buffer = Buffer.from('Hello World');
    const result = await processor.process(buffer, 'text/plain', 'test.txt');
    expect(result.text).toBe('Hello World');
    expect(result.metadata.fileName).toBe('test.txt');
    expect(result.metadata.mimeType).toBe('text/plain');
  });

  it('should clean text', async () => {
    const buffer = Buffer.from('Hello\r\nWorld\r\n\n\n   Extra');
    const result = await processor.process(buffer, 'text/plain', 'test.txt');
    expect(result.cleanedText).toContain('Hello');
    expect(result.cleanedText).not.toContain('\r');
  });

  it('should reject empty files', async () => {
    await expect(processor.process(Buffer.from(''), 'text/plain', 'empty.txt')).rejects.toThrow(
      'File buffer is empty',
    );
  });

  it('should reject unsupported MIME types', async () => {
    await expect(processor.process(Buffer.from('test'), 'image/png', 'test.png')).rejects.toThrow(
      'Unsupported file type',
    );
  });

  it('should reject files without name', async () => {
    await expect(processor.process(Buffer.from('test'), 'text/plain', '')).rejects.toThrow(
      'File name is required',
    );
  });

  it('should reject files over 50MB', async () => {
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024);
    await expect(processor.process(largeBuffer, 'text/plain', 'large.txt')).rejects.toThrow(
      'File too large',
    );
  });

  it('should normalize unicode characters', async () => {
    const buffer = Buffer.from('\u2018quote\u2019 \u201cdouble\u201d \u2013 dash');
    const result = await processor.process(buffer, 'text/plain', 'unicode.txt');
    expect(result.cleanedText).toContain("'");
    expect(result.cleanedText).toContain('"');
    expect(result.cleanedText).toContain('-');
  });
});
