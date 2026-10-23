---
title: 좁은 창에서 신호등 버튼 아래로 - 음악과 Safari
date: 2026-10-02
category: 개발기/MacFolio/프론트엔드
summary: 음악 창을 좁히면 휴대폰 화면으로 바뀌며 보관함 제목이 신호등 버튼에 가려지고 곡 목록에서 돌아갈 방법이 없었다. Safari는 여백 요소가 축소되어 뒤로·앞으로 버튼이 신호등 아래로 들어갔다. 상단에 44px 여백과 flex: none을 지정하고, 앱 9개를 창 폭 5가지로 검사하는 시험을 추가했다.
---

앱마다 창 너비가 640px 아래로 내려가면 [컨테이너 쿼리](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)(`@container (max-width: 640px)`)로 휴대폰과 같은 화면을 사용한다. 휴대폰에서는 창 최상단에 제목 막대가 별도로 있지만, 데스크톱 창에서는 왼쪽 위에 신호등 버튼(닫기·최소화·확대)이 앱 위에 겹쳐 있다. 음악 앱은 이 차이를 고려하지 않아서, 창을 좁히면 보관함 제목이 버튼에 가려졌다.

## 배경

데스크톱에서 창 오른쪽 아래 모서리를 드래그해 음악 창을 좁히면 재현된다.

| 앱     | 재현 폭    | 증상                                                                                    |
| ------ | ---------- | --------------------------------------------------------------------------------------- |
| 음악   | 560px 이하 | 보관함의 큰 제목이 신호등 버튼 아래에 가려짐. 곡 목록에서 보관함으로 돌아가는 버튼 없음 |
| Safari | 380px 이하 | 뒤로·앞으로 버튼이 신호등 아래로 들어가 클릭 불가                                       |

음악은 곡 목록으로 진입하면 창을 다시 넓히는 것 외에는 보관함으로 돌아올 방법이 없었다.

![좁은 창 전후](./images/narrow-window-title.jpg '위: 전 / 아래: 후')

10월 3일 새벽, 음악 앱 창을 줄였다가 제목이 신호등 버튼에 가려진 것을 처음 발견했다. 같은 컨테이너 쿼리를 사용하는 다른 앱에도 같은 문제가 있을 수 있어 앱마다 창 폭을 줄여 확인했고, Safari에서도 같은 문제를 찾아 함께 수정했다.

## 원인

좁은 창의 앱이 휴대폰 화면을 그대로 사용하는데, 휴대폰과 데스크톱 창은 상단 구조가 다르다.

|           | 휴대폰                              | 좁은 데스크톱 창                                |
| --------- | ----------------------------------- | ----------------------------------------------- |
| 최상단    | 상태 표시줄, 그 아래 셸의 뒤로 가기 | 앱 내부 왼쪽 위에 신호등 버튼이 겹쳐 있다       |
| 상단 여백 | `--phone-top`                       | 앱이 지정한 값 (음악은 16px)                    |
| 뒤로 가기 | `MobileNavigation`이 렌더링         | `MobileNavigation`은 아무것도 렌더링하지 않는다 |

음악은 좁은 화면에서 사이드바(보관함)의 상단 여백을 0으로, 본문의 상단 여백을 16px로 지정했다. 휴대폰에서는 그 위에 셸이 공간을 확보하므로 문제가 없었지만, 데스크톱 창에서는 같은 위치에 신호등이 있었다.

Safari는 원인이 달랐다. 도구 막대 맨 왼쪽에 신호등 공간으로 64px 여백 요소(`.safari-lights-space`)를 배치했는데, flex 항목의 기본값 [`flex-shrink: 1`](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-shrink) 때문에 공간이 부족하면 이 요소도 축소됐다.

## 검토한 방법

| 방법                                                                            | 단점                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 좁은 창에서는 신호등 버튼을 숨긴다                                              | 창을 닫거나 최소화할 방법이 없어진다. macOS도 신호등은 항상 표시된다 |
| 좁은 창도 휴대폰처럼 셸이 제목 막대를 렌더링                                    | 데스크톱 창 전체 구조를 바꿔야 한다                                  |
| **앱이 신호등 줄 높이만큼 상단 여백을 두고, 뒤로 가기 버튼을 직접 배치 (선택)** | 앱마다 적용해야 한다. 그래서 모든 앱을 시험으로 검사한다             |

메일·메모·메시지는 이미 세 번째 방식으로 상단 여백을 두고 있었다. 음악과 Safari만 적용되지 않은 상태였다.

## 음악

좁은 창의 보관함과 곡 목록 상단에 신호등 버튼 줄 높이(44px)만큼 여백을 두었다. 휴대폰은 기존 `--phone-top`이 이 값을 덮어쓰므로 변하지 않는다.

```css
@container (max-width: 640px) {
	/* 위쪽은 신호등 버튼 줄 높이만큼 비운다. 휴대폰은 --phone-top으로 덮어쓴다 */
	.music-sidebar {
		padding: 44px 16px 16px; /* 전: 0 16px 16px */
	}
	.music-main {
		padding: 44px 16px 24px; /* 전: 16px 16px 24px */
	}
	.music-back {
		display: flex;
	}
}
```

