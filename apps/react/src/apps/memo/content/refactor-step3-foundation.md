---
title: 리팩터링 3단계 — 공통 기반 코드
date: 2026-10-18
category: 개발기/MacFolio/설계
summary: 리팩터링 3단계 회고. 파일마다 따로 구현하던 서버 요청, 브라우저 저장소, matchMedia 조회를 client.ts·storage.ts·media.ts 세 모듈로 통합했다. 서버 요청 코드는 346줄에서 179줄이 됐고, 401 처리는 한 곳으로 모였다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 3단계는 앱마다 반복하던 기반 코드 세 가지를 한 곳으로 통합하는 작업이었다.

## 배경

| 영역      | 상태                                                                                                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 서버 요청 | 12개 파일이 각자 [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)를 호출하고 [`credentials: 'include'`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials)가 26곳. 오류와 401 처리가 파일마다 다름 |
| 저장소    | `localStorage`를 직접 사용하는 파일 11개                                                                                                                                                                                                   |
| 화면 크기 | `useIsMobile`·`useViewport`가 있는데도 [`matchMedia`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)·`innerWidth`를 직접 사용하는 곳 25곳                                                                             |

사용자에게 보이는 증상도 있었다.

- **401 이후에도 남는 관리자 메뉴**: 관리자 상태는 세션 만료 시각에 맞춘 타이머로만 로그아웃 상태로 바뀌었다. 그래서 서버에서 세션을 삭제했거나 쿠키가 사라지면, 저장이 401로 실패한 뒤에도 관리자 메뉴가 그대로 표시됐다. 401을 받은 파일만 그 사실을 알고 나머지는 알 수 없었기 때문이다.
- **가로 방향 휴대폰의 기기 분류**: 분석 이벤트의 기기 구분은 `innerWidth < 768`로 별도 정의되어 있어서, 가로 방향 휴대폰은 화면은 휴대폰 레이아웃인데 통계에는 데스크톱으로 집계됐다.

사진 캡션을 저장하는 함수 하나에도 공통 처리가 모두 반복되어 있었다.

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

기본 주소, 쿠키, JSON 헤더, 시간 제한([`AbortSignal.timeout`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)), 오류 본문 파싱이 모두 이 안에 있다. 다른 파일은 시간 제한을 누락하거나, 오류 본문의 배열에서 첫 항목만 읽거나, 서버에 연결하지 못한 경우를 별도로 처리하지 않았다.

## 채택한 방법과 제외한 방법

