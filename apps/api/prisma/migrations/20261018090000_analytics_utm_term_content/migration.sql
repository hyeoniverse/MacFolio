-- 분석 이벤트에 utm_term·utm_content (#211). 비어 있는 열이라 지난 행은 그대로 둔다
ALTER TABLE "AnalyticsEvent" ADD COLUMN "utmTerm" TEXT,
ADD COLUMN "utmContent" TEXT;
