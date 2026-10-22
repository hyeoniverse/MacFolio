-- 검색어: 검색엔진이 넘겨준 방문의 검색어, Google Search Console에서 가져온 검색어
-- 새 열은 비워 둘 수 있고 새 표는 앞 코드가 쓰지 않아, 배포를 되돌려도 앞 코드가 그대로 돈다

-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN "searchTerm" TEXT;

-- CreateTable
CREATE TABLE "SearchQueryStat" (
    "day" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SearchQueryStat_pkey" PRIMARY KEY ("day","query","page")
);

-- CreateIndex
CREATE INDEX "SearchQueryStat_day_idx" ON "SearchQueryStat"("day");
