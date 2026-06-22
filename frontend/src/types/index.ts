export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface Document {
  id: string;
  title: string;
  sourceType: 'PDF' | 'URL';
  sourceRef: string;
  status: DocumentStatus;
  error?: string | null;
  createdAt: string;
}

export interface Citation {
  id: string;
  chunkId: string;
  documentId: string;
  order: number;
  chunk?: { content: string; chunkIndex: number };
}

export interface MessageStep {
  order: number;
  tool: string;
  input: string;
  outputSummary: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  modelUsed?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  steps?: MessageStep[];
  createdAt: string;
  citations?: Citation[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  conversationDocuments: { documentId: string }[];
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}

export interface RetrievedSource {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
}
