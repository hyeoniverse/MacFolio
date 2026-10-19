---
title: PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: PR 미리보기용 CORS 와일드카드가 쿠키(credentials)까지 열고 있었다. SameSite=Lax가 이미 막고 있었지만 서버도 알게 했다. 허용 목록을 exact·pattern으로 나눠 pattern에는 credentials를 주지 않고, 관리자 가드는 exact가 아닌 Origin을 403으로 거절한다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))에 보안 항목으로 "CORS 와일드카드 범위 점검"을 적어 두었다. 이 글은 그 항목을 처리한 기록이다.

## 무엇이 걸렸나

API의 `CORS_ORIGINS`는 `https://macfolio.hyeoniverse.com,https://*-macfolio.hyeoniverse.workers.dev`다. 두 번째가 PR 미리보기 주소(브랜치 이름이 `*` 자리에 온다)다. 그런데 `enableCors`에 `credentials: true`를 한 번에 걸어 두어서, 미리보기 주소에서 온 요청도 쿠키를 주고받을 수 있다고 브라우저에 답하고 있었다. 미리보기는 저장소에 브랜치를 올릴 수 있는 사람이면 누구나 만들 수 있는 주소다. 혼자 하는 저장소라 당장 위험하지는 않지만, "관리자 세션을 붙여도 되는 주소"의 범위가 필요보다 넓었다.

## 용어

- **CORS**: 다른 주소(origin)의 자바스크립트가 API를 부를 수 있게 서버가 허락하는 규칙. 서버가 `Access-Control-Allow-Origin` 헤더로 "이 주소는 돼"라고 답해야 브라우저가 응답을 넘겨준다
- **credentials**: CORS 요청에 쿠키를 붙이는 것. 서버가 `Access-Control-Allow-Credentials: true`를 같이 보내야 하고, 안 보내면 브라우저가 쿠키 붙은 요청의 응답을 버린다
- **SameSite=Lax**: 쿠키의 속성. 다른 사이트에서 시작된 요청에는 쿠키를 붙이지 않는다(주소창에 쳐서 들어가는 이동은 예외). `macfolio.hyeoniverse.com`과 `macfolio-api.hyeoniverse.com`은 같은 사이트(`hyeoniverse.com`)라 쿠키가 가지만, `*.workers.dev`에서 부르면 가지 않는다
- **Origin 헤더**: 브라우저가 다른 주소로 요청할 때 "어디서 보낸 요청인지"를 적어 보내는 헤더. 자바스크립트가 바꿀 수 없다

## 실제로는 이미 막혀 있었다

세션 쿠키가 `SameSite=Lax`라, 미리보기(`*.workers.dev`)에서 API(`hyeoniverse.com`)로 보내는 fetch에는 쿠키가 애초에 붙지 않는다. 그래서 미리보기에서는 로그인해도 관리자로 보이지 않는다. 즉 와일드카드가 credentials까지 열어 두었어도, 브라우저 쪽 규칙이 먼저 막고 있었다.

그래도 고쳤다. 한 겹이 "브라우저가 알아서 안 붙인다"뿐이면, 쿠키 속성을 바꾸거나 API 주소를 옮기는 날 조용히 열린다. 서버가 스스로 "이 주소에는 쿠키를 안 받는다"고 알고 있어야 한다.

## 고를 수 있는 방법

| 방법                                                  | 좋은 점                                                 | 문제                                                     |
| ----------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| 그대로 둔다 (SameSite=Lax에 맡긴다)                   | 할 일이 없다                                            | 쿠키 속성이나 API 주소가 바뀌는 날 조용히 열린다         |
| 와일드카드를 지운다                                   | 가장 좁다                                               | PR 미리보기에서 API를 읽을 수 없어 글·사진이 비어 보인다 |
| 와일드카드는 읽기만, 쿠키는 그대로 적은 주소만 (고름) | 미리보기는 지금처럼 읽힌다. 관리자 기능은 서버가 막는다 | 분류 함수와 가드 한 겹이 늘어난다                        |

## 바꾼 것

허용 목록 검사가 "맞다/아니다"만 돌려주던 것을 **어떻게 맞았는지**(`exact`: 그대로 적은 주소, `pattern`: `*`에 맞은 주소)로 바꿨다. 그리고 두 군데서 쓴다.

1. **CORS 응답**: `exact`에만 `Access-Control-Allow-Credentials: true`. `pattern`은 `Allow-Origin`만 주고 credentials는 주지 않는다. NestJS의 `enableCors`는 요청마다 옵션을 정하는 함수를 받을 수 있어서, Origin을 보고 `{ origin, credentials }`를 그때 정한다
2. **관리자 가드**: 요청에 `Origin` 헤더가 있는데 `exact`가 아니면 세션이 맞아도 403. Origin이 없는 요청(같은 사이트 이동, curl)은 CORS 밖이라 그대로 둔다. 브라우저가 어떤 이유로 쿠키를 붙여 보내더라도 관리자 기능은 열리지 않는다

CORS 쪽은 이 세 줄이 전부다.

