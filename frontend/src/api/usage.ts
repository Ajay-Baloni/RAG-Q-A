import { apiFetch } from "../lib/apiClient";

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

export function getUsage() {
  return apiFetch<{ usage: UsageSummary }>("/api/usage");
}
