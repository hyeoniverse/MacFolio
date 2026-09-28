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

| 명령             | 설명                          |
| ---------------- | ----------------------------- |
| `pnpm dev`       | 개발 서버                     |
| `pnpm build`     | 모든 패키지 타입 체크 후 빌드 |
| `pnpm typecheck` | 타입 체크만 실행              |
| `pnpm test`      | 테스트 실행                   |

## 구조

```
apps/
  react/          # 데스크톱 UI (Vite + React)
packages/         # 앱 간에 공유하는 패키지
```

## 블로그 글 쓰기

메모 앱이 블로그입니다. `apps/react/src/apps/memo/content/`에 Markdown 파일을 추가하면 글이 됩니다. 파일 이름이 글의 주소 이름이 됩니다(예: `my-first-post.md`).

```md
---
title: 글 제목
date: 2026-09-28
category: 회고
summary: 목록에 보일 한 줄 요약 (없으면 본문 앞부분)
---

본문은 Markdown으로 씁니다. 표, 코드 블록, 링크를 쓸 수 있습니다.

![이미지 설명](./images/사진.png '이미지 아래 캡션 (선택)')
```

- `title`과 `date`(YYYY-MM-DD)는 필수입니다. 없거나 형식이 틀리면 목록에서 빠지고, 개발 서버 콘솔에 경고가 나옵니다.
- `category`는 왼쪽 폴더가 됩니다. `개발기/MacFolio`처럼 `/`로 하위 폴더를 만들 수 있고, 상위 폴더를 고르면 하위 폴더의 글까지 보입니다. 없으면 "기타"로 들어갑니다.
- 갤러리로 보기에서는 본문의 첫 이미지가 카드 미리보기가 됩니다. 이미지가 없으면 본문 앞부분이 보입니다.
- 이미지는 `content/images/`에 넣고 글 파일 기준 상대 경로로 씁니다. 에디터의 Markdown 미리보기에서도 그대로 보입니다. `public/` 경로(`/imgs/...`)와 외부 주소도 쓸 수 있습니다.
- `pnpm dev`로 띄우면 저장할 때마다 바로 반영되고, main에 머지하면 자동으로 배포됩니다.

## CRA → Vite 마이그레이션

deprecated된 Create React App에서 Vite로 옮겼습니다.

| 항목           | CRA      | Vite     |
| -------------- | -------- | -------- |
| dev 서버 시작  | 5.05초   | 0.58초   |
| 프로덕션 빌드  | 6.33초   | 1.88초   |
| JS 번들 (gzip) | 138.2 KB | 127.7 KB |
| 설치 패키지 수 | 1,438개  | 171개    |

측정 방법과 전환 과정은 [docs/migration-cra-to-vite.md](docs/migration-cra-to-vite.md)에 정리했습니다.

## 로드맵

아키텍처 결정과 앞으로의 계획은 [#8](https://github.com/hyeoniverse/MacFolio/issues/8)에서 관리합니다.
