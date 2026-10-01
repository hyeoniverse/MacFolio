-- 지운 때. '최근 삭제된 항목'에서 30일 동안 되살릴 수 있다.
-- 이미 지운 글은 비워 둔다 (영구히 지운 것으로 본다: 최근 삭제된 항목에 나오지 않는다)
ALTER TABLE "Post" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- 지운 때는 지운 글에만 있다
ALTER TABLE "Post" ADD CONSTRAINT "Post_deleted_at" CHECK ("deletedAt" IS NULL OR "deleted");
