---
title: 요청 계층과 위험별 설계 결정으로 정리한 MacFolio 백엔드 구성도
date: 2026-10-03
category: 개발 기록/MacFolio/서버·API
summary: 기능마다 따로 작성한 서버 글을 한 문서로 정리했다. 요청이 DB까지 거치는 경로와 계층, 인증·방문자·데이터·외부 연동·배포에서 어떤 위험을 막으려고 어떤 방식을 선택했는지 표로 정리하고, 이후 2주 동안 바뀐 점을 추가했다.
---

MacFolio의 서버는 기능을 추가할 때마다 모듈이 늘었다. 관리자 로그인, 글쓰기, 댓글, 메시지, 업로드, 배경화면, GitHub 연동까지 모듈이 11개가 됐고, 글도 기능마다 따로 작성했다. 전체 구조를 한 번에 보여 주는 문서가 없어서, 요청 경로와 설계 결정을 한 문서로 모아 저장소에 [docs/backend-design.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md)로 저장했다([PR #84](https://github.com/hyeoniverse/MacFolio/pull/84)).

## 배경: 백엔드가 맡는 일

MacFolio의 화면은 브라우저에서 실행되는 React 앱이다. 글 목록, 창 배치, 음악 재생처럼 방문자 한 명의 브라우저 안에서 끝나는 일은 서버 없이 동작한다. 서버(백엔드)가 필요한 일은 **여러 방문자가 같은 데이터를 공유하거나, 권한을 확인해야 하는 일**이다.

| 예                                      | 서버가 필요한 이유                                         |
| --------------------------------------- | ---------------------------------------------------------- |
| 관리자가 메모 앱에서 글을 고쳐 게시한다 | 다른 방문자도 고친 글을 받아야 하고, 관리자만 고칠 수 있다 |
| 방문자가 글에 댓글을 단다               | 모든 방문자가 같은 댓글 목록을 받아야 한다                 |
| 방문자가 본인 댓글을 삭제한다           | 계정 없이도 "본인 글"인지 서버가 판단해야 한다             |
| GitHub 프로필의 저장소 수를 표시한다    | GitHub API의 요청 한도를 서버 한 곳에서 관리해야 한다      |

서버는 [NestJS](https://docs.nestjs.com/)로 작성했다. NestJS는 기능을 **모듈** 단위로 나누고, 모듈마다 HTTP 경로를 받는 컨트롤러와 계산·DB 조회를 맡는 서비스를 둔다. 애플리케이션 모듈이 기능 모듈을 가져와(import) 하나의 서버를 구성한다. 데이터는 PostgreSQL에 저장하고, [Prisma](https://www.prisma.io/docs/orm/prisma-migrate)로 테이블 정의와 마이그레이션을 관리한다.

![NestJS 문서의 모듈 구조도. Application Module 아래 Users, Orders, Chat 모듈이 있고, 그 아래 Feature Module이 연결된다](./images/backend-design-nest-modules.png 'NestJS 앱은 루트 모듈이 기능 모듈을 가져오는 트리 구조다. MacFolio에서는 posts, comments, auth 같은 폴더 하나가 기능 모듈 하나다. NestJS 공식 문서, Modules')

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

### 1. 서버에 열린 인바운드 포트가 없다

일반적인 웹 서버는 방화벽에서 80·443번 포트를 열어 두고 인터넷의 요청을 직접 받는다. 열린 포트는 누구나 접속을 시도할 수 있는 입구라서, 포트 스캔과 취약점 공격의 대상이 된다.

Cloudflare Tunnel은 방향이 반대다. VM 안의 `cloudflared` 프로세스가 Cloudflare 네트워크로 **아웃바운드 연결**을 먼저 맺어 두고, Cloudflare가 받은 요청을 그 연결로 서버에 전달한다. 방문자의 브라우저는 서버의 IP 주소를 알 필요가 없고, 서버 방화벽은 들어오는 연결을 모두 막아도 된다.

![Cloudflare 문서의 Tunnel 요청 흐름도. 브라우저의 HTTP 요청이 Cloudflare Edge 서버에 도착하고, 호스트 이름과 터널 매핑을 확인한 뒤 서버의 cloudflared를 거쳐 localhost:8080 서비스로 전달된다](./images/backend-design-cloudflare-tunnel.jpg '브라우저 → Cloudflare Edge → cloudflared → 서버 안의 서비스. MacFolio에서는 localhost:8080 자리가 NestJS 컨테이너다. Cloudflare Docs, Cloudflare Tunnel')

방화벽에 80·443을 열지 않고, TLS 인증서 갱신도 Cloudflare가 처리한다. 운영 서버의 `compose.yml`에는 `ports` 항목이 없어서 DB는 컨테이너 네트워크 밖에서 접근할 수 없다([docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)).

### 2. 프론트엔드와 API가 같은 사이트(site)다

브라우저는 주소를 두 가지 단위로 비교한다. **출처**(origin)는 스킴·호스트·포트가 모두 같아야 같고, **사이트**(site)는 스킴과 등록 가능한 도메인(`hyeoniverse.com`처럼 공개 접미사 `com` 바로 앞까지)이 같으면 같다. `macfolio.hyeoniverse.com`과 `macfolio-api.hyeoniverse.com`은 출처는 다르지만 같은 사이트다.

![주소를 스킴, 하위 도메인, 등록 가능한 도메인, 공개 접미사로 나누고, API 주소 세 가지에 대해 출처·사이트 일치 여부와 Lax 쿠키 전송 여부를 비교한 표](./images/backend-design-same-site.svg 'hyeoniverse.com 아래에 API를 두면 같은 사이트라서 Lax 쿠키가 전송된다. workers.dev나 IP 주소에 두면 다른 사이트다')

관리자 세션 쿠키는 `SameSite=Lax`[^samesite]로 발급하므로, 같은 사이트 사이의 요청에만 쿠키가 전송된다. API를 `workers.dev`나 IP 주소에 배치했다면 ==쿠키가 전송되지 않아 로그인이 동작하지 않는다==.

### 3. 외부 서비스 앞에 서버 캐시가 있다

GitHub REST API는 인증 없는 요청을 IP당 시간당 60회로 제한한다([GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)). 방문자 요청마다 GitHub를 호출하면 방문자 61명이 한 시간 안에 프로필을 열기만 해도 한도를 초과한다. 그래서 서버가 GitHub 응답을 캐시하고, 방문자에게는 캐시한 값을 응답한다.

## 요청이 거치는 계층

API로 들어온 요청은 모두 같은 계층을 순서대로 거친다. NestJS는 요청 하나를 **미들웨어 → 가드 → 파이프 → 처리 함수** 순서로 처리하고, 어느 단계에서 발생한 오류든 **예외 필터**가 받아 응답으로 바꾼다. 앞 단계에서 거절된 요청은 뒤 단계와 처리 함수까지 도달하지 않는다.

| 계층                                                        | 종류      | 역할                                                                 | 거절 시 상태 코드 |
| ----------------------------------------------------------- | --------- | -------------------------------------------------------------------- | ----------------- |
| `trust proxy`                                               | Express   | 터널 뒤에서 `X-Forwarded-For`로 실제 방문자 IP를 읽는다              | 없음              |
| [helmet](https://docs.nestjs.com/security/helmet), CORS     | 미들웨어  | 보안 헤더를 붙이고, 사이트 주소에서 온 요청만 쿠키와 함께 허용한다   | 없음              |
| `ThrottlerGuard`                                            | 가드      | 로그인, 댓글·메시지 쓰기에 IP별 1분 단위 요청 제한을 건다            | 429               |
| [`AdminGuard`](https://docs.nestjs.com/guards)              | 가드      | 관리자 전용 경로에서 요청마다 세션을 DB에서 확인한다                 | 401               |
| [`ValidationPipe`](https://docs.nestjs.com/pipes)           | 파이프    | DTO로 입력을 검사하고, 정의하지 않은 필드가 있으면 거절한다          | 400               |
| [전역 예외 필터](https://docs.nestjs.com/exception-filters) | 예외 필터 | 오류 응답 형식을 하나로 통일하고, 예상하지 못한 오류는 내용을 숨긴다 | 500               |

`trust proxy`가 필요한 이유는 터널 구조 때문이다. NestJS가 보는 TCP 연결의 상대는 방문자가 아니라 같은 VM의 `cloudflared`라서, 연결 주소만 보면 모든 방문자의 IP가 같아진다. 실제 방문자 IP는 프록시가 붙인 `X-Forwarded-For` 헤더에 있고, `trust proxy` 설정이 있어야 Express가 이 헤더를 읽어 `request.ip`에 넣는다. 요청 제한과 IP 해시가 모두 이 값을 쓴다.

![API 요청이 터널, Express 미들웨어, 가드, 파이프, 처리 함수 순서로 지나가고 각 단계가 거절할 때의 상태 코드와 전역 예외 필터를 표시한 그림](./images/backend-design-request-order.svg '가드가 파이프보다 먼저 실행된다. 관리자 쓰기 경로에서는 요청 제한이 세션 조회보다 먼저다')

가드가 파이프보다 먼저 실행되므로, 로그인하지 않은 브라우저가 형식이 틀린 본문으로 글 삭제를 요청해도 400이 아니라 401을 받는다. 권한이 없는 요청에는 입력 형식에 관한 정보도 주지 않는다.

```http
DELETE /posts/hello HTTP/1.1
Host: macfolio-api.hyeoniverse.com

HTTP/1.1 401 Unauthorized
{"statusCode":401,"error":"Unauthorized","message":"관리자 로그인이 필요합니다.","path":"/posts/hello","timestamp":"…"}
```

`AdminGuard`가 세션 쿠키를 찾지 못해 401을 반환하고, 글을 삭제하는 서비스 코드는 실행되지 않는다. 응답 본문의 형식은 전역 예외 필터가 정한 것이다.

> [!IMPORTANT]
> 화면에서 편집 버튼을 숨기는 것과 서버가 요청을 거절하는 것은 별개다. 버튼이 보이지 않아도 `curl`로 요청을 직접 보낼 수 있으므로, 권한 검사는 항상 서버가 수행한다.

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

### 세션: 원문은 쿠키에, 해시는 DB에

표의 두 번째 행을 예로 들면, 관리자가 로그인하면 서버는 32바이트 무작위 토큰을 만들어 `macfolio_session` 쿠키로 보내고, DB의 `AdminSession` 테이블에는 그 토큰의 SHA-256 해시만 저장한다. 이후 요청마다 쿠키 값을 다시 해시해 DB에서 찾는다.

![세션 토큰 원문은 브라우저 쿠키에만 있고, 서버는 요청마다 SHA-256을 계산해 DB의 tokenHash와 비교한다. DB가 유출된 경우 원문 저장과 해시 저장의 차이를 비교한다](./images/backend-design-session-hash.svg 'DB 백업 파일이 유출되어도 그 안의 값으로는 관리자 쿠키를 만들 수 없다')

토큰이 무작위 32바이트(256비트)라서, 사람이 정하는 비밀번호와 달리 후보를 대입해 해시를 되돌리는 공격이 성립하지 않는다. 그래서 솔트나 의도적으로 느린 해시 함수 없이 SHA-256 한 번으로 저장한다.

### 처음 설계와 달라진 결정

일부는 처음 설계와 다르다. 댓글은 처음에 이름과 비밀번호를 받고 비밀번호를 scrypt 해시로 저장했다([scrypt 비밀번호 해시와 IP HMAC만 저장하는 가입 없는 댓글](/memo/post-comments)). 방문자 쿠키 방식으로 바꿀 때 기존 댓글은 그대로 보관하고 새 댓글부터 새 방식을 적용했다. ==데이터를 마이그레이션하지 않고 방식을 바꾸는 편이 1인 운영 서버에서는 장애 위험이 적다==.

## 파일을 DB에 저장한 이유

업로드한 이미지의 저장 위치가 가장 오래 검토한 결정이다. 일반적으로는 디스크나 오브젝트 스토리지(Amazon S3처럼 파일을 키로 저장하는 서비스)에 파일을 저장하고 DB에는 주소만 기록한다. 그러나 이 서버는 한 대뿐이고, 배포 환경을 옮기면 디스크도 바뀔 수 있다. 글은 DB에, 그 글의 이미지는 디스크에 있으면 백업 대상도 두 곳이 된다.

![파일 저장 위치에 따른 백업 범위](./images/backend-design-files.svg '디스크에 저장하면 pg_dump와 디스크 복사 두 가지를 맞춰야 하고, DB에 저장하면 pg_dump 하나로 끝난다')

예를 들어 새벽 3시에 `pg_dump`로 DB를 백업하고 3시 10분에 디스크를 복사한다고 하자. 그 10분 사이에 이미지를 올린 글은 DB 백업에는 없고 디스크 백업에만 이미지가 있다. 반대로 그 사이 삭제한 이미지는 DB 백업에는 주소가 있지만 디스크 백업에는 파일이 없다. 두 백업으로 복원하면 이미지가 깨진 글이 생긴다.

그래서 파일도 PostgreSQL `bytea`[^bytea] 열에 저장했다. 파일 하나는 10MB로 제한하고, 배경화면은 브라우저에서 크기를 줄인 뒤 업로드한다. 그 결과 `pg_dump` 한 번으로 ==글과 이미지가 함께 백업된다==. 글 본문에는 `/files/<무작위 ID>` 주소만 들어간다. 사진이 수천 장 규모가 되면 다시 검토해야 하지만, 포트폴리오 블로그 규모에서는 백업·복원 절차가 하나인 쪽을 선택했다.

## 시험

| 종류         | 대상                                                    | 확인 내용                                                                                                   |
| ------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 단위 시험    | 입력 규칙, 세션·해시, 방문자 이름 같은 순수 함수        | 규칙은 `rules.ts`에 모으고 컨트롤러는 그 결과만 사용한다                                                    |
| API e2e      | CI에서 PostgreSQL을 실행해 실제 DB로 HTTP 요청을 보낸다 | 비관리자 401, 규칙 위반 400, 과다 요청 429, DB에 해시만 저장되는지. GitHub·사진 서비스는 가짜 클래스로 교체 |
| 브라우저 E2E | 프론트엔드를 가짜 API(`e2e/fakeApi.ts`)로 시험          | API 응답 형식이 바뀌면 서버와 가짜 API를 함께 수정한다                                                      |

10월 3일 기준 API 시험은 단위·e2e를 합쳐 120개가 넘었다. main에 들어오는 모든 커밋에서 이 시험이 실행되고, 통과해야 배포된다.

## 10월 3일 이후 바뀐 것

이후 2주 동안 같은 구조 위에 기능이 많이 추가됐다. 구조(터널, 같은 사이트 쿠키, 요청 계층)는 그대로이고, 계층 안의 구현 방식이 몇 곳 바뀌었다.

![10월 3일과 지금](./images/backend-design-growth.svg '기능 모듈은 11개에서 24개로, API 시험은 120여 개에서 309개로')

| 바뀐 곳        | 10월 3일                                      | 현재                                                                                                                                                            |
| -------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 요청 제한      | 로그인, 댓글·메시지 쓰기에만 `ThrottlerGuard` | 모든 쓰기 경로에 `@RateLimit` 데코레이터 하나로 적용 ([쓰기 경로에 요청 제한](/memo/rate-limit-all-writes))                                                     |
| 입력 형식      | 서버의 DTO와 화면의 타입을 따로 작성          | `packages/contracts`의 [zod](https://zod.dev/) 스키마를 서버·화면이 함께 사용 ([분석 이벤트 계약](/memo/contracts-package#분석-이벤트의-전송수신조회-형식-206)) |
| 권한 확인      | 경로마다 `@UseGuards`를 사람이 검토           | 경로 85개를 표 하나와 비교하는 시험 ([API 경로를 표 하나로](/memo/api-route-table-test))                                                                        |
| 배포           | 서버에서 `git pull` 후 빌드                   | GitHub Actions가 이미지를 빌드하고 서버는 이미지만 교체 ([command= 제한 SSH 키와 GHCR 이미지로 하는 API 자동 배포와 롤백](/memo/api-auto-deploy))               |
| 새로 생긴 모듈 | 없음                                          | 트래픽 분석, 서버 자원, 문서 파일(R2), Finder 폴더, 사이트 프로필, 좋아요, 번역·요약 등                                                                         |

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
- [쿠키 없는 하루 해시 순방문자 집계와 세션별로 응답 범위를 나누는 분석 API](/memo/analytics-api)
- [Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험](/memo/api-route-table-test)

<details>
<summary>참고 문헌</summary>

- 이 글의 원본: [docs/backend-design.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md)
- NestJS, [Request lifecycle](https://docs.nestjs.com/faq/request-lifecycle), [Modules](https://docs.nestjs.com/modules), [Guards](https://docs.nestjs.com/guards), [Pipes](https://docs.nestjs.com/pipes), [Exception filters](https://docs.nestjs.com/exception-filters)
- [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
- Cloudflare Docs, [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- Oracle, [Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- MDN, [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies), [Same-site](https://developer.mozilla.org/en-US/docs/Glossary/Site), [Origin](https://developer.mozilla.org/en-US/docs/Glossary/Origin)
- [Public Suffix List](https://publicsuffix.org/)
- Express, [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html)
- GitHub Docs, [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- PostgreSQL, [Binary Data Types](https://www.postgresql.org/docs/current/datatype-binary.html)

</details>

<details>
<summary>사진 출처</summary>

- NestJS 모듈 구조도: NestJS 공식 문서, [Modules](https://docs.nestjs.com/modules) ([원본 그림](https://docs.nestjs.com/assets/Modules_1.png)), [MIT 라이선스](https://github.com/nestjs/docs.nestjs.com/blob/master/LICENSE)
- Cloudflare Tunnel 요청 흐름도: Cloudflare Docs, [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), CC BY 4.0

</details>

[^samesite]: `SameSite`는 다른 사이트에서 시작된 요청에 쿠키를 함께 보낼지 정하는 쿠키 속성이다. `Lax`이면 같은 사이트(등록 가능한 도메인이 같은 주소) 사이의 요청과 최상위 이동에만 쿠키를 보낸다.

[^hmac]: HMAC은 서버만 아는 비밀 키를 섞어 계산하는 해시다. 키를 모르면 같은 입력으로 같은 값을 만들 수 없으므로, 원문 후보를 대입해 되돌리는 공격을 막는다.

[^bytea]: `bytea`는 PostgreSQL의 바이너리 문자열 형식이다. 이미지 같은 바이트 배열을 행 안에 그대로 저장한다.

#MacFolio #백엔드 #설계
