-- CreateTable
CREATE TABLE "tool_audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "tool_call_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "input_summary" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_audit_logs_user_id_created_at_idx" ON "tool_audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "tool_audit_logs_conversation_id_created_at_idx" ON "tool_audit_logs"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "tool_audit_logs_request_id_idx" ON "tool_audit_logs"("request_id");

-- AddForeignKey
ALTER TABLE "tool_audit_logs" ADD CONSTRAINT "tool_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_audit_logs" ADD CONSTRAINT "tool_audit_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
