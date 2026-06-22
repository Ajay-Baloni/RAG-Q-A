import { prisma } from '../../db/prisma';

interface UsageRow {
  modelUsed: string | null;
  promptTokens: number;
  completionTokens: number;
  count: number;
}

export interface UsageModelSummary {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  messages: number;
}

export interface UsageSummary {
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    messages: number;
  };
  byModel: UsageModelSummary[];
}

export function summarizeUsage(rows: UsageRow[]): UsageSummary {
  const byModel: UsageModelSummary[] = rows.map((r) => ({
    model: r.modelUsed ?? 'unknown',
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens: r.promptTokens + r.completionTokens,
    messages: r.count,
  }));

  const totals = byModel.reduce(
    (acc, m) => ({
      promptTokens: acc.promptTokens + m.promptTokens,
      completionTokens: acc.completionTokens + m.completionTokens,
      totalTokens: acc.totalTokens + m.totalTokens,
      messages: acc.messages + m.messages,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0, messages: 0 }
  );

  return { totals, byModel };
}

export async function getUsage(userId: string): Promise<UsageSummary> {
  const grouped = await prisma.message.groupBy({
    by: ['modelUsed'],
    where: { role: 'ASSISTANT', conversation: { userId } },
    _sum: { promptTokens: true, completionTokens: true },
    _count: { _all: true },
  });

  const rows: UsageRow[] = grouped.map((g) => ({
    modelUsed: g.modelUsed,
    promptTokens: g._sum.promptTokens ?? 0,
    completionTokens: g._sum.completionTokens ?? 0,
    count: g._count._all,
  }));

  return summarizeUsage(rows);
}
