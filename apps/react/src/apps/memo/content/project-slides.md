---
title: 미리보기 슬라이드쇼와 프로젝트 발표 자료
date: 2026-10-19
category: 개발 기록/MacFolio/프론트엔드/앱
summary: 미리보기 앱에 macOS처럼 보기 › 슬라이드쇼(⇧⌘F)를 추가해 검은 화면에 한 페이지씩 맞춰 렌더링하고, 종료하면 마지막으로 본 페이지로 이동하게 했다. 발표 자료는 slides 필드를 추가했다가 제거하고, Finder 프로젝트 폴더의 PDF로 지정하도록 변경했다.
---

미리보기 앱으로 이력서 PDF를 열 수 있게 되면서, 프로젝트마다 만들어 둔 발표 자료도 같은 경로로 표시하기로 했다. 발표 자료는 스크롤해서 읽는 문서가 아니라 한 장씩 넘겨 보는 형식이므로, macOS 미리보기의 슬라이드쇼부터 구현했다([#258](https://github.com/hyeoniverse/MacFolio/pull/258)).

## 배경

발표 자료 PDF를 미리보기로 열면 페이지가 세로로 이어져, 16:9 페이지 하나를 보려면 창을 키우고 스크롤 위치를 맞춰야 했다. 발표 자료의 위치도 프로젝트 페이지에서는 알 수 없었다. Finder 문서 폴더를 직접 탐색해야 찾을 수 있었다.

## 슬라이드쇼

기준은 실제 macOS 미리보기다. 같은 날(10월 18일) 미리보기 창의 레이아웃도 이 화면에 맞춰 다시 구현했다. 왼쪽에 페이지 섬네일, 위에 파일 이름과 페이지 수가 있는 창에서 보기 › 슬라이드쇼로 진입한다.

![macOS 미리보기로 포트폴리오 PDF를 연 화면](./images/project-slides-macos-preview-reference.jpg '참고한 macOS 미리보기 화면. 왼쪽 썸네일 사이드바, 위에 파일 이름과 1/27페이지')

macOS 미리보기에서 보기 › 슬라이드쇼(⇧⌘F)를 선택하면 화면이 검게 바뀌고 페이지 하나가 화면 전체에 표시된다. 이 사이트의 동작도 같다.

- 현재 보던 페이지부터 시작한다.
- 페이지는 [pdf.js](https://mozilla.github.io/pdf.js/)로 화면 크기에 맞춰 렌더링한다. 캔버스는 [`devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)만큼 높은 해상도로 렌더링해 레티나 화면에서도 글자가 흐려지지 않는다.
- 포인터를 움직이면 아래에 작은 조절 막대(이전 / 3 / 27 / 다음 / 닫기)가 표시되고, 2초 동안 입력이 없으면 커서와 함께 숨겨진다.
- 브라우저가 허용하면 [Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API)로 전체 화면을 사용한다. 브라우저 쪽에서 전체 화면을 종료해도 슬라이드쇼가 함께 종료된다.

| 키                            | 동작        |
| ----------------------------- | ----------- |
| → ↓ Space PageDown, 화면 클릭 | 다음 페이지 |
| ← ↑ PageUp                    | 이전 페이지 |
| Home / End                    | 처음 / 끝   |
| Esc                           | 종료        |

![화면에 맞추기](./images/project-slides-fit.svg '쪽은 화면에 맞춰 줄이거나 키우고, 캔버스는 기기 픽셀 비율만큼 촘촘하게 그린다')

배율은 페이지의 원래 크기와 화면 크기의 비율 가운데 작은 값이다. 캔버스의 실제 픽셀 수는 CSS 크기에 `devicePixelRatio`를 곱한 값으로 지정하고, pdf.js에는 같은 배율의 변환 행렬을 전달한다.

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

페이지를 바꾸거나 화면 크기가 바뀌면 이전 렌더링 작업(`RenderTask`)을 `cancel()`한다. 그래서 빠르게 넘겨도 이전 페이지의 렌더링 결과가 새 페이지 위에 늦게 덮어쓰이지 않는다.

키 입력은 창 전체에서 캡처 단계로 먼저 수신한다(`window.addEventListener('keydown', onKey, true)`)[^capture]. 그렇지 않으면 뒤에 있는 미리보기 창의 ←→ 페이지 이동이나 메뉴 막대 단축키가 함께 실행된다.

종료하면 미리보기 창이 마지막으로 본 페이지로 스크롤한다. 발표를 멈춘 위치에서 바로 문서를 이어 읽을 수 있다.

## 프로젝트 폴더에 PDF 넣기

처음에는 프로젝트 정보에 `slides` 필드를 추가하고, 시스템 설정에서 Finder 문서의 PDF를 선택해 연결하게 했다(`f7543ed50`). 그런데 [#261](https://github.com/hyeoniverse/MacFolio/pull/261)에서 Finder에 프로젝트마다 폴더(프로젝트 › MacFolio 등)가 생기면서 별도의 선택 단계가 필요 없어졌다. 실제 OS에서 프로젝트 폴더에 발표 자료를 보관하는 방식과 같다.

관리자가 Finder의 프로젝트 폴더(또는 폴더 아이콘 위)에 PDF를 드래그 앤 드롭하면 그 프로젝트의 파일이 된다(폴더 값 `project:<id>`, R2 키 `projects/<id>/…`). 별도로 저장하는 필드가 없으므로, 파일을 삭제하면 버튼도 함께 사라진다.

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

버튼을 누르면 미리보기 앱이 맨 앞으로 오고 해당 PDF가 열린다. PDF가 여러 개이면 이름순([`localeCompare`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare), 한국어 정렬) 첫 파일을 연다. 그 상태에서 ⇧⌘F를 누르면 바로 슬라이드쇼가 시작된다. 휴대폰에서는 창이 없으므로 PDF를 새 탭으로 연다.

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

- [Finder의 이력서 PDF와 그림을 미리보기 앱으로 열기](/memo/finder-files)
- [프로젝트를 앱으로 - 배포한 사이트를 창 안에 띄우기](/memo/project-apps)
- [사진 앱 - 프로젝트 화면을 앨범으로](/memo/photos-app)

[^capture]: DOM 이벤트는 캡처 단계(바깥 → 대상)와 버블링 단계(대상 → 바깥)를 거친다. `addEventListener`의 세 번째 인수를 `true`로 지정하면 캡처 단계에서 수신하므로, 다른 요소의 리스너보다 먼저 처리하고 전파를 멈출 수 있다. [MDN addEventListener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) 참고.

#MacFolio #프론트엔드 #미리보기 #슬라이드쇼 #pdfjs #FullscreenAPI #프로젝트
