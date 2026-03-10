-- Migration: add_agent_workspaces
-- Adds per-agent persistent memory to support stateful multi-agent orchestration.

CREATE TABLE "agent_workspaces" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "memory" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_workspaces_user_id_agent_id_key"
    ON "agent_workspaces"("user_id", "agent_id");

CREATE INDEX "agent_workspaces_user_id_updated_at_idx"
    ON "agent_workspaces"("user_id", "updated_at");

ALTER TABLE "agent_workspaces"
    ADD CONSTRAINT "agent_workspaces_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
