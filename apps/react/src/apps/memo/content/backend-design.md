---
title: 요청 계층과 위험별 설계 결정으로 정리한 MacFolio 백엔드 구성도
date: 2026-10-03
category: 개발 기록/MacFolio/백엔드
summary: 기능마다 따로 작성한 서버 글을 한 문서로 정리했다. 요청이 DB까지 거치는 경로와 계층, 인증·방문자·데이터·외부 연동·배포에서 어떤 위험을 막으려고 어떤 방식을 선택했는지 표로 정리하고, 이후 2주 동안 바뀐 점을 추가했다.
---

MacFolio의 서버는 기능을 추가할 때마다 모듈이 늘었다. 관리자 로그인, 글쓰기, 댓글, 메시지, 업로드, 배경화면, GitHub 연동까지 모듈이 11개가 됐고, 글도 기능마다 따로 작성했다. 전체 구조를 한 번에 보여 주는 문서는 없었다. 이 글은 그 전체 구조를 정리한다. 저장소에도 같은 내용을 [docs/backend-design.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md)로 저장했다([PR #84](https://github.com/hyeoniverse/MacFolio/pull/84)).

## 설계 조건

설계를 결정한 것은 기술 선호보다 아래 네 가지 운영 조건이다.

| 조건                     | 설계에 준 영향                                                                   |
| ------------------------ | -------------------------------------------------------------------------------- |
| 관리자는 한 명이다       | 회원가입·권한 단계가 필요 없다. 대신 그 한 명 외에는 어떤 쓰기도 허용하지 않는다 |
| 방문자는 가입하지 않는다 | 댓글·메시지 작성자를 계정 없이 식별해야 한다                                     |
| 비용 0원                 | 서버는 Oracle Cloud Always Free VM 한 대다. 메모리 여유가 적다                   |
| 1인 운영                 | 새벽 장애에 즉시 대응할 수 없다. 외부 서비스가 실패해도 화면은 비지 않아야 한다  |

## 구성도

![MacFolio 백엔드 구성도](./images/backend-design-architecture.jpg '브라우저는 Workers에서 화면을, Tunnel을 거쳐 API를 받는다. 서버는 바깥에 포트를 열지 않는다')

요청 경로는 두 가지다. 화면(HTML·JS)은 Cloudflare Workers가 정적 파일로 응답하고, API 요청은 Cloudflare Tunnel을 거쳐 VM 안의 NestJS로 전달된다. 구성도에서 중요한 지점은 세 곳이다.

1. **서버에 열린 인바운드 포트가 없다.** VM 안의 `cloudflared`가 Cloudflare로 아웃바운드 연결을 먼저 맺고, 요청은 그 연결로만 들어온다. 방화벽에 80·443을 열지 않고, TLS 인증서 갱신도 Cloudflare가 처리한다. 운영 서버의 `compose.yml`에는 `ports` 항목이 없어서 DB는 컨테이너 네트워크 밖에서 접근할 수 없다([docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)).
2. **프론트엔드와 API가 같은 사이트(site)다.** `macfolio.`와 `macfolio-api.`가 모두 `hyeoniverse.com` 아래에 있으므로 `SameSite=Lax`[^samesite] 세션 쿠키가 API 요청에 함께 전송된다. API를 `workers.dev`나 IP 주소에 배치했다면 쿠키가 전송되지 않아 로그인이 동작하지 않는다.
3. **외부 서비스 앞에 서버 캐시가 있다.** GitHub REST API는 인증 없는 요청을 IP당 시간당 60회로 제한한다([GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)). 방문자 요청마다 GitHub를 호출하면 이 한도를 바로 초과한다.

## 요청이 거치는 계층

API로 들어온 요청은 모두 같은 계층을 순서대로 거친다.

| 계층                                                        | 역할                                                                 | 거절 시 상태 코드 |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | ----------------- |
| `trust proxy`                                               | 터널 뒤에서 `X-Forwarded-For`로 실제 방문자 IP를 읽는다              | —                 |
| [helmet](https://docs.nestjs.com/security/helmet), CORS     | 보안 헤더를 붙이고, 사이트 주소에서 온 요청만 쿠키와 함께 허용한다   | —                 |
| [`ValidationPipe`](https://docs.nestjs.com/pipes)           | DTO로 입력을 검사하고, 정의하지 않은 필드가 있으면 거절한다          | 400               |
| [`AdminGuard`](https://docs.nestjs.com/guards)              | 관리자 전용 경로에서 요청마다 세션을 DB에서 확인한다                 | 401               |
| `ThrottlerGuard`                                            | 로그인, 댓글·메시지 쓰기에 IP별 1분 단위 요청 제한을 건다            | 429               |
| [전역 예외 필터](https://docs.nestjs.com/exception-filters) | 오류 응답 형식을 하나로 통일하고, 예상하지 못한 오류는 내용을 숨긴다 | 500               |

![요청이 거치는 계층](./images/backend-design-layers.svg '각 계층이 거절할 때 반환하는 상태 코드. 처리 함수까지 도달한 요청은 앞의 검사를 모두 통과한 것이다')

화면에서 편집 버튼을 숨기는 것과 서버가 요청을 거절하는 것은 별개다. 버튼이 보이지 않아도 `curl`로 요청을 직접 보낼 수 있으므로, 권한 검사는 항상 서버가 수행한다.

## 설계 결정

각 결정은 고른 방식보다 **막으려는 위험**을 기준으로 정리했다.

| 주제          | 선택한 방식                                                     | 막는 위험                                                              |
| ------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 관리자 로그인 | GitHub OAuth를 직접 구현, `state` 쿠키를 상수 시간 비교         | 비밀번호 저장, 타인이 시작한 로그인(CSRF), 타이밍 공격                 |
| 세션          | 쿠키에는 무작위 토큰, DB에는 SHA-256 해시만 저장                | DB가 유출되어도 세션을 탈취할 수 없다. 로그아웃 즉시 세션이 무효화된다 |
| 관리자 확인   | 계정 이름이 아닌 GitHub 숫자 ID로 비교                          | 계정 이름 변경·재사용으로 권한이 넘어가는 경우                         |
| 방문자        | 쿠키 토큰의 HMAC[^hmac]만 저장, 응답에는 본인 글 여부만 포함    | 가입 없이 본인 글만 삭제. 토큰 원문은 서버에 없다                      |
| IP            | 앞 두 자리와 HMAC만 저장                                        | 개인정보는 최소로 보관하면서 같은 사람의 글은 묶어서 조회              |
| 필수 항목     | 화면·API 검증에 더해 DB `CHECK` 제약                            | API를 거치지 않은 쓰기(스크립트, 버그)                                 |
| 글 편집       | 게시본·임시 저장 분리, 게시마다 버전(최대 50개), 30일 복원      | 수정 중인 글 노출, 잘못된 게시, 실수로 인한 삭제                       |
| 업로드        | DB에 저장, 10MB 제한, 파일 시그니처로 형식 확인, 무작위 ID      | 백업 누락, 확장자만 바꾼 파일, 주소 추측                               |
| GitHub        | 서버 캐시, 동시 요청은 하나로 병합, 실패 시 마지막 성공 값 사용 | 요청 한도 초과, GitHub 장애 시 빈 화면                                 |
| 서버 노출     | Cloudflare Tunnel, 인바운드 포트 없음                           | 열린 포트를 노린 공격, 인증서 만료                                     |
| 배포          | `check` 작업을 통과한 커밋만 Workers에 배포                     | 시험을 건너뛴 배포                                                     |

일부는 처음 설계와 다르다. 댓글은 처음에 이름과 비밀번호를 받고 비밀번호를 scrypt 해시로 저장했다([scrypt 비밀번호 해시와 IP HMAC만 저장하는 가입 없는 댓글](/memo/post-comments)). 방문자 쿠키 방식으로 바꿀 때 기존 댓글은 그대로 보관하고 새 댓글부터 새 방식을 적용했다. 데이터를 마이그레이션하지 않고 방식을 바꾸는 편이 1인 운영 서버에서는 장애 위험이 적다.

## 파일을 DB에 저장한 이유

업로드한 이미지의 저장 위치가 가장 오래 검토한 결정이다. 일반적으로는 디스크나 오브젝트 스토리지에 파일을 저장하고 DB에는 주소만 기록한다. 그러나 이 서버는 한 대뿐이고, 배포 환경을 옮기면 디스크도 바뀔 수 있다. 글은 DB에, 그 글의 이미지는 디스크에 있으면 백업 대상도 두 곳이 된다.

![파일 저장 위치에 따른 백업 범위](./images/backend-design-files.svg '디스크에 저장하면 pg_dump와 디스크 복사 두 가지를 맞춰야 하고, DB에 저장하면 pg_dump 하나로 끝난다')

그래서 파일도 PostgreSQL `bytea`[^bytea] 열에 저장했다. 파일 하나는 10MB로 제한하고, 배경화면은 브라우저에서 크기를 줄인 뒤 업로드한다. 그 결과 `pg_dump` 한 번으로 글과 이미지가 함께 백업된다. 사진이 수천 장 규모가 되면 다시 검토해야 하지만, 포트폴리오 블로그 규모에서는 백업·복원 절차가 하나인 쪽을 선택했다.

## 시험

| 종류         | 대상                                                    | 확인 내용                                                                                                   |
| ------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 단위 시험    | 입력 규칙, 세션·해시, 방문자 이름 같은 순수 함수        | 규칙은 `rules.ts`에 모으고 컨트롤러는 그 결과만 사용한다                                                    |
| API e2e      | CI에서 PostgreSQL을 실행해 실제 DB로 HTTP 요청을 보낸다 | 비관리자 401, 규칙 위반 400, 과다 요청 429, DB에 해시만 저장되는지. GitHub·사진 서비스는 가짜 클래스로 교체 |
| 브라우저 E2E | 프론트엔드를 가짜 API(`e2e/fakeApi.ts`)로 시험          | API 응답 형식이 바뀌면 서버와 가짜 API를 함께 수정한다                                                      |

10월 3일 기준 API 시험은 단위·e2e를 합쳐 120개가 넘었다. main에 들어오는 모든 커밋에서 이 시험이 실행되고, 통과해야 배포된다.

## 이 글 이후 바뀐 것

글을 작성한 뒤 2주 동안 같은 구조 위에 기능이 많이 추가됐다. 구조(터널, 같은 사이트 쿠키, 요청 계층)는 그대로이고, 계층 안의 구현 방식이 몇 곳 바뀌었다.

![10월 3일과 지금](./images/backend-design-growth.svg '기능 모듈은 11개에서 24개로, API 시험은 120여 개에서 309개로')

| 바뀐 곳        | 10월 3일                                      | 현재                                                                                                                                              |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 요청 제한      | 로그인, 댓글·메시지 쓰기에만 `ThrottlerGuard` | 모든 쓰기 경로에 `@RateLimit` 데코레이터 하나로 적용 ([쓰기 경로에 요청 제한](/memo/rate-limit-all-writes))                                       |
| 입력 형식      | 서버의 DTO와 화면의 타입을 따로 작성          | `packages/contracts`의 [zod](https://zod.dev/) 스키마를 서버·화면이 함께 사용 ([분석 이벤트 계약](/memo/contracts-analytics))                     |
| 권한 확인      | 경로마다 `@UseGuards`를 사람이 검토           | 경로 85개를 표 하나와 비교하는 시험 ([API 경로를 표 하나로](/memo/api-route-table-test))                                                          |
| 배포           | 서버에서 `git pull` 후 빌드                   | GitHub Actions가 이미지를 빌드하고 서버는 이미지만 교체 ([command= 제한 SSH 키와 GHCR 이미지로 하는 API 자동 배포와 롤백](/memo/api-auto-deploy)) |
| 새로 생긴 모듈 | —                                             | 트래픽 분석, 서버 자원, 문서 파일(R2), Finder 폴더, 사이트 프로필, 좋아요, 번역·요약 등                                                           |

현재 시험 수는 e2e 131개(파일 23개)와 단위 178개이고, DB 테이블(Prisma 모델)은 23개다.

## 남은 과제와 배운 점

- 업로드 파일을 DB에 저장하는 결정은 유지하고 있다. 다만 이력서·자격증 같은 문서 파일은 Cloudflare R2 버킷에 저장하고, 프론트엔드 Worker가 사이트와 같은 출처의 `/files/<키>` 주소로 응답한다. 같은 출처여야 Finder가 PDF를 iframe에 표시할 수 있기 때문이다. 관리자가 올리는 글 이미지와는 사용처도, 변경 빈도도 다르다.
- 서버가 한 대이므로 캐시(GitHub, 방문자용 요약)와 집계 타이머를 모두 서버 메모리에 보관한다. 서버를 두 대 이상으로 늘리면 가장 먼저 재설계해야 할 부분이다.
- 설계 문서를 모듈이 11개였던 시점에 작성한 것이 효과가 있었다. 이후 추가된 기능 대부분은 "설계 결정 표의 어느 행에 해당하는가"로 결정할 수 있었고, 표에 없는 결정(문서 파일을 R2에 저장)이 나오자 그것이 예외라는 점이 바로 드러났다.

<details>
<summary>로컬에서 전체 구성 실행하기</summary>

이 구성을 로컬에서 실행하는 순서는 [README.md](https://github.com/hyeoniverse/MacFolio/blob/main/README.md)에 있다.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm --filter @macfolio/api db:up      # PostgreSQL (Docker)
pnpm dev:all                           # 화면 5173 + API 4000, 시작할 때 마이그레이션
open http://localhost:4000/docs         # Swagger
pnpm --filter @macfolio/api test:e2e   # HTTP 경계 시험
```

서버 배포 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)에 있다.

</details>

## 참고 문서

- 이 글의 원본: [docs/backend-design.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md)
- [NestJS](https://docs.nestjs.com/), [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate), [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), [Oracle Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [MDN: HTTP 쿠키](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies), [PostgreSQL 바이너리 데이터 형식](https://www.postgresql.org/docs/current/datatype-binary.html)

## 관련 글

각 결정의 상세 과정은 기능별 글에 있다.

- [GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기](/memo/admin-login-github-oauth)
- [httpOnly 방문자 쿠키의 HMAC 해시로 가입 없이 방문자 식별하기](/memo/visitor-identity)
- [scrypt 비밀번호 해시와 IP HMAC만 저장하는 가입 없는 댓글](/memo/post-comments)
- [게시본과 임시본을 한 행에 담고 CHECK 제약으로 지키는 Post 테이블](/memo/drafts-and-versions)
- [Markdown 글은 두고 서버 JSON 한 행으로 겹치는 메모 폴더 정리](/memo/memo-organization-api)
- [createImageBitmap과 canvas toBlob으로 브라우저에서 이미지 축소해 업로드하기](/memo/custom-wallpapers)
- [API 서버에서 GitHub API 응답을 캐시해 프로필을 실시간 조회하기](/memo/github-live-profile)
- [Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)
- [Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions)
- [트래픽 분석 1 - 쿠키 없이 하루 해시로 순방문자를 집계하는 분석 API](/memo/analytics-api)
- [Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험](/memo/api-route-table-test)

[^samesite]: `SameSite`는 다른 사이트에서 시작된 요청에 쿠키를 함께 보낼지 정하는 쿠키 속성이다. `Lax`이면 같은 사이트(등록 가능한 도메인이 같은 주소) 사이의 요청과 최상위 이동에만 쿠키를 보낸다.

[^hmac]: HMAC은 서버만 아는 비밀 키를 섞어 계산하는 해시다. 키를 모르면 같은 입력으로 같은 값을 만들 수 없으므로, 원문 후보를 대입해 되돌리는 공격을 막는다.

[^bytea]: `bytea`는 PostgreSQL의 바이너리 문자열 형식이다. 이미지 같은 바이트 배열을 행 안에 그대로 저장한다.

#MacFolio #백엔드 #설계
