-- DropIndex
DROP INDEX "Chunk_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "promptTokens" INTEGER;

-- CreateTable
CREATE TABLE "MessageStep" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TOOL_CALL',
    "tool" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "outputSummary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageStep_messageId_idx" ON "MessageStep"("messageId");

-- AddForeignKey
ALTER TABLE "MessageStep" ADD CONSTRAINT "MessageStep_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
