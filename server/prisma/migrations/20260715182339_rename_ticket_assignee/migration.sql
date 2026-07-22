/*
  Warnings:

  - You are about to drop the column `assignedToId` on the `ticket` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ticket" DROP CONSTRAINT "ticket_assignedToId_fkey";

-- DropIndex
DROP INDEX "ticket_assignedToId_idx";

-- AlterTable
ALTER TABLE "ticket" DROP COLUMN "assignedToId",
ADD COLUMN     "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "ticket_assigneeId_idx" ON "ticket"("assigneeId");

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
