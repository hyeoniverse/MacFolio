-- 프로젝트 폴더 (Finder › 프로젝트 › <프로젝트>)에도 파일을 올린다.
-- 폴더 값은 세 문서 폴더(이력서·포트폴리오·자격증) 또는 project:<프로젝트 id>, 키는 폴더와 맞아야 한다
ALTER TABLE "Document" DROP CONSTRAINT "Document_required_fields";

ALTER TABLE "Document" ADD CONSTRAINT "Document_required_fields" CHECK (
  -- 폴더: 세 문서 폴더, 또는 프로젝트 폴더 project:<프로젝트 id>
  ("folder" IN ('이력서', '포트폴리오', '자격증') OR "folder" ~ '^project:[a-z0-9][a-z0-9-]{0,39}$')
  -- 키: <폴더 영어 이름>/<파일> 또는 projects/<프로젝트 id>/<파일>
  AND (
    ("folder" = '이력서' AND "key" ~ '^resume/[^/]+$')
    OR ("folder" = '포트폴리오' AND "key" ~ '^portfolio/[^/]+$')
    OR ("folder" = '자격증' AND "key" ~ '^certificates/[^/]+$')
    OR ("folder" LIKE 'project:%' AND "key" LIKE 'projects/' || substr("folder", 9) || '/%'
        AND "key" ~ '^projects/[a-z0-9-]+/[^/]+$')
  )
  AND length(btrim("name")) BETWEEN 1 AND 100
  AND "kind" IN ('pdf', 'image')
  AND "size" BETWEEN 1 AND 20971520
);
