export type CacheCategory =
  | 'llm.response'
  | 'llm.embedding'
  | 'rag.retrieval'
  | 'rag.knowledge'
  | 'agent.output'
  | 'workflow.result'
  | 'mcp.tool'
  | 'document.parse'
  | 'prompt.result'
  | 'conversation.summary';

export const CACHE_CATEGORIES: CacheCategory[] = [
  'llm.response',
  'llm.embedding',
  'rag.retrieval',
  'rag.knowledge',
  'agent.output',
  'workflow.result',
  'mcp.tool',
  'document.parse',
  'prompt.result',
  'conversation.summary',
];
