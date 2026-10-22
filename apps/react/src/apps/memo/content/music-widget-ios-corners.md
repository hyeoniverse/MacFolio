---
title: 아이폰에서만 각진 음악 위젯 - 흐린 배경이 둥근 자르기를 빠져나갈 때
date: 2026-10-22
category: 개발기/MacFolio/프론트엔드
summary: 휴대폰 홈 화면의 음악 위젯만 실제 아이폰 Safari에서 꼭짓점이 각져 보였다. 맥 Safari와 화면 시험의 WebKit에서는 둥글게 나와 재현되지 않았다. 앨범 표지를 흐리게 깐 층이 따로 그려지며 둥근 자르기를 빠져나가는 문제라, clip-path로 같은 모양을 한 번 더 잘랐다.
---

휴대폰 홈 화면의 위젯은 모두 둥근 판이다. 그런데 실제 아이폰 Safari로 열어 보니 음악 위젯 하나만 네 꼭짓점이 각져 있었다. 노트북의 Safari로 휴대폰 크기를 흉내 내면 멀쩡했다. 다른 위젯은 아이폰에서도 둥글었다.

## 음악 위젯만 다른 점

음악 위젯은 앨범 표지를 흐리게 깔아 배경으로 쓴다. iOS의 지금 재생 중 화면처럼 곡마다 배경 색이 바뀌게 하려는 것이다. 구조는 이렇다(`apps/react/src/desktop/mobile/MobileShell.css`).

```css
.music-widget {
	position: relative;
	overflow: hidden;
	border-radius: var(--radius-window);
	isolation: isolate;
}

/* 앨범 커버를 흐리게 깐 배경 */
.music-widget::before {
	position: absolute;
	inset: -30px;
	z-index: -1;
	background: var(--artwork) center / cover;
	filter: blur(28px) brightness(0.55) saturate(1.3);
	content: '';
}
```

흐리게 하면 그림의 가장자리도 투명하게 번진다. 그래서 `::before`를 위젯보다 30px씩 크게 깔고, 위젯의 `overflow: hidden`과 `border-radius`로 둥글게 잘라 번진 가장자리를 감춘다. 다른 위젯에는 이런 흐린 층이 없다. 날씨는 그라데이션이고, 사진은 그림을 그대로 깐다.

## 왜 아이폰에서만

`filter`가 걸린 요소는 브라우저가 따로 된 층(합성 층)으로 그린 뒤 화면에서 합친다. 흐리게 하는 계산을 GPU에 맡기기 위해서다. 둥근 모서리로 자르는 일은 부모(위젯)가 하는데, 이 자르기가 따로 그린 자식 층까지 전해지지 않으면 자식 층은 네모로만 잘린다. WebKit에서 오래전부터 알려진 문제이고, 주로 iOS에서 보인다.

![음악 위젯의 층](./images/music-widget-ios-corners-layers.svg '흐린 배경 층이 둥근 자르기를 빠져나가 네모로 남는다')

맥 Safari도 같은 WebKit이지만 결과가 달랐다. 합성 층을 언제 만들고 어떻게 자르는지가 기기와 GPU에 따라 다르기 때문이다. 화면 시험에 쓰는 Playwright의 WebKit(헤드리스)에서도 고치기 전과 뒤가 똑같이 둥글게 나왔다. 그래서 이번에는 고친 것을 시험으로 확인하지 못했다. 이 글을 쓰는 컴퓨터에는 iOS 시뮬레이터도 없었다.

## 고른 방법

| 방법                                                        | 좋은 점                                      | 문제                                                                |
| ----------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| `clip-path: inset(0 round …)`로 한 번 더 자른다 (고름)      | 한 줄. 자르는 모양을 직접 적어 뜻이 드러난다 | 둥근 값(`--radius-window`)을 `border-radius`와 같이 맞춰야 한다     |
| `-webkit-mask-image: -webkit-radial-gradient(white, black)` | 오래 쓰인 우회책                             | 왜 되는지 코드만 보고는 알 수 없다. 접두어가 붙은 옛 문법           |
| `transform: translateZ(0)` 등으로 부모도 층으로 만든다      | 짧다                                         | 기기마다 결과가 달라 믿기 어렵다. 층이 늘어 메모리를 더 쓴다        |
| 흐리게 하지 않고 미리 흐린 그림을 쓴다                      | 자르기 문제가 아예 없다                      | 곡마다 흐린 그림을 따로 만들어 둬야 한다. 관리자가 올리는 곡도 있다 |

`clip-path`는 그림을 다 그린 뒤 결과를 그 모양으로 자르므로, 자식 층이 따로 그려져도 함께 잘린다. 같은 둥근 값을 쓰니 모양도 `border-radius`와 같다.

```css
.music-widget {
	/* … */
	isolation: isolate;
	/* iPhone Safari는 흐리게 한 배경(::before, filter)을 따로 그려서 overflow·border-radius로 자르지 못한다 (꼭짓점이 각져 보인다).
	   clip-path로 같은 둥근 모양을 한 번 더 자른다 */
	clip-path: inset(0 round var(--radius-window));
}
```

`clip-path`는 판 밖으로 나가는 그림자도 자른다. 음악 위젯의 그림자는 바깥 판(`.widget`)이 그리고, 자르는 것은 안쪽 판(`.music-widget`)이라 그림자는 그대로다.

## 확인

- Playwright의 Chromium·WebKit(아이폰 크기)에서 고친 뒤에도 꼭짓점과 그림자가 그대로인 것을 확인했다. 휴대폰 화면 시험 69개도 그대로 통과한다
- 실제 아이폰에서 각진 꼭짓점이 사라졌는지는 배포한 뒤 확인해 여기에 적는다

이번 일로 "휴대폰 화면 시험"이 실제 휴대폰을 대신하지 못한다는 것을 다시 알았다. 화면 시험은 크기와 터치를 흉내 내지만 GPU가 그리는 방식까지는 흉내 내지 않는다. 흐림·유리 같은 효과를 쓰는 곳은 실제 기기에서 한 번 더 본다.

## 관련 글

- [같은 Safari, 다른 화면 - macOS와 iOS, 브라우저마다 다르게 그리는 곳](/memo/safari-macos-ios-rendering)
- [바탕화면과 홈 화면에 위젯 — 칸 격자, 같이 쓰는 부품, 한 번만 묻는 날씨](/memo/desktop-widgets)
- [휴대폰 앱들을 메모처럼 - 함께 쓰는 바탕과 카드, iOS 음악](/memo/mobile-apps-ios-style)

#MacFolio #프론트엔드 #CSS #Safari #iOS
