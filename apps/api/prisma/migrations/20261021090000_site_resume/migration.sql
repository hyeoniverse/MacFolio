-- 관리자가 저장한 이력서 Markdown ({ markdown }). 없으면 화면이 코드의 기본 이력서를 쓴다
ALTER TABLE "SiteContent" ADD COLUMN "resume" JSONB;
