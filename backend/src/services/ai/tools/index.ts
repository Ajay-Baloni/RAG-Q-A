import type { Tool } from './types';
import { searchDocumentsTool } from './searchDocuments';
import { webSearchTool } from './webSearch';
import { calculatorTool } from './calculator';

export type { Tool, ToolContext, ToolResult } from './types';

export const TOOLS: Tool[] = [searchDocumentsTool, webSearchTool, calculatorTool];

export function getTool(name: string): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}
