import { RankerService } from '../retrieval/ranker.service';
import { DocumentChunk } from '../dto/chunk.dto';

describe('RankerService', () => {
  let ranker: RankerService;

  const makeChunk = (id: string): DocumentChunk => ({
    id,
    documentId: 'd1',
    organizationId: 'org1',
    version: 1,
    content: `content ${id}`,
    metadata: { source: 'upload' },
    tokenEstimate: 10,
    index: 0,
    createdAt: new Date().toISOString(),
  });

  beforeEach(() => {
    ranker = new RankerService();
  });

  it('should rank results by score descending', async () => {
    const results = await ranker.rank([
      { chunk: makeChunk('a'), score: 0.5 },
      { chunk: makeChunk('b'), score: 0.9 },
      { chunk: makeChunk('c'), score: 0.7 },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].score).toBe(0.9);
    expect(results[1].score).toBe(0.7);
    expect(results[2].score).toBe(0.5);
  });

  it('should assign rank numbers', async () => {
    const results = await ranker.rank([
      { chunk: makeChunk('a'), score: 0.9 },
      { chunk: makeChunk('b'), score: 0.5 },
    ]);

    expect(results[0].rank).toBe(1);
    expect(results[1].rank).toBe(2);
  });

  it('should respect topK limit', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      chunk: makeChunk(`c${i}`),
      score: i / 10,
    }));

    const results = await ranker.rank(items, 3);
    expect(results).toHaveLength(3);
  });

  it('should rerank by source priority', async () => {
    const results = await ranker.rank([
      { chunk: { ...makeChunk('a'), metadata: { source: 'upload' } }, score: 0.5 },
      { chunk: { ...makeChunk('b'), metadata: { source: 'website' } }, score: 0.4 },
    ]);

    const reranked = ranker.rerankBySourcePriority(results, { website: 0.2 });
    expect(reranked[0].chunk.id).toBe('b');
  });
});
