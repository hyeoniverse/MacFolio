-- 비밀 글: 관리자에게만 보이는 글 표시
-- 기본값이 false인 열이라 기존 글은 그대로 공개되고, 배포를 되돌려도 앞 코드가 그대로 돈다
-- (앞 코드는 이 열을 읽지 않으므로 되돌린 동안에는 비밀 글도 방문자에게 보인다. docs/backend-design.md)

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "secret" BOOLEAN NOT NULL DEFAULT false;