곡 목록에는 뒤로 가기 버튼이 없었다. 휴대폰에서는 제목 막대의 뒤로 가기(`MobileNavigation`)가 이 역할을 하는데, 이 컴포넌트는 데스크톱에서 아무것도 렌더링하지 않는다. 그래서 좁은 데스크톱 창에서는 곡 목록으로 진입하면 보관함으로 돌아올 수 없었다. 메일의 받은 편지함 버튼처럼 곡 목록 위에 `‹ 보관함` 버튼(`.music-back`)을 배치하고, 넓은 창과 휴대폰에서는 숨긴다.

## Safari

여백 요소에 `flex: none`을 지정하고, 대신 주소 막대가 축소되도록 `min-width: 0`을 지정했다.

```css
.safari-lights-space {
	flex: none; /* 줄어들면 뒤로·앞으로 버튼이 신호등 아래로 들어간다 */
	width: 64px;
}
.safari-address {
	min-width: 0; /* 대신 주소 막대가 줄어든다 */
	max-width: 520px;
}
```

`min-width: 0`이 필요한 이유는 flex 항목의 기본 최소 너비가 `auto`(콘텐츠의 최소 너비)이기 때문이다[^min-width-auto]. 여백 요소만 고정하면 주소 막대도 축소되지 않아 도구 막대가 창 밖으로 넘친다.

| 요소                   | 수정 전                   | 수정 후                    |
| ---------------------- | ------------------------- | -------------------------- |
| `.safari-lights-space` | `flex-shrink: 1` (축소됨) | `flex: none` (64px 고정)   |
| `.safari-address`      | `min-width: auto`         | `min-width: 0` (대신 축소) |

## 모든 앱 검사

![신호등과 겹치는지 보는 시험](./images/narrow-window-title-check.svg '표시된 버튼·링크·입력·제목·탭의 상자가 신호등 상자와 겹치면 실패')

같은 문제가 다른 앱에도 있는지 E2E 시험(`e2e/narrow-window.spec.ts`)으로 검사했다. 앱마다 창 폭을 700, 560, 460, 380, 320px로 바꾸고, 표시된 버튼·링크·입력·제목·탭 중 신호등 버튼과 겹치는 요소가 있는지 확인한다. 앱 9개(음악·메시지·메일·메모·설정·GitHub·Safari·터미널·게임) × 폭 5가지로 45회 검사한다.

```ts
const covered = await win.evaluate((frame) => {
	const lights = frame.querySelector('.traffic-lights')!.getBoundingClientRect();
	return [...frame.querySelectorAll<HTMLElement>('button, a, input, h1, h2, h3, [role="tab"]')]
		.filter((el) => !el.closest('.traffic-lights'))
		.filter((el) => {
			const box = el.getBoundingClientRect();
			// 보이지 않는 것은 빼고, 두 상자가 가로·세로 모두 겹치면
			return box.right > lights.left && box.left < lights.right && box.bottom > lights.top && box.top < lights.bottom;
		})
		.map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 20));
});
expect(covered, `${width}px`).toEqual([]);
```

폭을 바꾼 뒤에는 [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)을 한 번 대기한다. 컨테이너 쿼리는 스타일 재계산 후에 적용되기 때문이다. 실패하면 겹친 요소의 텍스트와 창 폭이 실패 메시지에 출력되어 수정 위치를 바로 알 수 있다.

수정 전에는 음악(560px 이하)과 Safari(380px 이하)만 실패했고, 메일·메모·메시지·설정·GitHub·터미널·게임은 이미 버튼 아래에 공간을 확보하고 있었다. 음악은 별도로 `e2e/music.spec.ts`의 "좁은 창에서는 제목이 신호등 버튼 아래에 있고, 곡 목록에서 보관함으로 돌아온다"로 뒤로 가기 버튼까지 확인한다([#77](https://github.com/hyeoniverse/MacFolio/pull/77)).

## 남은 것·정리

- 이 시험은 상자가 겹치는지만 확인한다. 겹치지 않지만 버튼과 간격 없이 붙은 경우는 검출하지 못한다.
- 이후 앱마다 최소 창 크기(`minSize`)를 지정했다. 예를 들어 시스템 설정은 사이드바가 항상 표시되는 680×420보다 작게 줄어들지 않는다. 지나치게 좁은 창을 막는 것도 같은 문제를 줄이는 방법이다.
- "휴대폰 화면을 그대로 사용한다"는 전제에는 "휴대폰 셸이 처리하던 역할"이 빠져 있었다. 화면을 재사용할 때는 그 화면이 의존하던 외부 환경(상단 여백, 뒤로 가기)까지 함께 검토해야 한다.
- 특정 앱에서 발견한 버그를 모든 앱을 검사하는 시험으로 일반화하면, 새 앱을 추가할 때도 같은 실수를 검출한다. 이 시험은 앱 이름 목록에 항목 하나만 추가하면 된다.

## 관련 글

- [휴대폰 앱들을 메모처럼](/memo/mobile-apps-ios-style)
- [음악 앱 버그 세 가지](/memo/music-player-fixes)
- [Playwright로 모바일과 애니메이션까지 테스트하기](/memo/playwright-mobile-and-motion)

[^min-width-auto]: flex 항목은 `min-width`의 기본값 `auto`가 콘텐츠의 최소 크기(줄바꿈할 수 없는 가장 긴 단어나 입력창의 기본 폭)로 계산된다. 그래서 `flex-shrink`가 있어도 그 크기보다 작아지지 않는다. [MDN: min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width)

#MacFolio #데스크톱 #CSS
