import { Injectable, Logger } from '@nestjs/common';
import { IJobProcessor, JobProcessorDefinition } from '../interfaces/job-processor.interface';
import { JobDefinition, JobResult } from '../dto/job.dto';
import { ExecutionContext } from '../../execution/execution-context';
import { KnowledgeManagerService } from '../../knowledge/rag/knowledge-manager.service';
import { DocumentUploadInput } from '../../knowledge/rag/dto/document.dto';

@Injectable()
export class RagIndexingProcessor implements IJobProcessor {
  private readonly logger = new Logger(RagIndexingProcessor.name);
  readonly definition: JobProcessorDefinition = {
    jobType: 'rag.indexing',
    description: 'Indexes documents into the RAG vector store',
    concurrency: 2,
    timeout: 300000,
  };

  constructor(private readonly knowledgeManager: KnowledgeManagerService) {}

  async process(job: JobDefinition, context: ExecutionContext): Promise<JobResult> {
    const startTime = Date.now();
    const input = job.payload as {
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      content?: string;
      organizationId?: string;
      uploadedBy?: string;
    };

    const documentInput: DocumentUploadInput = {
      fileName: input.fileName || 'unknown.txt',
      fileSize: input.fileSize || 0,
      mimeType: input.mimeType || 'text/plain',
      buffer: Buffer.from(input.content || '', 'utf-8'),
      metadata: job.metadata,
    };

    const doc = await this.knowledgeManager.ingestDocument(
      documentInput,
      input.organizationId || context.organizationId,
      input.uploadedBy || context.userId,
      { metadata: job.metadata },
    );

    return {
      success: true,
      data: { documentId: doc.id, status: doc.status },
      duration: Date.now() - startTime,
    };
  }
}
