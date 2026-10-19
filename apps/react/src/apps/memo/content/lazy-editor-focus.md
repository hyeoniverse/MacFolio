---
title: 가끔 실패하는 시험이 찾아 준 버그 - 아직 없는 편집기로 옮긴 초점
date: 2026-10-10
category: 개발기/MacFolio/프론트엔드
summary: 메모 편집 E2E 몇 개가 전체를 돌릴 때만 가끔 실패했다. 일부러 느리게 돌려 재현하니 원인은 코드였다. 제목에서 Enter를 누르면 본문 편집기로 초점을 옮기는데, 따로 불러오는 편집기가 느린 기기에서는 아직 없었다.
---

전체 E2E(350개 남짓)를 돌리면 메모 편집 시험 두세 개가 가끔 실패했다. 그 시험만 따로 돌리면 늘 통과했다. 처음에는 "부하가 걸릴 때 타이밍이 어긋나는 시험"으로 넘기고 다시 돌렸는데, 몇 번 반복되자 그냥 둘 수 없었다. 실패한 시험은 `e2e/memo-editor.spec.ts`의 서식 시험들이었다.

## 일부러 느리게 만들기

전체를 돌릴 때와 비슷하게, 그 시험들을 한꺼번에 여러 번 동시에 돌렸다.

```bash
npx playwright test e2e/memo-editor.spec.ts:99 e2e/memo-editor.spec.ts:164 \
  --repeat-each=14 --workers=10
```

36번 중 2번 실패했다. 이제 다시 볼 수 있다. `--workers=10`으로 CPU를 바쁘게 만들면 편집기 코드를 받아 실행하는 시간이 길어져, 전체를 돌릴 때와 비슷한 조건이 된다.

![고치기 전후의 반복 결과](./images/lazy-editor-focus-runs.svg '고치기 전에는 36번 중 2번, 고친 뒤에는 126번 모두 통과') 실패한 쪽의 저장된 본문은 이랬다.

```diff
- ### 머리말이 될 줄
+ ###
```

머리말 모양은 들어갔는데 글자가 없다. 시험은 이렇게 쓴다.

```ts
await page.keyboard.type('서식 시험'); // 제목
await page.keyboard.press('Enter'); // 본문으로
await page.keyboard.type('머리말이 될 줄');
```

Enter 바로 뒤에 친 글자가 본문에 들어가지 않았다.

## 원인

제목 칸의 Enter는 이렇게 처리하고 있었다.

```ts
event.currentTarget.closest('.memo-writer')?.querySelector<HTMLElement>('.ProseMirror')?.focus();
```

본문 편집기(Milkdown)는 관리자에게만 필요해서 `React.lazy`로 처음 쓸 때 불러온다. 새 메모를 열자마자 제목을 쓰고 Enter를 누르면, 편집기 코드가 아직 오는 중이라 `.ProseMirror`가 없을 수 있다. 그러면 `?.focus()`는 아무 일도 하지 않고, 초점은 제목에 남는다. 그 뒤에 친 글자는 제목으로 들어간다.

시험만의 문제가 아니다. 느린 휴대폰이나 느린 네트워크에서 새 메모를 열자마자 제목을 쓰고 Enter를 누르면, 사람도 같은 일을 겪는다.

![고치기 전과 후의 Enter 처리 순서](./images/lazy-editor-focus-timeline.svg '편집기가 아직 없으면 옮길 일을 기억해 두었다가 준비되면 옮긴다')

## 고를 수 있던 방법

