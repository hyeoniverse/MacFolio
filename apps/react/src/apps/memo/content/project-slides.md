---
title: pdf.js와 Fullscreen API로 구현한 PDF 슬라이드쇼
date: 2026-10-19
category: 개발 기록/MacFolio/인터랙션·브라우저 API
summary: 미리보기 앱에 macOS처럼 보기 › 슬라이드쇼(⇧⌘F)를 추가해 검은 화면에 한 페이지씩 맞춰 렌더링하고, 종료하면 마지막으로 본 페이지로 이동하게 했다. 발표 자료는 slides 필드를 추가했다가 제거하고, Finder 프로젝트 폴더의 PDF로 지정하도록 변경했다.
---

미리보기 앱으로 이력서 PDF를 열 수 있게 되면서, 프로젝트마다 만들어 둔 발표 자료도 같은 경로로 표시하기로 했다. 발표 자료는 스크롤해서 읽는 문서가 아니라 한 장씩 넘겨 보는 형식이므로, macOS 미리보기의 슬라이드쇼부터 구현했다([#258](https://github.com/hyeoniverse/MacFolio/pull/258)).

## 배경

발표 자료 PDF를 미리보기로 열면 페이지가 세로로 이어져, 16:9 페이지 하나를 보려면 창을 키우고 스크롤 위치를 맞춰야 했다. 발표 자료의 위치도 프로젝트 페이지에서는 알 수 없었다. Finder 문서 폴더를 직접 탐색해야 찾을 수 있었다.

### PDF를 브라우저에서 그리는 방법

PDF는 페이지마다 글자, 선, 이미지를 어느 좌표에 그릴지 적어 둔 문서 형식이다. 브라우저에도 PDF 보기 기능이 있지만, `<iframe>`이나 `<embed>`로 열면 브라우저마다 다른 도구 막대가 붙고 페이지 단위 제어(지금 몇 쪽인지, 다음 쪽으로 넘기기)를 페이지 코드에서 할 수 없다.

[pdf.js](https://mozilla.github.io/pdf.js/)는 Mozilla가 만든 JavaScript PDF 렌더러로, Firefox의 내장 PDF 보기도 이 라이브러리를 쓴다. pdf.js는 PDF 파일을 해석해 페이지 하나를 HTML `<canvas>` 요소에 그림으로 그린다. 페이지 번호와 크기를 직접 지정할 수 있으므로, "3쪽을 화면 크기에 맞춰 그린다" 같은 동작을 코드로 구현할 수 있다.

### Fullscreen API

[Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)는 페이지의 요소 하나를 모니터 전체 화면으로 표시하는 브라우저 기능이다. `element.requestFullscreen()`을 호출하면 브라우저의 주소 막대와 탭이 사라지고 그 요소만 화면을 채운다. 브라우저는 이 요청을 사용자 입력(클릭, 키 입력) 처리 중에만 허용하고, 사용자는 Esc 키로 언제든 전체 화면을 끝낼 수 있다. 전체 화면에 들어가거나 나올 때마다 `document`에 `fullscreenchange` 이벤트가 발생하고, 지금 전체 화면인 요소는 `document.fullscreenElement`로 확인한다.

## 슬라이드쇼

기준은 실제 macOS 미리보기다. 같은 날(10월 18일) 미리보기 창의 레이아웃도 이 화면에 맞춰 다시 구현했다. 왼쪽에 페이지 섬네일, 위에 파일 이름과 페이지 수가 있는 창에서 보기 › 슬라이드쇼로 진입한다.

![macOS 미리보기로 포트폴리오 PDF를 연 화면](./images/project-slides-macos-preview-reference.jpg '참고한 macOS 미리보기 화면. 왼쪽 썸네일 사이드바, 위에 파일 이름과 1/27페이지')

macOS 미리보기에서 보기 › 슬라이드쇼(⇧⌘F)를 선택하면 화면이 검게 바뀌고 페이지 하나가 화면 전체에 표시된다. 이 사이트의 동작도 같다.

- 현재 보던 페이지부터 시작한다.
- 페이지는 pdf.js로 화면 크기에 맞춰 렌더링한다. 캔버스는 [`devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)만큼 높은 해상도로 렌더링해 레티나 화면에서도 글자가 흐려지지 않는다.
- 포인터를 움직이면 아래에 작은 조절 막대(이전 / 3 / 27 / 다음 / 닫기)가 표시되고, 2초(`IDLE = 2000`) 동안 입력이 없으면 커서와 함께 숨겨진다.
- 브라우저가 허용하면 Fullscreen API로 전체 화면을 사용한다. 브라우저 쪽에서 전체 화면을 종료해도 슬라이드쇼가 함께 종료된다.

| 키                            | 동작        |
| ----------------------------- | ----------- |
| → ↓ Space PageDown, 화면 클릭 | 다음 페이지 |
| ← ↑ PageUp                    | 이전 페이지 |
| Home / End                    | 처음 / 끝   |
| Esc                           | 종료        |

### 화면에 맞춰 선명하게 그리기

CSS의 1px은 화면의 물리 픽셀 1개와 같지 않다. 레티나 같은 고밀도 화면은 CSS 1px을 물리 픽셀 2×2개로 그리고, 이 비율이 `devicePixelRatio`(이 예에서 2)다. 캔버스는 지정한 픽셀 수만큼만 그림을 저장하므로, CSS 크기와 같은 1000×750 캔버스를 레티나 화면에 표시하면 브라우저가 이 그림을 2배로 늘려 글자 가장자리가 흐려진다. 캔버스 자체를 2000×1500으로 만들고 CSS 크기는 1000×750으로 두면 물리 픽셀 하나에 캔버스 픽셀 하나가 대응한다.

![화면에 맞추기](./images/project-slides-fit.svg '쪽은 화면에 맞춰 줄이거나 키우고, 캔버스는 기기 픽셀 비율만큼 촘촘하게 그린다')

배율은 페이지의 원래 크기와 화면 크기의 비율 가운데 작은 값이다. 예를 들어 4:3 페이지(원래 크기 960×720)를 1440×900 화면에 띄우면 가로 비율은 1440 ÷ 960 = 1.5, 세로 비율은 900 ÷ 720 = 1.25이고, 작은 값 1.25를 써서 1200×900으로 그린다. 큰 값을 쓰면 세로가 화면을 넘어 잘린다. 캔버스의 실제 픽셀 수는 CSS 크기에 `devicePixelRatio`를 곱한 값으로 지정하고, pdf.js에는 같은 배율의 변환 행렬을 전달한다.

```ts
const base = page.getViewport({ scale: 1, rotation: angle });
const scale = Math.min(width / base.width, height / base.height);
const viewport = page.getViewport({ scale, rotation: angle });
const ratio = window.devicePixelRatio || 1;
target.width = Math.floor(viewport.width * ratio);
target.height = Math.floor(viewport.height * ratio);
target.style.width = `${Math.floor(viewport.width)}px`;
target.style.height = `${Math.floor(viewport.height)}px`;
task = page.render({ canvas: target, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
```

변환 행렬 `[ratio, 0, 0, ratio, 0, 0]`은 Canvas 2D의 `setTransform(a, b, c, d, e, f)`와 같은 형식으로, 가로·세로를 `ratio`배 늘리고 이동은 하지 않는다는 뜻이다. pdf.js는 `viewport` 기준 좌표로 그리고, 이 행렬이 그 좌표를 2배 촘촘한 캔버스 픽셀로 옮긴다.

### 렌더링 작업 취소

페이지를 바꾸거나 화면 크기가 바뀌면 이전 렌더링 작업(`RenderTask`)을 `cancel()`한다. 그래서 빠르게 넘겨도 ==이전 페이지의 렌더링 결과가 새 페이지 위에 늦게 덮어쓰이지 않는다==.

![cancel이 없으면 3쪽 렌더링이 4쪽보다 늦게 끝나 4쪽 위에 그려지고, cancel을 적용하면 →를 누른 시각에 3쪽 작업이 멈춰 4쪽만 남는다](./images/project-slides-render-cancel.svg '두 작업은 같은 canvas에 그린다. 늦게 끝난 작업의 그림이 화면에 남는다')

pdf.js의 렌더링은 비동기다. 페이지의 그림이 복잡하면 한 쪽을 그리는 데 수백 밀리초가 걸리고, 그동안 다른 코드가 실행된다. 렌더링은 React의 `useEffect` 안에서 시작하고, effect의 정리(cleanup) 함수가 `task?.cancel()`을 호출한다. React는 `number`(페이지 번호)가 바뀌어 effect를 다시 실행하기 직전에 이전 effect의 정리 함수를 먼저 실행하므로, 4쪽 작업이 시작되기 전에 3쪽 작업이 취소된다.

### 키 입력을 먼저 받기

키 입력은 창 전체에서 캡처 단계로 먼저 수신한다(`window.addEventListener('keydown', onKey, true)`)[^capture]. 그렇지 않으면 뒤에 있는 미리보기 창의 ←→ 페이지 이동이나 메뉴 막대 단축키가 함께 실행된다.

![DOM 이벤트의 세 단계 전파](./images/menu-bar-app-name-w3c-eventflow.svg 'W3C UI Events 명세 초안(2016)의 그림. 이벤트는 Window에서 대상까지 내려가는 캡처 단계(빨간색), 대상 단계(파란색), 다시 Window까지 올라가는 버블링 단계(초록색)를 거친다. window에 캡처로 등록한 처리기는 가장 먼저 실행된다')

예를 들어 슬라이드쇼 중에 →를 누르면 `keydown`은 Window에서 출발해 초점을 가진 요소까지 내려간다. 슬라이드쇼의 처리기는 그 첫 단계(Window의 캡처)에서 실행되어 다음 쪽으로 넘기고 `stopPropagation()`으로 전파를 멈춘다. 그 뒤에 있는 미리보기 창의 처리기는 이벤트를 받지 못한다. ⌘·Ctrl·Option이 함께 눌린 키는 처리하지 않고 그대로 통과시킨다.

### 전체 화면과 종료

![⇧⌘F로 requestFullscreen을 요청하고, 허용되면 전체 화면, 거절되면 창 안의 검은 화면이 된다. 전체 화면 해제나 Esc keydown은 모두 close()로 모여 한 번만 실행되고 마지막 쪽으로 스크롤한다](./images/project-slides-fullscreen.svg '두 종료 경로가 한 번만 실행되는 close()로 모인다')

`requestFullscreen()`이 거절되면(예: 브라우저 설정이나 iframe 안이라 허용되지 않는 경우) Promise 거절을 무시하고, 슬라이드쇼는 브라우저 창 안의 검은 화면으로 동작한다. 허용되어 전체 화면에 들어가면 `fullscreenchange` 처리기가 `entered = true`를 기록한다. 이후 사용자가 Esc로 전체 화면을 끝내면 `fullscreenElement`가 `null`로 바뀌는 `fullscreenchange`가 다시 발생하고, 이때 슬라이드쇼도 닫는다. `entered`를 확인하는 이유는 전체 화면에 들어가기 전에 발생한 이벤트로 슬라이드쇼가 바로 닫히지 않게 하기 위해서다.

Esc 키와 전체 화면 해제가 같은 시각에 함께 발생할 수 있으므로, 닫는 함수 `close()`는 `closed` ref로 한 번만 실행한다.

종료하면 미리보기 창이 마지막으로 본 페이지로 스크롤한다. 예를 들어 1쪽부터 슬라이드쇼를 시작해 12쪽에서 Esc를 누르면, 미리보기 창은 12쪽이 보이는 위치로 이동한다. 발표를 멈춘 위치에서 바로 문서를 이어 읽을 수 있다.

## 프로젝트 폴더에 PDF 넣기

처음에는 프로젝트 정보에 `slides` 필드를 추가하고, 시스템 설정에서 Finder 문서의 PDF를 선택해 연결하게 했다(`f7543ed50`). 그런데 [#261](https://github.com/hyeoniverse/MacFolio/pull/261)에서 Finder에 프로젝트마다 폴더(프로젝트 › MacFolio 등)가 생기면서 별도의 선택 단계가 필요 없어졌다. 실제 OS에서 프로젝트 폴더에 발표 자료를 보관하는 방식과 같다.

관리자가 Finder의 프로젝트 폴더(또는 폴더 아이콘 위)에 PDF를 드래그 앤 드롭하면 그 프로젝트의 파일이 된다(폴더 값 `project:<id>`, R2 키 `projects/<id>/…`). R2는 Cloudflare의 파일 저장소이고, 키는 그 안에서 파일을 구분하는 경로 문자열이다. 별도로 저장하는 필드가 없으므로, ==파일을 삭제하면 버튼도 함께 사라진다==.

|                 | `slides` 필드 (처음)                 | 프로젝트 폴더 (현재)                                                |
| --------------- | ------------------------------------ | ------------------------------------------------------------------- |
| 연결 방법       | 시스템 설정에서 PDF를 선택한다       | Finder 프로젝트 폴더에 드래그 앤 드롭한다                           |
| 저장 위치       | 프로젝트 정보의 필드 + 파일          | 파일만 (폴더 값이 곧 연결)                                          |
| 파일을 삭제하면 | 필드가 존재하지 않는 파일을 가리킨다 | 버튼도 사라진다                                                     |
| 코드            | 설정 화면·검사·시험                  | 설정 화면 40줄, 프로젝트 검사 9줄과 그 시험 13줄 삭제 (`617ef82dd`) |

```ts
/** 프로젝트 폴더의 PDF 가운데 이름순 첫 파일 */
export function firstProjectPdf(entries: DocumentEntry[], projectId: string): DocumentEntry | null {
	const folder = projectFolderValue(projectId);
	return (
		entries
			.filter((entry) => entry.folder === folder && entry.kind === 'pdf')
			.sort((a, b) => a.name.localeCompare(b.name, 'ko'))[0] ?? null
	);
}
```

## 프로젝트 페이지의 버튼

프로젝트 폴더에 PDF가 하나라도 있으면, 프로젝트 페이지의 링크 그룹(여기서 열기, 데모, GitHub) 끝에 "발표 자료 보기" 버튼이 추가된다. 직접 구현한 페이지와 템플릿 페이지(카드, 키노트, 벤토, 개발자 도구 등)가 모두 같은 버튼을 사용한다.

버튼을 누르면 미리보기 앱이 맨 앞으로 오고 해당 PDF가 열린다. PDF가 여러 개이면 이름순([`localeCompare`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare), 한국어 정렬) 첫 파일을 연다. 예를 들어 폴더에 `소개.pdf`와 `2024 발표.pdf`가 있으면 숫자가 한글보다 앞에 정렬되어 `2024 발표.pdf`를 연다. 그 상태에서 ==⇧⌘F를 누르면 바로 슬라이드쇼가 시작된다==. 휴대폰에서는 창이 없으므로 PDF를 새 탭으로 연다.

![Finder 프로젝트 폴더의 PDF가 프로젝트 페이지 버튼과 미리보기 슬라이드쇼로 이어지는 흐름과 슬라이드쇼 키](./images/project-slides-flow.svg 'PDF를 폴더에 넣는 것만으로 버튼이 생기고, ⇧⌘F로 발표 화면이 된다')

## 확인

`apps/react/e2e/preview-slideshow.spec.ts`의 시험 네 개다.

1. "⇧⌘F로 지금 쪽부터 한 쪽씩 보이고, Esc로 끝내면 끝낸 쪽을 보인다"
2. "보기 메뉴에서 시작하고, 조절 막대는 움직이면 보였다가 가만히 있으면 사라진다"
3. "프로젝트 폴더에 PDF가 있으면 Safari에 버튼이 있고, 이름순 첫 PDF를 미리보기에서 연다"
4. "프로젝트 폴더에 PDF가 없으면 버튼이 없다"

슬라이드쇼 커밋(`21b84be16`)의 변경은 대부분 `Slideshow.tsx` 192줄과 CSS 98줄이다. 폴더 방식으로 변경한 커밋(`617ef82dd`)에서 이 시험 파일을 62줄 수정했다.

## 남은 것·배운 것

- PDF가 여러 개이면 이름순 첫 파일만 연다. 발표 자료가 둘 이상인 프로젝트는 파일 이름으로 순서를 지정해야 한다.
- 휴대폰에서는 슬라이드쇼 없이 새 탭으로 PDF를 연다.
- 전체 화면은 브라우저가 허용할 때만 적용된다. 허용하지 않아도 슬라이드쇼는 창 안의 검은 화면으로 동작한다.
- 처음 추가한 `slides` 필드는 하루 만에 제거했다. "어디에 연결할까"를 새 필드로 해결하기 전에, 기존 구조(프로젝트 폴더)가 이미 그 관계를 표현하는지 먼저 확인하는 편이 빨랐다.

## 관련 글

- [Cloudflare R2 파일을 Worker가 같은 출처 /files/로 제공하기](/memo/finder-files)
- [PROJECTS 데이터에서 생성하는 iframe 앱과 ProjectAppName 브랜드 타입](/memo/project-apps)
- [별도 목록 없이 프로젝트 데이터를 순회해 생성하는 사진 앨범](/memo/photos-app)

[^capture]: DOM 이벤트는 캡처 단계(바깥 → 대상)와 버블링 단계(대상 → 바깥)를 거친다. `addEventListener`의 세 번째 인수를 `true`로 지정하면 캡처 단계에서 수신하므로, 다른 요소의 리스너보다 먼저 처리하고 전파를 멈출 수 있다. [MDN addEventListener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) 참고.

<details>
<summary>참고 문헌</summary>

- Mozilla, [PDF.js](https://mozilla.github.io/pdf.js/), [PDF.js Examples](https://mozilla.github.io/pdf.js/examples/)
- MDN, [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API), [Element.requestFullscreen()](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [fullscreenchange event](https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenchange_event)
- MDN, [Window.devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
- MDN, [CanvasRenderingContext2D.setTransform()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setTransform)
- MDN, [EventTarget.addEventListener()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
- MDN, [String.prototype.localeCompare()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare)
- React, [useEffect: cleanup](https://react.dev/reference/react/useEffect)

</details>

<details>
<summary>사진 출처</summary>

- DOM 이벤트 전파 그림: W3C, [UI Events Working Draft 2016-08-04, 3.1 Event dispatch and DOM event flow](https://www.w3.org/TR/2016/WD-uievents-20160804/#event-flow), 원본 [eventflow.svg](https://github.com/w3c/uievents/blob/main/images/eventflow.svg), W3C Software and Document License, 출처 표기 (흰 바탕만 추가)

</details>

#MacFolio #프론트엔드 #미리보기 #슬라이드쇼 #pdfjs #FullscreenAPI #프로젝트
