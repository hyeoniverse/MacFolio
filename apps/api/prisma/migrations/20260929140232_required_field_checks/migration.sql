-- 필수 항목을 DB에서도 막는다. 화면과 API가 먼저 막지만, 그 둘을 거치지 않은 쓰기(스크립트, 버그)도 막기 위해서다.
-- Prisma 스키마로는 CHECK 제약을 적을 수 없어서 마이그레이션 SQL로 둔다.

-- 블로그 글: 지운 표시가 아니면 제목(100자까지)·날짜(YYYY-MM-DD)·폴더·본문이 비어 있으면 안 된다
ALTER TABLE "Post" ADD CONSTRAINT "Post_required_fields" CHECK (
  "deleted" OR (
    length(btrim("title")) BETWEEN 1 AND 100
    AND "date" ~ '^\d{4}-\d{2}-\d{2}$'
    AND length(btrim("category")) > 0
    AND length(btrim("body")) > 0
  )
);

-- 댓글: 이름(20자까지)과 내용(500자까지)은 비어 있으면 안 된다. 방문자 댓글은 비밀번호 해시가 있어야 한다
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_required_fields" CHECK (
  length(btrim("name")) BETWEEN 1 AND 20
  AND length(btrim("body")) BETWEEN 1 AND 500
  AND ("isAdmin" OR "passwordHash" IS NOT NULL)
);
