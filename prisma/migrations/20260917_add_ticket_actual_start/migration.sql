-- Track the first server-observed transition into DOING and whether its
-- calendar start was supplied automatically. Existing rows remain unknown.
ALTER TABLE "Ticket"
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "startDateAutoFilled" BOOLEAN NOT NULL DEFAULT false;