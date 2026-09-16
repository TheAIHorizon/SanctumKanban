-- Add the server-managed timestamp for the current DONE interval.
-- Existing DONE tickets intentionally remain empty because their actual
-- historical completion time cannot be inferred from other timestamps.
ALTER TABLE "Ticket" ADD COLUMN "completedAt" TIMESTAMP(3);
