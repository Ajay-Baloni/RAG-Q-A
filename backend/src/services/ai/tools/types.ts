import type { RetrievedChunk } from '../../../db/vectorSearch';

export interface ToolContext {
  userId: string;
  documentIds: string[];
}

export interface ToolResult {
  /** Short human-readable result, shown in the UI trace and fed back to the model. */
  summary: string;
  /** Only set by search_documents — retrieved chunks for citation accumulation. */
  chunks?: RetrievedChunk[];
}

export interface Tool {
  name: string;
  description: string;
  /** JSON Schema object describing the tool's arguments. */
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
