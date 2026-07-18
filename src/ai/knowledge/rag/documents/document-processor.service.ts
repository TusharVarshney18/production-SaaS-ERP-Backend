import { Injectable, Logger } from '@nestjs/common';
import { ProcessedDocument } from '../interfaces/processed-document.interface';
import { DocumentParserService } from './document-parser.service';
import { RAG_MAX_FILE_SIZE } from '../../../constants';

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  constructor(private readonly parser: DocumentParserService) {}

  async process(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    extraMetadata?: Record<string, unknown>,
  ): Promise<ProcessedDocument> {
    this.validateFile(fileName, mimeType, buffer);

    const parsed = await this.parser.parse(buffer, mimeType);

    const cleanedText = this.clean(parsed.text);

    const normalizedText = this.normalize(cleanedText);

    return {
      text: normalizedText,
      metadata: {
        ...parsed.metadata,
        ...extraMetadata,
        fileName,
        mimeType,
        originalSize: buffer.length,
        processedAt: new Date().toISOString(),
      },
      cleanedText: normalizedText,
    };
  }

  private validateFile(fileName: string, mimeType: string, buffer: Buffer): void {
    if (!fileName || fileName.length === 0) {
      throw new Error('File name is required');
    }
    if (!buffer || buffer.length === 0) {
      throw new Error('File buffer is empty');
    }
    if (!this.parser.supportedMimeTypes.includes(mimeType)) {
      throw new Error(
        `Unsupported file type: ${mimeType}. Supported: ${this.parser.supportedMimeTypes.join(', ')}`,
      );
    }
    if (buffer.length > RAG_MAX_FILE_SIZE) {
      throw new Error(`File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB (max: ${RAG_MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }
  }

  private clean(text: string): string {
    let cleaned = text;
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/\r/g, '\n');
    cleaned = cleaned.replace(/\t/g, ' ');
    cleaned = cleaned.replace(/\f/g, '\n');
    cleaned = cleaned.replace(/\u0000-\u0008\u000b\u000c\u000e-\u001f/g, '');
    cleaned = cleaned.replace(/[^\S\n]+/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.trim();
    return cleaned;
  }

  private normalize(text: string): string {
    let normalized = text;
    normalized = normalized.replace(/\u2018|\u2019/g, "'");
    normalized = normalized.replace(/\u201c|\u201d/g, '"');
    normalized = normalized.replace(/\u2013|\u2014/g, '-');
    normalized = normalized.replace(/\u2026/g, '...');
    return normalized;
  }
}
