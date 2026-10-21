# 김정현

**웹 개발자 · 프론트엔드 중심 풀스택**

> 화면에서 서버까지, 끝까지 만들고 운영하는 개발자

hyeoniverse.dev@gmail.com · github.com/hyeoniverse · macfolio.hyeoniverse.com

## 강점

- **끝까지 운영** — 기획·디자인부터 서버·배포까지 1인 개발한 서비스 2개를 실제 도메인에서 운영
- **검증된 코드만 배포** — PR마다 타입 검사·테스트·e2e·보안 스캔을 통과해야 배포되는 파이프라인
- **보안 전공 배경** — 정보보호학과 출신, DB 권한 정책·IP 익명화로 데이터 노출을 미리 차단

## 할 수 있는 일

- **화면 개발** — 상태가 많은 화면을 컴포넌트·훅 단위로 나눠 만들고, 서버 상태와 전역 상태를 분리해 관리합니다. `React` `TypeScript` `Next.js` `React Query` `Zustand` `Redux Toolkit` `TailwindCSS`
- **디자인 시스템** — 디자인 토큰과 린트 규칙으로 모든 앱의 스타일을 하나의 체계로 유지합니다. `CSS 변수 토큰` `Stylelint`
- **인터랙션** — 스크롤 애니메이션, 창 끌기 같은 직접 조작 UI, 3D·게임 화면을 구현합니다. `GSAP` `Framer Motion` `Three.js` `Unity(C#)`
- **API · 데이터** — REST API·DB 스키마를 설계하고, OAuth 로그인과 세션 권한 확인을 서버에서 처리합니다. `NestJS` `Express` `PostgreSQL` `Supabase` `Firebase`
- **테스트 · 배포** — 단위·e2e 테스트를 PR마다 돌리고, 통과한 커밋만 자동 배포하는 파이프라인을 만듭니다. `Vitest` `Playwright` `GitHub Actions` `Cloudflare Workers` `pnpm + Turborepo`

## 프로젝트

### [MacFolio](#project/macfolio) | 2024.10 – | 개인 · 운영 중

macOS 데스크톱을 웹으로 옮긴 포트폴리오. 메모 앱은 블로그, 메시지 앱은 방명록이 됩니다. https://macfolio.hyeoniverse.com

`React` `TypeScript` `Vite` `NestJS` `PostgreSQL` `Cloudflare`

- **창 관리와 반응형 셸** — 창 끌기·크기 조절·Dock이 있는 데스크톱, 휴대폰에서는 같은 앱이 iOS 홈 화면으로 전환
- **보는 화면이 곧 편집기** — 관리자가 로그인하면 글이 그 자리에서 편집기가 되어, 별도 CMS 없이 블로그 운영
- **서버 비용 0원** — NestJS·PostgreSQL을 무료 VM에 올리고, Cloudflare Tunnel로 포트를 열지 않고 공개
- **안전한 관리자 인증** — GitHub OAuth로 관리자 한 명만 허용, 세션은 해시로만 저장하고 요청마다 서버가 권한 확인

### [HYEONIVERSE](#project/hyeoniverse) | 2026.02 – | 개인 · 운영 중

작업물·글을 보여 주는 공개 화면과 직접 쓰고 고치는 관리자 화면을 담은 포트폴리오. https://www.hyeoniverse.com

`Next.js` `TypeScript` `Supabase` `GSAP` `Three.js` `DeepL · Groq`

- **빠르고 접근성 좋은 화면** — Lighthouse 성능 97점, 접근성·SEO 100점, LCP 0.7초
- **DB가 지키는 권한** — 소유자·관리자·저자·방문자 4단계를 RLS 정책 29개로 판정하고, 방문 IP는 90일 뒤 자동 익명화
- **무료 한도 안에서 AI 운영** — 기능마다 AI 공급자를 갈아 끼우고, 실패하거나 무료 한도에 닿으면 다음 공급자로 자동 전환

### [NewPick 뉴픽](#project/newpick) | 2024.12 – 2025.02 | 팀 5인 (FE 2 · BE 3) · 프론트엔드

관심사에 맞춰 AI가 요약한 뉴스를 매일 아침 메일로 보내 주는 뉴스레터 서비스.

`Next.js` `TypeScript` `Zustand` `React Query` `OpenAI`

- **로그인·인증 담당** — 보호 경로 그룹으로 마이페이지 접근 관리, 페이지 성격에 따라 서버·클라이언트 렌더링 분리
- **가입 전 체험** — 로그인 없이 관심사 하나로 AI 뉴스레터를 바로 받아 보는 흐름으로 가입 문턱을 낮춤

### [QRU 큐알유](#project/qru) | 2024.12 – 2025.01 | 개인 · 2026.09 개선

QR 디지털 명함을 만들어 공유하고, 공개 명함을 셔플로 찾아보는 웹 앱.

`React` `TypeScript` `Redux Toolkit` `Firebase`

- **서버 없이 데이터 보호** — Firestore 보안 규칙으로 저장 필드를 제한하고, 비공개 항목은 공개 문서에 저장하지 않음
- **복합 색인 0개** — 범위 질의를 "같음" 조건으로 바꿔 단일 필드 색인만으로 검색 처리

## 그 밖의 프로젝트

- **[WTD (What To Do)](#project/whattodo)** | 2024.10 · 팀 7인 — 비회원 데이터를 로그인 시 bulk API로 서버에 옮기는 동기화와 낙관적 업데이트
- **[SproutFarm 새싹 농장](#project/sproutfarm)** | 2024.06 · 개인 — 절차적 무한 맵, A* 경로 탐색 동물 AI, 조작할 수 없는 Redis 랭킹

## 수상 · 자격 · 어학

- **2023 프로보노 공모전 동상 · 과학기술정보통신부** | 2023.12 — 시각장애인을 위한 AI 음성 인식 키오스크
- **졸업 프로젝트 평가회 우수상 · 서울여대 정보보호학과** | 2022.12 — 온라인 시험 부정행위 탐지 서비스, 2023 춘계학술대회 논문 게재
- **정보처리기사 · 한국산업인력공단** | 2024.06
- **TOEIC 775점 · ETS** | 2026.09

## 교육

- **프로그래머스 데브코스 4기 · 웹 풀 사이클 개발** | 2024.08 – 2025.02 — React · TypeScript · Node.js, 875시간
- **서울여자대학교** | 2020.03 – 2025.02 — 정보보호학과 전공 · 소프트웨어융합학과 복수전공 · 학점 3.9 / 4.5
