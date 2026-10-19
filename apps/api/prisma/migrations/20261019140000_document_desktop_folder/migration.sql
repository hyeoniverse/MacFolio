-- 바탕화면에 바로 놓은 파일은 데스크탑 폴더(키 desktop/…)에 둔다 (예전에는 포트폴리오에 넣고 자리만 바탕화면으로 적었다).
-- 규칙은 20261019130000_document_any_file과 같고 폴더 값 '데스크탑'만 더한다
ALTER TABLE "Document" DROP CONSTRAINT "Document_required_fields";

ALTER TABLE "Document" ADD CONSTRAINT "Document_required_fields" CHECK (
  ("folder" IN ('이력서', '포트폴리오', '자격증', '데스크탑') OR "folder" ~ '^project:[a-z0-9][a-z0-9-]{0,39}$')
  AND (
    ("folder" = '이력서' AND "key" ~ '^resume/[^/]+$')
    OR ("folder" = '포트폴리오' AND "key" ~ '^portfolio/[^/]+$')
    OR ("folder" = '자격증' AND "key" ~ '^certificates/[^/]+$')
    OR ("folder" = '데스크탑' AND "key" ~ '^desktop/[^/]+$')
    OR ("folder" LIKE 'project:%' AND "key" LIKE 'projects/' || substr("folder", 9) || '/%'
        AND "key" ~ '^projects/[a-z0-9-]+/[^/]+$')
  )
  AND length(btrim("name")) BETWEEN 1 AND 100
  AND "kind" IN ('pdf', 'image', 'file')
  AND "size" BETWEEN 1 AND 20971520
);
