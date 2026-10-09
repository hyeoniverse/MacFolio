-- 서버 자원 사용률과 보낸 알림 (RESOURCE_MONITOR)
CREATE TABLE "ResourceSample" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpu" DOUBLE PRECISION NOT NULL,
    "memory" DOUBLE PRECISION NOT NULL,
    "network" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ResourceSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResourceSample_at_idx" ON "ResourceSample"("at");

CREATE TABLE "ResourceAlert" (
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "detail" TEXT NOT NULL,

    CONSTRAINT "ResourceAlert_pkey" PRIMARY KEY ("kind")
);
