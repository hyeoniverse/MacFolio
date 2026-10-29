-- 연재 이름과 연재 안의 순서: 게시한 내용·임시 저장·버전에 하나씩. 모두 null을 허용하는 열이라 이전 코드와 함께 돌아간다
-- (게시본·임시본을 '모두 null이거나 모두 있음'으로 묶은 CHECK에는 넣지 않는다: 연재가 아닌 글은 늘 null)
ALTER TABLE "Post" ADD COLUMN "series" TEXT,
ADD COLUMN "seriesOrder" INTEGER,
ADD COLUMN "draftSeries" TEXT,
ADD COLUMN "draftSeriesOrder" INTEGER;

ALTER TABLE "PostRevision" ADD COLUMN "series" TEXT,
ADD COLUMN "seriesOrder" INTEGER;

-- 빈 이름 대신 null (API가 빈 칸을 null로 바꿔 저장한다), 순서는 1 이상
ALTER TABLE "Post" ADD CONSTRAINT "Post_series_not_blank" CHECK ("series" IS NULL OR length(btrim("series")) > 0),
ADD CONSTRAINT "Post_draftSeries_not_blank" CHECK ("draftSeries" IS NULL OR length(btrim("draftSeries")) > 0),
ADD CONSTRAINT "Post_seriesOrder_positive" CHECK ("seriesOrder" IS NULL OR "seriesOrder" >= 1),
ADD CONSTRAINT "Post_draftSeriesOrder_positive" CHECK ("draftSeriesOrder" IS NULL OR "draftSeriesOrder" >= 1);
