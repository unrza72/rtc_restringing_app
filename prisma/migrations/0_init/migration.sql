-- PostgreSQL baseline: the whole schema as of the switch from SQLite.
-- The SQLite migrations before it live in git history.

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "status" TEXT DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "locale" TEXT,
    "inviteToken" TEXT,
    "onboardedAt" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Racket" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "headSizeCm2" INTEGER,
    "stringPattern" TEXT,
    "gripSize" TEXT,
    "tensionMain" DOUBLE PRECISION,
    "tensionCross" DOUBLE PRECISION,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Racket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubString" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gauge" TEXT,
    "priceCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubString_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StringingRequest" (
    "id" TEXT NOT NULL,
    "racketId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "stringSource" TEXT NOT NULL,
    "clubStringId" TEXT,
    "ownStringName" TEXT,
    "tensionMain" DOUBLE PRECISION,
    "tensionCross" DOUBLE PRECISION,
    "neededBy" TIMESTAMP(3),
    "memberNotes" TEXT,
    "tokenNumber" INTEGER,
    "activeToken" INTEGER,
    "operatorId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "operatorNotes" TEXT,
    "usedStringName" TEXT,
    "usedTensionMain" DOUBLE PRECISION,
    "usedTensionCross" DOUBLE PRECISION,
    "stringPriceCents" INTEGER,
    "labourPriceCents" INTEGER,
    "rakeCents" INTEGER,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StringingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tokenCount" INTEGER NOT NULL DEFAULT 20,
    "labourPriceCents" INTEGER,
    "rakeCents" INTEGER,
    "paymentRecipient" TEXT,
    "paymentIban" TEXT,
    "paymentBic" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberAuditEntry" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "targetId" TEXT,
    "targetName" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberAuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ball" TEXT,
    "strength" DOUBLE PRECISION,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAvailability" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "minGroupSize" INTEGER NOT NULL,
    "maxGroupSize" INTEGER NOT NULL,
    "strengthSpread" DOUBLE PRECISION NOT NULL,
    "sessionMinutes" INTEGER NOT NULL,
    "slotStepMinutes" INTEGER NOT NULL,
    "courtCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGroup" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "ball" TEXT NOT NULL,
    "court" INTEGER NOT NULL,

    CONSTRAINT "TrainingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,

    CONSTRAINT "TrainingGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlanUnplaced" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "TrainingPlanUnplaced_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "Racket_ownerId_idx" ON "Racket"("ownerId");

-- CreateIndex
CREATE INDEX "ClubString_active_sortOrder_idx" ON "ClubString"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StringingRequest_activeToken_key" ON "StringingRequest"("activeToken");

-- CreateIndex
CREATE INDEX "StringingRequest_status_createdAt_idx" ON "StringingRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StringingRequest_requesterId_idx" ON "StringingRequest"("requesterId");

-- CreateIndex
CREATE INDEX "StringingRequest_operatorId_idx" ON "StringingRequest"("operatorId");

-- CreateIndex
CREATE INDEX "StringingRequest_racketId_idx" ON "StringingRequest"("racketId");

-- CreateIndex
CREATE INDEX "RequestEvent_requestId_createdAt_idx" ON "RequestEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "Reimbursement_operatorId_createdAt_idx" ON "Reimbursement"("operatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE INDEX "Invite_createdById_createdAt_idx" ON "Invite"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "MemberAuditEntry_createdAt_idx" ON "MemberAuditEntry"("createdAt");

-- CreateIndex
CREATE INDEX "MemberAuditEntry_targetId_createdAt_idx" ON "MemberAuditEntry"("targetId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingPerson_kind_archived_name_idx" ON "TrainingPerson"("kind", "archived", "name");

-- CreateIndex
CREATE INDEX "TrainingAvailability_personId_weekday_startMin_idx" ON "TrainingAvailability"("personId", "weekday", "startMin");

-- CreateIndex
CREATE INDEX "TrainingPlan_createdAt_idx" ON "TrainingPlan"("createdAt");

-- CreateIndex
CREATE INDEX "TrainingGroup_planId_weekday_startMin_idx" ON "TrainingGroup"("planId", "weekday", "startMin");

-- CreateIndex
CREATE INDEX "TrainingGroupMember_personId_idx" ON "TrainingGroupMember"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingGroupMember_groupId_personId_key" ON "TrainingGroupMember"("groupId", "personId");

-- CreateIndex
CREATE INDEX "TrainingPlanUnplaced_personId_idx" ON "TrainingPlanUnplaced"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlanUnplaced_planId_personId_key" ON "TrainingPlanUnplaced"("planId", "personId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Racket" ADD CONSTRAINT "Racket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StringingRequest" ADD CONSTRAINT "StringingRequest_racketId_fkey" FOREIGN KEY ("racketId") REFERENCES "Racket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StringingRequest" ADD CONSTRAINT "StringingRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StringingRequest" ADD CONSTRAINT "StringingRequest_clubStringId_fkey" FOREIGN KEY ("clubStringId") REFERENCES "ClubString"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StringingRequest" ADD CONSTRAINT "StringingRequest_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StringingRequest" ADD CONSTRAINT "StringingRequest_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StringingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAuditEntry" ADD CONSTRAINT "MemberAuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAuditEntry" ADD CONSTRAINT "MemberAuditEntry_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAvailability" ADD CONSTRAINT "TrainingAvailability_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TrainingPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainingPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGroupMember" ADD CONSTRAINT "TrainingGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGroupMember" ADD CONSTRAINT "TrainingGroupMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TrainingPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlanUnplaced" ADD CONSTRAINT "TrainingPlanUnplaced_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlanUnplaced" ADD CONSTRAINT "TrainingPlanUnplaced_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TrainingPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

