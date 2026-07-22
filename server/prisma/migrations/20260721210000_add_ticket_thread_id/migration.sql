-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "threadId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ticket_threadId_key" ON "ticket"("threadId");
