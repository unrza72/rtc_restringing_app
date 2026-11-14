-- CreateTable
CREATE TABLE "MemberAuditEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "targetId" TEXT,
    "targetName" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberAuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MemberAuditEntry_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MemberAuditEntry_createdAt_idx" ON "MemberAuditEntry"("createdAt");

-- CreateIndex
CREATE INDEX "MemberAuditEntry_targetId_createdAt_idx" ON "MemberAuditEntry"("targetId", "createdAt");
