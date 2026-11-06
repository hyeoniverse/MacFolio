---
title: 브라우저 history 대신 sessionStorage에 쌓는 앱 내부 뒤로·앞으로 기록
date: 2026-10-27
category: 개발 기록/MacFolio/구조·상태 관리
summary: 메모 앱 도구 막대에 Finder·Safari처럼 ‹ › 버튼을 더했다. 연 폴더와 본 글을 기록에 쌓고, 길게 누르면 지난 칸 목록이 열린다. 브라우저 기록에 쌓지 않은 이유, 지운 글을 건너뛰는 규칙, 돌아온 글을 떠날 때의 스크롤 위치에서 여는 방법을 정리했다.
---

## 배경

메모 앱에서 글 안의 링크를 따라 다른 글로 이동한 뒤 원래 글로 돌아가려면, 메모 목록에서 제목을 다시 찾아 눌러야 했다. 웹 브라우저라면 뒤로 가기 버튼 한 번으로 돌아갈 수 있는 동작이다.

macOS의 Finder와 Safari는 도구 막대 왼쪽에 ‹ › 버튼이 있다. ‹는 직전에 보던 위치로, ›는 ‹로 돌아오기 전 위치로 이동한다. 버튼을 길게 누르면 지난 위치 목록이 펼쳐지고, 목록에서 고르면 여러 칸을 한 번에 건너뛴다. 메모 앱에 같은 버튼을 더했다.

![고치기 전 목록 도구 막대](./images/memo-history-nav-toolbar-before.jpg '고치기 전. 목록 도구 막대에는 폴더 이름과 글 수만 있었다')

![고친 뒤 목록 도구 막대](./images/memo-history-nav-toolbar-after.jpg '고친 뒤. 폴더 이름 앞에 ‹ › 버튼이 있다. 막 연 메모처럼 지난 칸이 없으면 흐리게 보인다')

## 조작 방법

| 조작                                                    | 결과                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| ‹ · › 누르기                                            | 한 칸 뒤·앞으로 이동한다                                          |
| 길게 누르기(약 0.5초), 누른 채 아래로 끌기, 오른쪽 클릭 | 그 방향의 지난 칸 목록을 연다. 손을 떼도 한 칸 이동은 하지 않는다 |
| ⌘[ · ⌘] (Windows·Linux는 Ctrl)                          | 한 칸 뒤·앞으로. 메뉴 막대의 **이동 › 뒤로·앞으로**와 같다        |

누른 채 아래로 끌어도 목록이 열리는 동작은 macOS 버튼과 같다. 마우스를 누른 위치보다 8px 아래로 움직이면 0.5초를 기다리지 않고 연다.

![길게 눌러 연 뒤로 기록](./images/memo-history-nav-menu.jpg '‹를 길게 누른 화면. 가까운 칸부터 글 제목과 그 글이 들어 있는 폴더(사이드바와 같은 개발 기록 › MacFolio › 회고 표기)가 보이고, 고르면 그 칸의 폴더와 글을 다시 연다. 마우스를 올린 둘째 줄은 강조 바탕 위에서 흰 글자다')

### 목록 둘째 줄에 적는 폴더

목록의 둘째 줄은 그 글이 실제로 들어 있는 폴더다. 처음에는 그 글을 볼 당시 열려 있던 목록(예: '모든 글')을 적었다. 그런데 '모든 글'에서 연 글이 다섯 개면 다섯 줄 모두 둘째 줄이 '모든 글'이 되어, 어느 글인지 구별하는 데 쓸모가 없었다. 그래서 글의 폴더로 바꿨다. 관리자가 메모 정리로 글을 옮겼다면 옮긴 폴더를 적는다. 글 없이 폴더만 연 칸은 그 폴더 경로를 적는다.

### 강조된 항목의 글자 대비

둘째 줄은 원래 흐린 회색(`--color-secondary-label`)이다. 마우스를 올려 항목이 파란 강조 바탕이 되면 회색 글자가 바탕에 묻혀 읽기 어려웠다. 공용 메뉴(`shared/ui/menu/Menu.css`)에서 강조된 항목은 둘째 줄도 첫 줄과 같은 강조 글자색(흰색)을 쓰게 했다.

**명암비(contrast ratio)**는 글자색과 바탕색의 밝기 차이를 1:1(차이 없음)부터 21:1(흰 바탕의 검은 글자)까지의 비율로 나타낸 값이다. 웹 접근성 지침 [WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)의 AA 등급은 일반 크기 글자에 4.5:1 이상을 요구한다.

