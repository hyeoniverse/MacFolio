---
title: PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기
date: 2026-10-10
category: 개발 기록/MacFolio/배포·품질/보안
summary: PR 미리보기용 CORS 와일드카드가 쿠키(credentials)까지 허용하고 있었다. SameSite=Lax가 이미 차단하고 있었지만 서버에서도 차단하게 했다. 허용 목록을 exact·pattern으로 분류해 pattern에는 credentials를 허용하지 않고, 관리자 가드는 exact가 아닌 Origin을 403으로 거부한다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "CORS 와일드카드 범위 점검"을 처리한 기록이다([#182](https://github.com/hyeoniverse/MacFolio/pull/182)).

## 문제

API의 `CORS_ORIGINS`는 `https://macfolio.hyeoniverse.com,https://*-macfolio.hyeoniverse.workers.dev`다. 두 번째가 PR 미리보기 주소(`*` 자리에 브랜치 이름이 들어간다)다. 그런데 `enableCors`에 `credentials: true`를 일괄 적용해, 미리보기 주소의 요청에도 쿠키 송수신을 허용한다고 브라우저에 응답하고 있었다. 미리보기 주소는 저장소에 브랜치를 push할 수 있는 사람이면 누구나 생성할 수 있다. 1인 저장소라 당장의 위험은 낮지만, 관리자 세션 쿠키를 허용하는 주소의 범위가 필요보다 넓었다.

<details>
<summary>용어 정리</summary>

- **CORS**: 다른 출처(origin)의 JavaScript가 API를 호출할 수 있게 서버가 허용하는 규칙. 서버가 `Access-Control-Allow-Origin` 헤더로 해당 출처를 허용해야 브라우저가 응답을 스크립트에 전달한다
- **credentials**: CORS 요청에 쿠키를 포함하는 것. 서버가 `Access-Control-Allow-Credentials: true`를 함께 보내야 하고, 보내지 않으면 브라우저가 쿠키를 포함한 요청의 응답을 차단한다
- **SameSite=Lax**: 쿠키 속성. 다른 사이트에서 시작된 하위 요청에는 쿠키를 포함하지 않는다(최상위 탐색 GET은 예외). `macfolio.hyeoniverse.com`과 `macfolio-api.hyeoniverse.com`은 같은 사이트(`hyeoniverse.com`)라 쿠키가 전송되지만, `*.workers.dev`에서 호출하면 전송되지 않는다
- **Origin 헤더**: 브라우저가 교차 출처 요청에 요청을 보낸 출처를 기록하는 헤더. JavaScript가 변경할 수 없다

</details>

## 브라우저 규칙이 이미 차단하고 있었다

세션 쿠키가 `SameSite=Lax`이므로, 미리보기(`*.workers.dev`)에서 API(`hyeoniverse.com`)로 보내는 fetch에는 쿠키가 포함되지 않는다. 그래서 미리보기에서는 로그인해도 관리자로 인식되지 않는다. 와일드카드가 credentials를 허용했어도 브라우저 규칙이 먼저 차단하고 있었다.

그래도 수정했다. 방어가 브라우저의 쿠키 전송 규칙 하나뿐이면, 쿠키 속성을 바꾸거나 API 주소를 옮기는 시각에 경고 없이 허용 상태가 된다. 서버도 "이 출처에는 쿠키를 허용하지 않는다"는 규칙을 가져야 한다.

## 검토한 방법

| 방법                                             | 장점                                                     | 단점                                                       |
| ------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------- |
| 그대로 둔다 (SameSite=Lax에 의존)                | 작업이 없다                                              | 쿠키 속성이나 API 주소가 바뀌면 경고 없이 허용된다         |
| 와일드카드를 삭제한다                            | 허용 범위가 가장 좁다                                    | PR 미리보기에서 API를 호출할 수 없어 글·사진이 비어 보인다 |
| 와일드카드는 읽기만, 쿠키는 명시한 주소만 (선택) | 미리보기는 기존처럼 읽기 가능. 관리자 기능은 서버가 차단 | 분류 함수와 가드 검사가 추가된다                           |

## 변경 내용

허용 목록 검사가 일치 여부만 반환하던 것을 **일치 방식**(`exact`: 명시한 주소, `pattern`: `*` 패턴에 일치한 주소)을 반환하도록 변경했다. 이 결과를 두 곳에서 사용한다.

1. **CORS 응답**: `exact`에만 `Access-Control-Allow-Credentials: true`를 보낸다. `pattern`은 `Allow-Origin`만 보내고 credentials는 허용하지 않는다. NestJS의 `enableCors`는 요청마다 옵션을 결정하는 함수를 받을 수 있으므로([NestJS 문서: CORS](https://docs.nestjs.com/security/cors)), Origin에 따라 `{ origin, credentials }`를 요청 단위로 결정한다
2. **관리자 가드**: 요청에 `Origin` 헤더가 있는데 `exact`가 아니면 세션이 유효해도 403을 반환한다. Origin이 없는 요청(같은 사이트 탐색, curl)은 CORS 대상이 아니므로 그대로 둔다. 브라우저가 어떤 이유로 쿠키를 포함해 보내더라도 관리자 기능은 허용되지 않는다

CORS 설정은 다음 세 줄이 전부다.

```ts
const classifyOrigin = originClassifier(config.corsOrigins);
app.enableCors((req, callback) => {
	const match = classifyOrigin(req.headers.origin);
	callback(null, { origin: match !== null, credentials: match === 'exact' });
});
```

`originClassifier`는 `*`가 없는 주소를 `Set`에 저장해 문자열로 비교하고, `*`가 포함된 주소는 나머지 문자를 이스케이프한 뒤 `*`만 `[a-z0-9-]+`로 치환한 정규식으로 변환한다. 관리자 가드는 같은 분류 함수로 `cookiesAllowedFrom`을 생성해 사용한다.

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

`*` 자리에 `[a-z0-9-]+`만 허용하는 것이 핵심이다. 시험은 다음 주소가 모두 거부되는지 확인한다.

| 주소                                                  | 우회 시도                       |
| ----------------------------------------------------- | ------------------------------- |
| `https://x.evil-macfolio.hyeoniverse.workers.dev`     | `*` 자리에 점(하위 도메인) 포함 |
| `https://a-macfolio.hyeoniverse.workers.dev.evil.com` | 뒤에 다른 도메인 추가           |
| `http://…`로 시작하는 주소                            | 스킴 변경                       |
| `*` 자리가 빈 주소                                    | 빈 브랜치 이름                  |

정규식 앞뒤를 `^…$`로 고정하고 메타 문자를 이스케이프하므로 이런 주소는 일치하지 않는다.

```ts
// apps/api/src/auth/admin.guard.ts (더한 부분)
if (!this.cookiesAllowed(request.headers.origin))
	throw new ForbiddenException('이 주소에서는 관리자 기능을 쓸 수 없습니다.');
```

![Origin을 exact, pattern, null로 나누고 CORS 응답과 관리자 가드가 각각 다르게 답하는 도식](./images/preview-cors-read-only-origin.svg 'exact만 쿠키를 허용하고 관리자 API를 통과한다. * 패턴에 일치한 미리보기는 읽기만 허용')

미리보기 동작은 바뀌지 않는다. 이전에도 읽기만 가능했고 지금도 읽기만 가능하다. 관리자 기능은 로컬에서 확인한다.

## 확인

- 단위: `exact`·`pattern`·거절 분류, 쿠키 허용 판단
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

규칙은 [apps/api/src/common/cors.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/common/cors.ts)에 있고, 시험은 `pnpm --filter @macfolio/api test -- src/common/cors.test.ts`로 실행한다. 미리보기에서 관리자 화면이 필요하면 그 주소를 `*` 없이 명시해 추가하고, 확인 후 삭제한다.

참고 문서: [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS), [NestJS CORS](https://docs.nestjs.com/security/cors).

## 관련 글

- [쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)
- [프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만](/memo/deploy-github-actions)
- [액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게](/memo/pin-actions-dependabot)
- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel)
- [리팩터링 7단계 — 보안](/memo/refactor-step7-security)

#MacFolio #보안 #CORS #NestJS
