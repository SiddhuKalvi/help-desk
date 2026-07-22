-- AlterTable
ALTER TABLE "public"."ticket" ADD COLUMN     "assignedToId" TEXT;

-- CreateIndex
CREATE INDEX "ticket_assignedToId_idx" ON "public"."ticket"("assignedToId" ASC);

-- AddForeignKey
ALTER TABLE "public"."ticket" ADD CONSTRAINT "ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
