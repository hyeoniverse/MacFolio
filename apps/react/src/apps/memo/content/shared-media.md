---
title: matchMedia 네 가지 표기를 하나로 — 화면 질문 모듈
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: 움직임 줄이기·어두운 모드·모바일 화면을 파일 20개가 matchMedia와 innerWidth로 직접 물었다. 표기는 네 가지, 모바일 기준은 둘이었다. media.ts와 getViewport()로 25곳을 옮기고, 눕힌 휴대폰이 통계에서 데스크톱으로 잡히던 것도 맞췄다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 3단계의 마지막 항목. 앞의 둘은 [공통 API 클라이언트](/memo/shared-api-client)와 [브라우저 저장소](/memo/shared-storage)였다.

## 무엇이 흩어져 있었나

`useIsMobile`·`useViewport` 훅이 이미 있는데도 `window.matchMedia`·`innerWidth`를 직접 쓰는 곳이 25곳이었다. 세어 보니 질문은 네 종류뿐이다.

| 질문             | 곳  | 적힌 모양                                                                                        |
| ---------------- | --- | ------------------------------------------------------------------------------------------------ |
| 움직임 줄이기    | 9   | `matchMedia('…').matches`, `matchMedia?.('…').matches ?? false`, 파일마다 다른 상수 이름         |
| 어두운 화면 모드 | 5   | `resolveTheme(theme, matchMedia('(prefers-color-scheme: dark)').matches)`를 세 컴포넌트가 똑같이 |
| 모바일 화면인가  | 4   | `isMobileViewport({ width: innerWidth, height: innerHeight })` 셋, `innerWidth < 768` 하나       |
| 창 크기 숫자     | 7   | 팝오버 자리, 스크롤 연출의 기준선, 앱 전환 카드 간격                                             |

두 가지가 눈에 띄었다. 첫째, 움직임 줄이기를 `?.`로 막는 곳과 안 막는 곳이 섞여 있었다. `matchMedia`가 없는 환경(시험, 옛 브라우저)에서 한쪽은 false, 한쪽은 예외다. 둘째, 분석 이벤트의 `device`가 `innerWidth < 768`로 따로 정해져 있어, 가로로 눕힌 휴대폰(넓지만 낮은 화면)이 셸은 모바일인데 통계는 데스크톱으로 잡혔다.

![전: 파일마다 직접, 후: 두 모듈](./images/shared-media-before-after.svg)

![innerWidth만 보던 기준과 isMobileViewport 기준의 차이](./images/shared-media-mobile-rule.svg '눕힌 휴대폰은 넓지만 낮다')

## 고른 방법과 버린 방법

| 방법                               | 장점                                 | 단점                                                       |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| 그대로 두고 `?.`만 맞춘다          | 바꾸는 범위가 작다                   | 질문의 이름(쿼리 문자열)이 여전히 20곳에 흩어진다          |
| 모든 질문을 훅 하나(`useMedia`)로  | React다운 모양                       | 이벤트 처리기·스토어 초기화처럼 훅을 못 쓰는 곳이 절반이다 |
| 이름 붙인 함수 + 훅 + 구독 함수 셋 | 어느 자리에서나 같은 이름으로 묻는다 | 함수가 조금 늘어난다                                       |

훅을 못 쓰는 자리가 많아서 세 번째를 골랐다. 한 번 묻는 함수(`mediaMatches`), 렌더링이 따라가는 훅(`useMediaQuery`), 스토어가 따라가는 구독 함수(`onMediaChange`)가 같은 쿼리 상수를 쓴다.

## 두 모듈

**`shared/lib/media.ts`**: `matchMedia` 질문을 이름 붙인 함수로. `prefersReducedMotion()`, `prefersDarkScheme()`, `hasCoarsePointer()`. 바뀌는 것을 따라가야 하면 `useMediaQuery(query)`(렌더링)나 `onMediaChange(query, cb)`(스토어). `matchMedia`가 없으면 모두 false라서 부르는 쪽에 `?.`가 필요 없다.

