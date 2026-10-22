-- 처음 게시한 때: 같은 날 글의 순서를 정한다 (publishedAt은 게시할 때마다 바뀐다)
-- 새 열은 비워 둘 수 있어, 배포를 되돌려도 앞 코드가 그대로 돈다

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "firstPublishedAt" TIMESTAMP(3);

-- 이미 게시한 글은 남은 버전 중 가장 이른 때로 채운다 (버전은 최근 50개만 남아, 마지막 게시 시각과 견줘 이른 쪽)
UPDATE "Post" p
SET "firstPublishedAt" = LEAST(p."publishedAt", (SELECT MIN(r."createdAt") FROM "PostRevision" r WHERE r."postSlug" = p."slug"))
WHERE p."publishedAt" IS NOT NULL;
