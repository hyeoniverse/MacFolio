# @macfolio/api

MacFolio의 API 서버 (#9). NestJS + Prisma 7 + PostgreSQL.

## 로컬에서 돌리기

```bash
cp .env.example .env          # 처음 한 번
pnpm db:up                    # PostgreSQL (Docker)
pnpm dev                      # http://localhost:4000, 문서는 /docs
```

저장소 루트에서는 `pnpm dev:api`(API만), `pnpm dev:all`(프론트엔드 5173 + API 4000). 루트의 `pnpm dev`는 프론트엔드만 띄운다.

api까지 컨테이너로 띄우려면 `docker compose up --build`.

## 테스트

```bash
pnpm test                     # 단위 테스트 (DB 없이)
pnpm test:e2e                 # e2e (pnpm db:up 필요)
```

## 구조

- `src/app.setup.ts`: 서버와 e2e가 같이 쓰는 설정 (helmet, CORS, 입력 검증, 에러 모양, Swagger)
- `src/config.ts`: 환경 변수 검사. 잘못되면 시작하지 않는다
- `src/common/http-error.filter.ts`: 모든 에러를 `{ statusCode, error, message, path, timestamp }`로. 예상하지 못한 에러는 내용을 감춘다
- `prisma/schema.prisma`: 데이터 모델. 클라이언트는 `src/generated/prisma`에 만든다 (커밋하지 않음)
- `Dockerfile`: 멀티 스테이지, amd64·arm64 모두 빌드된다 (지금 배포 서버는 Oracle E2.1.Micro, amd64)

## 배포

Oracle Cloud VM에서 docker compose(db + api + cloudflared)로 띄운다. 순서와 환경 변수, 문제 해결은 [docs/deployment.md](../../docs/deployment.md).
