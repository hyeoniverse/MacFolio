-- CreateTable
CREATE TABLE "MemoOrganization" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "MemoOrganization_pkey" PRIMARY KEY ("id")
);
