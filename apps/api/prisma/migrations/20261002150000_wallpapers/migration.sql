-- 관리자가 올린 배경화면 (시스템 설정). 이미지는 Upload에 있다
CREATE TABLE "Wallpaper" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "thumbId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Wallpaper_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Wallpaper_imageId_key" ON "Wallpaper"("imageId");
CREATE UNIQUE INDEX "Wallpaper_thumbId_key" ON "Wallpaper"("thumbId");
CREATE INDEX "Wallpaper_kind_createdAt_idx" ON "Wallpaper"("kind", "createdAt");

ALTER TABLE "Wallpaper" ADD CONSTRAINT "Wallpaper_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Wallpaper" ADD CONSTRAINT "Wallpaper_thumbId_fkey" FOREIGN KEY ("thumbId") REFERENCES "Upload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Wallpaper" ADD CONSTRAINT "Wallpaper_required_fields" CHECK (
  "kind" IN ('mac', 'ios')
  AND length(btrim("name")) BETWEEN 1 AND 40
);
