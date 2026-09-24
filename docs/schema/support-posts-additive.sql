-- CreateTable
CREATE TABLE "SupportPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "steps" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "staffReply" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportPost_authorId_createdAt_idx" ON "SupportPost"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportPost_status_createdAt_idx" ON "SupportPost"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportPost" ADD CONSTRAINT "SupportPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

