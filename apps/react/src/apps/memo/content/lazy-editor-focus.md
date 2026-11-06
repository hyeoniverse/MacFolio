---
title: 마운트 전 React.lazy 편집기로 가는 포커스를 onReady까지 대기시키기
date: 2026-10-10
category: 개발 기록/MacFolio/트러블슈팅
series: 메모 편집기
seriesOrder: 4
summary: 메모 편집 E2E 몇 개가 전체 실행 시에만 간헐적으로 실패했다. 의도적으로 부하를 걸어 재현하자 원인은 앱 코드였다. 제목에서 Enter를 누르면 본문 편집기로 포커스를 이동하는데, 지연 로딩하는 편집기가 느린 기기에서는 아직 마운트되지 않았다.
---

| 증상                                                    | 원인                                                                                                 | 해결                                                             | 영향 범위                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| 전체 E2E에서만 메모 편집 시험 두세 개가 간헐적으로 실패 | `React.lazy` 편집기가 마운트되기 전에 제목의 Enter가 `.ProseMirror`를 찾지 못해 포커스가 제목에 남음 | 편집기가 없으면 포커스 이동을 대기로 기록하고 `onReady`에서 이동 | 느린 기기·네트워크에서 새 메모를 작성하는 관리자 |

## 배경

### 메모 작성 화면과 포커스

관리자가 메모 앱에서 새 메모를 열면 제목 칸과 본문 편집기가 위아래로 나타난다. 제목을 입력하고 Enter를 누르면 커서가 본문 편집기로 이동한다. 키보드 입력을 받는 요소를 **포커스(focus)**가 있는 요소라고 하며, 스크립트에서는 요소의 `focus()` 메서드로 포커스를 옮긴다.

![메모 작성 화면. 위에 큰 글씨의 제목 'Enter로 본문 이동'이 있고, 아래 본문 칸에 '제목에서 Enter를 누르면 커서가 이 본문 칸으로 옮겨 온다'가 입력되어 있다](./images/lazy-editor-focus-writer.jpg '새 메모 작성 화면. 제목에서 Enter를 누르면 아래 본문 편집기로 커서가 이동한다')

