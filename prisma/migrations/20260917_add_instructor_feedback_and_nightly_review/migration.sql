-- Add instructor feedback categories.
CREATE TYPE "InstructorFeedbackCategory" AS ENUM ('GUIDANCE', 'NEEDS_ATTENTION', 'ACTION_REQUIRED');

-- Add nightly review configuration to class workspaces.
ALTER TABLE "ClassWorkspace"
  ADD COLUMN "nightlyReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "nightlyReviewHour" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "nightlyReviewTimezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  ADD COLUMN "nightlyReviewRequestedAt" TIMESTAMP(3),
  ADD COLUMN "nightlyReviewLastRunAt" TIMESTAMP(3),
  ADD COLUMN "nightlyReviewLastRunDate" TEXT,
  ADD COLUMN "nightlyReviewLastError" TEXT,
  ADD COLUMN "nightlyReviewLastSummary" JSONB;

CREATE TABLE "InstructorFeedback" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "ticketId" TEXT,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" "InstructorFeedbackCategory" NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructorFeedbackReply" (
  "id" TEXT NOT NULL,
  "feedbackId" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorFeedbackReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructorFeedbackAcknowledgment" (
  "id" TEXT NOT NULL,
  "feedbackId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorFeedbackAcknowledgment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamFeedbackRead" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readThrough" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamFeedbackRead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketAiGuidance" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "model" TEXT,
  "mode" TEXT NOT NULL,
  "guidance" JSONB NOT NULL,
  "tasks" JSONB NOT NULL,
  "candidateCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastAttemptAt" TIMESTAMP(3) NOT NULL,
  "nextRetryAt" TIMESTAMP(3),
  CONSTRAINT "TicketAiGuidance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NightlyReviewLease" (
  "id" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NightlyReviewLease_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstructorFeedback_teamId_createdAt_idx" ON "InstructorFeedback"("teamId", "createdAt");
CREATE INDEX "InstructorFeedback_teamId_pinned_createdAt_idx" ON "InstructorFeedback"("teamId", "pinned", "createdAt");
CREATE INDEX "InstructorFeedback_ticketId_idx" ON "InstructorFeedback"("ticketId");
CREATE INDEX "InstructorFeedback_authorId_idx" ON "InstructorFeedback"("authorId");
CREATE INDEX "InstructorFeedbackReply_feedbackId_createdAt_idx" ON "InstructorFeedbackReply"("feedbackId", "createdAt");
CREATE INDEX "InstructorFeedbackReply_authorId_idx" ON "InstructorFeedbackReply"("authorId");
CREATE UNIQUE INDEX "InstructorFeedbackAcknowledgment_feedbackId_userId_key" ON "InstructorFeedbackAcknowledgment"("feedbackId", "userId");
CREATE INDEX "InstructorFeedbackAcknowledgment_userId_idx" ON "InstructorFeedbackAcknowledgment"("userId");
CREATE UNIQUE INDEX "TeamFeedbackRead_teamId_userId_key" ON "TeamFeedbackRead"("teamId", "userId");
CREATE INDEX "TeamFeedbackRead_userId_idx" ON "TeamFeedbackRead"("userId");
CREATE UNIQUE INDEX "TicketAiGuidance_ticketId_inputHash_key" ON "TicketAiGuidance"("ticketId", "inputHash");
CREATE INDEX "TicketAiGuidance_nextRetryAt_idx" ON "TicketAiGuidance"("nextRetryAt");
CREATE INDEX "NightlyReviewLease_expiresAt_idx" ON "NightlyReviewLease"("expiresAt");

ALTER TABLE "InstructorFeedback" ADD CONSTRAINT "InstructorFeedback_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstructorFeedback" ADD CONSTRAINT "InstructorFeedback_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstructorFeedback" ADD CONSTRAINT "InstructorFeedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstructorFeedbackReply" ADD CONSTRAINT "InstructorFeedbackReply_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "InstructorFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstructorFeedbackReply" ADD CONSTRAINT "InstructorFeedbackReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InstructorFeedbackAcknowledgment" ADD CONSTRAINT "InstructorFeedbackAcknowledgment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "InstructorFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstructorFeedbackAcknowledgment" ADD CONSTRAINT "InstructorFeedbackAcknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamFeedbackRead" ADD CONSTRAINT "TeamFeedbackRead_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamFeedbackRead" ADD CONSTRAINT "TeamFeedbackRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketAiGuidance" ADD CONSTRAINT "TicketAiGuidance_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
