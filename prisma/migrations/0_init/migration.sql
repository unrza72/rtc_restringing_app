-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" DATETIME,
    "status" TEXT DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "locale" TEXT,
    "inviteToken" TEXT,
    "onboardedAt" DATETIME
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Racket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "headSizeCm2" INTEGER,
    "stringPattern" TEXT,
    "gripSize" TEXT,
    "tensionMain" REAL,
    "tensionCross" REAL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Racket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClubString" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gauge" TEXT,
    "priceCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StringingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "racketId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "stringSource" TEXT NOT NULL,
    "clubStringId" TEXT,
    "ownStringName" TEXT,
    "tensionMain" REAL,
    "tensionCross" REAL,
    "neededBy" DATETIME,
    "memberNotes" TEXT,
    "tokenNumber" INTEGER,
    "activeToken" INTEGER,
    "operatorId" TEXT,
    "acceptedAt" DATETIME,
    "completedAt" DATETIME,
    "collectedAt" DATETIME,
    "operatorNotes" TEXT,
    "usedStringName" TEXT,
    "usedTensionMain" REAL,
    "usedTensionCross" REAL,
    "stringPriceCents" INTEGER,
    "labourPriceCents" INTEGER,
    "ownStringFeeCents" INTEGER,
    "paidAt" DATETIME,
    "paidById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StringingRequest_racketId_fkey" FOREIGN KEY ("racketId") REFERENCES "Racket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StringingRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StringingRequest_clubStringId_fkey" FOREIGN KEY ("clubStringId") REFERENCES "ClubString" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StringingRequest_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StringingRequest_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClubSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "tokenCount" INTEGER NOT NULL DEFAULT 20,
    "labourPriceCents" INTEGER,
    "ownStringFeeCents" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RequestEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StringingRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequestEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operatorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reimbursement_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reimbursement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedById" TEXT,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingPerson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ball" TEXT,
    "strength" REAL,
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrainingAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingAvailability_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TrainingPerson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "minGroupSize" INTEGER NOT NULL,
    "maxGroupSize" INTEGER NOT NULL,
    "strengthSpread" REAL NOT NULL,
    "sessionMinutes" INTEGER NOT NULL,
    "slotStepMinutes" INTEGER NOT NULL,
    "courtCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "ball" TEXT NOT NULL,
    "court" INTEGER NOT NULL,
    CONSTRAINT "TrainingGroup_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingGroup_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainingPerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    CONSTRAINT "TrainingGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingGroupMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TrainingPerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingPlanUnplaced" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    CONSTRAINT "TrainingPlanUnplaced_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingPlanUnplaced_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TrainingPerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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