| 방법                                                                     | 장점                                        | 단점                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------- |
| axios·ky 같은 HTTP 라이브러리                                            | 인터셉터, 재시도, 시간 제한이 내장되어 있다 | 의존성이 하나 늘고, 사용하는 기능은 일부다. 응답·오류 형태를 다시 맞춰야 한다 |
| [TanStack Query](https://tanstack.com/query/latest)로 요청과 캐시를 함께 | 재요청, 캐시, 로딩 상태                     | 요청 방식이 아니라 상태 관리를 바꾸는 큰 작업이라 3단계 범위를 넘는다         |
| `fetch` 위의 얇은 함수 하나 (채택)                                       | 기존 코드와 같은 `fetch`, 변경량이 적다     | 재시도·캐시는 없다. 필요한 곳이 생기면 호출하는 쪽에서 구현한다               |

이 사이트의 요청은 대부분 한 번 호출하고 끝나므로, 라이브러리가 제공하는 기능 대부분을 쓰지 않는다. 그래서 기존 파일들이 공통으로 수행하던 처리만 함수 하나로 통합했다. 저장소와 미디어 쿼리도 같은 이유로 라이브러리 없이 작은 함수로 구현했다.

10월 10일 밤에 서버 요청, `localStorage`, `useIsMobile` 순서로 한 항목씩 PR을 올렸다. 그런데 PR 변경 내용만으로는 목적이 드러나지 않았다. 그래서 각 PR 본문에 목적과 이유, 관련 이슈·PR 링크를 추가했다. 이 글의 "배경" 절이 그 시각에 작성한 내용이다.

## 변경 목록

| 항목                 | PR                                                       | 글                                                       |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| 공통 API 클라이언트  | [#196](https://github.com/hyeoniverse/MacFolio/pull/196) | [fetch 33곳을 client.ts 하나로](/memo/shared-api-client) |
| 브라우저 저장소 모듈 | [#198](https://github.com/hyeoniverse/MacFolio/pull/198) | [try/catch 열두 개를 하나로](/memo/shared-storage)       |
| 미디어 쿼리 모듈     | [#199](https://github.com/hyeoniverse/MacFolio/pull/199) | [matchMedia 네 가지 표기를 하나로](/memo/shared-media)   |

## 구현

### 서버 요청: `api()`와 `apiFetch()`

![api() 한 번이 거치는 길](./images/refactor-step3-foundation-api.svg '닿지 못함, 401, 그 밖의 실패, 성공을 한 곳에서 나눈다')

| 함수         | 반환값                          | 사용처                       |
| ------------ | ------------------------------- | ---------------------------- |
| `apiFetch()` | `Response` 그대로               | 상태 코드로 분기해야 하는 곳 |
| `api()`      | 파싱한 JSON, 실패 시 `ApiError` | 그 밖의 대부분               |

```ts
// apps/react/src/shared/api/client.ts
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
	const response = await apiFetch(path, options);
	if (!response.ok) throw new ApiError(response.status, await reasonsOf(response, options.fallback));
	const text = await response.text();
	return (text ? JSON.parse(text) : null) as T;
}
```

`ApiError`의 `status`가 0이면 서버에 연결하지 못한 경우다. 주소가 없거나, 서버가 중단됐거나, 네트워크가 끊긴 경우를 하나의 메시지로 안내한다. 오류 본문의 `message`는 문자열이든 배열이든 모두 읽고, NestJS가 붙이는 영어 기본 메시지(`Unauthorized`, `ThrottlerException` 등)는 필터링한다. 그 결과 위의 캡션 저장 코드는 다음과 같이 줄었다.

```ts
// #196 뒤
const map = await api<Record<string, string>>('/photos/captions', {
	method: 'PUT',
	json: { src, caption },
	fallback: '캡션을 저장하지 못했습니다.',
});
```

[401](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401) 응답을 받으면 `onUnauthorized()`에 등록한 함수들을 호출한다. 현재는 관리자 상태(`shared/auth/adminStore.ts`) 하나가 등록되어 있다. 어느 앱에서 401을 받든 `/auth/me`로 상태를 다시 조회해, 메뉴 막대와 모든 앱이 함께 로그아웃 상태로 전환된다. 401·[429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429) 메시지는 서버가 보낸 이유를 우선 표시한다.

외부 서비스(날씨, 효과음)는 이 함수를 거치지 않는다. 쿠키를 전송하면 안 되고, 오류 형태도 다르기 때문이다.

### 저장소와 미디어 쿼리

저장소 모듈은 키 이름을 한곳에 정의하고, 읽기·쓰기 예외를 모두 내부에서 처리한다. 사생활 보호 창이거나 저장 공간이 가득 찼을 때 `localStorage`는 예외를 던지는데, 그때도 화면은 이번 방문 동안 메모리 값으로 동작해야 하기 때문이다.

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

모든 키에 `macfolio:` 접두어를 붙여, 같은 출처에서 실행되는 라이브러리의 키와 충돌하지 않게 했다. 휴지통의 '내 브라우저 데이터'도 이 목록을 기준으로 표시하고 삭제한다.

미디어 쿼리는 동작 줄이기·다크 모드·터치 입력 세 가지를 `shared/lib/media.ts`로 통합했다. `matchMedia`가 없는 환경(시험, 구형 브라우저)에서는 모두 `false`를 반환한다. 이전에는 옵셔널 체이닝(`?.`)으로 방어한 곳과 방어하지 않은 곳이 섞여, 같은 환경에서 한쪽은 `false`, 다른 쪽은 예외였다.

```ts
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
export const mediaMatches = (query: string): boolean => queryOf(query)?.matches ?? false;
export const prefersReducedMotion = () => mediaMatches(REDUCED_MOTION);
```

화면 크기는 `useViewport`의 `getViewport()` 하나로 조회하고, 휴대폰 화면 여부는 셸과 같은 `isMobileViewport`로 판단한다. 분석 이벤트의 기기 구분도 이 함수를 쓰게 되어, 가로 방향 휴대폰이 통계에서도 휴대폰으로 집계된다.

## 전후

|                                     | 전                                      | 후                                        |
| ----------------------------------- | --------------------------------------- | ----------------------------------------- |
| 서버 요청 코드                      | 346줄                                   | 179줄, 사용처 19곳이 `api()`·`apiFetch()` |
| 저장소 코드                         | 134줄                                   | 53줄, 사용처 7곳                          |
| `matchMedia`·`innerWidth` 직접 사용 | 25곳, 네 가지 표기, 모바일 기준 두 가지 | 25곳 모두 `media.ts`·`getViewport()` 사용 |

![서버 요청 코드와 저장소 코드의 줄 수 전후 막대 그래프](./images/refactor-step3-foundation-lines.svg '기반 코드는 절반 아래로 줄고, 사용처는 한 함수를 부른다')

## 확인

- 단위 시험: `shared/api/client.test.ts` 10개(주소와 쿠키, JSON 헤더, 연결 실패 → `ApiError(0)`, 401에서 핸들러 호출, 빈 본문은 `null`, 서버 이유 우선이고 없으면 401·429 기본 메시지 등), `shared/lib/storage.test.ts` 6개, `shared/lib/media.test.ts` 3개.
- 세 PR은 사용처를 교체하는 작업이라 E2E를 수정하지 않고 통과시켰다. 가짜 API(`page.route`)가 반환하는 오류 본문이 같으므로, 화면의 거절 메시지가 같으면 교체가 올바르다고 판단했다.
- 줄 수는 PR 전후에 요청·저장소 코드만 골라 측정했다. 현재 `client.ts`는 111줄, `storage.ts`는 85줄, `media.ts`는 38줄이다.

## 의도적으로 남긴 것

- 호출하는 쪽의 응답 형태 검사는 유지했다. 저장소 모듈은 읽기·쓰기 예외만 처리하고, 읽은 값의 형태가 올바른지는 사용하는 쪽이 판단한다.
- 재시도와 캐시도 추가하지 않았다. 서버 상태 표시처럼 주기적으로 조회하는 곳은 이미 자체 주기를 갖고 있고, 쓰기 요청을 함수가 자동으로 재전송하면 같은 댓글이 두 번 등록될 수 있다.

## 배운 것

- **증상은 "따로 구현한 처리" 사이의 차이에서 발생했다.** 401을 받고도 관리자 메뉴가 남던 것, 가로 방향 휴대폰이 통계에서 데스크톱으로 집계되던 것 모두 같은 처리를 두 곳에서 다르게 구현해서 생겼다.
- **얇게 유지한다.** `api()`는 이 사이트가 이미 하던 처리만 수행한다. 기능을 추가하지 않으니 교체 PR이 기계적인 치환 작업이 되었다.

이전 단계: [2단계 — 폴더 구조와 의존](/memo/refactor-step2-structure) · 다음 단계: [4단계 — 공통 컴포넌트 설계](/memo/refactor-step4-components)

## 관련 글

- [fetch 33곳을 client.ts 하나로](/memo/shared-api-client)
- [try/catch 열두 개를 하나로](/memo/shared-storage)
- [matchMedia 네 가지 표기를 하나로](/memo/shared-media)
- [리팩터링 계획을 마치며 — 일곱 단계 전후](/memo/refactor-retrospective)

#MacFolio #리팩터링 #React #TypeScript
