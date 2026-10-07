-- CreateTable
CREATE TABLE "ContactMail" (
    "id" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactReply" (
    "id" TEXT NOT NULL,
    "mailId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactMail_visitorHash_createdAt_idx" ON "ContactMail"("visitorHash", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMail_createdAt_idx" ON "ContactMail"("createdAt");

-- CreateIndex
CREATE INDEX "ContactReply_mailId_idx" ON "ContactReply"("mailId");

-- AddForeignKey
ALTER TABLE "ContactReply" ADD CONSTRAINT "ContactReply_mailId_fkey" FOREIGN KEY ("mailId") REFERENCES "ContactMail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
