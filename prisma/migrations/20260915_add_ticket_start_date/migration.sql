-- Add an optional planned calendar start date for Gantt scheduling.
-- Existing tickets intentionally remain NULL; no start date is inferred.
ALTER TABLE "Ticket" ADD COLUMN "startDate" DATE;
