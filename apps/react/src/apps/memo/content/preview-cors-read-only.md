---
title: PR 미리보기 origin에는 credentials 없는 CORS로 읽기만 허용하기
date: 2026-10-10
category: 개발 기록/MacFolio/테스트·보안·성능
series: 보안 점검
seriesOrder: 9
summary: PR 미리보기용 CORS 와일드카드가 쿠키(credentials)까지 허용하던 범위를 줄였다. 패턴에 맞은 주소에는 credentials를 허용하지 않고, 관리자 가드는 exact가 아닌 Origin을 403으로 거부한다. 프론트엔드는 사이트가 다른 미리보기에서 쿠키 없이 요청해 공개 데이터를 읽는다.
---

MacFolio의 화면(`macfolio.hyeoniverse.com`)과 API 서버(`macfolio-api.hyeoniverse.com`)는 주소가 다르다. 브라우저는 주소가 다른 서버의 응답을 페이지 코드에 넘기기 전에 서버의 허락을 확인하는데, 이 허락을 주고받는 규칙이 CORS다. API는 사이트 주소 외에 PR마다 생기는 미리보기 주소도 허락 목록에 두고 있었고, 그 허락에 관리자 로그인 쿠키까지 포함되어 있었다. 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "CORS 와일드카드 범위 점검"에서 이 범위를 줄였다([#182](https://github.com/hyeoniverse/MacFolio/pull/182)).

## 배경

### 출처(origin)와 동일 출처 정책

출처는 URL의 **스킴, 호스트, 포트** 세 가지를 합친 값이다. `https://macfolio.hyeoniverse.com`과 `https://macfolio-api.hyeoniverse.com`은 스킴과 포트(443)가 같아도 호스트가 다르므로 다른 출처다. 브라우저의 동일 출처 정책(same-origin policy)은 한 출처의 스크립트가 다른 출처의 응답 내용을 읽지 못하게 한다. 예를 들어 아무 웹 페이지의 스크립트가 사용자의 메일 서비스 API를 호출해 메일 목록을 읽어 가는 일을 막는 규칙이다.

### CORS: 다른 출처의 응답을 읽어도 되는지 서버가 답하는 규칙

CORS(Cross-Origin Resource Sharing)는 이 제한을 서버가 선택적으로 풀어 주는 규칙이다. 브라우저는 다른 출처로 요청을 보낼 때 요청을 보낸 페이지의 출처를 `Origin` 헤더에 적고, 서버는 응답 헤더 `Access-Control-Allow-Origin`에 허용하는 출처를 적는다. 두 값이 일치해야 브라우저가 응답을 페이지의 JavaScript에 넘긴다.

```http
GET /posts HTTP/1.1
Host: macfolio-api.hyeoniverse.com
Origin: https://macfolio.hyeoniverse.com

HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://macfolio.hyeoniverse.com
Access-Control-Allow-Credentials: true
```

`DELETE` 같은 메서드나 `Content-Type: application/json` 같은 헤더를 쓰는 요청은 본 요청 전에 `OPTIONS` 메서드로 사전 요청(preflight)을 보내 서버의 허락을 먼저 확인한다. 반대로 `GET`이나 폼 형식의 `POST` 같은 단순 요청은 사전 요청 없이 서버에 바로 도착하고, 브라우저는 응답이 돌아온 뒤에 CORS 헤더를 검사한다.

![CORS 사전 요청을 보내는 조건의 흐름도](./images/preview-cors-read-only-preflight-flowchart.svg '교차 출처 요청이 단순 요청 경로(왼쪽)로 바로 가는지, OPTIONS 사전 요청 경로(오른쪽)를 거치는지 판단하는 순서. 사전 요청에 서버가 알맞은 Access-Control-* 헤더로 답하지 않으면 본 요청은 실패한다')

### credentials: 쿠키를 포함한 교차 출처 요청

`fetch(url, { credentials: 'include' })`처럼 쿠키를 포함하는 요청을 credentials 요청이라 한다. 이 요청은 서버가 `Access-Control-Allow-Credentials: true`를 함께 보내야 브라우저가 응답을 페이지에 넘긴다. 또 이때 `Access-Control-Allow-Origin`은 `*`일 수 없고 출처를 정확히 적어야 한다. 관리자 세션처럼 쿠키에 담긴 권한을 다른 출처의 스크립트가 사용하려면, 서버가 그 출처를 이름으로 지정해 허락해야 한다는 뜻이다.

### SameSite: 쿠키를 다른 사이트의 요청에 포함할지 정하는 속성

쿠키의 `SameSite` 속성은 **사이트**를 기준으로 동작한다. 사이트는 출처보다 넓은 단위로, 스킴과 등록 가능한 도메인(공개 접미사 바로 앞 한 단계까지의 도메인)만 비교한다. 공개 접미사(public suffix)는 `com`, `co.kr`, `workers.dev`처럼 누구나 그 아래에 주소를 등록할 수 있는 접미사이며, Mozilla가 관리하는 Public Suffix List에 등록되어 있다.

![출처와 사이트 비교](./images/preview-cors-read-only-site-origin.svg '사이트 화면과 API는 출처는 다르지만 사이트(hyeoniverse.com)는 같다. PR 미리보기는 workers.dev가 공개 접미사라 사이트가 hyeoniverse.workers.dev가 되어, API와 사이트도 다르다')

`SameSite=Lax` 쿠키는 다른 사이트에서 시작된 하위 요청(fetch, 이미지 등)에는 포함되지 않는다. 다른 사이트의 링크를 눌러 이동하는 최상위 `GET` 탐색만 예외다. 그림처럼 사이트 화면에서 API로 보내는 fetch에는 세션 쿠키가 포함되고, 미리보기에서 보내는 fetch에는 포함되지 않는다.

<details>
<summary>용어 정리</summary>

- **CORS**: 다른 출처(origin)의 JavaScript가 API를 호출할 수 있게 서버가 허용하는 규칙. 서버가 `Access-Control-Allow-Origin` 헤더로 해당 출처를 허용해야 브라우저가 응답을 스크립트에 전달한다
- **credentials**: CORS 요청에 쿠키를 포함하는 것. 서버가 `Access-Control-Allow-Credentials: true`를 함께 보내야 하고, 보내지 않으면 브라우저가 쿠키를 포함한 요청의 응답을 차단한다
- **SameSite=Lax**: 쿠키 속성. 다른 사이트에서 시작된 하위 요청에는 쿠키를 포함하지 않는다(최상위 탐색 GET은 예외). `macfolio.hyeoniverse.com`과 `macfolio-api.hyeoniverse.com`은 같은 사이트(`hyeoniverse.com`)라 쿠키가 전송되지만, `*.workers.dev`에서 호출하면 전송되지 않는다
- **Origin 헤더**: 브라우저가 교차 출처 요청에 요청을 보낸 출처를 기록하는 헤더. JavaScript가 변경할 수 없다

</details>

## 문제

API의 `CORS_ORIGINS`는 `https://macfolio.hyeoniverse.com,https://*-macfolio.hyeoniverse.workers.dev`다. 두 번째가 PR 미리보기 주소이며, `*` 자리에 브랜치 이름이 들어간다. 예를 들어 `feat/x` 브랜치의 미리보기는 `https://feat-x-macfolio.hyeoniverse.workers.dev`다.

그런데 `enableCors`에 `credentials: true`를 일괄 적용해, 미리보기 주소의 요청에도 쿠키 송수신을 허용한다고 브라우저에 응답하고 있었다. 미리보기 주소는 저장소에 브랜치를 push할 수 있는 사람이면 누구나 생성할 수 있다. 1인 저장소라 당장의 위험은 낮지만, ==관리자 세션 쿠키를 허용하는 주소의 범위가 필요보다 넓었다==.

## 브라우저 규칙이 이미 차단하고 있었다

세션 쿠키가 `SameSite=Lax`이므로, 미리보기(`*.workers.dev`)에서 API(`hyeoniverse.com`)로 보내는 fetch에는 쿠키가 포함되지 않는다. 그래서 미리보기에서는 로그인해도 관리자로 인식되지 않는다. 와일드카드가 credentials를 허용했어도 ==브라우저 규칙이 먼저 차단하고 있었다==.

그래도 수정했다. 방어가 브라우저의 쿠키 전송 규칙 하나뿐이면, 쿠키 속성을 바꾸거나 API 주소를 옮기는 시각에 경고 없이 허용 상태가 된다. 예를 들어 다음 두 변경은 각각 한 줄이지만, 어느 쪽이든 미리보기에서 보낸 요청에 세션 쿠키가 포함되기 시작한다.

| 변경                                                          | 결과                                                |
| ------------------------------------------------------------- | --------------------------------------------------- |
| 다른 기능을 위해 세션 쿠키를 `SameSite=None; Secure`로 바꾼다 | 사이트가 달라도 쿠키가 전송된다                     |
| API를 `*.workers.dev` 아래 주소로 옮긴다                      | 미리보기와 API가 같은 사이트가 되어 쿠키가 전송된다 |

==서버도 "이 출처에는 쿠키를 허용하지 않는다"는 규칙을 가져야 한다==.

## 검토한 방법

| 방법                                             | 장점                                                     | 단점                                                       |
| ------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------- |
| 그대로 둔다 (SameSite=Lax에 의존)                | 작업이 없다                                              | 쿠키 속성이나 API 주소가 바뀌면 경고 없이 허용된다         |
| 와일드카드를 삭제한다                            | 허용 범위가 가장 좁다                                    | PR 미리보기에서 API를 호출할 수 없어 글·사진이 비어 보인다 |
| 와일드카드는 읽기만, 쿠키는 명시한 주소만 (선택) | 미리보기는 기존처럼 읽기 가능. 관리자 기능은 서버가 차단 | 분류 함수와 가드 검사가 추가된다                           |

## 변경 내용

허용 목록 검사가 일치 여부(`true`/`false`)만 반환하던 것을 **일치 방식**을 반환하도록 변경했다.

| 반환값    | 뜻                               | 예                                                |
| --------- | -------------------------------- | ------------------------------------------------- |
| `exact`   | 목록에 그대로 적은 주소와 일치   | `https://macfolio.hyeoniverse.com`                |
| `pattern` | `*`가 든 항목에 일치             | `https://feat-x-macfolio.hyeoniverse.workers.dev` |
| `null`    | 목록 밖, 또는 `Origin` 헤더 없음 | `https://evil.example`                            |

이 결과를 두 곳에서 사용한다.

1. **CORS 응답**: `exact`에만 `Access-Control-Allow-Credentials: true`를 보낸다. `pattern`은 `Allow-Origin`만 보내고 credentials는 허용하지 않는다. NestJS의 `enableCors`는 요청마다 옵션을 결정하는 함수를 받을 수 있으므로([NestJS 문서: CORS](https://docs.nestjs.com/security/cors)), Origin에 따라 `{ origin, credentials }`를 요청 단위로 결정한다
2. **관리자 가드**: 요청에 `Origin` 헤더가 있는데 `exact`가 아니면 세션이 유효해도 403을 반환한다. Origin이 없는 요청(같은 사이트 탐색, curl)은 CORS 대상이 아니므로 그대로 둔다. 브라우저가 어떤 이유로 쿠키를 포함해 보내더라도 관리자 기능은 허용되지 않는다

가드가 따로 필요한 이유는 CORS가 막는 대상에 있다. CORS 헤더는 브라우저가 응답을 페이지에 넘길지를 정할 뿐, 요청이 서버에 도착해 처리되는 것을 막지 않는다. 단순 요청은 사전 요청 없이 서버에 바로 도착하므로, 서버가 Origin을 보고 처리 여부를 직접 결정해야 한다.

![CORS 헤더와 관리자 가드의 역할](./images/preview-cors-read-only-two-gates.svg '요청은 먼저 서버에 도착해 AdminGuard가 처리 여부를 정하고, 응답의 CORS 헤더는 브라우저가 그 응답을 스크립트에 넘길지 정한다')

CORS 설정은 다음 세 줄이 전부다.

```ts
const classifyOrigin = originClassifier(config.corsOrigins);
app.enableCors((req, callback) => {
	const match = classifyOrigin(req.headers.origin);
	callback(null, { origin: match !== null, credentials: match === 'exact' });
});
```

`originClassifier`는 `*`가 없는 주소를 `Set`에 저장해 문자열로 비교하고, `*`가 포함된 주소는 나머지 문자를 이스케이프한 뒤 `*`만 `[a-z0-9-]+`로 치환한 정규식으로 변환한다. 예를 들어 `https://*-macfolio.hyeoniverse.workers.dev`는 `^https://[a-z0-9-]+-macfolio\.hyeoniverse\.workers\.dev$`가 된다. 관리자 가드는 같은 분류 함수로 `cookiesAllowedFrom`을 생성해 사용한다.

```ts
// apps/api/src/common/cors.ts
export function originClassifier(allowed: string[]): (origin: string | undefined) => OriginMatch {
	const exact = new Set(allowed.filter((entry) => !entry.includes('*')));
	const patterns = allowed
		.filter((entry) => entry.includes('*'))
		.map((entry) => new RegExp(`^${entry.split('*').map(escape).join('[a-z0-9-]+')}$`));
	return (origin) => {
		if (!origin) return null;
		if (exact.has(origin)) return 'exact';
		return patterns.some((pattern) => pattern.test(origin)) ? 'pattern' : null;
	};
}
```

==`*` 자리에 `[a-z0-9-]+`만 허용하는 것이 핵심이다==. `*`를 `.*`로 바꾸면 점과 다른 도메인까지 일치해, 공격자가 자기 도메인으로 허용 목록을 통과할 수 있다. 시험은 다음 주소가 모두 거부되는지 확인한다.

| 주소                                                  | 우회 시도                       |
| ----------------------------------------------------- | ------------------------------- |
| `https://x.evil-macfolio.hyeoniverse.workers.dev`     | `*` 자리에 점(하위 도메인) 포함 |
| `https://a-macfolio.hyeoniverse.workers.dev.evil.com` | 뒤에 다른 도메인 추가           |
| `http://…`로 시작하는 주소                            | 스킴 변경                       |
| `*` 자리가 빈 주소                                    | 빈 브랜치 이름                  |

정규식 앞뒤를 `^…$`로 고정하고 메타 문자를 이스케이프하므로 이런 주소는 일치하지 않는다. 두 번째 주소는 `^`·`$` 고정이 없으면 일치하고, 점을 이스케이프하지 않으면 `.`이 아무 문자에나 일치해 `hyeoniverseXworkers` 같은 주소도 통과한다.

```ts
// apps/api/src/auth/admin.guard.ts (더한 부분)
if (!this.cookiesAllowed(request.headers.origin))
	throw new ForbiddenException('이 주소에서는 관리자 기능을 쓸 수 없습니다.');
```

![Origin을 exact, pattern, null로 나누고 CORS 응답과 관리자 가드가 각각 다르게 답하는 도식](./images/preview-cors-read-only-origin.svg 'exact만 쿠키를 허용하고 관리자 API를 통과한다. * 패턴에 일치한 미리보기는 읽기만 허용')

### 프론트엔드: API와 사이트가 다르면 쿠키 없이 요청한다

서버 쪽 변경만으로는 미리보기가 글을 읽지 못한다. 프론트엔드의 요청 함수(`apps/react/src/shared/api/client.ts`)가 모든 요청에 `credentials: 'include'`를 붙이고 있었기 때문이다. 앞의 [credentials](#credentials-쿠키를-포함한-교차-출처-요청) 절에서 설명한 대로, credentials 요청은 응답에 `Access-Control-Allow-Credentials: true`가 없으면 브라우저가 응답 전체를 차단한다. 서버는 미리보기 주소에 이 헤더를 보내지 않으므로, 미리보기에서 보내는 글 목록·댓글 같은 공개 데이터 요청도 모두 실패한다.

| 미리보기의 요청                    | 서버 응답 헤더                                       | 브라우저 처리                            |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `credentials: 'include'` (수정 전) | `Allow-Origin: <미리보기>`, `Allow-Credentials` 없음 | 응답 차단, 콘솔에 CORS 오류              |
| `credentials: 'omit'` (수정 후)    | `Allow-Origin: <미리보기>`                           | 응답을 페이지에 전달, 쿠키는 보내지 않음 |

미리보기에서 쿠키를 보낼 이유도 없다. 미리보기(`hyeoniverse.workers.dev`)와 API(`hyeoniverse.com`)는 사이트가 달라 `SameSite=Lax` 쿠키가 요청에 실리지 않는다. 그래서 요청 함수가 ==페이지와 API의 사이트가 같을 때만 쿠키를 붙이도록== 바꿨다. 판단은 `credentials.ts`의 순수 함수 하나가 맡는다.

```ts
// apps/react/src/shared/api/credentials.ts
export function credentialsFor(pageHostname: string, apiUrl: string): RequestCredentials {
	// 호스트 이름의 끝 두 라벨(hyeoniverse.com)을 사이트로 보고 비교한다. localhost·IP는 include
}
```

| 페이지 주소                               | API 주소                       | 결과      |
| ----------------------------------------- | ------------------------------ | --------- |
| `macfolio.hyeoniverse.com` (배포 사이트)  | `macfolio-api.hyeoniverse.com` | `include` |
| `feat-x-macfolio.hyeoniverse.workers.dev` | `macfolio-api.hyeoniverse.com` | `omit`    |
| `localhost:5173` (로컬 개발)              | `localhost:4000`               | `include` |

보안 측면에서는 쿠키를 보내는 범위가 더 좁아진다. 서버의 CORS 응답과 관리자 가드는 그대로이고, 미리보기 화면은 처음부터 쿠키 없이 공개 API만 호출한다. 관리자 기능은 미리보기에서 열리지 않으므로 로컬에서 확인한다.

## 확인

- 단위: `exact`·`pattern`·거절 분류, 쿠키 허용 판단
- 프론트엔드 단위: 배포 사이트·로컬은 `include`, 미리보기(`workers.dev`)는 `omit` (`apps/react/src/shared/api/credentials.test.ts`)
- e2e: 사이트 주소에는 `Allow-Credentials: true`, 미리보기 주소에는 헤더 없음, 관리자 API에 미리보기·다른 사이트 Origin을 지정하면 403

시험 이름은 `apps/api/src/common/cors.test.ts`의 "*에는 점이 오지 않는다: 다른 도메인이나 다른 계정으로 넓어지지 않는다", "그대로 적은 주소는 exact, *에 맞은 주소는 pattern", "exact 주소와 Origin이 없는 요청(같은 사이트 이동, curl)에만 쿠키를 허용한다"와 `apps/api/test/auth.e2e.test.ts`의 "허용한 사이트 주소가 아닌 Origin이 붙으면 세션이 맞아도 403 (PR 미리보기·다른 사이트에서는 관리자 기능이 열리지 않는다)"이다. 이 시험은 같은 세션 쿠키로 Origin만 바꿔 세 번 요청한다.

| Origin                                                       | `/auth/me` |
| ------------------------------------------------------------ | ---------- |
| `http://localhost:5173` (개발용, 그대로 적은 주소)           | 200        |
| `https://feat-x-macfolio.hyeoniverse.workers.dev` (미리보기) | 403        |
| `https://evil.example`                                       | 403        |

코드 변경은 `cors.ts`·`app.setup.ts`·`admin.guard.ts` 세 파일에서 추가·삭제한 줄을 합쳐 66줄이다(`7db1f994a`). 같은 커밋에서 `docs/deployment.md`와 `docs/backend-design.md`의 CORS 설명도 수정했다.

## 남은 과제와 정리

- 미리보기에서는 관리자 기능을 확인할 수 없다. 로컬에서 확인한다.
- 미리보기 주소 패턴의 읽기 허용은 유지된다. 공개 API(글·사진 읽기)만 사용하므로 문제가 없지만, 공개 API 응답에 개인 정보가 포함되지 않는지는 계속 점검해야 한다.
- 브라우저 규칙(SameSite)의 차단과 서버의 차단은 별개의 방어 계층이다. 한 계층이 이미 차단하고 있어도 설정 한 줄로 사라질 수 있으므로, 서버에도 같은 규칙을 적용했다.
- 허용 목록 검사가 일치 여부 대신 일치 방식을 반환하도록 바꾸자, 같은 함수를 CORS와 가드 두 곳에서 각각의 목적에 맞게 사용할 수 있었다.

## 적용 방법

허용 주소는 서버 `api.env`의 한 줄로 설정한다. 명시한 주소는 쿠키까지, `*` 패턴에 일치한 주소는 읽기만 허용된다.

```bash
# ~/deploy/api.env
CORS_ORIGINS=https://macfolio.hyeoniverse.com,https://*-macfolio.hyeoniverse.workers.dev
```

```bash
cd ~/deploy && docker compose up -d api
# 미리보기 주소로는 관리자 확인이 403이어야 한다
curl -s -o /dev/null -w '%{http_code}\n' -H 'Origin: https://feat-x-macfolio.hyeoniverse.workers.dev' \
  https://macfolio-api.hyeoniverse.com/auth/me
```

규칙은 [apps/api/src/common/cors.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/common/cors.ts)에 있고, 시험은 `pnpm --filter @macfolio/api test -- src/common/cors.test.ts`로 실행한다.

> [!TIP] 미리보기에서 관리자 화면이 필요한 경우
> 미리보기에서 관리자 화면이 필요하면 그 주소를 `*` 없이 명시해 추가하고, 확인 후 삭제한다.

## 관련 글

- [@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes)
- [Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions)
- [GitHub Actions를 커밋 SHA로 고정하고 Dependabot으로 업데이트 받기](/memo/supply-chain-security#github-actions-커밋-sha-고정과-dependabot)
- [Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)
- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-retrospective#7단계-보안)

<details>
<summary>참고 문헌</summary>

- MDN, [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- MDN, [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- MDN, [Access-Control-Allow-Credentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials)
- MDN, [Set-Cookie: SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value)
- WHATWG, [Fetch Standard: CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
- web.dev, [Understanding "same-site" and "same-origin"](https://web.dev/articles/same-site-same-origin)
- Mozilla, [Public Suffix List](https://publicsuffix.org/)
- NestJS, [CORS](https://docs.nestjs.com/security/cors)

</details>

<details>
<summary>사진 출처</summary>

- CORS 사전 요청 흐름도: Bluesmoon, Wikimedia Commons, [Flowchart showing Simple and Preflight XHR.svg](https://commons.wikimedia.org/wiki/File:Flowchart_showing_Simple_and_Preflight_XHR.svg), CC BY-SA 4.0

</details>

#MacFolio #보안 #CORS #NestJS
