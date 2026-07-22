-- DropForeignKey
ALTER TABLE "reply" DROP CONSTRAINT "reply_authorId_fkey";

-- AlterTable
ALTER TABLE "reply" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ticket" ALTER COLUMN "status" SET DEFAULT 'new';

-- AddForeignKey
ALTER TABLE "reply" ADD CONSTRAINT "reply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
