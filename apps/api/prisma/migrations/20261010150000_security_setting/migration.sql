-- CreateTable
CREATE TABLE "SecuritySetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "contactHuman" BOOLEAN NOT NULL DEFAULT true,
    "commentHuman" BOOLEAN NOT NULL DEFAULT false,
    "messageHuman" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SecuritySetting_pkey" PRIMARY KEY ("id")
);
