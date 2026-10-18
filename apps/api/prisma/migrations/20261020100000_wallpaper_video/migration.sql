-- 배경화면으로 MP4 동영상을 올릴 수 있게 한 파일의 크기 한도를 30MB로 늘린다.
-- 이미지·첨부의 10MB 한도는 API가 그대로 지키고, 30MB까지는 배경화면 동영상만 받는다
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_required_fields";
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_required_fields" CHECK (
  length(btrim("name")) BETWEEN 1 AND 200
  AND length("type") > 0
  AND "size" BETWEEN 1 AND 31457280
  AND octet_length("data") = "size"
);
