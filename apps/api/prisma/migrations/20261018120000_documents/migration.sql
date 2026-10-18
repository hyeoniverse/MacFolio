-- Finder의 문서 파일 (이력서·포트폴리오·자격증). 파일은 R2에 있고 여기에는 목록만 둔다
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Document_key_key" ON "Document"("key");
CREATE INDEX "Document_folder_createdAt_idx" ON "Document"("folder", "createdAt");

ALTER TABLE "Document" ADD CONSTRAINT "Document_required_fields" CHECK (
  "folder" IN ('이력서', '포트폴리오', '자격증')
  AND length(btrim("name")) BETWEEN 1 AND 100
  AND "kind" IN ('pdf', 'image')
  AND "size" BETWEEN 1 AND 20971520
);
