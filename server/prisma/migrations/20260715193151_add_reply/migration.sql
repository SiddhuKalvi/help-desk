-- CreateEnum
CREATE TYPE "ReplySenderType" AS ENUM ('agent', 'customer');

-- CreateTable
CREATE TABLE "reply" (
    "id" SERIAL NOT NULL,
    "body" TEXT NOT NULL,
    "senderType" "ReplySenderType" NOT NULL DEFAULT 'agent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticketId" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "reply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reply_ticketId_idx" ON "reply"("ticketId");

-- AddForeignKey
ALTER TABLE "reply" ADD CONSTRAINT "reply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reply" ADD CONSTRAINT "reply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
