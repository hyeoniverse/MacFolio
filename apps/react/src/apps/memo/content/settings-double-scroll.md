---
title: 최소 창 크기와 컨테이닝 블록으로 중첩 스크롤의 이중 스크롤 없애기
date: 2026-10-11
category: 개발 기록/MacFolio/화면·스타일
summary: 시스템 설정에서 패널 끝까지 스크롤한 뒤 한 번 더 스크롤하면 창 전체가 다시 스크롤됐다. 원인은 두 가지였다. 좁은 창의 상단 탭이 패널 높이를 줄였고, 숨은 텍스트가 창을 기준으로 배치되어 영역을 늘렸다. 창에 최소 크기를 지정하고 패널을 컨테이닝 블록으로 바꿨다.
---

| 증상                                                  | 원인                                                                       | 해결                                             | 영향 범위                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| 패널 끝까지 스크롤한 뒤 창 전체가 한 번 더 스크롤된다 | 상단 탭이 패널 높이를 줄였고, 숨은 텍스트가 창 기준으로 놓여 영역을 늘렸다 | 앱별 최소 창 크기, 패널을 `position: relative`로 | 시스템 설정 창 (관리자는 항목이 늘어 더 심함) |

## 배경

### 스크롤 컨테이너와 중첩 스크롤

