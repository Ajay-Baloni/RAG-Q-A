import type { Tool } from './types';
import { embedText } from '../embeddings';
import { searchSimilarChunks } from '../../../db/vectorSearch';

export const searchDocumentsTool: Tool = {
  name: 'search_documents',
  description:
    "Search the user's uploaded documents for passages relevant to a query. " +
    'Returns the most relevant excerpts. Call multiple times with refined queries to gather more information.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural-language search query' },
    },
    required: ['query'],
  },
  async execute(args, ctx) {
    const query = String(args.query ?? '').trim();
    const embedding = await embedText(query);
    const chunks = await searchSimilarChunks(embedding, ctx.documentIds);
    const summary = chunks.length
      ? `Found ${chunks.length} relevant excerpt(s) for "${query}".`
      : `No relevant excerpts found for "${query}".`;
    return { summary, chunks };
  },
};
