---
title: 가끔 실패하는 시험이 찾아 준 버그 - 아직 없는 편집기로 옮긴 초점
date: 2026-10-10
category: 개발기/MacFolio/프론트엔드
summary: 메모 편집 E2E 시험 몇 개가 전체를 돌릴 때만 가끔 실패했다. 시험을 여러 개 동시에 돌려 일부러 느리게 만들자 다시 나왔고, 원인은 시험이 아니라 코드였다. 제목에서 Enter를 누르면 본문 편집기로 초점을 옮기는데, 편집기는 따로 불러오는 코드라 느린 기기에서는 아직 없을 수 있었다.
---

전체 E2E(350개 남짓)를 돌리면 메모 편집 시험 두세 개가 가끔 실패했다. 그 시험만 따로 돌리면 늘 통과했다. 처음에는 "부하가 걸릴 때 타이밍이 어긋나는 시험"으로 넘기고 다시 돌렸는데, 몇 번 반복되자 그냥 둘 수 없었다.

## 일부러 느리게 만들기

전체를 돌릴 때와 비슷하게, 그 시험들을 한꺼번에 여러 번 동시에 돌렸다.

```bash
npx playwright test e2e/memo-editor.spec.ts:99 e2e/memo-editor.spec.ts:164 \
  --repeat-each=14 --workers=10
```

36번 중 2번 실패했다. 이제 다시 볼 수 있다. 실패한 쪽의 저장된 본문은 이랬다.

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

## 고친 것

Enter를 눌렀는데 편집기가 아직 없으면 "본문으로 옮기기"를 기억해 두고, 편집기가 다 만들어지면 그때 옮긴다.

```ts
if (!focusBody()) bodyFocusPending.current = true;
```

편집기 쪽에는 다 만들어졌을 때 부르는 `onReady`를 더했다. Milkdown의 `useEditor`가 돌려주는 `loading`이 `false`가 되는 때다.

```ts
const { get, loading } = useEditor(/* ... */);
useEffect(() => {
	if (!loading) onReadyRef.current?.();
}, [loading]);
```

## 고쳤다는 것을 시험으로

이 상황을 일부러 만드는 시험을 더했다. 편집기 코드 파일을 Playwright로 붙잡아 두었다가 늦게 보낸다.

```ts
await page.route(/InlineEditor-[\w-]+\.js$/, async (route) => {
	await held; // 제목에서 Enter를 누른 뒤에 풀어 준다
	await route.continue();
});
```

Enter를 누른 때에는 편집기가 없고, 풀어 준 뒤에 본문에 초점이 가서 친 글자가 본문에 들어가는지 본다. 고치기 전 코드로 돌리면 이 시험이 실패하는 것도 확인했다.

다른 시험들은 Enter 뒤에 본문에 초점이 간 것을 확인하고 나서 쓰게 했다. 사람도 커서가 옮겨 간 것을 보고 쓴다. 같은 모양의 시험이 세 파일에 14곳 있었다.

고친 뒤 같은 방법으로 세 시험을 126번 돌렸고 모두 통과했다.

#MacFolio #테스트 #Playwright #트러블슈팅
