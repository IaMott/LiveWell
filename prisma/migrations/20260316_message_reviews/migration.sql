-- Migration: replace UserFeedback with MessageReview (isolated study table)
-- and remove userFeedback field from AgentPerformanceLog

-- 1. Drop old user_feedbacks table
DROP TABLE IF EXISTS "user_feedbacks";

-- 2. Remove userFeedback column from agent_performance_logs
ALTER TABLE "agent_performance_logs" DROP COLUMN IF EXISTS "user_feedback";

-- 3. Create message_reviews (isolated — no FK to user tables)
CREATE TABLE "message_reviews" (
  "id"              TEXT         NOT NULL,
  "user_hash"       TEXT         NOT NULL,
  "message_id"      TEXT         NOT NULL,
  "conversation_id" TEXT         NOT NULL,
  "agent_id"        TEXT,
  "agent_name"      TEXT,
  "domain"          TEXT,
  "rating"          INTEGER      NOT NULL,
  "comment"         TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "message_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_reviews_user_hash_message_id_key" ON "message_reviews"("user_hash", "message_id");
CREATE INDEX "message_reviews_agent_id_rating_idx"  ON "message_reviews"("agent_id", "rating");
CREATE INDEX "message_reviews_domain_rating_idx"    ON "message_reviews"("domain", "rating");
CREATE INDEX "message_reviews_created_at_idx"       ON "message_reviews"("created_at");
