-- GitHub 앱의 Pinned에 보일 저장소 (시스템 설정 → GitHub). 한 행만 쓴다
CREATE TABLE "GithubShowcase" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "repos" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "GithubShowcase_pkey" PRIMARY KEY ("id")
);
