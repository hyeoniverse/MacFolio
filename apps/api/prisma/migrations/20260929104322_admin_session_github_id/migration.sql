-- 관리자 확인을 계정 이름 대신 바뀌지 않는 GitHub 숫자 ID로 한다.
-- 기존 세션에는 ID가 없으므로 지운다 (관리자는 다시 로그인하면 된다).
DELETE FROM "AdminSession";

-- AlterTable
ALTER TABLE "AdminSession" ADD COLUMN "githubId" INTEGER NOT NULL;
