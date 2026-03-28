-- AddColumn caseStatus on conversations
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "case_status" TEXT NOT NULL DEFAULT 'active';

-- AddColumn casePriority on conversations
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "case_priority" TEXT NOT NULL DEFAULT 'normal';

-- AddColumn replyToMessageId on messages (nullable FK, self-referential)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_message_id" TEXT;

ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_fkey"
  FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

-- Index for reply threading queries
CREATE INDEX IF NOT EXISTS "messages_conversation_id_reply_to_message_id_idx"
  ON "messages"("conversation_id", "reply_to_message_id");
