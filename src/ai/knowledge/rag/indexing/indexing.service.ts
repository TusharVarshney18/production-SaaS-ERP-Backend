import { Injectable, Logger } from '@nestjs/common';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { VectorRecord } from '../interfaces/vector-store.interface';
import { EmbeddingProviderFactory } from '../embeddings/embedding-provider.factory';
import { InMemoryVectorStore } from '../vector/in-memory-vector.store';
import { DocumentRepository } from '../repositories/document.repository';
import { DocumentChunk } from '../dto/chunk.dto';

interface IndexChunkInput {
  chunk: DocumentChunk;
}

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);
  private readonly embeddingProvider: IEmbeddingProvider;
  private readonly embeddingCache = new Map<string, number[]>();

  constructor(
    private readonly vectorStore: InMemoryVectorStore,
    private readonly embeddingFactory: EmbeddingProviderFactory,
    private readonly documentRepository: DocumentRepository,
  ) {
    this.embeddingProvider = this.embeddingFactory.getProvider();
  }

  async indexChunks(inputs: IndexChunkInput[]): Promise<number> {
    const contents = inputs.map((i) => i.chunk.content);

    const embeddings: number[][] = [];
    const toEmbed: string[] = [];
    const toEmbedIndices: number[] = [];

    for (let i = 0; i < contents.length; i++) {
      const cached = this.embeddingCache.get(contents[i]);
      if (cached) {
        embeddings[i] = cached;
      } else {
        toEmbed.push(contents[i]);
        toEmbedIndices.push(i);
      }
    }

    if (toEmbed.length > 0) {
      const newEmbeddings = await this.embeddingProvider.generateEmbeddings(toEmbed);
      for (let j = 0; j < toEmbed.length; j++) {
        const idx = toEmbedIndices[j];
        embeddings[idx] = newEmbeddings[j];
        this.embeddingCache.set(toEmbed[j], newEmbeddings[j]);
      }
    }

    const records: VectorRecord[] = inputs.map((input, i) => ({
      id: `vec-${input.chunk.id}`,
      organizationId: input.chunk.organizationId,
      chunkId: input.chunk.id,
      documentId: input.chunk.documentId,
      documentVersion: input.chunk.version,
      embedding: embeddings[i],
      metadata: { ...input.chunk.metadata, content: input.chunk.content },
    }));

    await this.vectorStore.upsert(records);
    await this.documentRepository.saveChunks(inputs.map((i) => i.chunk));

    this.logger.log(`Indexed ${inputs.length} chunks`);
    return inputs.length;
  }

  async deleteDocumentIndex(documentId: string, organizationId: string): Promise<number> {
    const deleted = await this.vectorStore.deleteByDocumentId(documentId, organizationId);
    const deletedChunks = await this.documentRepository.deleteChunksByDocumentId(
      documentId,
      organizationId,
    );
    this.logger.log(
      `Deleted ${deleted} vectors and ${deletedChunks} chunks for document ${documentId}`,
    );
    return deleted;
  }

  async deleteOrganizationIndex(organizationId: string): Promise<number> {
    const deleted = await this.vectorStore.deleteByOrganizationId(organizationId);
    this.logger.log(
      `Deleted all index data for organization ${organizationId}: ${deleted} vectors`,
    );
    return deleted;
  }

  clearCache(): void {
    this.embeddingCache.clear();
    this.logger.log('Embedding cache cleared');
  }
}
