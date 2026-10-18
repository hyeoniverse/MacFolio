-- 문서 파일 종류를 늘린다: PDF·그림(pdf, image) 말고도 문서·영상·소리·ZIP을 받는다 (종류 file, 열면 받기).
-- 규칙은 20261019100000_document_project_folders와 같고 kind만 바뀐다
ALTER TABLE "Document" DROP CONSTRAINT "Document_required_fields";

ALTER TABLE "Document" ADD CONSTRAINT "Document_required_fields" CHECK (
  ("folder" IN ('이력서', '포트폴리오', '자격증') OR "folder" ~ '^project:[a-z0-9][a-z0-9-]{0,39}$')
  AND (
    ("folder" = '이력서' AND "key" ~ '^resume/[^/]+$')
    OR ("folder" = '포트폴리오' AND "key" ~ '^portfolio/[^/]+$')
    OR ("folder" = '자격증' AND "key" ~ '^certificates/[^/]+$')
    OR ("folder" LIKE 'project:%' AND "key" LIKE 'projects/' || substr("folder", 9) || '/%'
        AND "key" ~ '^projects/[a-z0-9-]+/[^/]+$')
  )
  AND length(btrim("name")) BETWEEN 1 AND 100
  AND "kind" IN ('pdf', 'image', 'file')
  AND "size" BETWEEN 1 AND 20971520
);
