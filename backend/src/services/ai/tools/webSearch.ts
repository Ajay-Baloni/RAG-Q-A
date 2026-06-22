import type { Tool } from './types';
import { env } from '../../../config/env';

interface TavilyResponse {
  answer?: string;
  results?: { title: string; url: string; content: string }[];
}

export const webSearchTool: Tool = {
  name: 'web_search',
  description:
    "Search the public web for current information NOT found in the user's documents. " +
    'Use only when the documents do not contain the answer.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Web search query' },
    },
    required: ['query'],
  },
  async execute(args) {
    const query = String(args.query ?? '').trim();
    if (!env.TAVILY_API_KEY) return { summary: 'Web search is not configured.' };

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: env.TAVILY_API_KEY,
          query,
          max_results: 3,
          include_answer: true,
        }),
      });
      if (!res.ok) return { summary: `Web search failed (HTTP ${res.status}).` };

      const data = (await res.json()) as TavilyResponse;
      const lines = (data.results ?? [])
        .map((r) => `- ${r.title} (${r.url}): ${r.content.slice(0, 200)}`)
        .join('\n');
      const answer = data.answer ? `${data.answer}\n` : '';
      return {
        summary: `Web results for "${query}":\n${answer}${lines || 'No results.'}`,
      };
    } catch {
      return { summary: 'Web search failed (network error).' };
    }
  },
};
