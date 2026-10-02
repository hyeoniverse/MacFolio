-- 방문자 쿠키로 사람을 가린다 (이름·비밀번호를 받지 않는다).
-- 예전 댓글은 visitorHash가 없어서 관리자만 지운다.
ALTER TABLE "PostComment" ADD COLUMN "visitorHash" TEXT;

-- 방문자 댓글은 비밀번호(예전 댓글) 대신 방문자 해시(새 댓글)가 있으면 된다
ALTER TABLE "PostComment" DROP CONSTRAINT "PostComment_required_fields";
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_required_fields" CHECK (
  length(btrim("name")) BETWEEN 1 AND 20
  AND length(btrim("body")) BETWEEN 1 AND 500
  AND ("isAdmin" OR "passwordHash" IS NOT NULL OR "visitorHash" IS NOT NULL)
);

-- 메시지 앱의 피드백과 답글 (지금까지는 브라우저에만 저장했다)
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "visitorHash" TEXT NOT NULL,
    "ipPrefix" TEXT,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuestMessage_threadId_createdAt_idx" ON "GuestMessage"("threadId", "createdAt");

ALTER TABLE "GuestMessage" ADD CONSTRAINT "GuestMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 이름·내용은 비지 않고, 내용은 500자까지 (서버가 먼저 검사하지만 DB에 바로 써도 지킨다)
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_required_fields" CHECK (
  length(btrim("title")) BETWEEN 1 AND 20
);
ALTER TABLE "GuestMessage" ADD CONSTRAINT "GuestMessage_required_fields" CHECK (
  length(btrim("name")) BETWEEN 1 AND 20
  AND length(btrim("body")) BETWEEN 1 AND 500
);