| 모드   | 강조 바탕 | 흰 글자와의 명암비 | AA 기준(4.5:1) |
| ------ | --------- | ------------------ | -------------- |
| 라이트 | `#007AFF` | 4.02:1             | 미달           |
| 다크   | `#0A84FF` | 3.65:1             | 미달           |

첫 줄과 같은 조합이고 macOS 메뉴도 같은 색을 쓰지만, ==WCAG AA의 작은 글자 기준(4.5:1)에는 못 미친다==. 휴대폰(터치) 메뉴는 누른 항목의 바탕이 옅은 회색이라 둘째 줄을 흐린 색 그대로 유지한다.

## 기록 규칙

기록 한 칸은 **연 폴더(또는 '모든 글'·태그 같은 보기)와 그 시각에 본 글**이다. 코드에서는 `NavEntry` 타입으로 표현한다.

```ts
export interface NavEntry {
	category: string; // 폴더 경로 또는 '모든 글'·태그 같은 보기
	tags: string; // 태그로 볼 때 고른 태그 (JSON). 태그 보기가 아니면 빈 문자열
	slug: string | null; // 본 글 주소. 글이 없는 폴더면 null
	scroll?: number; // 이 칸을 떠날 때의 본문 스크롤 위치(px)
}
```

규칙은 React에 의존하지 않는 순수 함수 파일 `navHistory.ts`에 작성하고 단위 시험으로 고정했다. **순수 함수**는 같은 입력에 항상 같은 출력을 반환하고 외부 상태를 바꾸지 않는 함수다. 기록 객체를 받아 새 기록 객체를 반환하므로 화면 없이 입력과 결과만 비교해 시험할 수 있다.

![이동 기록의 세 단계](./images/memo-history-nav-stack.svg '도식. ① 글 셋을 연 뒤 ② ‹ 두 번 ③ 그 자리에서 새 글을 열면 앞쪽 칸을 버린다')

| 규칙          | 동작                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 새 칸         | 지금 칸 뒤에 쌓고, 앞으로 갈 칸이 있었다면 버린다(Safari와 같다). 지금 칸과 같으면 쌓지 않는다                                                                                 |
| 빈 칸 채우기  | 글을 불러오기 전이나 폴더를 연 직후처럼 글이 없는 칸은, 같은 폴더에서 글이 열리면 그 칸을 교체한다. 교체하지 않으면 처음 연 순간의 '모든 글(글 없음)' 칸이 기록 맨 앞에 남는다 |
| 상한          | 50칸. 넘으면 오래된 칸부터 버린다                                                                                                                                              |
| 삭제된 글     | 지금 없는 글의 칸은 ‹ ›와 길게 누르기 목록에서 건너뛴다. 칸 자체는 남겨 두어, 글이 복구되면 다시 이동할 수 있다                                                                |
| 돌아가는 시각 | 검색어와 ⌄ 메뉴의 조건을 비운다. 조건이 남아 있으면 그 글이 목록에서 필터링되어 다른 글이 열린다                                                                               |

위 그림의 예로 규칙을 따라가면 다음과 같다. 글 A, B, C를 차례로 열면 기록은 `[A, B, C]`이고 지금 칸은 C다. ‹를 두 번 누르면 지금 칸이 A가 되고, B와 C는 › 쪽에 남는다. 이 상태에서 글 D를 열면 B와 C를 버리고 기록은 `[A, D]`가 된다. 브라우저의 뒤로 가기 기록과 같은 동작이다.

## 브라우저 기록에 쌓지 않은 이유

브라우저에는 이미 탭마다 방문 기록이 있다. JavaScript의 [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API)로 이 기록을 다룰 수 있다. `history.pushState`는 페이지를 새로 불러오지 않고 주소만 바꾸면서 기록에 칸을 하나 추가하고, `history.replaceState`는 칸을 추가하지 않고 지금 칸의 주소만 교체한다.

메모는 글을 열 때마다 주소를 `/memo/<글>`로 바꾸지만, `replaceState`로 교체만 하고 브라우저 기록은 늘리지 않는다(`shared/lib/appLink.ts`, [History API로 SPA 창 상태를 /memo·/safari 주소와 연결하기](/memo/app-links)). 한 탭 안에 메모·Safari·Finder 창이 함께 떠 있어서, ==브라우저의 뒤로 가기가 어느 창의 기록을 되돌릴지 정할 수 없기 때문==이다.