요소의 내용이 요소 크기보다 크면 내용이 넘친다(overflow). CSS [`overflow`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow) 속성을 `auto`나 `scroll`로 지정하면 그 요소는 넘친 내용을 스크롤해서 보여 주는 스크롤 컨테이너가 된다. 넘쳤는지는 두 값으로 판정한다. [`scrollHeight`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight)는 내용 전체의 높이, [`clientHeight`](https://developer.mozilla.org/en-US/docs/Web/API/Element/clientHeight)는 화면에 보이는 영역의 높이다. 예를 들어 `scrollHeight`가 736px, `clientHeight`가 500px이면 236px이 넘쳐 그만큼 스크롤할 수 있다.

스크롤 컨테이너 안에 또 스크롤 컨테이너가 있으면 중첩 스크롤이 된다. 마우스 휠을 굴리면 브라우저는 포인터 아래의 가장 안쪽 컨테이너부터 스크롤한다. 안쪽이 끝에 닿은 뒤에도 입력이 이어지면 남은 입력을 바깥 컨테이너로 넘기는데, 이 동작을 스크롤 체이닝(scroll chaining)이라 한다[^chaining]. 바깥 컨테이너도 넘친 상태라면 바깥이 한 번 더 스크롤된다.

![중첩된 스크롤 컨테이너와 스크롤 체이닝](./images/settings-double-scroll-nested.svg '안쪽 패널이 끝에 닿으면 남은 휠 입력이 바깥 .content로 넘어가고, .content가 넘친 상태면 창 전체가 한 번 더 스크롤된다')

### 컨테이닝 블록

[`position: absolute`](https://developer.mozilla.org/en-US/docs/Web/CSS/position)를 지정한 요소는 일반 문서 흐름에서 빠져, 기준이 되는 상자 안의 좌표(`top`, `left` 등)로 배치된다. 이 기준 상자를 [컨테이닝 블록](https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block)(containing block)이라 한다. 절대 위치 요소의 컨테이닝 블록은 `position`이 `static`이 아닌 가장 가까운 조상의 패딩 상자다. 그런 조상이 없으면 문서의 최상위 상자가 기준이 된다.

![CSS 상자 모델의 margin, border, padding, content 영역](./images/settings-double-scroll-mdn-box-model.png '요소의 상자는 안쪽부터 content, padding, border, margin 순서로 둘러싸인다. 절대 위치 요소의 기준은 조상의 padding 바깥선까지의 영역이다. 출처: MDN')

예를 들어 다음 구조에서 `.hidden`의 기준은 `.panel`이 아니라 `.window`다. `.panel`에는 `position`이 없기 때문이다.

```html
<div class="window" style="position: relative; overflow: scroll">
	<div class="panel" style="overflow: auto">
		…
		<span class="hidden" style="position: absolute">(새 탭)</span>
	</div>
</div>
```

이 경우 `.hidden`은 패널의 스크롤과 `overflow`에 포함되지 않고, `.window`의 내용 크기에 더해진다. 이 글의 두 번째 원인이 이 동작이다.

## 증상

시스템 설정에서 내용 끝까지 스크롤했는데, 한 번 더 스크롤하면 창 전체가 다시 스크롤됐다. 스크롤 컨테이너가 두 개였다([#195](https://github.com/hyeoniverse/MacFolio/pull/195)).

재현 절차는 다음과 같다.

1. 화면 1280×800에서 시스템 설정을 연다.
2. '정보'를 선택하고 끝까지 스크롤한다.
3. 패널 스크롤이 멈춘 뒤 창의 콘텐츠 영역이 한 번 더 스크롤된다.

관리자로 로그인하면 항목이 일곱 개로 늘어 패널 높이가 더 줄었다.

## 원인 추적

### 스크롤 컨테이너 조사

설정 창 안의 요소마다 `scrollHeight`와 `clientHeight`를 측정해, 넘치면서 `overflow`가 `auto`·`scroll`인 요소를 수집했다.

| 창                        | 정보                                     | 개인정보 보호 및 보안 |
| ------------------------- | ---------------------------------------- | --------------------- |
| 기본 크기 (화면 1280×800) | 창의 콘텐츠 영역 + 패널 (패널 높이 79px) | 패널                  |
| 넓은 화면 (1600×1000)     | 창의 콘텐츠 영역 + 패널                  | 패널                  |

창의 콘텐츠 영역(`.content`)은 모든 앱이 공유하는 창 프레임이라 `overflow: scroll`이고, 설정은 그 안에서 패널(`.settings-panel`)이 별도로 스크롤한다. 콘텐츠 영역이 넘치면 두 스크롤 컨테이너가 중첩된다.

### 탭을 수정한 뒤에도 남은 넘침

아래 원인 1의 상단 탭을 수정한 뒤에도 정보 항목에서만 창이 넘쳤다. 콘텐츠 영역의 자식들은 모두 창 높이 안에 있는데, 콘텐츠 영역의 `scrollHeight`만 736px였다. 패널 안에서 `position: absolute`인 요소를 찾으니 세 개가 나왔다.

> [!TIP] 스크롤 문제는 측정으로 찾는다
> 넘치는 요소를 눈으로 찾기는 어렵다. 요소마다 `scrollHeight`와 `clientHeight`를 측정해 넘치는 요소를 수집하니 두 원인이 바로 구분됐다.

## 원인

### 원인 1: 상단 탭이 패널 높이를 줄였다

설정 창은 기본 폭이 좁아서, 폭이 520px 이하면 왼쪽 항목 목록을 상단 탭 행으로 바꿨다. 탭은 `flex: 1`로 폭을 균등 분배했는데, 관리자에게는 항목이 일곱 개라 탭 하나의 폭이 좁아졌다. 그러자 '화면 모드', '개인정보 보호 및 보안' 같은 이름이 한 글자씩 세로로 줄바꿈되며 ==탭 행이 창 높이의 대부분을 차지했다.== 패널은 79px로 줄었고, 넘친 만큼 창 전체가 스크롤됐다.

![좁은 창의 상단 탭이 패널 높이를 줄인 과정](./images/settings-double-scroll-tabs.svg '탭 일곱 개가 폭을 나눠 가지면 긴 이름이 한 글자씩 줄바꿈되어 탭 행이 길어지고, 남은 패널 높이는 79px이 된다')

### 원인 2: 숨은 텍스트가 창 영역을 늘렸다

세 요소는 링크 옆의 스크린 리더용 숨은 텍스트[^hidden] "(메일 앱에서 쓰기)", "(새 탭)"이다(`.visually-hidden`). 스크린 리더는 화면 내용을 음성으로 읽어 주는 보조 기술이다. 예를 들어 "(새 탭)"은 링크가 새 탭에서 열린다는 사실을, "(메일 앱에서 쓰기)"는 링크가 메일 앱의 새 메일 창을 연다는 사실을 스크린 리더 사용자에게 알려 준다.

이 텍스트는 `position: absolute`로 배치된다. 설정의 패널과 그 상위 요소에는 `position`이 없어서, 배경 절의 예시와 같이 이 텍스트들의 컨테이닝 블록은 창의 콘텐츠 영역(`position: relative`)이 됐다. 그래서 ==패널의 스크롤이나 `overflow: hidden`에 포함되지 않고==, 패널 아래쪽 링크 위치만큼 콘텐츠 영역을 늘렸다.

## 해결

수정은 [#195](https://github.com/hyeoniverse/MacFolio/pull/195)다.

### 앱별 최소 창 크기

처음에는 탭을 한 줄로 두고 가로 스크롤하게 수정했다. 그런데 ==실제 macOS의 시스템 설정은 좁은 창에서 레이아웃을 바꾸지 않는다.== 사이드바와 패널이 함께 들어가는 크기보다 작게 **줄어들지 않을** 뿐이다. 그래서 그 방식으로 변경했다.

수정 방법을 비교하면 다음과 같다.

| 방법                                      | 장점                                             | 단점                                                               |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| 상단 탭을 한 줄로 두고 가로 스크롤        | 좁은 창도 그대로 사용한다                        | macOS 시스템 설정에 없는 레이아웃이고, 탭이 많으면 항목이 가려진다 |
| 창의 콘텐츠 영역을 `overflow: hidden`으로 | 한 줄 수정으로 스크롤 컨테이너가 하나가 된다     | 모든 앱이 공유하는 창 프레임이라 다른 앱의 스크롤이 막힌다         |
| 앱별 최소 창 크기 (채택)                  | macOS와 같은 동작, 좁은 레이아웃이 필요 없어진다 | 화면이 최소 크기보다 작으면 화면 크기가 한계다                     |

- 앱마다 최소 창 크기를 지정할 수 있게 했다(`apps/manifest.ts`의 `minSize`). 창을 처음 열 때, 이동할 때, 모서리를 드래그해 줄일 때 모두 이 크기 아래로 줄어들지 않는다(`desktop/window/geometry.ts`). 지정하지 않은 앱은 기존처럼 360×200이다.
- 시스템 설정은 초기 780×540, 최소 680×420이다. 이 폭에서는 항상 왼쪽에 사이드바가 있으므로, 좁은 창용 상단 탭 레이아웃은 삭제했다.
- 넓은 창의 왼쪽 목록도 창보다 길어지면(관리자는 항목이 늘어난다) 목록만 스크롤한다.
- 설정 전체(`.settings`)는 창 높이에 정확히 맞추고(`min-height: 0`, `overflow: hidden`), 패널도 `min-height: 0`으로 줄어들 수 있게 했다.

```ts
// apps/react/src/apps/manifest.ts
// 사이드바와 패널이 함께 들어가는 크기보다 작게 줄이지 않는다 (macOS 시스템 설정처럼)
settings: {
	label: '시스템 설정',
	icon: 'settings.png',
	inDock: true,
	windowSize: { width: 780, height: 540 },
	minSize: { width: 680, height: 420 },
},
```

창 크기를 계산하는 함수들(`defaultRect`, `clampRect`, `moveRect`, `resizeRect`)이 모두 `min` 인수를 받게 했다. 이전에는 상수 `MIN_SIZE`를 함수 안에서 직접 참조했다.

```ts
// apps/react/src/desktop/window/geometry.ts
export function clampRect(rect: Rect, viewport: Viewport, min: MinSize = MIN_SIZE): Rect {
	const maxWidth = viewport.width;
	const maxHeight = viewport.height - STATUSBAR_HEIGHT;
	const width = clamp(rect.width, Math.min(min.width, maxWidth), maxWidth);
	const height = clamp(rect.height, Math.min(min.height, maxHeight), maxHeight);
	// …
}
```

`clamp(값, 하한, 상한)`은 값을 하한과 상한 사이로 자른다. `Math.min(min.width, maxWidth)`가 화면이 더 작을 때의 안전장치다. 680px보다 좁은 화면에서는 화면 폭이 최소 크기가 된다. 시스템 설정 창으로 계산하면 다음과 같다.

| 화면 폭 | 요청한 창 폭 | 하한 `Math.min(680, 화면 폭)` | 결과 창 폭 |
| ------- | ------------ | ----------------------------- | ---------- |
| 1280    | 500          | 680                           | 680        |
| 1280    | 900          | 680                           | 900        |
| 600     | 500          | 600                           | 600        |

> [!WARNING] `min-height: 0`은 필수
> 세로 flex 컨테이너의 자식은 기본값이 [`min-height: auto`](https://developer.mozilla.org/en-US/docs/Web/CSS/min-height)라 자기 콘텐츠보다 작아지지 않는다.

| 패널의 `min-height` | 패널 콘텐츠가 길 때                                   |
| ------------------- | ----------------------------------------------------- |
| `auto` (기본값)     | 패널이 콘텐츠만큼 커지고, 넘친 만큼 부모가 스크롤된다 |
| `0`                 | 패널이 창 높이에 맞춰 줄고, 패널 안에서 스크롤한다    |

### 패널을 컨테이닝 블록으로

패널을 `position: relative`로 지정해 숨은 텍스트의 컨테이닝 블록을 패널로 바꿨다. `position: relative`는 요소 자신의 위치를 바꾸지 않으면서(오프셋을 지정하지 않으면 원래 자리에 그대로 있다) 자손 절대 위치 요소의 기준 상자가 된다. 이제 숨은 텍스트도 패널 안에서 함께 스크롤된다.

```css
/* apps/react/src/apps/settings/Settings.css (.settings-panel) */
min-width: 0;
min-height: 0;
/* 패널 끝에 닿아도 창(바깥)으로 스크롤이 이어지지 않게 */
overscroll-behavior: contain;
/* 안의 position: absolute 요소(화면 읽기용 숨은 글자 등)도 패널을 기준으로 */
position: relative;
```

[`overscroll-behavior: contain`](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)도 함께 추가했다. 패널 끝에 도달한 뒤의 스크롤 입력이 바깥 컨테이너로 전달(스크롤 체이닝)되지 않게 하는 속성이다. 바깥에 스크롤할 영역이 없어진 현재는 보조 조치지만, 이후 다른 원인으로 바깥이 넘쳐도 스크롤이 전달되지 않는다.

| `overscroll-behavior` | 패널 끝에 닿은 뒤 휠을 더 굴리면          |
| --------------------- | ----------------------------------------- |
| `auto` (기본값)       | 바깥 컨테이너가 이어서 스크롤된다         |
| `contain`             | 바깥으로 넘어가지 않고 그 자리에서 멈춘다 |

![고치기 전에는 숨은 글자가 창의 콘텐츠 칸을 기준으로 놓여 칸을 늘렸고, 패널을 relative로 하자 패널 안에 들어왔다](./images/settings-double-scroll-anchor.svg '숨은 글자의 기준 상자가 창의 콘텐츠 칸에서 패널로 바뀌었다')

## 확인

- 단위: 앱이 지정한 최소 크기보다 작게 만들지 않고(화면이 더 작으면 화면 크기), 모서리·변을 드래그해 줄여도 그 크기에서 멈추고 반대쪽 변은 고정된다.
- E2E: 설정 창에서 정보·개인정보 보호 및 보안·배경화면을 차례로 열고, 창의 콘텐츠 영역이 넘치지 않는지(`scrollHeight - clientHeight ≤ 1`)와 패널 높이가 200px보다 큰지 확인한다. 화면 1280×800과 1600×1000에서 실행하고, 수정 전 CSS로는 두 크기 모두 실패하는 것을 확인했다.
- E2E: 설정 창의 오른쪽 아래 모서리를 왼쪽 위로 크게 드래그해도 680×420에서 멈추고, 사이드바는 패널 왼쪽에 유지된다.

`scrollHeight`와 `clientHeight`는 정수로 반올림된 값이라, 판정에는 1px 차이를 허용했다.

미리보기 빌드에서 같은 순서로 다시 측정했다.

| 항목                                           | 측정값                                               |
| ---------------------------------------------- | ---------------------------------------------------- |
| 초기 창 크기                                   | 780×540                                              |
| 모서리를 600·500px 드래그한 뒤                 | 680×420에서 정지                                     |
| 그 크기에서 '정보' 패널                        | 콘텐츠 724px을 높이 389px로 표시, 패널이 자체 스크롤 |
| 창 콘텐츠 영역의 `scrollHeight - clientHeight` | 0                                                    |

![가장 작은 크기 680×420의 시스템 설정](./images/settings-double-scroll-min.jpg '가장 작게 줄여도 사이드바가 왼쪽에 남고, 패널만 스크롤된다')

## 재발 방지

- 위 E2E 시험이 화면 크기 두 가지에서 창 콘텐츠 영역의 넘침을 검사하므로, 이후 설정 패널에 절대 위치 요소나 긴 항목을 더해도 바깥이 넘치면 시험이 실패한다.
- 패널에 지정한 `overscroll-behavior: contain`이 바깥이 다시 넘치는 경우에도 스크롤 체이닝을 차단한다.

### 부가 수정: 간헐적으로 실패하던 댓글 사람 확인 시험

<details><summary>원인과 수정 내용</summary>

전체 E2E를 실행하다가 관계없는 시험 하나가 간헐적으로 실패했다. 댓글에 사람 확인([Turnstile](https://developers.cloudflare.com/turnstile/))을 켜고 댓글 두 개를 연속으로 작성하는 시험이다. Turnstile은 Cloudflare가 제공하는 자동 입력 방지 위젯으로, 사람이 쓴 요청인지 확인한 뒤 서버에 보낼 토큰을 발급한다. 사람 확인 토큰은 한 번만 사용할 수 있어서, 댓글을 등록하면 새 토큰을 발급받는다. 그 사이(시험의 가짜 위젯은 50ms)에 등록을 누르면 "사람인지 확인하는 칸이 끝날 때까지 기다려 주세요."만 표시되고 댓글은 등록되지 않았다. 시험은 이를 감지하지 못하고 댓글이 표시되기를 기다리다 실패했다.

시험의 타이밍 문제이지만, 사용자도 빠르게 누르면 같은 문제를 겪는다. 그래서 시험에 대기를 추가하지 않고 화면을 수정했다. 토큰이 발급될 때까지 등록 버튼을 비활성화하고 '확인 중…'으로 표시한다.

```tsx
// apps/react/src/apps/memo/comments/Comments.tsx
{
	/* 사람 확인을 켰으면 토큰이 올 때까지 끈다: 댓글을 쓴 직후 새 토큰을 받는 사이에 누르면 보내지 못한다 */
}
<Button tone="primary" type="submit" disabled={sending || !human.ready}>
	{sending ? '등록 중…' : human.ready ? '등록' : '확인 중…'}
</Button>;
```

| 상태                  | 버튼 글자 | 누를 수 있는가 |
| --------------------- | --------- | -------------- |
| 등록 요청을 보내는 중 | 등록 중…  | 아니요         |
| 새 토큰을 기다리는 중 | 확인 중…  | 아니요         |
| 토큰 발급 완료        | 등록      | 예             |

이 시험만 반복 실행해 비교하니, 수정 전에는 60번 중 2번 실패했고 수정 후에는 60번 모두 통과했다.

</details>

## 배운 것

- **숨은 텍스트도 레이아웃에 영향을 준다.** 스크린 리더용 텍스트는 1px로 축소될 뿐 레이아웃에 남는다. 절대 위치 요소의 컨테이닝 블록이 어디인지가 핵심이었다.
- **최소 크기 지정도 해결책이다.** 좁은 창용 두 번째 레이아웃을 만드는 대신, macOS처럼 일정 크기보다 작아지지 않게 하니 삭제할 코드가 생겼다. 상단 탭 CSS 블록 하나가 삭제됐다.
- **간헐적으로 실패하는 시험은 화면 버그일 수 있다.** 사용자도 빠르게 누르면 같은 문제를 겪는다. 시험에 대기를 추가하는 대신 화면을 수정했다.

## 관련 글

- [메모 칸 너비 조절 — 그리드 칸을 차지하지 않는 손잡이 두 개](/memo/memo-pane-resize)
- [Turnstile 사람 확인을 requireHuman 하나로 묶고 설정 테이블로 켜고 끄기](/memo/privacy-security-settings)
- [이미지 로드 전 좌표와 누락된 dragover로 흔들린 끌기 E2E](/memo/flaky-drag-e2e)
- [img 로드 전까지 대체 아이콘을 깔아 두는 외부 프로필 사진 표시](/memo/settings-avatar-placeholder)

[^hidden]: 화면에는 보이지 않지만 스크린 리더는 읽는 텍스트다. 보통 `position: absolute`, 1px 크기, `clip`으로 시각적으로만 숨긴다. `display: none`과 달리 접근성 트리에 남는다.

[^chaining]: CSS Overscroll Behavior 명세는 스크롤 컨테이너가 끝에 닿은 뒤 스크롤이 조상 컨테이너로 전파되는 동작을 scroll chaining이라 부른다. [W3C: CSS Overscroll Behavior Module Level 1](https://www.w3.org/TR/css-overscroll-1/)

<details>
<summary>참고 문헌</summary>

- [MDN: overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)
- [MDN: Element.scrollHeight](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight)
- [MDN: Element.clientHeight](https://developer.mozilla.org/en-US/docs/Web/API/Element/clientHeight)
- [MDN: Containing block](https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block)
- [MDN: position](https://developer.mozilla.org/en-US/docs/Web/CSS/position)
- [MDN: overscroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)
- [MDN: min-height](https://developer.mozilla.org/en-US/docs/Web/CSS/min-height)
- [W3C: CSS Overscroll Behavior Module Level 1](https://www.w3.org/TR/css-overscroll-1/)
- [Cloudflare: Turnstile](https://developers.cloudflare.com/turnstile/)

</details>

<details>
<summary>사진 출처</summary>

- CSS 상자 모델 그림: MDN Web Docs, [Layout and the containing block](https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block) (그림 원본 [box-model.png](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Display/Containing_block/box-model.png)), CC BY-SA 2.5

</details>

#MacFolio #프론트엔드 #CSS #트러블슈팅 #시스템설정 #테스트
