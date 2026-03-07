-- Migration: add role to users, tracker models, file/artifact models, geo preference
-- This migration is additive-only (no destructive changes).

-- Add role column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'USER';

-- Body metric entries (health tracker)
CREATE TABLE IF NOT EXISTS "body_metric_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "body_metric_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "body_metric_entries_user_id_recorded_at_idx" ON "body_metric_entries"("user_id", "recorded_at");
ALTER TABLE "body_metric_entries" ADD CONSTRAINT "body_metric_entries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Meals (nutrition tracker)
CREATE TABLE IF NOT EXISTS "meals" (
    "id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "meal_type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "meals_created_by_user_id_date_idx" ON "meals"("created_by_user_id", "date");
ALTER TABLE "meals" ADD CONSTRAINT "meals_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workout plans
CREATE TABLE IF NOT EXISTS "workout_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weekly_days" INTEGER NOT NULL,
    "sessions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workout_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "workout_plans_user_id_idx" ON "workout_plans"("user_id");
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workout sessions (training tracker)
CREATE TABLE IF NOT EXISTS "workout_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "duration_min" INTEGER NOT NULL,
    "perceived_effort" INTEGER,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "workout_sessions_user_id_date_idx" ON "workout_sessions"("user_id", "date");
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "workout_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mindfulness entries
CREATE TABLE IF NOT EXISTS "mindfulness_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mood" INTEGER,
    "stress" INTEGER,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mindfulness_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mindfulness_entries_user_id_created_at_idx" ON "mindfulness_entries"("user_id", "created_at");
ALTER TABLE "mindfulness_entries" ADD CONSTRAINT "mindfulness_entries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- File assets (uploads with extracted text)
CREATE TABLE IF NOT EXISTS "file_assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT,
    "extracted_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "file_assets_user_id_idx" ON "file_assets"("user_id");
CREATE INDEX IF NOT EXISTS "file_assets_conversation_id_idx" ON "file_assets"("conversation_id");
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recommendation artifacts (AI-generated plans / recommendations)
CREATE TABLE IF NOT EXISTS "recommendation_artifacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "related_conversation_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content_markdown" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recommendation_artifacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recommendation_artifacts_user_id_created_at_idx" ON "recommendation_artifacts"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "recommendation_artifacts_related_conversation_id_idx" ON "recommendation_artifacts"("related_conversation_id");
ALTER TABLE "recommendation_artifacts" ADD CONSTRAINT "recommendation_artifacts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_artifacts" ADD CONSTRAINT "recommendation_artifacts_related_conversation_id_fkey"
    FOREIGN KEY ("related_conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Geo preferences (privacy-first, opt-in)
CREATE TABLE IF NOT EXISTS "geo_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "lat_coarse" DOUBLE PRECISION,
    "lon_coarse" DOUBLE PRECISION,
    "accuracy" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "geo_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "geo_preferences_user_id_key" ON "geo_preferences"("user_id");
ALTER TABLE "geo_preferences" ADD CONSTRAINT "geo_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
