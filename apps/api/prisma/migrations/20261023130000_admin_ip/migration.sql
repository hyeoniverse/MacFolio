-- 관리자가 쓰는 IP (HMAC만): 그 IP에서 온 방문은 세지 않는다
-- 새 표는 앞 코드가 쓰지 않아, 배포를 되돌려도 앞 코드가 그대로 돈다

-- CreateTable
CREATE TABLE "AdminIp" (
    "ipHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminIp_pkey" PRIMARY KEY ("ipHash")
);

-- CreateIndex
CREATE INDEX "AdminIp_lastSeenAt_idx" ON "AdminIp"("lastSeenAt");
