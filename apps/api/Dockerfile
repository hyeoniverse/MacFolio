# 멀티 스테이지 빌드. 배포 서버가 ARM(Oracle Ampere A1)이라 node 공식 이미지(amd64·arm64 모두 있음)를 쓴다.
# 저장소 루트를 context로 빌드한다: docker build -f apps/api/Dockerfile .

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
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
