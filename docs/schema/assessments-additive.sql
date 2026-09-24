-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classWorkspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "questions" JSONB,
    "answers" JSONB,
    "score" INTEGER,
    "error" TEXT,
    "model" TEXT,
    "promptVersion" TEXT NOT NULL,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvalMethod" TEXT,
    "references" TEXT,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assessment_studentId_classWorkspaceId_createdAt_idx" ON "Assessment"("studentId", "classWorkspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Assessment_status_createdAt_idx" ON "Assessment"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_classWorkspaceId_fkey" FOREIGN KEY ("classWorkspaceId") REFERENCES "ClassWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

