CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "automatedResult" TEXT,
    "reason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationEvent" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Verification_documentId_key" ON "Verification"("documentId");
CREATE INDEX "Verification_sellerId_createdAt_idx" ON "Verification"("sellerId", "createdAt");
CREATE INDEX "Verification_status_updatedAt_idx" ON "Verification"("status", "updatedAt");
CREATE INDEX "VerificationEvent_verificationId_createdAt_idx" ON "VerificationEvent"("verificationId", "createdAt");

ALTER TABLE "Verification" ADD CONSTRAINT "Verification_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_verificationId_fkey"
FOREIGN KEY ("verificationId") REFERENCES "Verification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
