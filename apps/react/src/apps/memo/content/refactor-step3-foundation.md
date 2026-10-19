---
title: 리팩터링 3단계 — 공통 기반 코드
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 리팩터링 3단계를 돌아본다. 파일마다 따로 하던 서버 요청, 브라우저 저장소, matchMedia 질문을 client.ts·storage.ts·media.ts 세 모듈로 모았다. 서버 요청 코드는 346줄에서 179줄이 됐고, 401 처리는 한 곳이 됐다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 3단계는 앱마다 되풀이하던 기반 코드 세 가지를 한 곳으로 모으는 일이었다.

## 왜

- 서버 요청: 12개 파일이 각자 `fetch`를 쓰고 `credentials: 'include'`가 26곳이었다. 오류와 401 처리가 파일마다 달랐다.
- 저장소: `localStorage`를 직접 쓰는 파일이 11개였다.
- 화면 크기: `useIsMobile`·`useViewport`가 있는데도 `matchMedia`·`innerWidth`를 직접 쓰는 곳이 25곳이었다.

겉으로 드러난 증상도 있었다. 관리자 상태는 세션 만료 시각에 맞춘 타이머로만 로그아웃으로 바뀌었다. 그래서 서버에서 세션을 지웠거나 쿠키가 사라지면, 저장이 401로 실패한 뒤에도 관리자 메뉴가 그대로 보였다. 401을 받은 파일만 알고 나머지는 몰랐기 때문이다. 분석 이벤트의 기기 구분은 `innerWidth < 768`로 따로 정해져 있어서, 가로로 눕힌 휴대폰은 화면은 휴대폰 모양인데 통계에는 데스크톱으로 잡혔다.

사진 캡션을 저장하는 함수 하나만 봐도 같은 일을 매번 적었다.

```ts
// apps/react/src/apps/photos/captionsApi.ts (#196 전)
const response = await fetch(`${env.apiUrl}/photos/captions`, {
	method: 'PUT',
	credentials: 'include',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ src, caption }),
	signal: AbortSignal.timeout(15_000),
});
if (!response.ok) {
	const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
	const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
	throw new Error(message || '캡션을 저장하지 못했습니다.');
}
```

주소, 쿠키, JSON 머리, 시간 제한, 오류 몸통 읽기가 모두 여기 있다. 다른 파일은 시간 제한을 빠뜨리거나, 오류 몸통의 배열을 첫 줄만 읽거나, 서버에 닿지 못한 경우를 따로 다루지 않았다.

## 고른 방법과 버린 방법

| 방법                                | 좋은 점                                  | 걸린 점                                                                        |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| axios·ky 같은 HTTP 라이브러리       | 인터셉터, 재시도, 시간 제한이 들어 있다  | 의존성이 하나 늘고, 쓰는 기능은 그중 일부다. 응답·오류 모양을 다시 맞춰야 한다 |
| TanStack Query로 요청과 캐시를 함께 | 다시 불러오기, 캐시, 로딩 상태           | 요청 방식이 아니라 상태 관리를 바꾸는 큰 일이라 3단계 범위를 넘는다            |
| `fetch` 위에 얇은 함수 하나 (고름)  | 지금 코드와 같은 `fetch`, 바꿀 것이 적다 | 재시도·캐시는 없다. 필요한 곳이 생기면 부르는 쪽이 한다                        |

이 사이트의 요청은 대부분 한 번 부르고 끝나는 것이라, 라이브러리가 주는 기능 대부분을 쓰지 않는다. 그래서 지금 파일들이 공통으로 하던 일만 함수 하나로 모았다. 저장소와 화면 질문도 같은 이유로 라이브러리 없이 작은 함수로 두었다.

## 무엇을 바꿨나

