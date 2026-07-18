import { InMemoryVectorStore } from '../vector/in-memory-vector.store';
import { VectorRecord } from '../interfaces/vector-store.interface';

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  const makeRecord = (
    id: string,
    orgId: string,
    docId: string,
    values: number[],
  ): VectorRecord => ({
    id,
    organizationId: orgId,
    chunkId: `chunk-${id}`,
    documentId: docId,
    documentVersion: 1,
    embedding: values,
    metadata: {},
  });

  beforeEach(() => {
    store = new InMemoryVectorStore();
  });

  it('should upsert and search records', async () => {
    const records = [
      makeRecord('1', 'org1', 'doc1', [1, 0, 0]),
      makeRecord('2', 'org1', 'doc1', [0, 1, 0]),
      makeRecord('3', 'org1', 'doc1', [0, 0, 1]),
    ];
    await store.upsert(records);

    const results = await store.search([1, 0, 0], { organizationId: 'org1', limit: 3 });
    expect(results).toHaveLength(3);
    expect(results[0].record.id).toBe('1');
    expect(results[0].score).toBeGreaterThan(0.99);
  });

  it('should enforce organization isolation', async () => {
    await store.upsert([
      makeRecord('1', 'org1', 'doc1', [1, 0, 0]),
      makeRecord('2', 'org2', 'doc2', [0, 1, 0]),
    ]);

    const results = await store.search([1, 0, 0], { organizationId: 'org1' });
    expect(results).toHaveLength(1);
    expect(results[0].record.id).toBe('1');
  });

  it('should filter by document IDs', async () => {
    await store.upsert([
      makeRecord('1', 'org1', 'doc1', [1, 0, 0]),
      makeRecord('2', 'org1', 'doc2', [1, 0, 0]),
    ]);

    const results = await store.search([1, 0, 0], {
      organizationId: 'org1',
      documentIds: ['doc1'],
    });
    expect(results).toHaveLength(1);
    expect(results[0].record.documentId).toBe('doc1');
  });

  it('should filter by metadata', async () => {
    await store.upsert([
      { ...makeRecord('1', 'org1', 'doc1', [1, 0, 0]), metadata: { type: 'pdf' } },
      { ...makeRecord('2', 'org1', 'doc1', [1, 0, 0]), metadata: { type: 'docx' } },
    ]);

    const results = await store.search([1, 0, 0], {
      organizationId: 'org1',
      metadataFilter: { type: 'pdf' },
    });
    expect(results).toHaveLength(1);
  });

  it('should apply score threshold', async () => {
    await store.upsert([
      makeRecord('1', 'org1', 'doc1', [1, 0, 0]),
      makeRecord('2', 'org1', 'doc1', [0.1, 0.9, 0]),
    ]);

    const results = await store.search([1, 0, 0], {
      organizationId: 'org1',
      scoreThreshold: 0.5,
    });
    expect(results).toHaveLength(1);
  });

  it('should limit results', async () => {
    await store.upsert([
      makeRecord('1', 'org1', 'doc1', [1, 0, 0]),
      makeRecord('2', 'org1', 'doc1', [0.9, 0.1, 0]),
      makeRecord('3', 'org1', 'doc1', [0.8, 0.2, 0]),
    ]);

    const results = await store.search([1, 0, 0], {
      organizationId: 'org1',
      limit: 2,
    });
    expect(results).toHaveLength(2);
  });

  it('should delete by IDs', async () => {
    await store.upsert([
      makeRecord('1', 'org1', 'doc1', [1, 0, 0]),
      makeRecord('2', 'org1', 'doc1', [0, 1, 0]),
    ]);
    await store.delete(['1']);

    const results = await store.search([1, 0, 0], { organizationId: 'org1' });
    expect(results).toHaveLength(1);
  });

  it('should delete by document ID', async () => {
    await store.upsert([
      makeRecord('1', 'org1', 'doc1', [1, 0, 0]),
      makeRecord('2', 'org1', 'doc2', [0, 1, 0]),
    ]);
    await store.deleteByDocumentId('doc1', 'org1');

    const results = await store.search([1, 0, 0], { organizationId: 'org1' });
    expect(results).toHaveLength(1);
    expect(results[0].record.documentId).toBe('doc2');
  });

  it('should delete by organization', async () => {
    await store.upsert([
      makeRecord('1', 'org1', 'doc1', [1, 0, 0]),
      makeRecord('2', 'org2', 'doc2', [0, 1, 0]),
    ]);
    await store.deleteByOrganizationId('org1');

    const org1Results = await store.search([1, 0, 0], { organizationId: 'org1' });
    expect(org1Results).toHaveLength(0);

    const org2Results = await store.search([0, 1, 0], { organizationId: 'org2' });
    expect(org2Results).toHaveLength(1);
  });
});
