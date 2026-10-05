# 멀티 스테이지 빌드. node 공식 이미지라 amd64·arm64 모두 된다 (지금 배포 서버는 Oracle E2.1.Micro, amd64).
# 저장소 루트를 context로 빌드한다: docker build -f apps/api/Dockerfile .
# 배포 이미지는 GitHub Actions가 만들어 GHCR에 올린다 (.github/workflows/ci.yml의 api-image, #100). APP_VERSION에 커밋을 넣는다

# ─── 1. 빌드: 의존성을 모두 설치하고 컴파일한다 ───
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @macfolio/api...
COPY apps/api apps/api
RUN pnpm --filter @macfolio/api build
# 실행에 필요한 것만 따로 모은다 (개발 의존성 제외)
RUN pnpm --filter @macfolio/api deploy --prod --legacy /out

# ─── 2. 실행: 컴파일 결과와 실행 의존성만 ───
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./
COPY --from=build /repo/apps/api/dist ./dist
# 시작할 때 마이그레이션을 적용한다 (Prisma CLI, 스키마, 마이그레이션 파일)
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/prisma.config.ts ./
USER node
EXPOSE 4000
# 컨테이너가 살아 있고 DB에 닿는지. 배포 스크립트(ops/deploy.sh)가 healthy가 될 때까지 기다린다.
# 시작할 때 마이그레이션이 먼저 돌아서 start-period를 넉넉히 둔다
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=3 \
	CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" >/dev/null || exit 1
# 이 이미지를 만든 커밋 (/health의 version). 자주 바뀌는 값이라 맨 끝에 둬서 위의 층은 캐시를 쓴다
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
