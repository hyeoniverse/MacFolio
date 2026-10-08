---
title: sticky 도구 막대가 버튼을 가린 이유
date: 2026-09-29
category: 개발기/MacFolio/메모
summary: 메모 도구 막대를 스크롤에 붙였더니 버튼이 눌리지 않았다. position sticky가 만든 쌓임 맥락 이야기.
---

메모 앱을 macOS 메모처럼 도구 막대 중심으로 바꾸면서, 글을 스크롤해도 도구 막대가 위에 남도록 `position: sticky`를 붙였다. 화면에는 버튼이 멀쩡히 보이는데, 눌러도 아무 일이 없었다.

## 창 위에 깔린 끌기 영역

제목 표시줄이 없는 창(Safari, 메모처럼 도구 막대와 제목 표시줄이 합쳐진 모양)은 투명한 끌기 영역을 내용 위에 띄운다. 신호등 버튼이 들어 있고, 이곳을 잡아 창을 옮긴다.

```css
.container.unified .macos-titlebar {
	position: absolute;
	top: 0;
	left: 0;
	z-index: 3;
	height: 52px;
	background: none;
}
```

끌기 영역은 창 너비 전체를 덮으므로, 같은 높이에 있는 도구 막대 버튼은 그보다 위에 있어야 눌린다. 그래서 버튼마다 `z-index: 4`를 주었다.

```css
.memo-tool {
	position: relative;
	z-index: 4;
}
```

![메모 앱의 도구 막대](./images/memo-toolbar.jpg '메모의 도구 막대. 신호등 버튼이 있는 윗줄 전체가 창을 끄는 영역과 겹친다')

## z-index 4가 3보다 아래에 있었다

sticky를 붙이자 도구 막대가 **새 쌓임 맥락(stacking context)** 을 만들었다. 쌓임 맥락 안의 z-index는 그 안에서만 순서를 정한다. 버튼의 4는 도구 막대 안에서의 순서일 뿐이고, 밖에서 보면 도구 막대 전체가 z-index가 없는 한 덩어리로 끌기 영역(3) 아래에 깔렸다.

```text
창
├─ 끌기 영역            z-index 3
└─ 도구 막대 (sticky)   쌓임 맥락 → 창 안에서는 auto
   └─ 버튼             z-index 4, 도구 막대 안에서만 의미 있음
```

버튼에 z-index를 더 크게 줘도 소용이 없다. 경쟁은 버튼과 끌기 영역이 아니라, 도구 막대와 끌기 영역 사이에서 일어난다.

![쌓임 맥락 안에 갇힌 버튼](./images/stacking-context.svg '버튼의 z-index 4는 도구 막대 안에서만 통한다')

## 스크롤하는 쪽을 바꿨다

도구 막대를 붙이는 대신, 도구 막대는 그대로 두고 그 아래 영역만 스크롤하게 했다.

```css
.memo-list,
.memo-reader,
.memo-gallery {
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.memo-scroll {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
}
```

도구 막대는 쌓임 맥락을 만들지 않으니 버튼의 z-index 4가 창 기준으로 다시 동작한다. 검색 칸 위치가 스크롤에 따라 흔들리지 않는 것도 덤이다.

## 쌓임 맥락을 만드는 것들

z-index가 이상하게 동작하면, 조상 중에 쌓임 맥락을 만드는 요소가 있는지부터 본다. 흔한 것들은 이렇다.

- `position: sticky` 또는 `fixed`
- `position: relative`/`absolute`이면서 z-index가 `auto`가 아닌 것
- `opacity`가 1보다 작은 것
- `transform`, `filter`, `backdrop-filter`
- `isolation: isolate`, `will-change`, `contain`

브라우저 개발자 도구의 3D 보기나 레이어 보기로 쌓인 순서를 확인할 수 있다.

#MacFolio #메모앱 #CSS #트러블슈팅
