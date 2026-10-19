---
title: try/catch 열두 개를 하나로 — 브라우저 저장소 모듈
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: 브라우저 저장소를 쓰는 파일 7개가 저마다 키 문자열, JSON.parse, try/catch(12개)를 들고 있었다. storage.ts에 키 목록과 readJson·writeJson을 두고 실패를 거기서 삼키게 해, 부르는 쪽에는 모양 검사만 남았다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 3단계의 둘째 항목. 첫째는 [공통 API 클라이언트](/memo/shared-api-client)였다.

## 무엇이 흩어져 있었나

브라우저에 남기는 값은 일곱 가지다. 설정, 메모 보기 설정과 최근 검색어, 날씨 장소와 단위, 창 위치, 서버 없이 쓴 메시지, 로그인하러 떠날 때 켜 둔 앱. 이것을 다루는 파일 일곱 개가 모두 같은 다섯 줄을 들고 있었다.

```ts
try {
	return JSON.parse(localStorage.getItem(KEY) ?? 'null');
} catch {
	return null;
}
```

쓰는 쪽도 마찬가지로 `try { localStorage.setItem(…) } catch { /* 저장하지 못해도 … */ }`가 파일마다 있었다. try/catch가 열두 개. 주석도 "저장하지 못해도 이번에는 그대로 보인다"가 여섯 가지 표현으로 흩어져 있었다.

왜 try/catch가 필요한가. Safari의 사생활 보호 창은 `localStorage.setItem`에서 `QuotaExceededError`를 던지고, 일부 설정에서는 `localStorage`에 손대는 순간 `SecurityError`가 난다. 그래서 저장은 늘 "되면 좋고 안 돼도 화면은 그대로"여야 한다. 그 규칙이 한 곳에 있지 않으니, 새 키를 더할 때마다 다섯 줄을 다시 베껴 썼다.

![세 층: 쓰는 곳 → storage.ts → 브라우저](./images/shared-storage-layers.svg)

![저장소가 실패하는 세 경우와 storage.ts가 돌려주는 값](./images/shared-storage-failures.svg '실패는 한 곳에서 삼킨다')

## 고른 방법과 버린 방법

| 방법                                        | 장점                             | 단점                                                           |
| ------------------------------------------- | -------------------------------- | -------------------------------------------------------------- |
| 상태 도구의 저장 기능(예: persist 미들웨어) | 상태와 저장이 함께 간다          | 이 사이트는 자체 `createStore`를 쓴다. 도구를 바꾸는 일이 된다 |
| IndexedDB 감싸개(idb-keyval 등)             | 큰 값, 비동기                    | 지금 값은 모두 작다. 첫 화면을 그릴 때 동기로 읽어야 한다      |
| 동기 `localStorage` 위에 얇은 함수          | 의존성 0, 옮기는 일이 기계적이다 | 큰 값에는 맞지 않는다(지금은 없다)                             |

설정은 첫 화면을 그리기 전에 읽어야 깜빡임이 없다. 동기로 읽는 `localStorage`가 맞고, 필요한 것은 실패를 한 곳에서 다루는 얇은 함수뿐이었다.

## storage.ts

`shared/lib/storage.ts`에 두 가지를 뒀다.

**키 목록** `STORAGE_KEYS`. 문자열 아홉 개가 파일 여섯 개에 흩어져 있던 것을 한 객체로 모았다. 창 위치처럼 앱 이름이 붙는 키는 함수다.

```ts
export const STORAGE_KEYS = {
	settings: 'macfolio:settings',
	memoArrangement: 'macfolio:memo:arrangement',
	weatherPlaces: 'macfolio:weather:places',
	appsBeforeLeaving: 'macfolio:apps-before-leaving', // sessionStorage
	window: (appName: string) => `macfolio:window:${appName}`,
	// …
} as const;
```

**읽고 쓰는 함수** 네 개. `readJson`은 없거나 JSON이 아니면 `null`, `writeJson`은 못 쓰면 `false`. `readString`·`writeString`은 문자열 그대로(기온 단위 `'c'`·`'f'`, 방문자 id). 둘째 인자로 `'session'`을 주면 `sessionStorage`. 한 번만 쓰는 값을 읽고 바로 지우는 `takeJson`도 있다.

부르는 쪽에는 **모양 검사**만 남는다. 저장된 JSON이 지금 코드가 기대하는 모양인지는 저장소가 알 수 없으므로, 그것은 원래대로 `parseSettings`·`parseArrangement` 같은 순수 함수가 한다.

```ts
// 전 (settingsStore.ts)
function load(): Settings {
	try {
		return parseSettings(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? 'null'));
	} catch {
		return parseSettings(null);
	}
}
export const settingsStore = createStore<Settings>(load());

// 후
export const settingsStore = createStore<Settings>(parseSettings(readJson(STORAGE_KEYS.settings)));
```