| 항목                 | PR   | 글                                                       |
| -------------------- | ---- | -------------------------------------------------------- |
| 공통 API 클라이언트  | #196 | [fetch 33곳을 client.ts 하나로](/memo/shared-api-client) |
| 브라우저 저장소 모듈 | #198 | [try/catch 열두 개를 하나로](/memo/shared-storage)       |
| 화면 질문 모듈       | #199 | [matchMedia 네 가지 표기를 하나로](/memo/shared-media)   |

## 구현

### 서버 요청: `api()`와 `apiFetch()`

![api() 한 번이 거치는 길](./images/refactor-step3-foundation-api.svg '닿지 못함, 401, 그 밖의 실패, 성공을 한 곳에서 나눈다')

`apiFetch()`는 응답을 그대로 돌려주고(상태 코드로 나눠야 하는 곳), `api()`는 그 위에서 JSON을 읽고 실패를 `ApiError`로 바꾼다.

```ts
// apps/react/src/shared/api/client.ts
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
	const response = await apiFetch(path, options);
	if (!response.ok) throw new ApiError(response.status, await reasonsOf(response, options.fallback));
	const text = await response.text();
	return (text ? JSON.parse(text) : null) as T;
}
```

`ApiError`의 `status`가 0이면 서버에 닿지 못한 것이다. 주소가 없거나, 서버가 꺼졌거나, 네트워크가 끊긴 경우를 한 문구로 알린다. 오류 몸통의 `message`는 문자열이든 배열이든 모두 읽고, NestJS가 붙이는 영어 기본 문구(`Unauthorized`, `ThrottlerException` 등)는 걸러 낸다. 그래서 위의 캡션 저장은 이렇게 줄었다.

```ts
// #196 뒤
const map = await api<Record<string, string>>('/photos/captions', {
	method: 'PUT',
	json: { src, caption },
	fallback: '캡션을 저장하지 못했습니다.',
});
```

401은 `onUnauthorized()`에 등록한 함수들을 부른다. 지금은 관리자 상태(`shared/auth/adminStore.ts`) 하나가 등록되어 있다. 어느 앱에서 401을 받든 `/auth/me`로 다시 물어, 메뉴 막대와 모든 앱이 함께 로그아웃 모양으로 바뀐다.

바깥 서비스(날씨, 효과음)는 이 함수를 거치지 않는다. 쿠키를 보내면 안 되고, 오류 모양도 다르기 때문이다.

### 저장소와 화면 질문

401은 한 곳에서 받아 관리자 상태를 바로 로그아웃으로 바꾸고, 429·401 문구는 서버가 적은 이유를 먼저 쓴다.
저장소 모듈은 키 이름을 한곳에 모으고, 읽기·쓰기 실패를 모두 삼킨다. 사생활 보호 창이나 저장 공간이 찼을 때 `localStorage`는 예외를 던지는데, 그때도 화면은 이번 방문 동안 메모리 값으로 동작해야 하기 때문이다.

```ts
// apps/react/src/shared/lib/storage.ts
export const STORAGE_KEYS = {
	settings: 'macfolio:settings', // public/theme-boot.js도 이 글자를 그대로 읽는다
	memoArrangement: 'macfolio:memo:arrangement',
	weatherPlaces: 'macfolio:weather:places',
	messages: 'macfolio:messages:v2', // 저장 형식이 바뀌면 키를 바꾼다
	window: (appName: string) => `macfolio:window:${appName}`,
	// …
} as const;
```

모든 키에 `macfolio:` 접두어를 붙여, 같은 주소에서 도는 라이브러리의 키와 섞이지 않게 했다. 휴지통의 '내 브라우저 데이터'도 이 목록을 기준으로 보여 주고 지운다.

화면 질문은 움직임 줄이기·어두운 화면·손가락 입력 세 가지를 `shared/lib/media.ts`로 모았다. `matchMedia`가 없는 환경(시험, 옛 브라우저)에서는 모두 `false`다. 전에는 `?.`로 막은 곳과 막지 않은 곳이 섞여, 같은 환경에서 한쪽은 `false`, 한쪽은 예외였다.

