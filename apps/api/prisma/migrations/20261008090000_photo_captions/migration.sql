-- 사진 앱의 캡션 (#21): 관리자가 고친 것만 사진 주소로 덮는다. 길이는 src/photos/rules.ts와 같다
CREATE TABLE "PhotoCaption" (
    "src" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "PhotoCaption_pkey" PRIMARY KEY ("src"),
    CONSTRAINT "PhotoCaption_src_length" CHECK (char_length("src") BETWEEN 1 AND 500),
    CONSTRAINT "PhotoCaption_caption_length" CHECK (char_length("caption") BETWEEN 1 AND 200)
);
