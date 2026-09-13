-- Add per-class Student Resources and one shared note per team.
-- This artifact is intentionally not applied automatically.

CREATE TABLE "ClassResource" (
    "id" TEXT NOT NULL,
    "classWorkspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamNote" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassResource_classWorkspaceId_key_key" ON "ClassResource"("classWorkspaceId", "key");
CREATE UNIQUE INDEX "TeamNote_teamId_key" ON "TeamNote"("teamId");

ALTER TABLE "ClassResource"
ADD CONSTRAINT "ClassResource_classWorkspaceId_fkey"
FOREIGN KEY ("classWorkspaceId") REFERENCES "ClassWorkspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamNote"
ADD CONSTRAINT "TeamNote_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
