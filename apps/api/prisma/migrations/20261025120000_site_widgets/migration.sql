-- 관리자가 고른 위젯 기본값 ({ photoAlbum }). 없으면 화면이 코드의 기본값(모든 앨범)을 쓴다.
-- 비워 둘 수 있는 칸이라 이전 코드(이 칸을 모르는 버전)와 함께 동작한다
ALTER TABLE "SiteContent" ADD COLUMN "widgets" JSONB;
