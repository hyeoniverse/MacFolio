---
title: fetch 33곳을 client.ts 하나로 — 공통 API 클라이언트
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: 서버를 부르는 파일 22개가 저마다 credentials·JSON 머리말·try/catch·실패 문구를 적고 있었다. 111줄짜리 client.ts의 api()·apiFetch()로 모으고, 401은 한 곳에서 받아 관리자 상태를 바로 로그아웃으로 바꾼다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 3단계 "공통 기반 코드"의 첫 항목.

## 무엇이 흩어져 있었나

서버(apps/api)를 부르는 파일을 세어 보니 22개, `credentials: 'include'`가 33곳이었다. 하나하나는 짧지만 모두 같은 일을 조금씩 다르게 했다.

- 네트워크 실패 문구가 네 가지: "서버에 연결할 수 없습니다.", "서버에 연결하지 못했습니다.", "…잠시 뒤 다시 시도해 주세요." 붙은 것과 안 붙은 것
- 401 문구가 두 가지: "관리자 로그인이 필요합니다."와 "관리자 로그인이 끝났습니다. 다시 로그인해 주세요."
- 서버가 주는 `message`가 문자열일 때와 배열일 때를 파일마다 따로 처리 (`join(' ')`, `[0]`, 그대로 배열)
- 시간 제한이 5초·10초·15초·20초, 없는 곳도 많았다
- 세션이 끝났을 때: 글 저장은 401을 받아도 화면은 여전히 로그인한 것처럼 보였다. 상태를 바꾸는 코드는 만료 시각 타이머뿐이었다

![전: 파일마다 fetch, 후: client.ts 하나](./images/shared-api-client-before-after.svg)

## 고른 방법과 버린 방법

| 방법                               | 장점                             | 단점                                                       |
| ---------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| axios·ky 같은 HTTP 라이브러리      | 인터셉터·시간 제한이 이미 있다   | 의존성이 늘고, 실패 문구·이유 배열 규칙은 결국 직접 적는다 |
| TanStack Query 같은 서버 상태 도구 | 캐시·다시 시도까지 맡는다        | 22개 파일의 호출 방식이 모두 바뀐다. 이번 일보다 훨씬 크다 |
| `fetch` 위에 얇은 함수 둘          | 의존성 0, 옮기는 일이 기계적이다 | 캐시 같은 기능은 없다(지금 필요 없다)                      |

이번 목표는 "같은 일을 같은 방식으로"였다. 호출 방식을 크게 바꾸는 도구는 그다음에 따로 판단할 일이라, `fetch` 위에 얇은 함수를 두는 쪽을 골랐다.

## client.ts가 하는 일

`shared/api/client.ts`에 두 함수를 뒀다.

| 함수                      | 쓰는 때                                       | 실패하면                                      |
| ------------------------- | --------------------------------------------- | --------------------------------------------- |
| `api<T>(path, options)`   | JSON을 받을 때 (대부분)                       | `ApiError` (status, reasons, 첫 줄이 message) |
| `apiFetch(path, options)` | 상태 코드로 분기할 때 (403은 "내 것 아님" 등) | 서버에 닿지 못했을 때만 `ApiError(0)`         |

옵션은 `method`, `json`(JSON 머리말과 함께), `body`(FormData 그대로), `timeout`(기본 15초, 0이면 없음), `fallback`(서버가 이유를 안 줬을 때 문구). 주소는 `env.apiUrl`, 쿠키는 언제나 함께 보낸다.

![api()가 응답을 나누는 방식](./images/shared-api-client-flow.svg)

실패 문구는 세 상수로 정했다. `UNREACHABLE`(닿지 못함), `SIGNED_OUT`(401), `TOO_MANY`(429). 서버가 검증 오류를 배열로 주면 `ApiError.reasons`에 줄마다 들어가고, 화면은 `reasonsFrom(error)`로 그대로 보여 준다.

```ts
// 전 (postsApi.ts)
async function reasons(response: Response): Promise<string[]> {
	if (response.status === 401) return ['관리자 로그인이 끝났습니다. 다시 로그인해 주세요.'];
	const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
	return Array.isArray(body.message) ? body.message : [body.message ?? '저장하지 못했습니다.'];
}
async function send(fetchImpl, url, method, body) {
	try {
		const response = await fetchImpl(url, { method, credentials: 'include', ...(body !== undefined && { headers: …, body: JSON.stringify(body) }) });
		if (!response.ok) return { ok: false, errors: await reasons(response) };
		const text = await response.text();
		return { ok: true, body: text ? JSON.parse(text) : null };
	} catch {
		return { ok: false, errors: ['서버에 연결할 수 없습니다.'] };
	}
}

// 후
async function send(fetchImpl, apiUrl, path, method, json) {
	try {
		return { ok: true, body: await api(path, { method, json, apiUrl, fetchImpl, fallback: '저장하지 못했습니다.' }) };
	} catch (error) {
		return { ok: false, errors: reasonsFrom(error) };
	}
}
```

## 401을 한 곳에서 받는다

