-- Migration: remove unused shareToken and sharedAt fields from Conversation
-- These fields were never referenced in application code

ALTER TABLE "conversations" DROP COLUMN IF EXISTS "share_token";
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "shared_at";
