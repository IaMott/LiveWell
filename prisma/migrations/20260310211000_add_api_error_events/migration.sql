-- CreateTable
CREATE TABLE "api_error_events" (
  "id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "error_code" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "message" TEXT,
  "request_id" TEXT,
  "user_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_error_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_error_events_endpoint_created_at_idx"
  ON "api_error_events"("endpoint", "created_at");

-- CreateIndex
CREATE INDEX "api_error_events_error_code_created_at_idx"
  ON "api_error_events"("error_code", "created_at");

-- CreateIndex
CREATE INDEX "api_error_events_status_code_created_at_idx"
  ON "api_error_events"("status_code", "created_at");

-- CreateIndex
CREATE INDEX "api_error_events_user_id_created_at_idx"
  ON "api_error_events"("user_id", "created_at");
