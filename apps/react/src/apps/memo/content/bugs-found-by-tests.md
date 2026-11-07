---
title: 리팩터링 전 E2E 시험 10개로 찾은 hook 순서·클로저·ICU 버그
date: 2026-09-28
category: 개발 기록/MacFolio/테스트·보안·성능
series: E2E 시험
seriesOrder: 1
summary: 창 코드를 리팩터링하기 전에 E2E 시험 10개를 먼저 작성했더니 버그 다섯 개가 드러났다. 앱 전체를 멈추던 hook 순서, 한 번도 동작한 적 없던 창 위치 복구, 오래된 클로저, 전역 클래스 충돌, ICU 버전 차이. 발견 경위와 수정 방법, 그 뒤 시험이 432개로 늘어난 과정을 적었다.
---

이 데스크톱의 창 코드를 리팩터링하기 전에, 기존 동작을 고정할 E2E[^e2e] 시험을 먼저 작성했다. 회귀를 막으려고 만든 시험이 이미 있던 버그를 찾아냈다.

## 배경: 리팩터링 전에 시험을 먼저 작성하는 이유

**리팩터링**은 외부에서 보이는 동작을 바꾸지 않고 코드 구조만 바꾸는 작업이다. 예를 들어 창을 끌어 옮기는 위치 계산을 컴포넌트 안에서 별도 함수로 옮기는 일이 리팩터링이다. "동작을 바꾸지 않았다"를 확인하려면 바꾸기 전의 동작을 기록해 둔 시험이 있어야 한다. 이런 시험을 **회귀 시험**이라고 한다. 회귀(regression)는 이전에 동작하던 기능이 수정 뒤에 다시 깨지는 현상이다.

시험은 확인 범위에 따라 나뉜다.

