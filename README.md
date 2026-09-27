# MacFolio

macOS 데스크톱을 웹으로 구현한 포트폴리오입니다. Dock에서 앱을 열고, 창을 옮기고, 최소화할 수 있습니다.

- **앱:** Safari, Music, Memo, GitHub, Blog, Mail
- **스택:** React 19, TypeScript, Vite, pnpm workspaces + Turborepo, Cloudflare Workers
- **주소:** https://macfolio.hyeoniverse.com

## 실행

```bash
corepack enable   # package.json에 고정된 pnpm 버전을 사용
pnpm install
pnpm dev
```

설정 없이 바로 실행됩니다. Memo는 브라우저 localStorage에 저장됩니다. 에셋을 다른 곳(CDN 등)에서 불러오려면 `apps/react/.env.example`을 `apps/react/.env`로 복사해 경로를 채우세요.

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 모든 패키지 타입 체크 후 빌드 |
| `pnpm typecheck` | 타입 체크만 실행 |
| `pnpm test` | 테스트 실행 |

## 구조

```
apps/
  react/          # 데스크톱 UI (Vite + React)
packages/         # 앱 간에 공유하는 패키지
```

## CRA → Vite 마이그레이션

deprecated된 Create React App에서 Vite로 옮겼습니다.

| 항목 | CRA | Vite |
| --- | --- | --- |
| dev 서버 시작 | 5.05초 | 0.58초 |
| 프로덕션 빌드 | 6.33초 | 1.88초 |
| JS 번들 (gzip) | 138.2 KB | 127.7 KB |
| 설치 패키지 수 | 1,438개 | 171개 |

측정 방법과 전환 과정은 [docs/migration-cra-to-vite.md](docs/migration-cra-to-vite.md)에 정리했습니다.

## 로드맵

아키텍처 결정과 앞으로의 계획은 [#8](https://github.com/hyeoniverse/MacFolio/issues/8)에서 관리합니다.