![탭 하나에 창 세 개가 있을 때 브라우저 기록의 모호함](./images/memo-history-nav-one-tab.svg 'pushState로 쌓았다면 기록은 메모의 글 A, Safari의 프로젝트, 메모의 글 B가 한 줄로 섞인다. 뒤로 가기 한 번이 메모 창을 되돌리는 동작인지 Safari 창을 앞으로 올리는 동작인지 정할 수 없다')

그래서 이 기록은 브라우저 기록과 별도로 메모 창 안에 보관한다.

## 새로 고침 후에도 유지: sessionStorage

처음에는 기록을 JavaScript 변수(메모리)에만 보관해 새로 고치면 사라졌다. 새로 고친 뒤에도 브라우저의 뒤로 가기는 동작하는데 ‹만 비어 있으면 동작이 일관되지 않으므로, 기록을 [`sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)에 저장한다(키 `macfolio:memo:history`, `shared/lib/storage.ts`).

`localStorage`와 `sessionStorage`는 브라우저가 사이트마다 제공하는 키·값 저장소([Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API))다. 둘은 보관 범위가 다르다. `localStorage`는 같은 출처(프로토콜·도메인·포트가 같은 주소)의 모든 탭이 공유하고 브라우저를 닫아도 남는다. `sessionStorage`는 탭마다 따로 보관되고, 새로 고쳐도 남지만 탭을 닫으면 삭제된다.

![메모리·localStorage·sessionStorage의 보관 범위](./images/memo-history-nav-storage.svg '탭 A와 B에서 메모를 열었을 때. 메모리는 새로 고치면 사라지고, localStorage는 두 탭이 기록 하나를 덮어쓰고, sessionStorage는 탭마다 따로 보관하면서 새로 고침에도 남는다')

| 저장소                  | 새로 고침 | 다른 탭     | 탭을 닫으면 | 판단                                                            |
| ----------------------- | --------- | ----------- | ----------- | --------------------------------------------------------------- |
| 메모리 (처음)           | 사라짐    | 따로        | 사라짐      | 새로 고치면 ‹가 비어 브라우저 뒤로 가기와 어긋난다              |
| `localStorage`          | 남음      | **같이 씀** | 남음        | 두 탭이 한 기록을 덮어쓰고, 며칠 전 기록이 다음 방문에 나타난다 |
| `sessionStorage` (선택) | 남음      | 따로        | 사라짐      | 브라우저 기록과 같은 범위                                       |

저장한 값은 다음과 같은 JSON이다. 글 두 편을 읽고 첫 글로 돌아온 상태의 예다.

```json
{
	"v": 1,
	"index": 0,
	"entries": [
		{ "category": "개발 기록/MacFolio/구조·상태 관리", "tags": "", "slug": "macfolio-store-design", "scroll": 900 },
		{ "category": "개발 기록/MacFolio/구조·상태 관리", "tags": "", "slug": "memo-tags", "scroll": 400 }
	]
}
```

| 처리                      | 내용                                                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 형식 검사                 | `{ v: 1, index, entries }`. 다시 읽을 때 버전이 다르거나 모양이 틀리면 버리고 빈 기록으로 시작한다. 길이는 50칸까지, 지금 칸은 범위 안으로 맞춘다(`parseNavHistory`)                                                               |
| 복원 시 필터링            | 글을 다 불러온 시각에 한 번, 삭제된 글·비밀 글로 바뀌어 볼 수 없는 글·없어진 폴더의 칸을 빼고 지금 칸을 맞춘다(`pruneNavHistory`). 지금 칸이 빠지면 앞의 가장 가까운 칸이 지금 칸이 되고, 빼서 이웃하게 된 같은 칸은 하나로 합친다 |
| 불러오기 전에는 쌓지 않음 | 글을 불러오기 전 첫 화면(글 없는 '모든 글')을 쌓으면 저장해 둔 앞쪽 칸이 삭제된다. 그래서 글을 다 불러온 뒤부터 쌓는다                                                                                                             |
| 사용자에게 공개           | 휴지통 앱의 '내 브라우저 데이터'에 이 기록이 보이고, 삭제할 수 있다(`apps/bin/siteStorage.ts`)                                                                                                                                     |

## 단축키와 편집기

메뉴 막대의 단축키는 지금까지 ⌘가 붙은 키라면 글자를 입력하는 칸에서도 동작했다. 예를 들어 ⌘F는 편집기 안에서도 찾기 창을 연다. 그런데 메모 편집기(Milkdown)는 ⌘[를 목록 내어쓰기(들여쓰기 한 단계 해제)에 쓴다. 두 기능이 같은 키를 쓰면 편집 중 ⌘[를 누를 때마다 목록 대신 이전 글이 열린다.

그래서 단축키 정의(`shared/ui/menu/shortcut.ts`)에 `whileTyping` 속성을 추가하고, 뒤로·앞으로는 `whileTyping: false`로 지정했다. ==편집기에 커서가 있으면 ⌘[는 편집기가 처리한다==. 커서가 편집기 밖에 있으면 메뉴 막대가 처리해 이전 칸으로 이동한다.

## 휴대폰

휴대폰 메모는 iOS 메모처럼 화면마다 왼쪽 위에 표시되는 뒤로 가기(목록 → 폴더)를 쓴다. 같은 자리에 ‹ ›를 두면 '화면 계층을 한 단계 올라가는 뒤로'와 '방문 기록의 뒤로'가 함께 생겨 어느 버튼이 무엇을 하는지 구별하기 어렵다. 그래서 ‹ ›는 데스크톱 창에만 표시한다.

## 돌아온 글의 스크롤 위치

10월 30일 추가: 처음 구현에서는 ‹로 돌아온 글이 항상 맨 위부터 열렸다. 긴 글을 중간까지 읽다가 관련 글을 보고 돌아오면, 읽던 자리를 다시 찾아 스크롤해야 했다. 브라우저의 뒤로 가기처럼 떠난 위치에서 다시 시작하게 했다.

| 경우                       | 시작 위치                     |
| -------------------------- | ----------------------------- |
| 목록·링크로 새로 연 글     | 맨 위                         |
| ‹ › 또는 ⌘[ ⌘]로 돌아온 글 | 그 글을 떠날 때의 위치        |
| 폴더만 바뀌고 같은 글      | 그대로 (본문이 바뀌지 않는다) |

### 기록에 위치를 저장한다

기록의 칸(`NavEntry`)에 본문 스크롤 위치 `scroll`(px)을 추가했다. 다른 칸으로 이동하기 직전에 `rememberScroll`이 지금 칸에 위치를 기록한다. 같은 칸인지 판별하는 `sameEntry`는 `scroll`을 비교하지 않는다. 같은 글을 다른 위치에서 연 것을 별도 칸으로 쌓지 않기 위해서다. sessionStorage에 저장하는 기록에 함께 들어가므로 새로 고쳐도 남는다.

```ts
export function rememberScroll(history: NavHistory, scroll: number): NavHistory {
	const current = history.entries[history.index];
	const top = Math.round(Math.min(Math.max(scroll, 0), MAX_SCROLL));
	if (!current || !Number.isFinite(top) || current.scroll === top) return history;
	const entries = history.entries.slice();
	entries[history.index] = { ...current, scroll: top };
	return { ...history, entries };
}
```

위치는 정수로 반올림하고 0 이상, 상한(`MAX_SCROLL`, 10,000,000px) 이하로 제한한다. 예를 들어 `-12.6`이 들어오면 0으로, `899.6`이 들어오면 900으로 저장한다.

### 떠나는 위치는 별도로 기억한다

다른 글을 열면 본문을 맨 위로 옮기는 effect(React가 렌더링 직후 실행하는 함수)가 먼저 실행된다. 그 뒤에 `scrollTop`을 읽으면 이미 0이다. 그래서 문서의 `scroll` 이벤트에서 본문 영역의 마지막 위치를 ref(렌더링과 무관하게 값을 보관하는 React 객체)에 담아 두고, 그 값을 떠나는 칸에 기록한다.

본문 영역 요소는 글을 고를 때 생성되고 교체될 수 있다. 그래서 요소에 직접 리스너를 등록하지 않고, `document`에서 캡처 단계로 `scroll` 이벤트를 받아 `event.target`이 본문 영역일 때만 처리한다. `scroll` 이벤트는 버블링되지 않으므로 상위 요소에서 받으려면 캡처 단계로 등록해야 한다.

### 돌아올 때는 위치가 고정될 때까지 반복해서 맞춘다

**스크롤 앵커링(scroll anchoring)**은 화면 위쪽 내용의 높이가 늦게 바뀌어도 사용자가 보던 부분이 화면에서 밀려나지 않도록 브라우저가 스크롤 위치를 자동으로 조정하는 기능이다([MDN: Scroll anchoring](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_anchoring/Scroll_anchoring)). 이미지가 늦게 로드되며 글이 아래로 밀리는 현상을 막으려고 Chrome·Firefox에 기본으로 켜져 있다.

> [!WARNING] 스크롤 앵커링이 옮기는 위치
> 위치를 한 번만 맞추면 편집 화면에서 어긋났다. 900px로 맞춘 직후 목차와 편집기 내용이 늦게 그려져 본문 높이가 바뀌고, 스크롤 앵커링이 화면에 보이던 내용을 유지하려고 위치를 950px로 옮겼다.

![돌아온 글의 scrollTop 변화](./images/memo-history-nav-scroll-anchoring.svg '한 번만 맞추면 늦게 그려진 목차·편집기 때문에 스크롤 앵커링이 950px로 옮긴 위치가 그대로 남는다. 매 프레임 다시 맞추면 다음 프레임에 900px로 돌아온다')

그래서 약 0.6초(40프레임) 동안 매 프레임 위치를 다시 맞춘다. 브라우저는 화면을 보통 1초에 60번 다시 그리고, 그 한 번을 프레임이라 한다. [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)으로 다음 프레임 직전에 함수를 예약하면 그림이 바뀔 때마다 위치를 확인할 수 있다. 이 40프레임 동안 사용자가 휠이나 터치로 스크롤하면 사용자의 조작을 덮어쓰지 않도록 즉시 멈춘다.

```ts
// Memo.tsx: 위치가 1px 넘게 어긋나면 다시 맞추고, 다음 프레임을 예약한다
const retry = () => {
	if (frames++ > 40) return;
	if (Math.abs(scroller.scrollTop - top) > 1) scroller.scrollTo({ top });
	frame = requestAnimationFrame(retry);
};
frame = requestAnimationFrame(retry);
// 그동안 사용자가 직접 스크롤하면 맞추기를 멈춘다
const stop = () => cancelAnimationFrame(frame);
scroller.addEventListener('wheel', stop, { passive: true });
scroller.addEventListener('touchstart', stop, { passive: true });
```

## 시험

| 시험                               | 확인하는 것                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navHistory.test.ts`               | 쌓기·같은 칸 무시·앞쪽 칸 버리기·50칸 상한·삭제된 글 건너뛰기·빈 칸 채우기, 저장 형식 읽기(버전·모양·상한·범위)와 복원 시 필터링                                                 |
| `navHistory.test.ts` (10월 30일)   | 떠나는 칸에 위치 기록(정수·0 이상), 같은 위치면 그대로, 위치는 같은 칸 판단에 쓰지 않음, 저장·복원과 비정상 값 필터링                                                            |
| `shortcut.test.ts`                 | `whileTyping: false` 단축키는 입력 칸에서 동작하지 않는다                                                                                                                        |
| `memo-history.spec.ts`             | ‹ › 클릭, ⌘[ ⌘], 새 글을 열면 › 비활성, 폴더 이동 기록, 길게 눌러 연 목록에서 고르기(손을 떼도 이동하지 않음), 목록 둘째 줄이 글의 폴더, 새로 고친 뒤 뒤로 가기, 새 탭은 빈 기록 |
| `memo-history.spec.ts` (10월 30일) | 읽기·편집 화면에서 첫 글 900px, 둘째 글 400px을 남기고 ‹ ›로 오가면 그 위치에서 시작, 새로 연 글은 0                                                                             |
| `menubar.spec.ts`                  | 메모의 메뉴 막대에 **이동**이 생기고, 막 열었을 때 뒤로·앞으로가 비활성                                                                                                          |
| `mobile-memo-history.spec.ts`      | 휴대폰 메모에는 ‹ ›가 없다                                                                                                                                                       |

## 관련 글

- [History API로 SPA 창 상태를 /memo·/safari 주소와 연결하기](/memo/app-links): 주소 막대가 맨 앞 창의 글을 따라가는 방식
- [앱이 등록한 메뉴를 공통 메뉴와 병합하는 메뉴 막대 구조](/memo/menubar-menus): 메뉴 막대 단축키가 동작하는 구조

<details>
<summary>참고 문헌</summary>

- MDN, [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
- MDN, [History: replaceState() method](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
- MDN, [Window: sessionStorage property](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
- MDN, [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- MDN, [Scroll anchoring](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_anchoring/Scroll_anchoring)
- MDN, [Window: requestAnimationFrame() method](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- W3C, [Understanding Success Criterion 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

</details>

#MacFolio #메모앱 #React
