---
title: 테스트를 붙이자 보인 버그들
date: 2026-09-28
category: 개발기/MacFolio/인프라
summary: 창 코드를 고치기 전에 E2E 시험 10개부터 붙였더니 버그 다섯이 나왔다. 앱 전체를 멈추던 hook 순서, 한 번도 동작한 적 없던 창 되돌리기, 오래된 클로저, 전역 클래스 충돌, ICU 버전 차이. 찾은 순서와 고친 방법, 그 뒤 시험이 432개로 는 이야기.
---

이 데스크톱의 창 코드를 정리하기 전에, 기존 동작을 지켜 줄 E2E 테스트부터 붙였다. 안전장치로 만든 테스트가 오히려 숨어 있던 버그를 찾아냈다.

그날 저장소는 막 pnpm 모노레포로 옮겼고, 시험은 하나도 없었다. 창 코드는 DOM을 직접 만지는 곳과 React 상태가 섞여 있어서, 고치다 무엇이 깨질지 알 수 없었다. 그래서 순서를 정했다.

1. 지금 동작을 그대로 적는 E2E를 먼저 붙인다(PR [#26](https://github.com/hyeoniverse/MacFolio/pull/26)): 로딩 → 데스크톱, Dock에서 열고 닫고 최소화, 창 순서, 제목 막대 끌기, Music 닫기, 외부 링크, 공유, Launchpad, 메모 쓰기. 파일 2개에 10개였다.
2. CI에서 포맷·린트·타입·빌드·E2E를 돌린다(같은 PR).
3. 그다음에 창 계산을 순수 함수로 빼고 창을 상태 기반으로 다시 쓴다(PR [#27](https://github.com/hyeoniverse/MacFolio/pull/27)).

시험 쪽에는 장치를 하나 두었다. 처리되지 않은 페이지 에러가 나면 그 시험은 무엇을 확인하든 실패한다(fixture). 화면이 멀쩡해 보여도 콘솔에 에러가 나면 잡힌다.

| 버그                            | 잡은 시험                                          | 고친 곳                                       |
| ------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| Music을 닫으면 화면 전체가 멈춤 | Music 창을 닫아도 앱이 멈추지 않고 다시 열 수 있다 | `MusicPlayer.tsx`, 앱마다 에러 경계 (#26·#27) |
| 화면 밖 창 되돌리기가 늘 무동작 | 시험을 붙이며 창 코드를 읽다가 발견                | `geometry.ts`의 `clampRect` (#27)             |
| 끈 위치가 새로고침에 되돌아감   | 제목 표시줄을 끌어 창을 옮길 수 있다               | `moveRect`, 끝날 때 저장 (#27)                |
| 말풍선이 한 글자 폭             | 메시지 E2E                                         | `.resize-handle.left`로 좁힘 (#29)            |
| CI에서만 '오전'이 'AM'          | 메시지 시각 단위 시험                              | 숫자만 받고 문구는 직접 조립 (#29)            |

## Music 창을 닫으면 화면이 통째로 사라졌다

Music 창을 닫는 테스트가 실패했다. 창만 닫혀야 하는데 Dock까지 전부 사라졌다.

```tsx
useEffect(() => {
	/* ... */
}, [isPlaying]);

if (!isRunning) return null; // 여기서 먼저 빠져나가면

useEffect(() => {
	/* ... */
}, [isPlaying]); // 이 hook은 호출되지 않는다
```

창을 닫는 순간 렌더링마다 호출되는 hook 개수가 달라져서 React가 에러를 던졌다. 에러를 잡아 줄 경계(Error Boundary)도 없어서 앱 전체가 멈췄다. 테스트를 먼저 커밋해(`df12012dd`) 실패를 확인하고, 다음 커밋(`6e24355ca`)에서 조기 반환을 모든 hook 뒤로 옮겼다. hook을 조건 안에서 부르지 않는다는 규칙은 알고 있었지만, 조기 반환 뒤의 hook도 같은 것이라는 점은 시험이 실패하고서야 보였다. 앱마다 에러 경계도 추가해서, 한 앱이 멈춰도 데스크톱은 살아 있게 했다.

![창을 열었을 때와 닫았을 때 hook을 부르는 순서 비교](./images/hooks-order.svg '조기 반환이 두 번째 hook보다 앞에 있으면, 창을 닫는 순간 hook 개수가 달라진다')

## 한 번도 동작한 적 없던 기능

화면 밖으로 나간 창을 가운데로 되돌리는 코드가 있었다. 창 요소를 `document.getElementById('app-이름')`으로 찾는데, 정작 창 요소에는 그 id가 없었다. 처음부터 아무 일도 하지 않는 코드였다.

DOM을 직접 옮기는 대신, 창을 그릴 때마다 위치를 화면 안으로 제한하는 순수 함수로 바꿨다. 브라우저 크기가 줄어도 창이 화면 밖에 남지 않는다.

```ts
export function clampRect(rect: Rect, viewport: Viewport): Rect {
	const maxWidth = viewport.width;
	const maxHeight = viewport.height - STATUSBAR_HEIGHT;
	const width = clamp(rect.width, Math.min(MIN_SIZE.width, maxWidth), maxWidth);
	const height = clamp(rect.height, Math.min(MIN_SIZE.height, maxHeight), maxHeight);
	return {
		x: clamp(rect.x, 0, viewport.width - width),
		y: clamp(rect.y, STATUSBAR_HEIGHT, viewport.height - height),
		width,
		height,
	};
}
```

이 함수와 끌기·크기 조절·최대화 계산을 `desktop/window/geometry.ts`(68줄)에 모으고, Vitest를 들여 단위 시험 13개를 붙였다. 이 저장소의 첫 단위 시험이다.

## 드래그한 위치가 되돌아갔다

창을 옮기고 새로고침하면 옮기기 전 자리로 돌아갔다. 마우스를 뗄 때 저장하는 이벤트 핸들러가 드래그를 시작할 때의 상태를 기억하고 있었다. 오래된 클로저(stale closure) 문제다. 위치 계산을 순수 함수로 빼고, 드래그가 끝날 때 계산한 최종 위치를 그대로 저장하게 바꿨다.

![오래된 클로저](./images/bugs-found-by-tests-stale-closure.svg '핸들러가 기억한 값과 화면의 값이 달랐다')

## 전역 CSS 클래스가 부딪혔다

메시지 앱의 말풍선이 한 글자 폭으로 찌그러졌다. 말풍선 방향에 `.left`, `.right` 클래스를 붙였는데, 창 크기 조절 핸들도 같은 이름의 전역 클래스를 쓰고 있었다. 핸들 쪽 선택자를 `.resize-handle.left`처럼 좁혀서 해결했다.

![메시지 앱의 말풍선](./images/messages-bubbles.jpg '고친 뒤의 메시지 앱. 말풍선 방향 클래스가 창 크기 조절 핸들과 부딪혀 한 글자 폭으로 찌그러졌었다')

## CI에서만 '오전'이 'AM'이 됐다

내 컴퓨터에서는 통과하는 날짜 테스트가 CI에서만 실패했다. `Intl.DateTimeFormat`의 한국어 출력이 Node(ICU) 버전에 따라 "오전"이 되기도 하고 "AM"이 되기도 했다. 사용자 브라우저에서도 날 수 있는 차이라, 숫자만 받아 오고 "오전/오후" 문구는 직접 조립하게 바꿨다.

```ts
/**
 * 시간대 기준 날짜·시각 숫자. 문구는 직접 조립한다.
 * Intl의 한국어 출력(예: '오전'과 'AM')은 브라우저·Node의 ICU 버전마다 달라서 숫자만 받는다.
 */
function partsOf(date: Date, timeZone?: string): DateParts {
```

요일도 `['일', '월', '화', '수', '목', '금', '토']` 배열에서 직접 고른다. `formatToParts`로 숫자만 받으면 ICU가 달라도 같은 값이 나온다.

## 그 뒤

이날 붙인 10개는 시작이었다. 기능을 더할 때마다 E2E를 함께 쓰는 것이 규칙이 되어, 지금(10월 19일)은 `apps/react/e2e/`에 파일 47개, 시험 432개가 있다.

![E2E 시험 수](./images/bugs-found-by-tests-growth.svg '10개에서 432개로')

처음 시험 중 "Music 창을 닫아도 앱이 멈추지 않고 다시 열 수 있다"와 "제목 표시줄을 끌어 창을 옮길 수 있다"는 이름을 거의 그대로 둔 채 지금도 돈다. 시험이 많아지자 CI가 느려지고 끌기 시험이 가끔 실패하는 문제가 생겨 따로 손봤다([E2E를 빠르게](/memo/faster-e2e-ci), [가끔 실패하는 끌기 시험](/memo/flaky-drag-e2e)).

## 배운 것

- 리팩터링 전에 테스트부터 붙이면, 무엇을 지켜야 하는지와 무엇이 이미 깨져 있는지를 같이 알 수 있다.
- 시험을 먼저 커밋해 실패를 보고, 다음 커밋에서 고친다. 고친 커밋만 있으면 시험이 정말 그 버그를 잡는지 알 수 없다.
- 로직을 React에서 떼어 순수 함수로 만들면 테스트가 쉬워지고, 이런 버그가 숨을 자리가 줄어든다.
- 콘솔 에러를 시험 실패로 바꾸는 장치 하나가, 화면만 보는 시험이 놓치는 것을 잡는다.

관련 글: [Playwright로 화면 찍기](/memo/screenshots-with-playwright), [z-index 층](/memo/z-index-layers), [창 코드 desktop-core로](/memo/desktop-core-windows), [음악 앱 고침](/memo/music-player-fixes)

#MacFolio #테스트 #Playwright