`onUnauthorized(handler)`를 두고 `adminStore`가 등록한다. 어떤 요청이든 401을 받으면 `refreshAdmin()`을 불러 `/auth/me`로 다시 묻고, 화면이 로그아웃된 상태로 바뀐다. 전에는 만료 시각 타이머만 있어서, 서버에서 세션을 지웠거나 쿠키가 사라졌을 때는 저장이 실패한 뒤에도 관리자 메뉴가 그대로 보였다.

`adminStore → client`로 한 방향이다. client가 adminStore를 알면 순환이 생기므로, client는 핸들러 집합만 들고 있다.

![adminStore가 client에 핸들러를 등록하고 client는 401에서 부르기만 하는 구조](./images/shared-api-client-unauthorized.svg '401 처리의 의존 방향')

## 그대로 둔 것

- 날씨(Open-Meteo), 효과음 파일, 글의 이미지 내려받기: 우리 서버가 아니라서 쿠키·실패 문구 규칙이 다르다
- `/health` 확인(`serverStatus.ts`): CORS로 막힌 것과 꺼진 것을 가르려고 `no-cors`로 한 번 더 보내는 특수한 흐름
- 분석 이벤트 보내기: `sendBeacon`이 먼저고 fetch는 `keepalive` 대안이라 클라이언트에 넣으면 오히려 복잡하다
- 시험이 넣어 주던 `fetchImpl` 인자: 모듈 서명은 그대로 두고 옵션으로 넘긴다. 시험 쪽은 요청 모양을 `objectContaining`으로 느슨하게 맞췄다 (이제 `signal`·`headers`가 늘 붙으므로)

## 숫자

| 항목                         | 전  | 후  |
| ---------------------------- | --- | --- |
| `credentials: 'include'`     | 33  | 3   |
| 서버를 직접 `fetch`하는 파일 | 22  | 3   |
| 바뀐 파일의 줄 수            | 346 | 179 |
| 네트워크 실패 문구 종류      | 4   | 1   |

바뀐 파일은 34개(583줄 추가, 346줄 삭제)였다. 늘어난 줄의 대부분은 새 `client.ts`(111줄)와 그 시험이다. 위 표의 "346 → 179"는 옮긴 `*Api.ts`들의 줄 수만 센 것이다.

## 확인

`apps/react/src/shared/api/client.test.ts`에 시험 10개를 두었다. 가짜 `fetch`를 넘겨 요청 모양과 응답 처리를 본다.

- 요청: "기본 주소 뒤에 경로를 붙이고 쿠키를 함께 보낸다", "json을 주면 JSON 머리말과 함께 보낸다", "body(FormData)는 그대로, timeout 0이면 signal 없이 보낸다"
- 실패: "주소가 없거나 서버에 닿지 못하면 ApiError(0)", "401을 받으면 등록한 핸들러를 부른다", "실패하면 서버가 준 이유를 담은 ApiError", "이유가 없으면 fallback", "서버가 적은 이유가 먼저, 없으면 401·429는 정해진 문구"
- 응답: "JSON을 돌려주고, 몸통이 비어 있으면 null"
- 화면용: `reasonsFrom` — "Error의 message, 아니면 fallback"

옮긴 앱들의 기존 시험과 E2E는 요청 모양을 느슨하게 맞춘 것 말고는 그대로 통과했다.

## 남은 것·배운 것

- 실패 문구가 네 가지였다는 것은 누군가 매번 새로 적었다는 뜻이다. 같은 일을 하는 코드가 22곳이면, 조금씩 다른 것이 오히려 정상이다. 한 곳으로 모으면 다름이 사라진다.
- 세션 만료를 타이머 하나로만 알던 것은 실제 버그였다. "401을 받았다"는 사실이 가장 확실한 신호다.
- 순환을 피하려고 "등록" 방식을 썼다. 아래 모듈이 위 모듈을 알아야 할 때는 위에서 함수를 넘겨받는다.
- 우리 서버가 아닌 곳(Open-Meteo 등)까지 억지로 넣지 않았다. 규칙이 다른 것을 한 함수에 넣으면 옵션만 늘어난다.

다음은 같은 단계의 `localStorage` 접근과 화면 크기 판단(`useIsMobile`·`useViewport`) 통일.

## 쓰는 방법

새로 서버를 부를 때는 `fetch`를 쓰지 말고 [apps/react/src/shared/api/client.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/shared/api/client.ts)를 거친다. 쿠키, JSON 머리말, 오류 모양, 401 처리가 한 곳에 있다. 시험은 [apps/react/src/shared/api/client.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/shared/api/client.test.ts).

```bash
cd apps/react && npx vitest run src/shared/api
grep -rn "fetch(" src --include=*.ts --include=*.tsx | grep -v shared/api   # 새로 생긴 직접 호출이 없는지
```

참고 문서: [MDN Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), [credentials 옵션](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials).

## 관련 글

- 이어서 localStorage 접근을 모은 일: /memo/shared-storage
- 리팩터링 3단계 정리: /memo/refactor-step3-foundation
- 글 저장 규칙을 contracts로 옮긴 일: /memo/contracts-posts
- PR: https://github.com/hyeoniverse/MacFolio/pull/196

#MacFolio #리팩터링 #React #fetch
