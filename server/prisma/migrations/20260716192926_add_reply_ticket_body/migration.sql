-- AlterTable
ALTER TABLE "reply" ADD COLUMN     "ticketBody" TEXT;

-- Backfill existing rows with a snapshot of their ticket's current body
UPDATE "reply"
SET "ticketBody" = "ticket"."body"
FROM "ticket"
WHERE "ticket"."id" = "reply"."ticketId";

-- Now that all rows are backfilled, enforce NOT NULL
ALTER TABLE "reply" ALTER COLUMN "ticketBody" SET NOT NULL;
