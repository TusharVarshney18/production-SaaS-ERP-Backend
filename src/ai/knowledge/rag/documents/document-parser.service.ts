import { Injectable, Logger } from '@nestjs/common';
import { IDocumentParser, ParsedDocument } from '../interfaces/document-parser.interface';

@Injectable()
export class DocumentParserService implements IDocumentParser {
  private readonly logger = new Logger(DocumentParserService.name);

  readonly supportedMimeTypes = [
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  async parse(buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
    switch (mimeType) {
      case 'text/plain':
        return this.parseTxt(buffer);
      case 'text/markdown':
        return this.parseMarkdown(buffer);
      case 'text/csv':
        return this.parseCsv(buffer);
      case 'application/pdf':
        return this.parsePdf(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.parseDocx(buffer);
      default:
        throw new Error(`Unsupported mime type: ${mimeType}`);
    }
  }

  private async parseTxt(buffer: Buffer): Promise<ParsedDocument> {
    const text = buffer.toString('utf-8');
    return {
      text,
      metadata: { lineCount: text.split('\n').length, charCount: text.length },
    };
  }

  private async parseMarkdown(buffer: Buffer): Promise<ParsedDocument> {
    const text = buffer.toString('utf-8');
    const headingCount = (text.match(/^#{1,6}\s/gm) || []).length;
    return {
      text,
      metadata: { headingCount, charCount: text.length },
    };
  }

  private async parseCsv(buffer: Buffer): Promise<ParsedDocument> {
    const raw = buffer.toString('utf-8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const header = lines[0] || '';
    const dataLines = lines.slice(1);
    const text = dataLines
      .map((line, i) => {
        const values = this.parseCsvLine(line);
        return `Row ${i + 1}: ${values.join(', ')}`;
      })
      .join('\n');
    return {
      text,
      metadata: { header, rowCount: dataLines.length, columnCount: header.split(',').length },
    };
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  private async parsePdf(buffer: Buffer): Promise<ParsedDocument> {
    const text = this.extractPdfText(buffer);
    if (!text || text.trim().length === 0) {
      this.logger.warn('No text extracted from PDF');
    }
    return {
      text: text || '',
      metadata: { pageCount: this.estimatePageCount(text), extractedVia: 'basic' },
    };
  }

  private extractPdfText(buffer: Buffer): string {
    const content = buffer.toString('latin1');
    const textParts: string[] = [];
    const textObjRegex = /\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    const streamMatch = content.match(/stream\n?([\s\S]*?)\n?endstream/g);
    const searchSpace = streamMatch ? streamMatch.join(' ') : content;

    while ((match = textObjRegex.exec(searchSpace)) !== null) {
      const text = match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\([0-7]{1,3})/g, (_m, octal) => String.fromCharCode(parseInt(octal, 8)))
        .replace(/\\(.)/g, '$1');
      if (text.length > 1) {
        textParts.push(text);
      }
    }
    return textParts.join(' ');
  }

  private estimatePageCount(text: string): number {
    if (!text || text.length === 0) return 0;
    return Math.max(1, Math.ceil(text.length / 3000));
  }

  private async parseDocx(buffer: Buffer): Promise<ParsedDocument> {
    const text = this.extractDocxText(buffer);
    return {
      text,
      metadata: { charCount: text.length, extractedVia: 'xml' },
    };
  }

  private extractDocxText(buffer: Buffer): string {
    try {
      const signature = buffer.slice(0, 2).toString('hex');
      if (signature !== '504b') {
        return buffer.toString('utf-8');
      }
      const content = buffer.toString('latin1');
      const xmlStart = content.indexOf('<?xml');
      if (xmlStart === -1) return buffer.toString('utf-8');
      const textParts: string[] = [];
      const tagRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
      let match: RegExpExecArray | null;
      while ((match = tagRegex.exec(content)) !== null) {
        textParts.push(match[1]);
      }
      if (textParts.length === 0) {
        return buffer.toString('utf-8');
      }
      return textParts.join(' ');
    } catch {
      return buffer.toString('utf-8');
    }
  }
}
