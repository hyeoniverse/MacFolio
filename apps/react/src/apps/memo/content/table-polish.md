---
title: 표 다듬기 - 끌어 고른 범위, 여백 누르기, 한 번에 지우기
date: 2026-10-01
category: 프론트엔드/기능
summary: 메모 편집기의 표를 쓰다 걸린 것 넷을 고쳤다. 끌어 고른 칸에 macOS 메모처럼 테두리를 그리고, 표 옆 여백을 누르면 그쪽에 커서가 서고, Backspace 한 번에 표가 지워지고, 게시 단추의 위쪽이 잘리지 않게 했다.
---

'표 양옆에 커서 두기' 글 이후로 표를 쓰면서 걸린 것들을 모았다.

![표 다듬기](./images/table-polish.jpg '끌어 고른 칸에는 테두리와 꼭짓점, 표 양옆 여백을 누르면 그쪽에 세로 커서')

## 끌어 고른 칸에도 테두리를

예전 글에서 "칸을 끌어 고르면 손잡이를 띄우지 않는다"고 했다. 끌다가 우연히 한 열을 다 덮으면 손잡이 막대가 펼쳐져서 요란했기 때문이다. 그런데 그때 손잡이만이 아니라 **고른 범위의 테두리와 꼭짓점까지** 같이 숨겼다.

```tsx
// 칸을 끌어 골랐으면 손잡이·테두리 없이 고른 칸 표시만
if (!table || !tableBox || !run || table.dragged) return null;
```

macOS 메모는 끌어 고른 범위에도 노란 테두리와 대각선 꼭짓점 둘을 그린다. 무엇을 골랐는지 한눈에 보이고, 꼭짓점을 끌어 범위를 바꿀 수 있다. 숨겨야 했던 것은 행·열 손잡이뿐이었다.

```tsx
if (!table || !tableBox || !run) return null;
// 칸을 끌어 골랐으면 고른 범위의 테두리와 꼭짓점만 (행·열 손잡이는 손잡이로 고를 때만)
const handles = !table.dragged;
```

꼭짓점으로 범위를 바꾸는 명령은 원래 "손잡이로 고른 변경"이라는 표시를 붙였다. 그대로 두면 끌어 고른 범위의 꼭짓점을 만지는 순간 손잡이가 나타난다. 그래서 명령에 `byHandle`을 넘겨 처음 고른 방법을 이어 가게 했다.

## 표 옆 여백을 누르면 그쪽에 커서

←·→로는 표 양옆에 세로 커서를 둘 수 있었지만, 마우스로는 안 됐다. 표 옆을 누르면 커서가 엉뚱한 칸으로 갔다.

처음에는 편집기의 `handleClick`에서 누른 자리가 표의 왼쪽·오른쪽인지 보고 틈 커서를 두었다. 그런데 시험해 보니 아무 일도 일어나지 않았다. 이 편집기의 표는 **편집기 폭을 다 쓴다**. 표 옆은 편집기 바깥, 본문 칸의 여백(좌우 32px)이라 편집기의 클릭 처리기까지 오지 않았다.

그래서 플러그인의 `view`에서 본문 칸(`.memo-scroll`)에 `mousedown`을 따로 달았다.

```ts
view: (view) => {
	const area = view.dom.closest('.memo-scroll');
	const onDown = (event: MouseEvent) => {
		if (view.dom.contains(event.target as Node)) return; // 편집기 안은 handleClick이 맡는다
		const gap = gapBesideTableAt(view, event.clientX, event.clientY);
		if (gap === null) return;
		event.preventDefault(); // 여백을 눌러 편집기의 초점이 빠지지 않게
		placeGap(view, gap);
	};
	area?.addEventListener('mousedown', onDown);
	return { destroy: () => area?.removeEventListener('mousedown', onDown) };
},
```

`gapBesideTableAt`은 글 안의 표마다 화면 위치를 재서, 누른 높이가 표 안이고 표의 오른쪽(또는 왼쪽)이면 표 뒤(또는 앞) 자리를 돌려준다. `preventDefault`를 빼면 여백을 누르는 순간 편집기가 초점을 잃고, 틈 커서는 초점이 있을 때만 보여서 커서가 사라진다.

시험을 쓰다가 한 번 더 걸렸다. 표 오른쪽 30px을 누르게 했더니 창 가장자리의 크기 조절 손잡이가 눌렸다. 시험 창이 좁아서 본문 여백이 32px밖에 없었다. 표에서 12px 떨어진 곳을 누르게 고쳤다.

## Backspace 한 번에 표를 지운다

표 바로 뒤에서 Backspace를 누르면 먼저 표를 고르고(노란 테두리), 한 번 더 눌러야 지워졌다. 무엇을 지울지 보여 주려는 것이었는데, 쓰다 보면 두 번 누르는 것이 번거로웠다. 이제 한 번에 지운다.

- 표 바로 뒤 문단의 맨 앞, 또는 표 오른쪽 커서에서 Backspace
- 표 왼쪽 커서에서 Delete

이미지는 그대로 두 번이다. 이미지는 골랐을 때 테두리가 보여서 무엇이 지워질지 바로 알 수 있고, 실수로 지우면 다시 올려야 한다.

## 게시 단추 위쪽이 잘렸다

편집기 맨 위 줄 오른쪽의 '게시' 단추 위쪽이 살짝 잘려 보였다. 단추의 위치와 그 위 요소들의 `overflow`를 재 보니 바로 나왔다.

```
button      top 153.0  bottom 171.0
memo-scroll top 153.0  overflow-y: auto
```

단추의 위쪽이 스크롤 칸의 위쪽 가장자리와 정확히 같았다. 스크롤 칸은 넘치는 것을 자르므로, 고해상도 화면에서 반 픽셀이 걸리거나 초점 테두리가 생기면 위쪽이 잘린다. 본문 칸에 위쪽 여백 4px을 두었다. 읽기 화면도 같은 칸을 써서 날짜 줄이 4px 내려갔지만, 읽기와 편집이 같은 자리에 있는 것은 그대로다.

#MacFolio #메모앱 #편집기