```ts
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
export const mediaMatches = (query: string): boolean => queryOf(query)?.matches ?? false;
export const prefersReducedMotion = () => mediaMatches(REDUCED_MOTION);
```

화면 크기는 `useViewport`의 `getViewport()` 하나로 묻고, 휴대폰 화면인지는 셸과 같은 `isMobileViewport`로 정한다. 분석 이벤트의 기기 구분도 이것을 쓰게 되어, 눕힌 휴대폰이 통계에서도 휴대폰으로 잡힌다.

## 전후

|                                     | 전                                      | 후                                        |
| ----------------------------------- | --------------------------------------- | ----------------------------------------- |
| 서버 요청 코드                      | 346줄                                   | 179줄, 사용처 19곳이 `api()`·`apiFetch()` |
| 저장소 코드                         | 134줄                                   | 53줄, 사용처 7곳                          |
| `matchMedia`·`innerWidth` 직접 사용 | 25곳, 네 가지 표기, 모바일 기준 두 가지 | 25곳을 `media.ts`·`getViewport()`로       |

![서버 요청 코드와 저장소 코드의 줄 수 전후 막대 그래프](./images/refactor-step3-foundation-lines.svg '기반 코드는 절반 아래로 줄고, 사용처는 한 함수를 부른다')

## 확인

- 단위 시험: `shared/api/client.test.ts` 10개(주소와 쿠키, JSON 머리말, 닿지 못함 → `ApiError(0)`, 401에서 핸들러 호출, 빈 몸통은 `null`, 서버 이유가 먼저이고 없으면 401·429 문구 등), `shared/lib/storage.test.ts` 6개, `shared/lib/media.test.ts` 3개.
- 세 PR은 사용처를 옮기는 일이라 E2E를 그대로 두고 통과시켰다. 가짜 API(`page.route`)가 주는 오류 몸통이 바뀌지 않았으니, 화면의 거절 문구가 같으면 옮긴 것이 맞다.
- 줄 수는 PR 전후에 요청·저장소 코드만 골라 셌다. 지금 `client.ts`는 111줄, `storage.ts`는 85줄, `media.ts`는 38줄이다.

## 일부러 남긴 것

부르는 쪽의 응답 모양 검사는 남겼다. 저장소 모듈은 읽기·쓰기 실패만 맡고, 읽은 값이 맞는 모양인지는 쓰는 쪽이 안다.

재시도와 캐시도 넣지 않았다. 서버 상태 표시처럼 주기적으로 묻는 곳은 이미 자기 주기를 갖고 있고, 쓰기 요청을 함수가 알아서 다시 보내면 같은 댓글이 두 번 올라갈 수 있다.

## 배운 것

- **증상은 "따로 하던 것"의 틈에서 났다.** 401을 받고도 관리자 메뉴가 남던 것, 눕힌 휴대폰이 통계에서 데스크톱이던 것 모두 같은 일을 두 곳에서 다르게 해서 생겼다.
- **얇게 둔다.** `api()`는 이 사이트가 이미 하던 일만 한다. 기능을 더 넣지 않으니 옮기는 PR이 기계적인 바꾸기가 되었다.

관련 글: [fetch 33곳을 client.ts 하나로](/memo/shared-api-client) · [try/catch 열두 개를 하나로](/memo/shared-storage) · [matchMedia 네 가지 표기를 하나로](/memo/shared-media). PR: [#196](https://github.com/hyeoniverse/MacFolio/pull/196), [#198](https://github.com/hyeoniverse/MacFolio/pull/198), [#199](https://github.com/hyeoniverse/MacFolio/pull/199).

이전 단계: [2단계 — 폴더 구조와 의존](/memo/refactor-step2-structure) · 다음 단계: [4단계 — 공통 컴포넌트 설계](/memo/refactor-step4-components)

#MacFolio #리팩터링 #React #TypeScript
