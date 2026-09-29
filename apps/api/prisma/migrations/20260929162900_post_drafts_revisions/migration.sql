-- 임시 저장과 버전 기록, 예약 발행.
-- 게시한 내용(title…body)과 임시 저장(draft…)을 나누고, 게시할 때마다 PostRevision에 남긴다.

-- 옛 필수 항목 제약은 게시한 내용이 늘 있다고 가정해서 먼저 뺀다
ALTER TABLE "Post" DROP CONSTRAINT "Post_required_fields";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "draftBody" TEXT,
ADD COLUMN     "draftCategory" TEXT,
ADD COLUMN     "draftDate" TEXT,
ADD COLUMN     "draftSummary" TEXT,
ADD COLUMN     "draftTitle" TEXT,
ADD COLUMN     "draftUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "date" DROP NOT NULL,
ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "summary" DROP NOT NULL,
ALTER COLUMN "summary" DROP DEFAULT,
ALTER COLUMN "body" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PostRevision" (
    "id" SERIAL NOT NULL,
    "postSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "PostRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostRevision_postSlug_createdAt_idx" ON "PostRevision"("postSlug", "createdAt");

-- AddForeignKey
ALTER TABLE "PostRevision" ADD CONSTRAINT "PostRevision_postSlug_fkey" FOREIGN KEY ("postSlug") REFERENCES "Post"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- 지금 있는 글: 지운 표시는 내용을 비우고, 나머지는 게시한 글로 보고 첫 버전을 남긴다
UPDATE "Post" SET "title" = NULL, "date" = NULL, "category" = NULL, "summary" = NULL, "body" = NULL WHERE "deleted";
UPDATE "Post" SET "publishedAt" = "updatedAt" WHERE NOT "deleted";
INSERT INTO "PostRevision" ("postSlug", "title", "date", "category", "summary", "body", "createdAt", "createdBy")
SELECT "slug", "title", "date", "category", COALESCE("summary", ''), "body", "updatedAt", "updatedBy" FROM "Post" WHERE NOT "deleted";

-- 게시한 내용: 모두 비었거나(게시한 적 없음), 모두 규칙에 맞는다
ALTER TABLE "Post" ADD CONSTRAINT "Post_published_fields" CHECK (
  ("title" IS NULL AND "date" IS NULL AND "category" IS NULL AND "summary" IS NULL AND "body" IS NULL AND "publishedAt" IS NULL)
  OR (
    -- NULL이 섞이면 식 전체가 NULL이 되어 제약을 통과하므로, 비지 않았는지 먼저 따진다
    "title" IS NOT NULL AND "date" IS NOT NULL AND "category" IS NOT NULL AND "body" IS NOT NULL
    AND length(btrim("title")) BETWEEN 1 AND 100
    AND "date" ~ '^\d{4}-\d{2}-\d{2}$'
    AND length(btrim("category")) > 0
    AND "summary" IS NOT NULL
    AND length(btrim("body")) > 0
    AND "publishedAt" IS NOT NULL
  )
);

-- 임시 저장: 모두 비었거나, 모두 규칙에 맞는다
ALTER TABLE "Post" ADD CONSTRAINT "Post_draft_fields" CHECK (
  ("draftTitle" IS NULL AND "draftDate" IS NULL AND "draftCategory" IS NULL AND "draftSummary" IS NULL AND "draftBody" IS NULL AND "draftUpdatedAt" IS NULL)
  OR (
    "draftTitle" IS NOT NULL AND "draftDate" IS NOT NULL AND "draftCategory" IS NOT NULL AND "draftBody" IS NOT NULL
    AND length(btrim("draftTitle")) BETWEEN 1 AND 100
    AND "draftDate" ~ '^\d{4}-\d{2}-\d{2}$'
    AND length(btrim("draftCategory")) > 0
    AND "draftSummary" IS NOT NULL
    AND length(btrim("draftBody")) > 0
    AND "draftUpdatedAt" IS NOT NULL
  )
);

-- 지운 표시가 아니면 게시한 내용이나 임시 저장 중 하나는 있어야 한다
ALTER TABLE "Post" ADD CONSTRAINT "Post_has_content" CHECK ("deleted" OR "title" IS NOT NULL OR "draftTitle" IS NOT NULL);

-- 버전: 게시한 내용과 같은 규칙
ALTER TABLE "PostRevision" ADD CONSTRAINT "PostRevision_required_fields" CHECK (
  length(btrim("title")) BETWEEN 1 AND 100
  AND "date" ~ '^\d{4}-\d{2}-\d{2}$'
  AND length(btrim("category")) > 0
  AND length(btrim("body")) > 0
);
