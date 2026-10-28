---
title: box-shadow 스포트라이트와 pointer-events로 만든 온보딩 오버레이
date: 2026-10-21
category: 개발 기록/MacFolio/프론트엔드
summary: 첫 방문자에게 화면을 어둡게 덮고 한 곳만 비추는 둘러보기와 macOS 팁 앱을 추가했다. 덮개는 pointer-events none으로 클릭을 통과시키고, 비춘 곳의 클릭은 캡처 단계에서 감지해 원래 동작 뒤 다음 단계로 넘긴다. 이후 팁 앱의 위쪽 막대가 제목 표시줄을 덮어 창을 끌 수 없던 문제를 수정했다.
---

MacFolio의 첫 화면은 macOS 바탕화면이다. Dock에 아이콘이 스무 개 가까이 있고 메뉴 막대·바탕화면 폴더·위젯까지 있어, 처음 온 사람은 이력서와 블로그가 어디에 있는지 바로 알기 어렵다. 그래서 화면의 한 곳씩 비추며 "여기를 눌러 보세요"라고 안내하는 둘러보기와, 앱 사용법을 모은 팁 앱을 추가했다([#313](https://github.com/hyeoniverse/MacFolio/pull/313)). 이후 팁 앱 창을 끌 수 없는 문제를 수정했다([#325](https://github.com/hyeoniverse/MacFolio/pull/325)).

![처음 방문하면 표시되는 환영 카드](./images/first-visit-tour-welcome.jpg '처음 방문하면 로딩 화면이 사라지고 600ms 뒤 화면 가운데에 환영 카드가 표시된다. 다음에 할게요를 누르면 이 브라우저에서는 다시 표시하지 않는다')

## 요구 사항

- 비춘 곳은 **실제로 눌러야** 한다. 그림 위의 안내만 보는 방식이면 사용자가 둘러보기를 닫은 뒤 같은 동작을 다시 찾아야 한다.
- 화면 크기에 따라 대상이 없을 수 있다. 좁은 화면에서는 Dock에 일부 앱만 표시되고, 휴대폰은 Dock 대신 홈 화면 아이콘을 사용한다.
- 단계를 누르면 창이 열린다. 창이 열리거나 화면 크기가 바뀌어도 비춘 자리가 대상에서 벗어나면 안 된다.
- 한 번 보거나 닫으면 다시 표시하지 않는다. 다시 보는 경로는 따로 제공한다.

## 덮개·구멍·클릭 통과

비추기는 요소 두 개로 구성했다. 화면 전체를 덮는 `.tour`와, 대상 자리에 놓는 상자 `.tour-spotlight`다.

![둘러보기의 덮개와 비춘 구멍, 클릭 흐름 도식](./images/first-visit-tour-spotlight.svg '덮개는 그리기만 하고 클릭은 아래로 통과시킨다. 비춘 요소 안의 클릭은 document의 캡처 단계 리스너가 감지해 원래 동작이 끝난 뒤 다음 단계로 넘긴다')

```css
/* desktop/tour/Tour.css */
.tour {
	position: fixed;
	z-index: var(--z-tour); /* 9500: 알림(9000) 위, 메뉴(10000) 아래 */
	inset: 0;
	pointer-events: none;
}

/* 비춘 곳: 바깥을 어둡게 하는 큰 그림자 + 숨 쉬는 테두리 */
.tour-spotlight {
	position: absolute;
	border-radius: var(--radius-14);
	box-shadow: 0 0 0 9999px var(--tour-dim); /* rgba(0, 0, 0, 0.45) */
}

.tour-card {
	pointer-events: auto;
}
```

- **구멍은 그림자로 만든다.** 상자 자체는 투명하고, 퍼짐 반경 9999px의 `box-shadow`[^box-shadow]가 상자 바깥 전체를 칠한다. `clip-path`나 SVG 마스크로 구멍을 뚫는 방법보다 요소가 하나 적고, 상자의 `top`·`left`·`width`·`height`에 `transition`을 지정하면 다음 단계로 이동하는 모습이 그대로 애니메이션된다.
- **덮개는 클릭을 받지 않는다.** `.tour`에 [`pointer-events: none`](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)을 지정해 어두운 영역과 구멍 모두 클릭이 아래 요소에 도달한다. 카드만 `pointer-events: auto`로 되돌려 건너뛰기·이전·다음 단추를 누를 수 있게 했다.
- **z-index는 전역 층 토큰.** 알림보다 위, 펼친 메뉴보다 아래인 `--z-tour: 9500`을 [전역 층 목록](/memo/z-index-layers)에 추가했다. 둘러보기 중에도 Apple 메뉴를 펼치면 메뉴가 덮개 위에 표시된다.

### 비춘 곳을 누르면 다음 단계로

클릭이 덮개를 통과하므로 Dock 아이콘을 누르면 앱이 그대로 열린다. 둘러보기는 그 클릭을 `document`의 캡처 단계에서 감지한다.

```ts
// desktop/tour/Tour.tsx
useEffect(() => {
	if (!target || single) return;
	const onClick = (event: MouseEvent) => {
		const el = document.querySelector(target);
		if (el && event.target instanceof Node && el.contains(event.target)) setTimeout(() => stepTour(1), 0);
	};
	document.addEventListener('click', onClick, true);
	return () => document.removeEventListener('click', onClick, true);
}, [target, single]);
```

- 캡처 단계(`addEventListener`의 세 번째 인자 `true`)[^capture]에 등록해, 대상 요소의 핸들러가 `stopPropagation`을 호출해도 감지된다.
- `preventDefault`를 호출하지 않으므로 원래 동작(앱 열기, 폴더 열기)은 막지 않는다.
- 단계 전환은 `setTimeout(…, 0)`으로 미룬다. 같은 클릭으로 창이 열리는 상태 변경이 먼저 반영되고, 다음 단계의 대상 위치는 그 뒤에 계산된다.

### 카드 위치

카드는 비춘 곳 아래에 배치하고, 아래 공간이 부족하면 위로 올린다. 가로는 대상 중앙에 맞추되 화면 가장자리 16px 안으로 제한한다.

```ts
function cardPosition(box: Box, cardHeight: number) {
	const below = box.top + box.height + GAP; // GAP = 14
	const top = below + cardHeight + EDGE <= window.innerHeight ? below : Math.max(EDGE, box.top - GAP - cardHeight);
	const width = Math.min(CARD_WIDTH, window.innerWidth - EDGE * 2); // 300px, 좁은 화면은 화면 폭 - 32
	const left = Math.min(Math.max(EDGE, box.left + box.width / 2 - width / 2), window.innerWidth - width - EDGE);
	return { top, left, width };
}
```

| 바탕화면 아이콘 (1단계)                                                                                                                                                      | Dock 아이콘 (7단계)                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![이력서 폴더를 비춘 화면](./images/first-visit-tour-step-resume.jpg '이력서 폴더를 비춘 1단계. 화면 오른쪽 위라 카드는 아래에 배치되고 오른쪽 가장자리 16px 안으로 밀린다') | ![Dock의 메시지 아이콘을 비춘 화면](./images/first-visit-tour-step-dock.jpg 'Dock의 메시지 아이콘을 비춘 7단계. 아래 공간이 없어 카드가 위에 배치된다') |

## 화면에 없는 대상 건너뛰기

단계의 대상은 CSS 선택자다. 단계가 바뀐 시각에 대상을 찾아, 문서에 없거나 화면 밖에 있으면 그 단계를 건너뛴다.

```ts
const found = document.querySelector(target);
// 문서에 있어도 화면 밖(휴대폰 홈 화면의 다른 쪽, 숨은 칸)이면 없는 것으로 판단한다
const rect = found?.getBoundingClientRect();
const visible =
	rect &&
	rect.width > 0 &&
	rect.height > 0 &&
	rect.right > 0 &&
	rect.bottom > 0 &&
	rect.left < window.innerWidth &&
	rect.top < window.innerHeight;
if (!visible) {
	if (single)
		endTour(); // 팁 앱에서 하나만 보여 주는 경우는 닫는다
	else stepTour(1);
	return;
}
```

`querySelector`의 결과만 확인하면 부족했다. 휴대폰 홈 화면은 여러 쪽을 가로로 배치하므로 다른 쪽의 아이콘은 문서에는 있지만 화면 밖(`left ≥ innerWidth`)에 있다. 너비·높이 0도 함께 확인해 `display: none`인 요소를 제외한다.

## 창 열림·크기 변경 시 위치 다시 계산

대상의 위치는 단계가 바뀐 시각 한 번만 계산하면 어긋난다. 이력서 폴더를 누르면 Finder 창이 열리며 확대 애니메이션이 진행되고, 화면 크기를 바꾸면 Dock 아이콘이 이동한다. 그래서 단계가 유지되는 동안 [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)으로 매 프레임 위치를 다시 읽는다.

```ts
let frame = 0;
const follow = () => {
	const el = document.querySelector(target);
	const next = el ? boxOf(el) : null; // 둘레 6px 여유, 화면 안 2px로 제한
	setBox((current) => (sameBox(current, next) ? current : next));
	frame = requestAnimationFrame(follow);
};
frame = requestAnimationFrame(follow);
return () => cancelAnimationFrame(frame);
```

- `ResizeObserver`는 대상의 크기 변화만 알려 주고 위치 이동(창 열림으로 인한 재배치, 애니메이션 중 `transform`)은 알려 주지 않는다. `resize` 이벤트도 창 열림을 감지하지 못한다. 매 프레임 읽기가 세 경우를 모두 처리하는 가장 단순한 방법이었다.
- 비용은 프레임마다 `getBoundingClientRect` 한 번이다. 값이 같으면 `setBox`가 기존 객체를 그대로 반환해 React가 다시 렌더링하지 않는다.
- 메뉴 막대처럼 화면 맨 위에 붙은 대상은 여유 6px을 더하면 테두리가 화면 밖으로 잘린다. `boxOf`에서 상자를 화면 안 2px로 제한했다.

## 단계 데이터: tourSteps.ts

단계는 React·DOM에 의존하지 않는 데이터 파일 `desktop/tour/tourSteps.ts`에 모았다.

```ts
export interface TourStep {
	id: string;
	/** 비출 곳 (CSS 선택자). 없으면 가운데 카드. 화면에 없는 곳은 건너뛴다 */
	target?: string;
	title: string;
	body: string;
	/** 팁 앱 목록에 표시할 아이콘 (Font Awesome) */
	icon?: string;
}

const dock = (app: string) => `.dock .dock-item[aria-label="${app}"]`;
const phoneApp = (app: string) => `.mobile-app[data-launch="${app}"]`;
```

| 화면     | 비추는 단계                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 데스크톱 | 15단계: 이력서 → Finder → Safari → 프로젝트 앱 → 메모 → 사진 → 메시지 → 메일 → GitHub → 터미널 → 음악 → 시스템 설정 → Launchpad → 서버 상태 → Apple 메뉴 |
| 휴대폰   | 10단계: 홈 화면 아이콘으로 같은 흐름을 짧게                                                                                                              |

앞뒤에 대상 없는 환영·마무리 카드가 있고, 진행 표시(`1 / 15`)는 대상이 있는 단계만 집계한다. 같은 데이터를 팁 앱의 "화면에서 짚어 보기" 목록도 사용한다(`tipSteps`는 대상이 있는 단계만 필터링한다).

![휴대폰에서 파일 앱 아이콘을 비춘 화면](./images/first-visit-tour-m-step.jpg '휴대폰 1단계. 데스크톱의 바탕화면 이력서 폴더 대신 홈 화면의 파일 앱을 비춘다. 단계는 10개다')

### 저장과 다시 보기

- 끝까지 진행하거나 Esc·건너뛰기·다음에 할게요로 닫으면 `localStorage`의 `macfolio:tour`에 `done`을 저장한다. 키는 `STORAGE_KEYS`에 등록했다.
- 휴지통 › 내 브라우저 데이터에 "둘러보기를 본 기록"으로 표시되어 삭제할 수 있다. 거의 모든 방문자가 갖는 값이라 휴지통 아이콘을 채운 그림으로 바꾸지는 않는다(`fillsTrash: false`).
- `localStorage` 접근이 예외를 던지는 환경에서는 둘러보기를 표시하지 않는다(`hasSeenTour()`가 `true` 반환). 기록을 저장할 수 없으면 매 방문마다 표시되기 때문이다.
- 메뉴 막대의 도움말 › MacFolio 둘러보기, 팁 앱의 둘러보기 카드로 언제든 다시 시작한다.
- `prefers-reduced-motion: reduce`이면 상자 이동과 테두리 애니메이션을 끈다.

E2E 시험이 둘러보기 덮개에 가려지지 않도록, 공통 fixture는 시작 시각에 `macfolio:tour`를 `done`으로 설정한다. 둘러보기 시험만 `firstVisit(page)`로 이 값을 삭제한다.

## 팁 앱

macOS 팁 앱의 구성을 따랐다. 첫 화면에 찾기 칸, 둘러보기 카드, 팁 모음, 앱별 사용 설명서가 있다.

| 첫 화면                                                                                                                            | 블로그 읽는 법                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ![팁 앱 첫 화면](./images/first-visit-tour-tips-app.jpg '팁 앱 첫 화면. 카드에는 그림 칸만 두고 제목·설명은 카드 아래에 배치했다') | ![팁 앱의 블로그 읽는 법](./images/first-visit-tour-tips-guide.jpg '블로그 읽는 법. 왼쪽 목차와 10개 팁, 단축키(⌥1·⌥2)를 표시한다') |

- **데이터와 화면 분리**: 팁 모음은 `apps/tips/guides.ts`, 사용 설명서는 `apps/tips/manuals.ts`에 데이터만 보관한다. 프로젝트 앱의 설명서는 프로젝트 정보의 `usage`로 생성한다.
- **보여 주기**: 화면에서 짚어 보기의 각 팁에 있는 보여 주기를 누르면 팁 창을 닫고 그 단계 하나만 비춘다. 창이 닫히는 애니메이션 뒤에 대상을 계산해야 하므로 데스크톱 250ms, 휴대폰 500ms 뒤에 시작한다.
- **설명서 그림**: 기능이 많은 앱(메모·Finder·Safari 등)은 실제 화면 캡처를 포함한 글 형식이다. 캡처 20장은 별도 Playwright 설정(`playwright.tips.config.ts`, 1280×800, 2배 해상도)으로 빌드한 사이트에서 생성한다.

## 팁 앱 창을 끌 수 없던 문제 (#325)

배포 뒤 팁 앱 창을 끌어 옮길 수 없었다. 위쪽 막대를 두 번 눌러 확대하는 동작도 작동하지 않았다.

### 원인

팁 앱은 통합형 창(`chrome="unified"`)이다. 통합형 창에서는 투명한 제목 표시줄 `.macos-titlebar`(z-index 3)가 앱 내용 위에 놓여 끌기와 두 번 눌러 확대를 처리한다. 팁 앱의 위쪽 막대 `.tips-bar`는 뒤로·앞으로·홈 단추를 누를 수 있게 막대 **전체**를 z-index 4로 올렸다. 그 결과 막대가 제목 표시줄을 통째로 덮어, 빈 곳의 클릭이 제목 표시줄에 도달하지 않았다.

![팁 앱 위쪽 막대 수정 전후의 클릭 경로](./images/first-visit-tour-tips-bar.svg '전: z-index 4인 막대 전체가 클릭을 받는다. 후: 막대는 그대로 위에 있지만 단추만 클릭을 받고 나머지는 아래 제목 표시줄로 통과한다')

| 막대에서 누른 곳    | 전                                      | 후                                   |
| ------------------- | --------------------------------------- | ------------------------------------ |
| 뒤로·앞으로·홈 단추 | 단추                                    | 단추 (그대로)                        |
| 제목 글자, 빈 곳    | `.tips-bar`가 받음 → 창이 움직이지 않음 | 제목 표시줄로 → 끌기·두 번 눌러 확대 |

같은 통합형 창인 텍스트 편집기(`.textedit-actions`)와 메모(`.memo-view-switch`)는 단추 묶음만 z-index 4로 올려 이 문제가 없었다.

### 수정

둘러보기 덮개와 같은 방법이다. 막대는 제목 표시줄 위에 유지하고, 단추가 아닌 영역은 클릭을 아래로 통과시킨다.

```diff
 /* apps/tips/Tips.css */
 .tips-bar {
-	/* 통합형 창의 제목 표시줄(z-index 3) 위로: 단추를 누를 수 있게 */
+	/* 통합형 창의 제목 표시줄(z-index 3) 위에 놓되, 단추가 아닌 곳은 눌림을 아래 제목 표시줄로 넘긴다 */
 	position: relative;
 	z-index: 4;
+	pointer-events: none;
 }
+
+.tips-bar button {
+	pointer-events: auto;
+}
```

`pointer-events`는 상속되므로 `button`에서 `auto`로 되돌려야 한다.

## 확인

- 단위 시험 `tourStore.test.ts`: 단계 id 중복 없음, 환영으로 시작해 마무리로 끝남, 팁 앱에는 대상이 있는 단계만 포함, 끝까지 진행하거나 닫거나 하나만 보여 줘도 `done` 저장.
- E2E `tour.spec.ts`(#313 기준 6개):
  - 첫 방문 → 환영 → 1단계에서 비춘 상자가 이력서 아이콘을 포함하는지 좌표 비교 → 아이콘을 두 번 눌러 Finder가 열리고 다음 단계로 이동 → 마무리 → `macfolio:tour === 'done'`
  - 다음에 할게요로 닫고 도움말 메뉴로 다시 열기
  - 팁 앱의 보여 주기, 블로그 읽는 법 → 홈 → 뒤로 → 메모 열기, 모두 보기 → 날씨 설명서
  - 휴대폰 홈 화면 아이콘 비추기
- #325에서 시험 하나를 추가했다. 막대의 빈 곳을 끌면 창이 (120, 60)만큼 이동하고, 두 번 누르면 너비가 커지며, 막대의 단추는 그대로 눌리는지 확인한다. 수정을 제외하고 실행하면 `Expected: 120, Received: 0`으로 실패한다.

## 남은 것

- 매 프레임 위치 읽기는 단계가 유지되는 동안 계속 실행된다. 대상이 움직이지 않는 단계에서도 `getBoundingClientRect`를 호출한다. 이 비용은 따로 측정하지 않았다. 대상이 늘어나면 창 열림 이벤트와 `ResizeObserver`를 조합하는 방식을 검토한다.
- 다음 단계로 넘어가는 기준은 대상 요소 안의 `click` 이벤트 하나다. 바탕화면 폴더처럼 두 번 눌러야 열리는 대상은 코드상 첫 클릭에 다음 단계로 이동하므로, 한 번만 누르면 Finder가 열리지 않은 채 단계만 넘어간다. 시험은 두 번 누르기(`dblclick`)만 확인한다.
- 휴대폰에서는 상태 표시줄이 팁 앱 위쪽을 가려 눌리지 않는 문제가 있었다. 10월 23일 커밋 `98bd1d2a1`에서 `.tips-scroll`에 `calc(var(--phone-top) + 44px)` 위쪽 여백을 추가해 수정했다.

## 관련 글

- [z-index 숫자에 이름 붙이기 — 화면 전체의 겹침 순서를 한 표로](/memo/z-index-layers): `--z-tour`를 추가한 전역 층 목록
- [sticky 도구 막대가 버튼을 가린 이유](/memo/sticky-stacking-context): 겹침 순서 때문에 단추가 눌리지 않은 다른 사례
- [좁은 창에서 신호등 버튼 아래로 - 음악과 Safari](/memo/narrow-window-title): 통합형 창에서 신호등 영역과 앱 내용이 겹치는 구조
- [Stylelint declaration-property-value-allowed-list로 디자인 토큰 강제하기](/memo/off-scale-values): 같은 날 넓힌 Stylelint 규칙. 둘러보기 카드에서 존재하지 않는 토큰을 사용한 사례도 기록했다
- [10월 21일 - Markdown 이력서, 텍스트 편집기, 위젯, 첫 방문자를 위한 둘러보기](/memo/day-1021)

[^box-shadow]: [`box-shadow`](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow)의 네 번째 길이 값은 퍼짐 반경(spread)이다. 흐림 0, 퍼짐 9999px이면 상자 둘레로 9999px까지 같은 색을 칠해 사실상 화면 전체를 덮는다. 그림자는 상자 안쪽을 칠하지 않으므로 상자 자리만 밝게 남는다.

[^capture]: DOM 이벤트는 `window`에서 대상까지 내려가는 캡처 단계, 대상, 다시 올라가는 버블 단계 순서로 전달된다. [`addEventListener`의 `useCapture`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#usecapture)를 `true`로 지정하면 캡처 단계에서 호출된다.

#MacFolio #온보딩 #CSS #pointer-events #Playwright
