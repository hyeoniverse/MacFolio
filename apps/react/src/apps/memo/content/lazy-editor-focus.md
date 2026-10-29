---
title: 메모 편집기 4 - 마운트 전 React.lazy 편집기로 가는 포커스를 onReady까지 대기시키기
date: 2026-10-10
category: 개발 기록/MacFolio/품질
summary: 메모 편집 E2E 몇 개가 전체 실행 시에만 간헐적으로 실패했다. 의도적으로 부하를 걸어 재현하자 원인은 앱 코드였다. 제목에서 Enter를 누르면 본문 편집기로 포커스를 이동하는데, 지연 로딩하는 편집기가 느린 기기에서는 아직 마운트되지 않았다.
---

전체 E2E(약 350개)를 실행하면 메모 편집 시험 두세 개가 간헐적으로 실패했다. 해당 시험만 단독으로 실행하면 항상 통과했다. 처음에는 "부하 상황에서 타이밍이 어긋나는 시험"으로 판단하고 재실행했는데, 같은 실패가 반복되어 원인을 조사했다. 실패한 시험은 `e2e/memo-editor.spec.ts`의 서식 시험이었다. 수정은 [#148](https://github.com/hyeoniverse/MacFolio/pull/148)에서 했다.

## 부하를 걸어 재현

전체 실행과 비슷한 조건을 만들기 위해, 해당 시험들을 여러 번 병렬로 실행했다.

```bash
npx playwright test e2e/memo-editor.spec.ts:99 e2e/memo-editor.spec.ts:164 \
  --repeat-each=14 --workers=10
```

36회 중 2회 실패했다. 재현에 성공했다. [`--repeat-each`](https://playwright.dev/docs/test-cli)로 같은 시험을 반복하고 `--workers=10`으로 CPU 부하를 높이면, 편집기 코드를 내려받아 실행하는 시간이 길어져 전체 실행과 비슷한 조건이 된다.

![수정 전후의 반복 실행 결과](./images/lazy-editor-focus-runs.svg '수정 전에는 36회 중 2회 실패, 수정 후에는 126회 모두 통과')

실패한 시험에서 저장된 본문은 다음과 같았다.

```diff
- ### 머리말이 될 줄
+ ###
```

제목 서식은 적용됐는데 텍스트가 없다. 시험 코드는 다음과 같다.

```ts
await page.keyboard.type('서식 시험'); // 제목
await page.keyboard.press('Enter'); // 본문으로
await page.keyboard.type('머리말이 될 줄');
```

Enter 직후에 입력한 텍스트가 본문에 들어가지 않았다.

## 원인

제목 입력 칸의 Enter는 다음과 같이 처리했다.

```ts
event.currentTarget.closest('.memo-writer')?.querySelector<HTMLElement>('.ProseMirror')?.focus();
```

본문 편집기([Milkdown](https://milkdown.dev/))는 관리자에게만 필요해서 [`React.lazy`](https://react.dev/reference/react/lazy)로 처음 사용하는 시각에 불러온다. 새 메모를 열자마자 제목을 입력하고 Enter를 누르면, 편집기 코드를 아직 내려받는 중이라 `.ProseMirror` 요소가 없을 수 있다. 그러면 `?.focus()`는 아무 동작도 하지 않고, 포커스는 제목에 남는다. 그 뒤에 입력한 텍스트는 제목으로 들어간다.

시험만의 문제가 아니다. 느린 휴대폰이나 느린 네트워크에서 새 메모를 열자마자 제목을 입력하고 Enter를 누르면, 실제 사용자도 같은 문제를 겪는다.

![수정 전후의 Enter 처리 순서](./images/lazy-editor-focus-timeline.svg '편집기가 아직 없으면 포커스 이동을 대기 상태로 기록하고, 준비된 시각에 이동한다')

## 검토한 방법

| 방법                                                   | 장점                               | 단점                                                             |
| ------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------- |
| 시험에 `waitForTimeout` 추가                           | 시험만 수정하면 된다               | 사용자가 겪는 버그는 그대로이고, 시험만 느려진다                 |
| 편집기를 `lazy` 없이 초기에 로드                       | 편집기가 항상 존재한다             | 방문자는 편집기를 쓰지 않는데 모든 방문자가 그 코드를 내려받는다 |
| 새 메모 버튼을 누른 시각에 편집기를 미리 로드          | 대부분의 경우 늦지 않는다          | 네트워크가 매우 느리면 여전히 늦을 수 있어 보장되지 않는다       |
| **편집기가 없으면 대기 상태로 기록하고 준비되면 이동** | 로드 완료 시각과 무관하게 동작한다 | ref 하나와 콜백 하나가 추가된다                                  |

마지막을 선택했다. 사용자가 겪는 버그를 수정하고, 시간 지연에 의존하지 않는다.

## 수정 내용

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

대기 상태는 `useRef`에 보관한다. 값이 바뀌어도 다시 렌더링할 필요가 없으므로 state로 둘 이유가 없다.

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

기준은 `.ProseMirror` 요소가 생성된 시각이 아니라 Milkdown이 편집기 생성 완료를 알리는 시각이다.

## 수정을 시험으로 고정

이 상황을 의도적으로 만드는 시험을 추가했다. 편집기 청크 파일 요청을 Playwright의 [`page.route`](https://playwright.dev/docs/api/class-page#page-route)로 보류했다가 늦게 응답한다.

```ts
await page.route(/InlineEditor-[\w-]+\.js$/, async (route) => {
	await held; // 제목에서 Enter를 누른 뒤에 해제한다
	await route.continue();
});
```

시험 이름은 "편집기를 불러오는 중에 제목에서 Enter를 눌러도, 다 불러오면 본문으로 옮겨 간다"다. Enter를 누른 시각에 `.ProseMirror`가 0개인 것을 확인하고, 보류를 해제한 뒤 본문에 포커스가 이동해 입력한 텍스트가 저장된 본문(`'본문이 여기로\n'`)에 들어가고 제목은 '느린 기기' 그대로인지 확인한다. 수정 전 코드로 실행하면 이 시험이 실패하는 것도 확인했다.

다른 시험들은 Enter 후 본문에 포커스가 이동한 것을 확인한 뒤 입력하도록 수정했다. 실제 사용자도 커서 이동을 확인한 뒤 입력한다. 같은 패턴의 시험이 세 파일(`memo-editor`·`memo-publish`·`memo-tags`)에 14곳 있었다. 변경 파일은 6개, +156/−4다.

수정 후 같은 방법으로 세 시험을 126회 실행했고 모두 통과했다.

## 남은 것·배운 것

- 간헐적으로 실패하는 시험(flaky test)은 시험 자체의 문제로 판단하기 쉽다. 이번에는 시험이 느린 기기에서 사용자가 겪을 문제를 먼저 검출한 것이었다. 재실행해 통과하면 넘어가는 대신, 실패 조건을 재현해 원인을 확인한다.
- `lazy`로 분리한 코드는 "아직 로드되지 않았을 수 있다"는 상태를 항상 가진다. 그 코드의 DOM을 찾는 곳(`querySelector`)은 요소가 없을 때의 처리를 정의해야 한다. `?.`로 오류 없이 넘어가면 이런 버그가 드러나지 않는다.
- 네트워크 요청을 보류하는 `page.route`는 느린 기기를 재현하는 간단한 방법이다. 특정 청크 파일만 지연할 수 있다.

## 관련 글

- [E2E 시험 4 - 이미지 로드 전 좌표와 누락된 dragover로 흔들린 끌기 E2E](/memo/flaky-drag-e2e)
- [E2E 시험 1 - 리팩터링 전 E2E 시험 10개로 찾은 hook 순서·클로저·ICU 버그](/memo/bugs-found-by-tests)
- [E2E 시험 2 - Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)

#MacFolio #테스트 #Playwright #트러블슈팅
