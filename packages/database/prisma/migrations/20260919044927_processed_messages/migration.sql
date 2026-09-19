-- CreateTable
CREATE TABLE "processed_messages" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_messages_queue_processed_at_idx" ON "processed_messages"("queue", "processed_at");