| 종류      | 확인 범위                                       | 예                                                       | 이 저장소의 도구                      |
| --------- | ----------------------------------------------- | -------------------------------------------------------- | ------------------------------------- |
| 단위 시험 | 함수 하나의 입력과 출력                         | `clampRect({ x: -50, … }, 화면)`의 `x`가 0인지           | [Vitest](https://vitest.dev/)         |
| E2E 시험  | 실제 브라우저에서 사용자 조작부터 화면 결과까지 | Dock의 Music을 눌러 창을 열고 닫은 뒤 Dock이 남아 있는지 | [Playwright](https://playwright.dev/) |

당시 저장소는 pnpm 모노레포로 전환한 직후였고, 시험은 하나도 없었다. 창 코드는 DOM을 직접 조작하는 부분과 React 상태가 섞여 있어서, 수정하면 어떤 동작이 깨질지 예측할 수 없었다. 함수 단위로 나뉘어 있지 않은 코드에는 단위 시험을 붙이기 어려우므로, 화면 단위로 확인하는 E2E부터 작성했다. 작업 순서는 다음과 같다.

1. 현재 동작을 그대로 기록하는 E2E를 먼저 작성한다(PR [#26](https://github.com/hyeoniverse/MacFolio/pull/26)): 로딩 → 데스크톱, Dock에서 열기·닫기·최소화, 창 순서, 제목 막대 드래그, Music 닫기, 외부 링크, 공유, Launchpad, 메모 작성. 파일 2개에 시험 10개였다.
2. CI에서 포맷·린트·타입 검사·빌드·E2E를 실행한다(같은 PR).
3. 그다음에 창 위치 계산을 순수 함수로 분리하고 창을 상태 기반으로 다시 작성한다(PR [#27](https://github.com/hyeoniverse/MacFolio/pull/27)).

## 처리되지 않은 에러를 실패로 바꾸는 fixture

시험에는 공통 장치를 하나 넣었다. 처리되지 않은 페이지 에러(`pageerror` 이벤트)가 발생하면 그 시험은 무엇을 확인하든 실패한다. Playwright의 **fixture**는 시험마다 준비·정리 작업을 실행하는 장치이고, [자동 fixture](https://playwright.dev/docs/test-fixtures#automatic-fixtures)(`{ auto: true }`)는 시험이 이름으로 요청하지 않아도 모든 시험에 적용된다.

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

`await use(errors)` 앞은 시험 본문보다 먼저, 뒤는 시험 본문이 끝난 뒤에 실행된다. 화면이 정상으로 보여도 처리되지 않은 에러가 있으면 정리 단계의 `expect`에서 실패로 잡힌다.

![pageErrors fixture가 시험 시작 전에 pageerror 수집을 등록하고, 본문이 끝난 뒤 errors가 비었는지 확인하는 순서](./images/bugs-found-by-tests-pageerror-fixture.svg '본문의 확인이 모두 통과해도, 그 사이 페이지에서 발생한 에러가 있으면 정리 단계에서 실패한다')

## 찾은 버그 다섯 개

| 버그                               | 발견한 시험                                        | 수정 위치                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Music을 닫으면 화면 전체가 멈춤    | Music 창을 닫아도 앱이 멈추지 않고 다시 열 수 있다 | `MusicPlayer.tsx`, 앱마다 에러 경계 ([#26](https://github.com/hyeoniverse/MacFolio/pull/26)·[#27](https://github.com/hyeoniverse/MacFolio/pull/27)) |
| 화면 밖 창 위치 복구가 항상 무동작 | 시험을 작성하며 창 코드를 읽다가 발견              | `geometry.ts`의 `clampRect` ([#27](https://github.com/hyeoniverse/MacFolio/pull/27))                                                                |
| 드래그한 위치가 새로고침 후 원위치 | 제목 표시줄을 끌어 창을 옮길 수 있다               | `moveRect`, 드래그 종료 시각에 저장 ([#27](https://github.com/hyeoniverse/MacFolio/pull/27))                                                        |
| 말풍선이 한 글자 폭                | 메시지 E2E                                         | 선택자를 `.resize-handle.left`로 한정 ([#29](https://github.com/hyeoniverse/MacFolio/pull/29))                                                      |
| CI에서만 '오전'이 'AM'             | 메시지 시각 단위 시험                              | 숫자만 받고 문구는 직접 조립 ([#29](https://github.com/hyeoniverse/MacFolio/pull/29))                                                               |

## Music 창을 닫으면 화면 전체가 사라졌다

Music 창을 닫는 시험이 실패했다. 창만 닫혀야 하는데 Dock을 포함한 화면 전체가 사라졌다.

```tsx
useEffect(() => {
	/* ... */
}, [isPlaying]);

if (!isRunning) return null; // 여기서 먼저 빠져나가면

useEffect(() => {
	/* ... */
}, [isPlaying]); // 이 hook은 호출되지 않는다
```

React는 컴포넌트의 hook 상태를 이름이 아니라 **호출 순서**로 구분한다. 첫 번째로 호출된 `useEffect`는 1번 칸, 두 번째는 2번 칸에 상태를 보관하는 방식이다. 그래서 렌더링마다 hook을 같은 개수, 같은 순서로 호출해야 한다. 위 코드는 창이 열려 있으면 hook을 2개, 닫으면 1개 호출한다.

창을 닫는 순간 렌더링마다 호출되는 hook 개수가 달라져서 React가 "Rendered fewer hooks than expected" 계열의 에러를 발생시켰다. 에러를 처리할 [에러 경계(Error Boundary)](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)도 없어서 React 트리 전체가 언마운트됐다. 에러 경계는 하위 컴포넌트의 렌더링 에러를 받아 대체 화면을 보여 주는 컴포넌트로, 없으면 에러가 최상위까지 올라가 앱 전체가 사라진다.

![창이 열린 상태와 닫힌 상태에서 hook을 부르는 순서 비교](./images/hooks-order.svg '조기 반환이 두 번째 hook보다 앞에 있으면, 창을 닫는 순간 hook 개수가 달라진다')

시험을 먼저 커밋해(`df12012dd`) 실패를 확인하고, 다음 커밋(`6e24355ca`)에서 조기 반환을 모든 hook 뒤로 옮겼다. [hook은 조건문 안에서 호출하지 않는다](https://react.dev/reference/rules/rules-of-hooks)는 규칙은 알고 있었지만, 조기 반환 뒤의 hook도 조건부 호출에 해당한다는 점은 시험이 실패한 뒤에 확인했다. 앱마다 에러 경계도 추가해서, 한 앱에서 에러가 나도 데스크톱과 다른 앱은 계속 동작하게 했다.

## 한 번도 동작한 적 없던 기능

화면 밖으로 나간 창을 가운데로 되돌리는 코드가 있었다. 창 요소를 `document.getElementById('app-이름')`으로 조회하는데, 실제 창 요소에는 그 id가 없었다. 조회 결과가 항상 `null`이라 작성된 시점부터 아무 동작도 하지 않는 코드였다. 예외도 발생하지 않으므로, 실행해 보는 것만으로는 드러나지 않는 종류의 결함이다.

DOM을 직접 이동하는 대신, 창을 렌더링할 때마다 위치를 뷰포트(브라우저 창의 보이는 영역) 안으로 제한하는 순수 함수로 바꿨다. 순수 함수는 같은 입력에 항상 같은 결과를 반환하고 바깥 상태를 바꾸지 않는 함수다. 예를 들어 폭 1280px 화면에서 `x: 1200, width: 600`인 창은 `x: 680`으로 옮겨져 오른쪽 끝이 화면 안에 들어온다. 브라우저 크기가 줄어도 창이 화면 밖에 남지 않는다.

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

이 함수와 드래그·크기 조절·최대화 계산을 `desktop/window/geometry.ts`(68줄)에 모으고, Vitest를 도입해 단위 시험 13개를 작성했다. 이 저장소의 첫 단위 시험이다.

## 드래그한 위치가 되돌아갔다

창을 옮기고 새로고침하면 옮기기 전 위치로 돌아갔다. 마우스 버튼을 놓으면 위치를 저장하는 이벤트 핸들러가 드래그 시작 시각의 상태 값을 참조하고 있었다. 오래된 클로저(stale closure)[^stale] 문제다.

JavaScript 함수는 만들어진 시각의 바깥 변수를 기억한다(클로저). React 컴포넌트는 렌더링마다 새 변수를 만들기 때문에, 드래그 시작 시각에 등록한 핸들러는 그 시각의 `rect`(위치 A)를 계속 참조한다. 드래그 중 화면의 위치가 B로 바뀌어도 핸들러 안의 `rect`는 A이므로, 버튼을 놓는 순간 A가 저장된다.

![오래된 클로저](./images/bugs-found-by-tests-stale-closure.svg '핸들러가 참조한 값과 화면의 값이 달랐다')

위치 계산을 순수 함수로 분리하고, 드래그 종료 시각에 "시작 위치 + 포인터 이동 거리"로 최종 위치를 계산해 그 값을 그대로 저장하게 바꿨다.

## 전역 CSS 클래스가 충돌했다

메시지 앱의 말풍선이 한 글자 폭으로 줄어들었다. 말풍선 방향에 `.left`, `.right` 클래스를 붙였는데, 창 크기 조절 핸들도 같은 이름의 전역 클래스를 쓰고 있었다. CSS의 클래스 선택자는 파일과 관계없이 문서 전체의 같은 클래스에 적용된다. 그래서 `Window.css`의 `.left` 규칙(`left: -5px; width: 10px; …`)이 말풍선에도 적용됐다.

핸들 선택자 8개(`.top`, `.right`, `.bottom`, `.left`와 네 모서리)를 `.resize-handle.left`처럼 두 클래스 조합으로 한정해 해결했다. `.resize-handle.left`는 두 클래스를 **모두** 가진 요소에만 적용되므로, `.left`만 가진 말풍선에는 적용되지 않는다.

![전역 클래스 충돌 도식](./images/bugs-found-by-tests-class-collision.svg '도식. 클래스 하나짜리 선택자는 같은 클래스를 가진 모든 요소에 적용된다. 두 클래스 조합으로 한정하면 핸들에만 적용된다')

![메시지 앱의 말풍선](./images/messages-bubbles.jpg '수정 후의 메시지 앱. 말풍선이 내용 폭만큼 표시된다')

## CI에서만 '오전'이 'AM'이 됐다

로컬에서는 통과하는 날짜 시험이 CI(Node 22)에서만 실패했다. 메시지 앱은 [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)에 `'ko-KR'`을 지정해 "오전 10:36" 같은 시각 문구를 만들었다. 이 한국어 출력은 Node에 포함된 ICU[^icu] 버전에 따라 "오전"이 되기도 하고 "AM"이 되기도 했다. 같은 JavaScript 코드라도 실행 환경의 로케일 데이터가 다르면 결과 문자열이 다르다. 사용자 브라우저에서도 발생할 수 있는 차이라서, 숫자만 받아 오고 "오전/오후" 문구는 직접 조립하게 바꿨다.

```ts
/**
 * 시간대 기준 날짜·시각 숫자. 문구는 직접 조립한다.
 * Intl의 한국어 출력(예: '오전'과 'AM')은 브라우저·Node의 ICU 버전마다 달라서 숫자만 받는다.
 */
function partsOf(date: Date, timeZone?: string): DateParts {
```

[`formatToParts`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts)는 출력 문자열을 `{ type: 'hour', value: '10' }` 같은 조각 배열로 반환한다. `'en-US'`와 `hourCycle: 'h23'`(0~23시 표기)으로 숫자 조각만 받아 `Number()`로 변환하면 ICU 버전이 달라도 같은 값이 나온다. 요일도 `['일', '월', '화', '수', '목', '금', '토']` 배열에서 직접 선택한다.

![수정 전 ko-KR 출력의 dayPeriod 조각이 ICU에 따라 '오전' 또는 'AM'이 되고, 수정 후에는 숫자 조각만 받아 clock()이 '오전 10:36'을 조립하는 비교](./images/bugs-found-by-tests-format-parts.svg '2026-09-28T01:36:00Z를 한국 시각으로 표시하는 두 방법')

## 그 뒤

이날 작성한 10개 이후로 기능을 추가할 때마다 E2E를 함께 작성하는 규칙을 적용했다. 10월 19일 기준 `apps/react/e2e/`에는 파일 47개, 시험 432개가 있다.

![E2E 시험 수](./images/bugs-found-by-tests-growth.svg '10개에서 432개로')

처음 작성한 시험 중 "Music 창을 닫아도 앱이 멈추지 않고 다시 열 수 있다"와 "제목 표시줄을 끌어 창을 옮길 수 있다"는 이름을 거의 그대로 유지한 채 지금도 CI에서 실행된다. 시험 수가 늘면서 CI 시간이 길어지고 드래그 시험이 간헐적으로 실패하는 문제가 생겨 별도로 대응했다([E2E를 빠르게](/memo/faster-e2e-ci), [간헐적으로 실패하는 드래그 시험](/memo/flaky-drag-e2e)).

## 배운 것

| 원칙                                                       | 이번 사례                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| 리팩터링 전에 시험을 먼저 작성한다                         | 유지해야 할 동작과 이미 깨져 있던 동작(5개)을 함께 확인했다            |
| 시험을 먼저 커밋해 실패를 확인하고, 다음 커밋에서 수정한다 | `df12012dd`(실패) → `6e24355ca`(수정). 시험이 그 버그를 잡는다는 근거  |
| 로직을 컴포넌트에서 분리해 순수 함수로 만든다              | `geometry.ts`로 단위 시험 13개, 상태 참조 시점 버그가 들어갈 여지 축소 |
| 처리되지 않은 에러를 시험 실패로 바꾼다                    | 화면만 확인하는 시험이 놓치는 에러를 fixture 하나로 검출               |

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

- [Playwright와 E2E 가짜 API로 블로그 스크린샷 생성하기](/memo/screenshots-with-playwright)
- [흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/design-tokens#z-index-층-흩어진-숫자를---z--변수로-모으기-231)
- [창 관리 규칙을 useSyncExternalStore로 구독하는 프레임워크 무관 패키지로 옮기기](/memo/desktop-core-stores#창-관리-작은-store와-usesyncexternalstore)
- [음악 앱 버그 세 가지 - 꺼진 앱, 쌓이는 표지, 끝없이 내려가는 시트](/memo/music-player-fixes)
- [Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험](/memo/api-route-table-test)

<details>
<summary>참고 문헌</summary>

- [Playwright: Fixtures (Automatic fixtures)](https://playwright.dev/docs/test-fixtures#automatic-fixtures)
- [Playwright: Installation](https://playwright.dev/docs/intro)
- [React: Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [React: Catching rendering errors with an Error Boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [MDN: Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [formatToParts()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts)
- [Node.js: Internationalization support (ICU)](https://nodejs.org/api/intl.html)
- [Vitest](https://vitest.dev/)

</details>

[^e2e]: End-to-End 시험. 실제 브라우저로 사이트를 열고 사용자처럼 클릭·입력해 결과 화면을 확인한다. 이 저장소는 [Playwright](https://playwright.dev/)를 쓴다.

[^stale]: 함수가 만들어진 시각의 변수 값을 계속 참조하는 현상. React에서는 이벤트 핸들러나 effect가 이전 렌더링의 state를 캡처한 채로 실행되면 발생한다.

[^icu]: International Components for Unicode. 날짜·숫자 형식, 정렬 같은 국제화 데이터를 제공하는 라이브러리로, Node와 브라우저의 `Intl` API가 내부적으로 사용한다. 버전마다 로케일 데이터가 다를 수 있다.

#MacFolio #테스트 #Playwright