| 방법                                                | 좋은 점                     | 걸리는 점                                                 |
| --------------------------------------------------- | --------------------------- | --------------------------------------------------------- |
| 시험에서 `waitForTimeout`을 넣는다                  | 시험만 고치면 된다          | 사람이 겪는 버그는 그대로, 시험만 느려진다                |
| 편집기를 `lazy` 없이 처음부터 불러온다              | 편집기가 늘 있다            | 방문자는 편집기를 쓰지 않는데 모두가 그 코드를 받는다     |
| 새 메모 버튼을 누를 때 편집기를 미리 불러온다       | 대부분 늦지 않는다          | 네트워크가 아주 느리면 여전히 늦을 수 있다. 확실하지 않다 |
| **편집기가 없으면 기억해 두었다가 준비되면 옮긴다** | 언제 준비되든 맞게 동작한다 | 상태 하나와 콜백 하나가 는다                              |

마지막을 골랐다. 사람이 겪는 일을 고치고, 시간에 기대지 않는다.

## 고친 것

Enter를 눌렀는데 편집기가 아직 없으면 "본문으로 옮기기"를 기억해 두고, 편집기가 다 만들어지면 그때 옮긴다.

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

기억은 `useRef`에 둔다. 다시 그릴 필요가 없는 값이라 상태로 둘 까닭이 없다.

편집기 쪽에는 다 만들어졌을 때 부르는 `onReady`를 더했다. Milkdown의 `useEditor`가 돌려주는 `loading`이 `false`가 되는 때다.

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

기준은 `.ProseMirror` 요소가 생긴 때가 아니라 Milkdown이 편집기를 다 만들었다고 알려 주는 때다.

## 고쳤다는 것을 시험으로

이 상황을 일부러 만드는 시험을 더했다. 편집기 코드 파일을 Playwright로 붙잡아 두었다가 늦게 보낸다.

```ts
await page.route(/InlineEditor-[\w-]+\.js$/, async (route) => {
	await held; // 제목에서 Enter를 누른 뒤에 풀어 준다
	await route.continue();
});
```

시험 이름은 "편집기를 불러오는 중에 제목에서 Enter를 눌러도, 다 불러오면 본문으로 옮겨 간다"다. Enter를 누른 때에는 `.ProseMirror`가 0개인 것을 확인하고, 풀어 준 뒤에 본문에 초점이 가서 친 글자가 저장된 본문(`'본문이 여기로\n'`)에 들어가고 제목은 '느린 기기' 그대로인지 본다. 고치기 전 코드로 돌리면 이 시험이 실패하는 것도 확인했다.

다른 시험들은 Enter 뒤에 본문에 초점이 간 것을 확인하고 나서 쓰게 했다. 사람도 커서가 옮겨 간 것을 보고 쓴다. 같은 모양의 시험이 세 파일(`memo-editor`·`memo-publish`·`memo-tags`)에 14곳 있었다. 바뀐 파일은 여섯 개, 156줄 더하기, 4줄 지우기다.

고친 뒤 같은 방법으로 세 시험을 126번 돌렸고 모두 통과했다.

## 남은 것·배운 것

- "가끔 실패하는 시험"은 시험의 문제로 넘기기 쉽다. 이번에는 시험이 느린 기기에서 사람이 겪을 일을 먼저 겪은 것이었다. 다시 돌려 통과하면 넘어가는 대신, 조건을 만들어 다시 실패시켜 본다.
- `lazy`로 나눈 코드는 "아직 없을 수 있다"를 늘 품고 있다. 그 코드의 DOM을 찾는 곳(`querySelector`)은 없을 때 무엇을 할지 정해야 한다. `?.`로 조용히 넘어가면 이런 버그가 숨는다.
- 네트워크를 붙잡는 `page.route`는 느린 기기를 흉내 내는 쉬운 방법이다. 특정 청크 파일만 늦출 수 있다.

## 관련 글

- [글 한 편 추가했더니 E2E가 깨졌다](/memo/flaky-drag-e2e)
- [시험이 찾아낸 버그들](/memo/bugs-found-by-tests)
- [Playwright로 휴대폰 화면과 움직임 시험](/memo/playwright-mobile-and-motion)

#MacFolio #테스트 #Playwright #트러블슈팅
