-- Migration: add_user_attributes
-- Adds the UserAttribute time-series table for agent-driven dynamic data.
-- Run: npx prisma migrate deploy  OR  npx prisma db push

-- CreateTable
CREATE TABLE "user_attributes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "source" TEXT NOT NULL DEFAULT 'agent',
    "conversation_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_attributes_pkey" PRIMARY KEY ("id")
);

-- AddIndex: query by (userId, domain, key) in recency order
CREATE INDEX "user_attributes_user_id_domain_key_recorded_at_idx"
    ON "user_attributes"("user_id", "domain", "key", "recorded_at");

-- AddIndex: query latest value for a key across all domains
CREATE INDEX "user_attributes_user_id_key_recorded_at_idx"
    ON "user_attributes"("user_id", "key", "recorded_at");

-- AddForeignKey
ALTER TABLE "user_attributes"
    ADD CONSTRAINT "user_attributes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddIndex on messages.created_at for cross-conversation history queries
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at");
