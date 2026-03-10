-- CreateTable
CREATE TABLE "agent_workspaces" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "round1_proposal" JSONB,
  "round2_proposal" JSONB,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_workspaces_conversation_id_agent_id_key"
  ON "agent_workspaces"("conversation_id", "agent_id");

-- CreateIndex
CREATE INDEX "agent_workspaces_user_id_conversation_id_updated_at_idx"
  ON "agent_workspaces"("user_id", "conversation_id", "updated_at");

-- AddForeignKey
ALTER TABLE "agent_workspaces"
  ADD CONSTRAINT "agent_workspaces_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_workspaces"
  ADD CONSTRAINT "agent_workspaces_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
