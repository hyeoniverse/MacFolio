<div align="center">

# MacFolio

**macOS 데스크톱을 웹으로 옮긴 포트폴리오**

Dock에서 앱을 열고, 창을 끌어 옮기고, 메모 앱에서 블로그를 읽습니다.<br>
휴대폰으로 열면 iOS 홈 화면이 됩니다.

[**macfolio.hyeoniverse.com**](https://macfolio.hyeoniverse.com) · [API 문서](https://macfolio-api.hyeoniverse.com/docs) · [로드맵](https://github.com/hyeoniverse/MacFolio/issues/8)

[![CI](https://github.com/hyeoniverse/MacFolio/actions/workflows/ci.yml/badge.svg)](https://github.com/hyeoniverse/MacFolio/actions/workflows/ci.yml)
![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-e0234e?logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169e1?logo=postgresql&logoColor=white)

<img src="docs/images/desktop.jpg" alt="MacFolio 데스크톱 화면. 메뉴 막대, 메모 앱 창, 아래쪽 Dock" width="100%">

</div>

## 둘러보기

<table>
  <tr>
    <td width="50%"><img src="apps/react/src/apps/memo/content/images/memo-editor.jpg" alt="메모 앱 편집기"></td>
    <td width="50%"><img src="apps/react/src/apps/memo/content/images/messages-bubbles.jpg" alt="메시지 앱"></td>
  </tr>
  <tr>
    <td><b>메모 = 블로그</b><br>폴더·갤러리 보기, 검색과 찾기·대치. 관리자로 로그인하면 글이 곧 편집기가 되고, 임시 저장·게시·버전 기록을 남깁니다.</td>
    <td><b>메시지 = 방명록</b><br>이름과 비밀번호만으로 피드백을 남기고 답글을 답니다.</td>
  </tr>
  <tr>
    <td><img src="apps/react/src/apps/memo/content/images/comments.jpg" alt="블로그 댓글"></td>
    <td><img src="apps/react/src/apps/memo/content/images/admin-signed-in.jpg" alt="시스템 설정의 계정 화면"></td>
  </tr>
  <tr>
    <td><b>댓글</b><br>로그인 없이 쓰고 같은 비밀번호로 지웁니다. 서버에는 비밀번호 해시와 IP의 HMAC만 남습니다.</td>
    <td><b>관리자 로그인</b><br>GitHub OAuth로 내 계정만 들여보냅니다. 비밀번호가 없고, DB에는 세션 토큰의 해시만 둡니다.</td>
  </tr>
  <tr>
    <td><img src="apps/react/src/apps/memo/content/images/mobile-devices.jpg" alt="iPhone과 Android에서 본 홈 화면"></td>
    <td><img src="apps/react/src/apps/memo/content/images/sproutfarm-window.jpg" alt="새싹 농장 게임 창"></td>
  </tr>
  <tr>
    <td><b>모바일</b><br>휴대폰에서는 iOS 홈 화면과 위젯, 제어 센터 스와이프로 바뀝니다.</td>
    <td><b>프로젝트</b><br>배포한 게임(새싹 농장)을 창 안에서 바로 실행합니다. Safari, GitHub 앱에서 다른 프로젝트를 봅니다.</td>
  </tr>
</table>

## 사용법

### 방문자

| 하고 싶은 것       | 방법                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------- |
| 앱 열기            | Dock의 아이콘을 누릅니다. 터미널에서 `open memo`처럼 열 수도 있습니다                        |
| 창 다루기          | 제목 막대를 끌어 옮기고, 가장자리를 끌어 크기를 바꿉니다. 🔴 닫기 · 🟡 최소화 · 🟢 전체 화면 |
| 블로그 읽기        | 메모 앱. 왼쪽 폴더로 좁히고, 위의 버튼으로 목록/갤러리를 바꾸고, 검색 칸에서 찾습니다        |
| 피드백 남기기      | 메시지 앱에서 이름·비밀번호·내용을 적습니다. 같은 비밀번호로 지울 수 있습니다                |
| 저에 대해 알아보기 | 터미널에서 `help`, `about`, `skills`, `projects`, `contact`                                  |
| 화면 바꾸기        | 시스템 설정 → 화면 모드(라이트·다크), 배경화면                                               |

휴대폰에서는 홈 화면의 아이콘을 누르고, 아래쪽 막대를 위로 쓸어 올려 홈으로 돌아갑니다. 위에서 아래로 쓸면 제어 센터가 열립니다. 터미널은 명령을 눌러 실행하는 **단축어**로 바뀝니다.

### 관리자

1. 데스크톱은 **메뉴 막대 왼쪽의 Apple 메뉴 → 관리자 로그인**, 휴대폰은 **암호** 앱에서 GitHub로 로그인합니다.
2. 메모 앱에서 글을 누르면 바로 고칠 수 있습니다. 고치는 동안은 임시 저장만 되고, **게시**해야 방문자에게 보입니다. 미래 날짜로 게시하면 예약됩니다.
3. 폴더 만들기·이름 바꾸기, 글 옮기기(끌어 놓기), 고정, 댓글 지우기도 로그인했을 때만 됩니다.
4. 로그인 상태와 세션은 **시스템 설정 → 계정**에서 봅니다. 세션은 12시간입니다.

화면의 편집 버튼을 숨기는 것은 안내일 뿐이고, 권한은 서버가 요청마다 확인합니다.

## 기술 스택

| 영역       | 사용한 것                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------- |
| 프론트엔드 | React 19, TypeScript, Vite, Milkdown(편집기), react-markdown                              |
| 백엔드     | NestJS, Prisma 7, PostgreSQL, Swagger                                                     |
| 모노레포   | pnpm workspaces, Turborepo                                                                |
| 테스트     | Vitest(단위), Playwright(E2E: 데스크톱·iPhone·Android), supertest(API e2e)                |
| 배포       | Cloudflare Workers(프론트엔드), Oracle Cloud VM + Docker Compose + Cloudflare Tunnel(API) |
| CI         | GitHub Actions: 포맷 → 린트 → 타입 체크 → 테스트 → 빌드 → API e2e → E2E                   |

## 구조

```
apps/
  react/                  데스크톱 UI (Vite + React)
    src/apps/             앱마다 폴더 하나 (manifest.ts가 앱 목록의 단일 출처)
    src/apps/memo/content 블로그 글 (Markdown)
    src/desktop/          창 관리, Dock, 메뉴 막대, 모바일 셸
    e2e/                  Playwright
  api/                    NestJS API (관리자 로그인, 글, 댓글, 이미지, 메모 정리)
docs/                     배포, 마이그레이션 기록
wrangler.jsonc            Cloudflare Workers 설정
```

## 로컬에서 실행

Node 22와 pnpm이 필요합니다(버전은 `.node-version`과 `package.json`에 고정).

```bash
corepack enable
pnpm install
pnpm dev          # 프론트엔드만: http://localhost:5173
```

설정 없이 바로 뜹니다. API가 없으면 로그인과 편집만 꺼지고, 블로그는 저장소의 Markdown으로 보입니다.

API까지 띄우려면 Docker가 필요합니다.

```bash
cp apps/api/.env.example apps/api/.env          # GitHub OAuth 값은 개발용 OAuth App으로
echo 'VITE_API_URL=http://localhost:4000' > apps/react/.env.local
pnpm --filter @macfolio/api db:up                # PostgreSQL
pnpm dev:all                                     # 프론트엔드 5173 + API 4000 (문서: /docs)
```

| 명령                                     | 설명                           |
| ---------------------------------------- | ------------------------------ |
| `pnpm dev`                               | 프론트엔드 개발 서버           |
| `pnpm dev:api`                           | API 개발 서버                  |
| `pnpm dev:all`                           | 둘 다                          |
| `pnpm build`                             | 모든 패키지 빌드               |
| `pnpm typecheck`                         | 타입 체크                      |
| `pnpm lint`                              | 린트                           |
| `pnpm test`                              | 단위 테스트                    |
| `pnpm --filter @macfolio/api test:e2e`   | API e2e (DB 필요)              |
| `pnpm --filter @macfolio/react test:e2e` | 브라우저 E2E (`pnpm build` 후) |

## 블로그 글 쓰기

두 가지 방법이 있습니다.

- **사이트에서:** 관리자로 로그인해 메모 앱에서 바로 씁니다. 글은 서버(DB)에 저장되고, 저장소의 글을 고치면 같은 주소로 서버 글이 대신 보입니다.
- **저장소에서:** `apps/react/src/apps/memo/content/`에 Markdown 파일을 추가합니다. 파일 이름이 글의 주소 이름이 됩니다(예: `my-first-post.md`). main에 머지하면 배포됩니다.

```md
---
title: 글 제목
date: 2026-09-28
category: 개발기/MacFolio
summary: 목록에 보일 한 줄 요약 (없으면 본문 앞부분)
pinned: true # 목록 맨 위에 고정 (선택)
---

본문은 Markdown으로 씁니다. 표, 코드 블록, 링크를 쓸 수 있습니다.

![이미지 설명](./images/사진.png '이미지 아래 캡션 (선택)')
```

- `title`과 `date`(YYYY-MM-DD)는 필수입니다. 없거나 형식이 틀리면 목록에서 빠지고, 개발 서버 콘솔에 경고가 나옵니다.
- `category`는 왼쪽 폴더가 됩니다. `/`로 하위 폴더를 만들 수 있고, 상위 폴더를 고르면 하위 폴더의 글까지 보입니다. 없으면 "기타"로 들어갑니다.
- 이미지는 `content/images/`에 넣고 글 파일 기준 상대 경로로 씁니다. 갤러리 보기에서는 본문의 첫 이미지가 카드 미리보기가 됩니다.

## 배포

| 무엇       | 어디에                                               | 어떻게                           |
| ---------- | ---------------------------------------------------- | -------------------------------- |
| 프론트엔드 | Cloudflare Workers                                   | main에 머지하면 자동             |
| API        | Oracle Cloud Always Free VM (Docker Compose)         | 서버에서 `git pull` 후 다시 빌드 |
| HTTPS      | Cloudflare Tunnel (서버는 SSH 말고 포트를 열지 않음) |                                  |

VM 만들기부터 OAuth App, 터널, 환경 변수, 문제 해결까지 [docs/deployment.md](docs/deployment.md)에 정리했습니다.

## CRA → Vite 마이그레이션

deprecated된 Create React App에서 Vite로 옮겼습니다.

| 항목           | CRA      | Vite     |
| -------------- | -------- | -------- |
| dev 서버 시작  | 5.05초   | 0.58초   |
| 프로덕션 빌드  | 6.33초   | 1.88초   |
| JS 번들 (gzip) | 138.2 KB | 127.7 KB |
| 설치 패키지 수 | 1,438개  | 171개    |

측정 방법과 전환 과정은 [docs/migration-cra-to-vite.md](docs/migration-cra-to-vite.md)에 정리했습니다.

## 문서

- [작업 규칙](CONTRIBUTING.md): 브랜치, 커밋, 이슈, PR
- [배포](docs/deployment.md): Cloudflare Workers, Oracle VM, Cloudflare Tunnel, GitHub OAuth
- [CRA → Vite 마이그레이션](docs/migration-cra-to-vite.md)
- [API](apps/api/README.md): 로컬 실행, 테스트, 구조
- 개발기: 사이트의 메모 앱 → 개발기 폴더 (`apps/react/src/apps/memo/content/`)

## 로드맵

아키텍처 결정과 앞으로의 계획은 [#8](https://github.com/hyeoniverse/MacFolio/issues/8)에서 관리합니다.
