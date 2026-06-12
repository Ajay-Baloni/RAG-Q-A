-- Add retrieval-rank ordering to citations so [n] markers map to the right source.
ALTER TABLE "MessageCitation" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
