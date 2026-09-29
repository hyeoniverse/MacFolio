-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- 이름과 크기(1바이트~10MB)는 비어 있거나 넘치면 안 된다
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_required_fields" CHECK (
  length(btrim("name")) BETWEEN 1 AND 200
  AND length("type") > 0
  AND "size" BETWEEN 1 AND 10485760
  AND octet_length("data") = "size"
);
