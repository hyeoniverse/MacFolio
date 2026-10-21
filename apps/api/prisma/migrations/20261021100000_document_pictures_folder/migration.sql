-- 홈 › 그림에 올린 파일은 그림 폴더(키 pictures/…)에 둔다. 사진 위젯이 이 그림을 보여 준다.
-- 규칙은 20261019140000_document_desktop_folder와 같고 폴더 값 '그림'만 더한다
ALTER TABLE "Document" DROP CONSTRAINT "Document_required_fields";

ALTER TABLE "Document" ADD CONSTRAINT "Document_required_fields" CHECK (
  ("folder" IN ('이력서', '포트폴리오', '자격증', '데스크탑', '그림') OR "folder" ~ '^project:[a-z0-9][a-z0-9-]{0,39}$')
  AND (
    ("folder" = '이력서' AND "key" ~ '^resume/[^/]+$')
    OR ("folder" = '포트폴리오' AND "key" ~ '^portfolio/[^/]+$')
    OR ("folder" = '자격증' AND "key" ~ '^certificates/[^/]+$')
    OR ("folder" = '데스크탑' AND "key" ~ '^desktop/[^/]+$')
    OR ("folder" = '그림' AND "key" ~ '^pictures/[^/]+$')
    OR ("folder" LIKE 'project:%' AND "key" LIKE 'projects/' || substr("folder", 9) || '/%'
        AND "key" ~ '^projects/[a-z0-9-]+/[^/]+$')
  )
  AND length(btrim("name")) BETWEEN 1 AND 100
  AND "kind" IN ('pdf', 'image', 'file')
  AND "size" BETWEEN 1 AND 20971520
);