본문 편집기는 [Milkdown](https://milkdown.dev/)으로 만들었다. Milkdown은 ProseMirror라는 편집기 엔진 위에서 Markdown을 편집하게 해 주는 라이브러리이고, 편집 영역은 `class="ProseMirror"`인 `contenteditable` 요소로 렌더링된다.

### React.lazy와 코드 분할

편집기 코드(Milkdown과 ProseMirror)는 크기가 크고, 방문자에게는 필요 없고 관리자만 쓴다. 그래서 [`React.lazy`](https://react.dev/reference/react/lazy)로 분리했다. `lazy(() => import('./InlineEditor'))`로 선언한 컴포넌트는 첫 화면 번들에 포함되지 않고, 처음 렌더링되는 시각에 별도 파일(청크, `InlineEditor-….js`)로 내려받는다. 내려받는 동안에는 상위의 [`<Suspense>`](https://react.dev/reference/react/Suspense)에 지정한 대체 화면(fallback)이 그려진다.

```tsx
// PostWriter.tsx
const InlineEditor = lazy(() => import('./InlineEditor'));

<Suspense fallback={<div className="prose memo-markdown">{renderMarkdown(draft.body)}</div>}>
	<InlineEditor … />
</Suspense>
```

이 구조에서는 ==제목 칸은 이미 있는데 본문 편집기는 아직 없는 구간==이 생긴다. 이 구간의 길이는 네트워크 속도와 CPU 부하에 따라 달라진다.

![첫 화면 번들과 편집기 청크의 구성, 그리고 새 메모 클릭부터 청크 다운로드, InlineEditor 마운트, loading false와 onReady까지의 순서. 청크를 받는 동안 .ProseMirror 요소가 없다](./images/lazy-editor-focus-lazy-load.svg '편집기 청크를 받는 동안에는 .ProseMirror 요소가 문서에 없다')

### 간헐적으로 실패하는 시험

같은 코드로 실행해도 통과와 실패가 바뀌는 시험을 **불안정한 시험(flaky test)**이라고 한다. 대부분 시험이 타이밍처럼 고정되지 않은 조건에 의존할 때 생긴다. 흔히 시험 코드만의 문제로 보고 재실행하지만, 이번처럼 실제 사용자가 겪을 앱 버그가 원인인 경우도 있다.

## 증상

전체 E2E(약 350개)를 실행하면 메모 편집 시험 두세 개가 간헐적으로 실패했다. 해당 시험만 단독으로 실행하면 항상 통과했다. 처음에는 "부하 상황에서 타이밍이 어긋나는 시험"으로 판단하고 재실행했는데, 같은 실패가 반복되어 원인을 조사했다. 실패한 시험은 `e2e/memo-editor.spec.ts`의 서식 시험이었다.

실패한 시험에서 저장된 본문은 다음과 같았다.

```diff
- ### 머리말이 될 줄
+ ###
```

제목 서식(`###`)은 적용됐는데 텍스트가 없다. 시험 코드는 다음과 같다.

```ts
await page.keyboard.type('서식 시험'); // 제목
await page.keyboard.press('Enter'); // 본문으로
await page.keyboard.type('머리말이 될 줄');
```

Enter 직후에 입력한 텍스트가 본문에 들어가지 않았다.

## 원인 추적

### 부하를 걸어 재현

전체 실행과 비슷한 조건을 만들기 위해 해당 시험들을 여러 번 병렬로 실행했다.

```bash
npx playwright test e2e/memo-editor.spec.ts:99 e2e/memo-editor.spec.ts:164 \
  --repeat-each=14 --workers=10
```

[`--repeat-each`](https://playwright.dev/docs/test-cli)는 같은 시험을 지정한 횟수만큼 반복하고, `--workers=10`은 브라우저 10개를 동시에 실행해 CPU 부하를 높인다. 부하가 높으면 편집기 청크를 내려받아 실행하는 시간이 길어져 전체 실행과 비슷한 조건이 된다. ==36회 중 2회 실패해 재현에 성공했다.==

## 원인

제목 입력 칸의 Enter는 다음과 같이 처리했다.

```ts
event.currentTarget.closest('.memo-writer')?.querySelector<HTMLElement>('.ProseMirror')?.focus();
```

새 메모를 열자마자 제목을 입력하고 Enter를 누르면, 편집기 코드를 아직 내려받는 중이라 `.ProseMirror` 요소가 없을 수 있다. 그러면 `querySelector`가 `null`을 반환하고, 선택적 연결 연산자 `?.`는 `null`에서 멈춰 `focus()`를 호출하지 않는다. 오류도 나지 않으므로 ==포커스는 제목에 남는다.== 그 뒤에 입력한 텍스트는 제목으로 들어간다.

> [!IMPORTANT] 시험만의 문제가 아니다
> 느린 휴대폰이나 느린 네트워크에서 새 메모를 열자마자 제목을 입력하고 Enter를 누르면, 실제 사용자도 같은 문제를 겪는다.

![수정 전후의 Enter 처리 순서](./images/lazy-editor-focus-timeline.svg '편집기가 아직 없으면 포커스 이동을 대기 상태로 기록하고, 준비된 시각에 이동한다')

## 해결

수정은 [#148](https://github.com/hyeoniverse/MacFolio/pull/148)에서 했다.

### 검토한 방법

| 방법                                                   | 장점                               | 단점                                                             |
| ------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------- |
| 시험에 `waitForTimeout` 추가                           | 시험만 수정하면 된다               | 사용자가 겪는 버그는 그대로이고, 시험만 느려진다                 |
| 편집기를 `lazy` 없이 초기에 로드                       | 편집기가 항상 존재한다             | 방문자는 편집기를 쓰지 않는데 모든 방문자가 그 코드를 내려받는다 |
| 새 메모 버튼을 누른 시각에 편집기를 미리 로드          | 대부분의 경우 늦지 않는다          | 네트워크가 매우 느리면 여전히 늦을 수 있어 보장되지 않는다       |
| **편집기가 없으면 대기 상태로 기록하고 준비되면 이동** | 로드 완료 시각과 무관하게 동작한다 | ref 하나와 콜백 하나가 추가된다                                  |

마지막을 선택했다. 사용자가 겪는 버그를 수정하고, 시간 지연에 의존하지 않는다.

### 수정 내용

Enter를 눌렀을 때 편집기가 아직 없으면 "본문으로 포커스 이동"을 대기 상태로 기록하고, 편집기 생성이 끝난 시각에 이동한다.

```ts
// PostWriter.tsx
const bodyFocusPending = useRef(false);
const focusBody = () => {
	const body = titleRef.current?.closest('.memo-writer')?.querySelector<HTMLElement>('.ProseMirror');
	body?.focus();
	return Boolean(body);
};

// 제목의 onKeyDown
if (event.key === 'Enter') {
	event.preventDefault();
	if (!focusBody()) bodyFocusPending.current = true;
}
```

대기 상태는 [`useRef`](https://react.dev/reference/react/useRef)에 보관한다. `useRef`의 값은 바뀌어도 컴포넌트를 다시 렌더링하지 않는다. 화면에 표시할 값이 아니므로 state(`useState`)로 둘 이유가 없다.

편집기 쪽에는 생성 완료 시각에 호출하는 `onReady` 콜백을 추가했다. Milkdown의 `useEditor`가 반환하는 `loading`이 `false`가 되는 시각이다.

```ts
// InlineEditor.tsx
const { get, loading } = useEditor(/* ... */);
useEffect(() => {
	if (!loading) onReadyRef.current?.();
}, [loading]);

// PostWriter.tsx
<InlineEditor
	onReady={() => {
		if (!bodyFocusPending.current) return;
		bodyFocusPending.current = false;
		focusBody();
	}}
/>
```

두 경우의 동작은 다음과 같다.

| Enter를 누른 시각 | `focusBody()` 결과 | 이후 동작                                                      |
| ----------------- | ------------------ | -------------------------------------------------------------- |
| 편집기 생성 뒤    | `true`             | 바로 본문으로 이동. `onReady`는 이미 호출되어 다시 오지 않는다 |
| 편집기 생성 전    | `false`            | `bodyFocusPending = true` 기록 → `onReady`에서 본문으로 이동   |

> [!NOTE] 포커스 이동의 기준 시각
> 기준은 `.ProseMirror` 요소가 생성된 시각이 아니라 Milkdown이 편집기 생성 완료를 알리는 시각이다.

## 확인

==수정 후 같은 방법으로 세 시험을 126회 실행했고 모두 통과했다.==

![수정 전후의 반복 실행 결과](./images/lazy-editor-focus-runs.svg '수정 전에는 36회 중 2회 실패, 수정 후에는 126회 모두 통과')

## 재발 방지

### 느린 기기를 재현하는 시험

이 상황을 의도적으로 만드는 시험을 추가했다. Playwright의 [`page.route`](https://playwright.dev/docs/api/class-page#page-route)는 페이지가 보내는 네트워크 요청을 시험 코드가 가로채는 기능이다. 이 기능으로 편집기 청크 파일 요청을 보류했다가 늦게 응답한다.

```ts
let release = () => {};
const held = new Promise<void>((resolve) => (release = resolve));
await page.route(/InlineEditor-[\w-]+\.js$/, async (route) => {
	await held; // 제목에서 Enter를 누른 뒤에 해제한다
	await route.continue();
});
```

시험 이름은 "편집기를 불러오는 중에 제목에서 Enter를 눌러도, 다 불러오면 본문으로 옮겨 간다"다. Enter를 누른 시각에 `.ProseMirror`가 0개인 것을 확인하고, 보류를 해제한 뒤 본문에 포커스가 이동해 입력한 텍스트가 저장된 본문(`'본문이 여기로\n'`)에 들어가고 제목은 '느린 기기' 그대로인지 확인한다. 수정 전 코드로 실행하면 이 시험이 실패하는 것도 확인했다.

![시험 코드, 브라우저, 편집기 청크 세 줄로 나눈 순서. 보류 등록, 새 메모 열기와 요청 보류, 제목 입력과 Enter, 보류 해제와 응답 전달, onReady, 본문 입력](./images/lazy-editor-focus-route-hold.svg 'page.route로 편집기 청크 응답을 붙잡아 두고 Enter 뒤에 놓아준다')

### 다른 시험의 입력 순서

다른 시험들은 Enter 후 본문에 포커스가 이동한 것을 확인한 뒤 입력하도록 수정했다. 실제 사용자도 커서 이동을 확인한 뒤 입력한다.

```ts
await page.keyboard.press('Enter');
// 본문 편집기는 따로 불러오므로 초점이 옮겨 간 뒤에 쓴다
await expect(memo.locator('.ProseMirror')).toBeFocused();
await page.keyboard.type('머리말이 될 줄');
```

같은 패턴의 시험이 세 파일(`memo-editor`·`memo-publish`·`memo-tags`)에 14곳 있었다. 변경 파일은 6개, +156/−4다.

### 정리

> [!WARNING] lazy 코드의 DOM을 찾는 곳
> `lazy`로 분리한 코드는 "아직 로드되지 않았을 수 있다"는 상태를 항상 가진다. 그 코드의 DOM을 찾는 곳(`querySelector`)은 요소가 없을 때의 처리를 정의해야 한다. `?.`로 오류 없이 넘어가면 이런 버그가 드러나지 않는다.

- 간헐적으로 실패하는 시험은 시험 자체의 문제로 판단하기 쉽다. 이번에는 시험이 느린 기기에서 사용자가 겪을 문제를 먼저 검출했다. 재실행해 통과하면 넘어가는 대신, 실패 조건을 재현해 원인을 확인한다.
- 네트워크 요청을 보류하는 `page.route`는 느린 기기를 재현하는 간단한 방법이다. 특정 청크 파일만 지연할 수 있다.

## 관련 글

- [이미지 로드 전 좌표와 누락된 dragover로 흔들린 끌기 E2E](/memo/flaky-drag-e2e)
- [리팩터링 전 E2E 시험 10개로 찾은 hook 순서·클로저·ICU 버그](/memo/bugs-found-by-tests)
- [Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)

<details>
<summary>참고 문헌</summary>

- [React: lazy](https://react.dev/reference/react/lazy)
- [React: Suspense](https://react.dev/reference/react/Suspense)
- [React: useRef](https://react.dev/reference/react/useRef)
- [MDN: HTMLElement.focus()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)
- [MDN: Optional chaining (?.)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)
- [Milkdown 문서](https://milkdown.dev/)
- [Playwright: page.route](https://playwright.dev/docs/api/class-page#page-route)
- [Playwright: Command line (--repeat-each, --workers)](https://playwright.dev/docs/test-cli)

</details>

#MacFolio #테스트 #Playwright #트러블슈팅
