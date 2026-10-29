---
title: E2E 시험 1 - 리팩터링 전 E2E 시험 10개로 찾은 hook 순서·클로저·ICU 버그
date: 2026-09-28
category: 개발 기록/MacFolio/품질
summary: 창 코드를 리팩터링하기 전에 E2E 시험 10개를 먼저 작성했더니 버그 다섯 개가 드러났다. 앱 전체를 멈추던 hook 순서, 한 번도 동작한 적 없던 창 위치 복구, 오래된 클로저, 전역 클래스 충돌, ICU 버전 차이. 발견 경위와 수정 방법, 그 뒤 시험이 432개로 늘어난 과정을 적었다.
---

이 데스크톱의 창 코드를 리팩터링하기 전에, 기존 동작을 고정할 E2E[^e2e] 테스트를 먼저 작성했다. 회귀를 막으려고 만든 테스트가 이미 있던 버그를 찾아냈다.

당시 저장소는 pnpm 모노레포로 전환한 직후였고, 시험은 하나도 없었다. 창 코드는 DOM을 직접 조작하는 부분과 React 상태가 섞여 있어서, 수정하면 어떤 동작이 깨질지 예측할 수 없었다. 그래서 작업 순서를 정했다.

1. 현재 동작을 그대로 기록하는 E2E를 먼저 작성한다(PR [#26](https://github.com/hyeoniverse/MacFolio/pull/26)): 로딩 → 데스크톱, Dock에서 열기·닫기·최소화, 창 순서, 제목 막대 드래그, Music 닫기, 외부 링크, 공유, Launchpad, 메모 작성. 파일 2개에 시험 10개였다.
2. CI에서 포맷·린트·타입 검사·빌드·E2E를 실행한다(같은 PR).
3. 그다음에 창 위치 계산을 순수 함수로 분리하고 창을 상태 기반으로 다시 작성한다(PR [#27](https://github.com/hyeoniverse/MacFolio/pull/27)).

시험에는 공통 장치를 하나 넣었다. 처리되지 않은 페이지 에러(`pageerror` 이벤트)가 발생하면 그 시험은 무엇을 확인하든 실패한다. Playwright의 [자동 fixture](https://playwright.dev/docs/test-fixtures)(`{ auto: true }`)로 모든 시험에 적용했다. 화면이 정상으로 보여도 처리되지 않은 에러가 있으면 실패로 잡힌다.

```ts
// apps/react/e2e/fixtures.ts
pageErrors: [
	async ({ page }, use) => {
		const errors: Error[] = [];
		page.on('pageerror', (error) => errors.push(error));
		await use(errors);
		expect(errors, '페이지에서 처리되지 않은 에러가 발생했습니다').toEqual([]);
	},
	{ auto: true },
],
```

| 버그                               | 발견한 시험                                        | 수정 위치                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Music을 닫으면 화면 전체가 멈춤    | Music 창을 닫아도 앱이 멈추지 않고 다시 열 수 있다 | `MusicPlayer.tsx`, 앱마다 에러 경계 ([#26](https://github.com/hyeoniverse/MacFolio/pull/26)·[#27](https://github.com/hyeoniverse/MacFolio/pull/27)) |
| 화면 밖 창 위치 복구가 항상 무동작 | 시험을 작성하며 창 코드를 읽다가 발견              | `geometry.ts`의 `clampRect` ([#27](https://github.com/hyeoniverse/MacFolio/pull/27))                                                                |
| 드래그한 위치가 새로고침 후 원위치 | 제목 표시줄을 끌어 창을 옮길 수 있다               | `moveRect`, 드래그 종료 시각에 저장 ([#27](https://github.com/hyeoniverse/MacFolio/pull/27))                                                        |
| 말풍선이 한 글자 폭                | 메시지 E2E                                         | 선택자를 `.resize-handle.left`로 한정 ([#29](https://github.com/hyeoniverse/MacFolio/pull/29))                                                      |
| CI에서만 '오전'이 'AM'             | 메시지 시각 단위 시험                              | 숫자만 받고 문구는 직접 조립 ([#29](https://github.com/hyeoniverse/MacFolio/pull/29))                                                               |

## Music 창을 닫으면 화면 전체가 사라졌다

Music 창을 닫는 테스트가 실패했다. 창만 닫혀야 하는데 Dock을 포함한 화면 전체가 사라졌다.

```tsx
useEffect(() => {
	/* ... */
}, [isPlaying]);

if (!isRunning) return null; // 여기서 먼저 빠져나가면

useEffect(() => {
	/* ... */
}, [isPlaying]); // 이 hook은 호출되지 않는다
```

창을 닫는 순간 렌더링마다 호출되는 hook 개수가 달라져서 React가 "Rendered fewer hooks than expected" 계열의 에러를 발생시켰다. 에러를 처리할 [에러 경계(Error Boundary)](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)도 없어서 React 트리 전체가 언마운트됐다. 테스트를 먼저 커밋해(`df12012dd`) 실패를 확인하고, 다음 커밋(`6e24355ca`)에서 조기 반환을 모든 hook 뒤로 옮겼다. [hook은 조건문 안에서 호출하지 않는다](https://react.dev/reference/rules/rules-of-hooks)는 규칙은 알고 있었지만, 조기 반환 뒤의 hook도 조건부 호출에 해당한다는 점은 시험이 실패한 뒤에 확인했다. 앱마다 에러 경계도 추가해서, 한 앱에서 에러가 나도 데스크톱과 다른 앱은 계속 동작하게 했다.

![창을 열었을 때와 닫았을 때 hook을 부르는 순서 비교](./images/hooks-order.svg '조기 반환이 두 번째 hook보다 앞에 있으면, 창을 닫는 순간 hook 개수가 달라진다')

## 한 번도 동작한 적 없던 기능

화면 밖으로 나간 창을 가운데로 되돌리는 코드가 있었다. 창 요소를 `document.getElementById('app-이름')`으로 조회하는데, 실제 창 요소에는 그 id가 없었다. 조회 결과가 항상 `null`이라 작성된 시점부터 아무 동작도 하지 않는 코드였다.

DOM을 직접 이동하는 대신, 창을 렌더링할 때마다 위치를 뷰포트 안으로 제한하는 순수 함수로 바꿨다. 브라우저 크기가 줄어도 창이 화면 밖에 남지 않는다.

<details><summary>clampRect 전체 코드 (desktop/window/geometry.ts)</summary>

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

</details>

이 함수와 드래그·크기 조절·최대화 계산을 `desktop/window/geometry.ts`(68줄)에 모으고, [Vitest](https://vitest.dev/)를 도입해 단위 시험 13개를 작성했다. 이 저장소의 첫 단위 시험이다.

## 드래그한 위치가 되돌아갔다

창을 옮기고 새로고침하면 옮기기 전 위치로 돌아갔다. 마우스 버튼을 놓을 때 위치를 저장하는 이벤트 핸들러가 드래그 시작 시각의 상태 값을 참조하고 있었다. 오래된 클로저(stale closure)[^stale] 문제다. 위치 계산을 순수 함수로 분리하고, 드래그 종료 시각에 계산한 최종 위치를 그대로 저장하게 바꿨다.

![오래된 클로저](./images/bugs-found-by-tests-stale-closure.svg '핸들러가 참조한 값과 화면의 값이 달랐다')

## 전역 CSS 클래스가 충돌했다

메시지 앱의 말풍선이 한 글자 폭으로 줄어들었다. 말풍선 방향에 `.left`, `.right` 클래스를 붙였는데, 창 크기 조절 핸들도 같은 이름의 전역 클래스를 쓰고 있었다. `Window.css`의 `.left` 규칙(`left: -5px; width: 10px; …`)이 말풍선에도 적용된 것이다. 핸들 선택자 8개(`.top`, `.right`, `.bottom`, `.left`와 네 모서리)를 `.resize-handle.left`처럼 두 클래스 조합으로 한정해 해결했다.

![전역 클래스 충돌 도식](./images/bugs-found-by-tests-class-collision.svg '도식. 클래스 하나짜리 선택자는 같은 클래스를 가진 모든 요소에 적용된다. 두 클래스 조합으로 한정하면 핸들에만 적용된다')

![메시지 앱의 말풍선](./images/messages-bubbles.jpg '수정 후의 메시지 앱. 말풍선이 내용 폭만큼 표시된다')

## CI에서만 '오전'이 'AM'이 됐다

로컬에서는 통과하는 날짜 테스트가 CI에서만 실패했다. `Intl.DateTimeFormat`의 한국어 출력이 Node에 포함된 ICU[^icu] 버전에 따라 "오전"이 되기도 하고 "AM"이 되기도 했다. 사용자 브라우저에서도 발생할 수 있는 차이라서, 숫자만 받아 오고 "오전/오후" 문구는 직접 조립하게 바꿨다.

```ts
/**
 * 시간대 기준 날짜·시각 숫자. 문구는 직접 조립한다.
 * Intl의 한국어 출력(예: '오전'과 'AM')은 브라우저·Node의 ICU 버전마다 달라서 숫자만 받는다.
 */
function partsOf(date: Date, timeZone?: string): DateParts {
```

요일도 `['일', '월', '화', '수', '목', '금', '토']` 배열에서 직접 선택한다. [`formatToParts`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts)로 숫자 부분만 받으면 ICU 버전이 달라도 같은 값이 나온다.

## 그 뒤

이날 작성한 10개 이후로 기능을 추가할 때마다 E2E를 함께 작성하는 것이 규칙이 되었다. 10월 19일 기준 `apps/react/e2e/`에는 파일 47개, 시험 432개가 있다.

![E2E 시험 수](./images/bugs-found-by-tests-growth.svg '10개에서 432개로')

처음 작성한 시험 중 "Music 창을 닫아도 앱이 멈추지 않고 다시 열 수 있다"와 "제목 표시줄을 끌어 창을 옮길 수 있다"는 이름을 거의 그대로 유지한 채 지금도 CI에서 실행된다. 시험 수가 늘면서 CI 시간이 길어지고 드래그 시험이 간헐적으로 실패하는 문제가 생겨 별도로 대응했다([E2E를 빠르게](/memo/faster-e2e-ci), [간헐적으로 실패하는 드래그 시험](/memo/flaky-drag-e2e)).

## 배운 것

- 리팩터링 전에 테스트를 먼저 작성하면, 유지해야 할 동작과 이미 깨져 있는 동작을 함께 확인할 수 있다.
- 시험을 먼저 커밋해 실패를 확인하고, 다음 커밋에서 수정한다. 수정 커밋만 있으면 시험이 실제로 그 버그를 잡는지 확인할 수 없다.
- 로직을 React 컴포넌트에서 분리해 순수 함수로 만들면 단위 시험이 가능해지고, 상태 참조 시점 같은 버그가 들어갈 여지가 줄어든다.
- 처리되지 않은 페이지 에러를 시험 실패로 바꾸는 fixture 하나가, 화면만 확인하는 시험이 놓치는 에러를 잡는다.

## 시험 실행하기

이 글의 시험은 모두 `apps/react/e2e/`에 있다. 저장소를 처음 내려받았다면 브라우저부터 설치한다([Playwright 설치 문서](https://playwright.dev/docs/intro)).

```bash
cd apps/react
npx playwright install chromium
npx playwright test --project=desktop-chromium          # 데스크톱만
npx playwright test --project=mobile-iphone             # 휴대폰 설정
npx playwright show-report                              # 실패한 시험의 화면·trace
```

CI에서만 '오전'이 'AM'이 된 경우처럼, 로컬과 CI의 결과가 다른 원인은 ICU 버전과 시간대 차이였다. 그래서 시각을 다루는 함수(예: `buildTimeline`)는 시간대를 `timeZone` 인자로 받고, 단위 시험은 그 인자에 고정된 시간대를 넘긴다. 실행 환경의 기본 시간대에 의존하지 않으므로 로컬과 CI의 결과가 같다. 간헐적 실패를 수정했는지는 같은 시험을 `--repeat-each=5`로 반복 실행해 확인한다.

## 관련 글

- [E2E 시험 3 - Playwright와 E2E 가짜 API로 블로그 스크린샷 생성하기](/memo/screenshots-with-playwright)
- [디자인 토큰 1 - 흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/z-index-layers)
- [desktop-core 1 - 창 관리 규칙을 useSyncExternalStore로 구독하는 프레임워크 무관 패키지로 옮기기](/memo/desktop-core-windows)
- [음악 앱 버그 세 가지 - 꺼진 앱, 쌓이는 표지, 끝없이 내려가는 시트](/memo/music-player-fixes)
- [보안 점검 5 - Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험](/memo/api-route-table-test)

[^e2e]: End-to-End 시험. 실제 브라우저로 사이트를 열고 사용자처럼 클릭·입력해 결과 화면을 확인한다. 이 저장소는 [Playwright](https://playwright.dev/)를 쓴다.

[^stale]: 함수가 만들어진 시각의 변수 값을 계속 참조하는 현상. React에서는 이벤트 핸들러나 effect가 이전 렌더링의 state를 캡처한 채로 실행될 때 발생한다.

[^icu]: International Components for Unicode. 날짜·숫자 형식, 정렬 같은 국제화 데이터를 제공하는 라이브러리로, Node와 브라우저의 `Intl` API가 내부적으로 사용한다. 버전마다 로케일 데이터가 다를 수 있다.

#MacFolio #테스트 #Playwright
