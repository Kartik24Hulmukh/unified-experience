BEGIN;
-- Existing Prisma model permits system audit events, but the original SQL did not.
ALTER TABLE "audit_logs" ALTER COLUMN "actor_id" DROP NOT NULL;
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- OTP attempt tracking existed in Prisma but not in any committed migration.
ALTER TABLE "otps" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "client_id" VARCHAR(36) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_received_at_idx" ON "analytics_events"("received_at");

-- CreateIndex
CREATE INDEX "analytics_events_name_received_at_idx" ON "analytics_events"("name", "received_at");

-- CreateIndex
CREATE INDEX "messages_request_id_created_at_id_idx" ON "messages"("request_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_request_id_sender_id_client_id_key" ON "messages"("request_id", "sender_id", "client_id");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
