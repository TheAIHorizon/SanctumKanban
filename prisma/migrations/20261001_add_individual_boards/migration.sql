-- Existing boards remain unchanged. Owner deletion preserves the board/work.
ALTER TABLE "Team" ADD COLUMN "individualOwnerId" TEXT;
CREATE UNIQUE INDEX "Team_classWorkspaceId_individualOwnerId_key"
  ON "Team"("classWorkspaceId", "individualOwnerId");
ALTER TABLE "Team" ADD CONSTRAINT "Team_individualOwnerId_fkey"
  FOREIGN KEY ("individualOwnerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