## 휴지통의 '내 브라우저 데이터'와 맞물리기

휴지통 앱에는 이 사이트가 브라우저에 남긴 것을 보여 주고 지우는 화면이 있다(`bin/siteStorage.ts`). 그 목록 `BROWSER_DATA`도 키 문자열을 따로 적고 있었는데, 이제 `STORAGE_KEYS`를 가리킨다. 코드 어딘가에 `'macfolio:…'` 키가 새로 생기면 `BROWSER_DATA`에 빠졌다고 알려 주는 시험은 그대로 둔다. 키가 한 파일에 모였으니 시험이 볼 곳도 사실상 하나다.

`public/theme-boot.js`만 예외다. React가 뜨기 전에 테마를 읽어 깜빡임을 막는 다섯 줄짜리 스크립트라 모듈을 가져올 수 없고, 키를 글자 그대로 적는다. `STORAGE_KEYS.settings` 옆에 그렇게 주석을 달았다.

## 확인

`apps/react/src/shared/lib/storage.test.ts`에 시험 6개를 두었다. 가짜 저장소를 넣어 실패를 흉내 낸다.

- "JSON으로 쓰고 읽는다. 없으면 null"
- "JSON이 아니면 null"
- "local과 session을 가른다"
- "takeJson은 읽고 지운다"
- "저장소가 던지면 조용히 실패한다"
- "저장소 접근 자체가 막히면 null"

마지막 둘이 이 모듈이 있는 이유다. 전에는 파일마다 이 경우를 다뤘지만 시험한 곳은 없었다.

## 숫자

| 항목                              | 전  | 후                 |
| --------------------------------- | --- | ------------------ |
| `localStorage`를 직접 만지는 파일 | 7   | 1                  |
| try/catch                         | 12  | 4 (storage.ts 안)  |
| 키 문자열이 적힌 파일             | 6   | 1 (+theme-boot.js) |
| 바뀐 파일의 줄 수                 | 134 | 53                 |

PR 전체로는 14파일, 322줄 추가와 134줄 삭제였다. 늘어난 줄은 새 `storage.ts`와 시험이다.

## 남은 것·배운 것

- 이 글을 쓰며 다시 찾아보니 지금도 `localStorage`를 실제로 만지는 파일은 `storage.ts` 하나다. 다른 파일에 나오는 `localStorage`는 모두 주석이다. 키 목록은 그사이 12개로 늘었다(바탕화면 아이콘 자리, 메모 사이드바·목록 폭 등). 새 키도 모두 이 객체에 더해졌다.
- 실패를 삼키는 코드는 한 곳에 있어야 시험할 수 있다. 열두 곳에 흩어진 try/catch는 아무도 시험하지 않았다.
- 키 문자열을 한 객체로 모으면 "이 사이트가 브라우저에 무엇을 남기나"라는 질문에 파일 하나로 답할 수 있다. 개인정보 안내(휴지통의 '내 브라우저 데이터')와도 맞물린다.
- 모듈을 가져올 수 없는 곳(`theme-boot.js`)은 예외로 두고 양쪽에 주석을 단다. 억지로 하나로 만들려다 첫 화면이 늦어지면 손해다.

다음은 같은 단계의 마지막, 화면 크기 판단(`matchMedia`·`innerWidth` 25곳)을 `useIsMobile`·`useViewport`로 통일.

## 쓰는 방법

브라우저 저장소는 [apps/react/src/shared/lib/storage.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/shared/lib/storage.ts)로만 읽고 쓴다. 사생활 보호 창처럼 저장소가 막힌 브라우저에서도 앱이 깨지지 않게 try/catch가 거기 한 번 있다.

```bash
cd apps/react
npx vitest run src/shared/lib/storage.test.ts
grep -rn "localStorage\|sessionStorage" src | grep -v "shared/lib/storage\|\.test\."   # 새 직접 사용이 없는지
```

손으로 확인할 때는 개발자 도구 Application → Local Storage에서 값을 지우거나 망가뜨린 뒤 새로 고침해, 앱이 기본값으로 뜨는지 본다. 휴지통의 '내 브라우저 데이터'와 맞물리는 방식은 위 절에 있다.

참고 문서: [MDN Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).

## 관련 글

- 3단계 첫 항목, 공통 API 클라이언트: /memo/shared-api-client
- 3단계 마지막 항목, 화면 질문 모듈: /memo/shared-media
- 설정 값의 모양 검사: /memo/settings-schemas
- PR: https://github.com/hyeoniverse/MacFolio/pull/198

#MacFolio #리팩터링 #React #localStorage
