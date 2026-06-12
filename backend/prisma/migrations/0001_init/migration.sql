-- Enable pgvector (Neon supports this on the free tier)
CREATE EXTENSION IF NOT EXISTS vector;

-- User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Document
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- Chunk (embedding is a pgvector column)
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Chunk_documentId_idx" ON "Chunk"("documentId");

-- Approximate-nearest-neighbour index for cosine similarity search
CREATE INDEX "Chunk_embedding_hnsw_idx"
    ON "Chunk" USING hnsw ("embedding" vector_cosine_ops);

-- Conversation
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- ConversationDocument (many-to-many join)
CREATE TABLE "ConversationDocument" (
    "conversationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    CONSTRAINT "ConversationDocument_pkey" PRIMARY KEY ("conversationId", "documentId")
);
CREATE INDEX "ConversationDocument_documentId_idx" ON "ConversationDocument"("documentId");

-- Message
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "modelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- MessageCitation
CREATE TABLE "MessageCitation" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageCitation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MessageCitation_messageId_idx" ON "MessageCitation"("messageId");

-- Foreign keys
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationDocument" ADD CONSTRAINT "ConversationDocument_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationDocument" ADD CONSTRAINT "ConversationDocument_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageCitation" ADD CONSTRAINT "MessageCitation_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageCitation" ADD CONSTRAINT "MessageCitation_chunkId_fkey"
    FOREIGN KEY ("chunkId") REFERENCES "Chunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
