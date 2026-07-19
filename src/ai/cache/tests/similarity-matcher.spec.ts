import { SimilarityMatcher } from '../services/similarity-matcher.service';
import { MemoryCacheProvider } from '../providers/memory-cache.provider';

describe('SimilarityMatcher', () => {
  let provider: MemoryCacheProvider;
  let matcher: SimilarityMatcher;

  beforeEach(() => {
    provider = new MemoryCacheProvider();
    matcher = new SimilarityMatcher(provider);
  });

  it('should find exact match', async () => {
    await provider.set('k1', 'What is the capital of France?', 'org-1', 'llm.response');
    const results = await matcher.findSimilar(
      'What is the capital of France?',
      'org-1',
      'llm.response',
    );
    expect(results.length).toBe(1);
    expect(results[0].score).toBe(1.0);
  });

  it('should find similar text', async () => {
    await provider.set('k1', 'What is the capital of France', 'org-1', 'llm.response');
    const results = await matcher.findSimilar('capital of France', 'org-1', 'llm.response', {
      minScore: 0.3,
    });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should return empty for no match', async () => {
    await provider.set('k1', 'Completely different content', 'org-1', 'llm.response');
    const results = await matcher.findSimilar('finance report Q4', 'org-1', 'llm.response', {
      minScore: 0.95,
    });
    expect(results.length).toBe(0);
  });

  it('should compute cosine similarity', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(matcher.cosineSimilarity(a, b)).toBe(1);

    const c = [1, 0, 0];
    const d = [0, 1, 0];
    expect(matcher.cosineSimilarity(c, d)).toBe(0);

    const e = [1, 2, 3];
    const f = [2, 4, 6];
    expect(matcher.cosineSimilarity(e, f)).toBeCloseTo(1, 5);
  });

  it('should compute text similarity with Jaccard', () => {
    const score = matcher.computeSimilarity('hello world foo', 'hello world bar');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('should give exact match score 1 for identical', () => {
    expect(matcher.computeSimilarity('same text', 'same text')).toBe(1);
  });

  it('should find similar by embedding', async () => {
    await provider.set('k1', { embedding: [1, 0, 0, 0] }, 'org-1', 'llm.embedding');
    await provider.set('k2', { embedding: [1, 0.1, 0, 0] }, 'org-1', 'llm.embedding');

    const results = await matcher.findSimilarByEmbedding([1, 0, 0, 0], 'org-1', 'llm.embedding', {
      minScore: 0.9,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0.9);
  });
});