```ts
const queryOf = (query: string): MediaQueryList | null =>
	typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;

/** 지금 맞는지 한 번 묻는다 */
export const mediaMatches = (query: string): boolean => queryOf(query)?.matches ?? false;

/** 맞는지를 상태로. 바뀌면 다시 렌더링한다 */
export function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		(onChange) => onMediaChange(query, onChange),
		() => mediaMatches(query),
		() => false
	);
}
```

`useSyncExternalStore`를 쓰면 구독과 읽기를 React가 맞춰 준다. `useEffect` 안에서 `addEventListener`하고 `useState`에 담는 방식보다 짧고, 처음 그릴 때부터 맞는 값을 쓴다.

**`shared/hooks/useViewport.ts`**: 훅만 있던 곳에 `getViewport()`를 더했다. 이벤트 처리나 스토어 초기화처럼 훅을 쓸 수 없는 자리에서 쓴다. 모바일 여부는 전과 같이 `isMobileViewport(getViewport())` 한 줄이고, 분석도 이 기준을 쓴다.

```ts
// 전 (Finder.tsx, Github.tsx, MobileShell.tsx가 똑같이)
const { theme } = useSettings();
const dark = resolveTheme(theme, window.matchMedia('(prefers-color-scheme: dark)').matches) === 'dark';

// 후
const dark = useResolvedTheme() === 'dark';
```

`useResolvedTheme()`는 `settingsStore`에 뒀다. 설정의 테마와 시스템의 어두운 모드를 합쳐 `'light' | 'dark'`를 돌려주고, 둘 중 하나가 바뀌면 다시 렌더링한다. 전에는 시스템 모드가 바뀌어도 `<html data-theme>`만 바뀌고 이 세 컴포넌트는 다음 렌더링까지 옛 값을 들고 있었다.

## 그대로 둔 것

`WebFrame`이 iframe 안 문서의 `view.innerWidth`를 읽는 한 곳. 우리 창이 아니라 iframe의 창이라 `getViewport()`가 답할 수 없다.

## 숫자

| 항목                                       | 전  | 후                                     |
| ------------------------------------------ | --- | -------------------------------------- |
| `matchMedia`·`innerWidth`를 직접 쓰는 파일 | 20  | 3 (media.ts, useViewport.ts, WebFrame) |
| 움직임 줄이기 질문의 표기                  | 4   | 1                                      |
| 모바일 판단 기준                           | 2   | 1                                      |

바뀐 파일은 27개(242줄 추가, 53줄 삭제)다. `media.test.ts`에 시험 셋을 두었다. "matchMedia가 없으면 모두 false", "질문마다 지금 값을 돌려준다", "바뀌면 알리고, 돌려준 함수로 그만둔다".

## 남은 것·배운 것

- 이 글을 쓰며 다시 찾아보니, 그 뒤에 만든 파일 넷이 다시 직접 묻고 있었다. 메모의 링크·목차 이동 두 곳이 `matchMedia('(prefers-reduced-motion: reduce)')`를, 슬라이드 보기와 바탕화면 아이콘이 `innerWidth`를 쓴다. 공통 모듈을 만들어도 새 코드가 그것을 쓰게 하는 장치(린트 규칙 같은 것)가 없으면 다시 흩어진다. `no-restricted-properties`로 `window.matchMedia`를 막는 규칙이 다음 후보다.
- 같은 질문의 표기가 넷이면 그중 하나는 틀려 있다. 이번에는 `?.`가 없는 곳과 모바일 기준이 다른 분석 코드가 그랬다.
- 훅만 있는 모듈은 반쪽이다. 이벤트 처리기와 스토어에서도 같은 질문을 하므로, 훅 옆에 일반 함수를 함께 둔다.

이것으로 3단계(공통 기반 코드)가 끝났다. 다음은 1단계, API 요청·응답 타입을 zod 스키마로 모으는 일.

## 관련 글

- 3단계 첫 항목, 공통 API 클라이언트: /memo/shared-api-client
- 3단계 둘째 항목, 브라우저 저장소: /memo/shared-storage
- 리팩터링 3단계 정리: /memo/refactor-step3-foundation
- PR: https://github.com/hyeoniverse/MacFolio/pull/199

#MacFolio #리팩터링 #React #matchMedia
