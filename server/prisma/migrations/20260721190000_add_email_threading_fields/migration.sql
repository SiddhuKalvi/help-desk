-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "messageId" TEXT;

-- AlterTable
ALTER TABLE "reply" ADD COLUMN     "inReplyTo" TEXT,
ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "references" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ticket_messageId_key" ON "ticket"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "reply_messageId_key" ON "reply"("messageId");
