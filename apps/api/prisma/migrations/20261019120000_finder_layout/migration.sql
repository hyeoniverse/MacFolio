-- CreateTable
CREATE TABLE "FinderLayout" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "FinderLayout_pkey" PRIMARY KEY ("id")
);