```ts
const classifyOrigin = originClassifier(config.corsOrigins);
app.enableCors((req, callback) => {
	const match = classifyOrigin(req.headers.origin);
	callback(null, { origin: match !== null, credentials: match === 'exact' });
});
```

`originClassifier`는 `*`가 없는 주소를 `Set`에 넣어 그대로 비교하고, `*`가 든 주소는 나머지 글자를 이스케이프한 뒤 `*`만 `[a-z0-9-]+`로 바꾼 정규식으로 만든다. 관리자 가드는 같은 분류 함수로 `cookiesAllowedFrom`을 만들어 쓴다.

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

`*` 자리에 `[a-z0-9-]+`만 허용하는 것이 중요하다. 시험은 `https://x.evil-macfolio.hyeoniverse.workers.dev`(점이 든 앞자리), `https://a-macfolio.hyeoniverse.workers.dev.evil.com`(뒤에 붙인 다른 도메인), `http://`로 시작하는 주소, `*` 자리가 빈 주소가 모두 거절되는지 본다. 앞뒤를 `^…$`로 묶고 메타 문자를 이스케이프하므로 이런 주소가 맞을 틈이 없다.

```ts
// apps/api/src/auth/admin.guard.ts (더한 부분)
if (!this.cookiesAllowed(request.headers.origin))
	throw new ForbiddenException('이 주소에서는 관리자 기능을 쓸 수 없습니다.');
```

![Origin을 exact, pattern, null로 나누고 CORS 응답과 관리자 가드가 각각 다르게 답하는 도식](./images/preview-cors-read-only-origin.svg 'exact만 쿠키를 받고 관리자 API를 지난다. *에 맞은 미리보기는 읽기만')

미리보기에서 바뀌는 것은 없다. 원래 읽기만 됐고 지금도 읽기만 된다. 관리자 기능을 미리보기에서 확인하려면 로컬에서 한다.

## 확인

- 단위: `exact`·`pattern`·거절 분류, 쿠키 허용 판단
- e2e: 사이트 주소에는 `Allow-Credentials: true`, 미리보기 주소에는 헤더 없음, 관리자 API에 미리보기·다른 사이트 Origin을 붙이면 403

시험 이름으로 보면 `apps/api/src/common/cors.test.ts`의 "*에는 점이 오지 않는다: 다른 도메인이나 다른 계정으로 넓어지지 않는다", "그대로 적은 주소는 exact, *에 맞은 주소는 pattern", "exact 주소와 Origin이 없는 요청(같은 사이트 이동, curl)에만 쿠키를 허용한다"와 `apps/api/test/auth.e2e.test.ts`의 "허용한 사이트 주소가 아닌 Origin이 붙으면 세션이 맞아도 403 (PR 미리보기·다른 사이트에서는 관리자 기능이 열리지 않는다)"이다. 이 시험은 같은 세션 쿠키로 Origin만 바꿔 세 번 부른다.

| Origin                                                       | `/auth/me` |
| ------------------------------------------------------------ | ---------- |
| `http://localhost:5173` (개발용, 그대로 적은 주소)           | 200        |
| `https://feat-x-macfolio.hyeoniverse.workers.dev` (미리보기) | 403        |
| `https://evil.example`                                       | 403        |

코드 변경은 `cors.ts`·`app.setup.ts`·`admin.guard.ts` 세 파일에서 더하고 뺀 줄을 합쳐 66줄이다(`7db1f994a`). 같은 커밋에서 `docs/deployment.md`와 `docs/backend-design.md`의 CORS 설명도 고쳤다.

## 남은 것·배운 것

- 미리보기에서 관리자 기능은 확인할 수 없다. 로컬에서 확인한다.
- 미리보기 주소 패턴 자체는 그대로 열려 있다. 공개 API(글·사진 읽기)만 쓰므로 괜찮지만, 공개 API에 개인 정보가 섞이지 않는지는 계속 봐야 한다.
- 브라우저 규칙(SameSite)이 막아 주는 것과 서버가 막는 것은 다른 겹이다. 한 겹이 이미 막고 있어도, 그 겹은 설정 한 줄로 사라질 수 있어서 서버 쪽에 같은 뜻을 한 번 더 적어 두었다.
- 허용 목록을 "맞다/아니다"가 아니라 "어떻게 맞았나"로 돌려주게 바꾸자, 같은 함수를 CORS와 가드 두 곳에서 서로 다른 뜻으로 쓸 수 있었다.

## 따라 하는 방법

허용 주소는 서버의 `api.env` 한 줄이다. 그대로 적은 주소는 쿠키까지, `*`로 맞은 주소는 읽기만 된다.

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

규칙은 [apps/api/src/common/cors.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/common/cors.ts), 시험은 `pnpm --filter @macfolio/api test -- src/common/cors.test.ts`. 미리보기에서 관리자 화면이 꼭 필요하면 그 주소를 `*` 없이 그대로 적어 넣고, 끝나면 지운다.

참고 문서: [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS), [NestJS CORS](https://docs.nestjs.com/security/cors).

## 관련 글

- [쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)
- [프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만](/memo/deploy-github-actions)
- [액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게](/memo/pin-actions-dependabot)

#MacFolio #보안 #CORS #NestJS
