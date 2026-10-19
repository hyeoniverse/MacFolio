---
title: 미리보기 슬라이드쇼와 프로젝트 발표 자료
date: 2026-10-19
category: 개발기/MacFolio/프론트엔드
summary: 미리보기 앱에 macOS처럼 보기 › 슬라이드쇼(⇧⌘F)를 더해 검은 화면에 한 쪽씩 맞춰 그리고, 끝내면 끝낸 쪽을 보이게 했다. 발표 자료는 slides 칸을 두었다가 빼고, Finder 프로젝트 폴더의 PDF로 정하게 바꿨다.
---

미리보기 앱으로 이력서 PDF를 열 수 있게 되자, 프로젝트마다 만들어 둔 발표 자료도 같은 길로 보이고 싶어졌다. 발표 자료는 스크롤해서 읽는 문서가 아니라 한 장씩 넘겨 보는 것이라, macOS 미리보기의 슬라이드쇼부터 만들었다([PR #258](https://github.com/hyeoniverse/MacFolio/pull/258)).

## 배경

발표 자료 PDF를 미리보기로 열면 쪽이 세로로 이어져, 16:9 쪽 하나를 보려면 창을 키우고 스크롤을 맞춰야 했다. 발표 자료가 어디 있는지도 프로젝트 페이지에서는 알 수 없었다. 사람이 Finder 문서 폴더를 뒤져야 찾을 수 있었다.

## 슬라이드쇼

macOS 미리보기에서 보기 › 슬라이드쇼(⇧⌘F)를 고르면 화면이 검게 바뀌고 쪽 하나가 화면 가득 뜬다. 여기서도 같다.

- 지금 보던 쪽부터 시작한다.
- 쪽은 pdf.js로 화면 크기에 맞춰 그린다. 캔버스는 기기 픽셀 비율만큼 촘촘하게 그려 레티나 화면에서도 글자가 흐리지 않다.
- → ↓ 스페이스 PageDown은 다음, ← ↑ PageUp은 이전, Home·End는 처음과 끝, Esc는 끝내기. 화면을 누르면 다음 쪽이다.
- 마우스를 움직이면 아래에 작은 조절 막대(이전 / 3 / 27 / 다음 / 닫기)가 뜨고, 2초 동안 가만히 있으면 커서와 함께 사라진다.
- 브라우저가 허락하면 전체 화면으로 띄운다. 브라우저 쪽에서 전체 화면을 빠져나와도 슬라이드쇼가 같이 끝난다.

![화면에 맞추기](./images/project-slides-fit.svg '쪽은 화면에 맞춰 줄이거나 키우고, 캔버스는 기기 픽셀 비율만큼 촘촘하게 그린다')

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

쪽을 바꾸거나 화면 크기가 바뀌면 이전 그리기(`RenderTask`)를 `cancel()`한다. 그래서 빠르게 넘겨도 앞 쪽 그리기가 새 쪽 위에 늦게 그려지지 않는다.

키는 창 전체에서 먼저(capture) 받는다(`window.addEventListener('keydown', onKey, true)`). 그러지 않으면 뒤에 있는 미리보기 창의 ←→ 쪽 넘기기나 메뉴 막대 단축키가 같이 움직인다.

끝내면 미리보기 창이 끝낸 쪽으로 스크롤한다. 발표를 하다 멈춘 자리에서 바로 문서를 이어 읽을 수 있다.

## 프로젝트 폴더에 PDF 넣기

처음에는 프로젝트 정보에 `slides` 필드를 두고, 시스템 설정에서 Finder 문서의 PDF를 골라 붙이게 했다(`f7543ed50`). 그런데 Finder가 프로젝트마다 폴더(프로젝트 › MacFolio 등)를 갖게 되면서, 따로 고르는 단계가 필요 없어졌다. 실제 OS에서 프로젝트 폴더에 발표 자료를 넣어 두는 것과 같다.

관리자가 Finder의 프로젝트 폴더(또는 그 폴더 아이콘 위)에 PDF를 끌어다 놓으면 그 프로젝트의 파일이 된다(폴더 값 `project:<id>`, R2 키 `projects/<id>/…`). 따로 저장할 필드가 없으니, 파일을 지우면 버튼도 함께 사라진다.

|               | `slides` 칸 (처음)           | 프로젝트 폴더 (지금)                                                    |
| ------------- | ---------------------------- | ----------------------------------------------------------------------- |
| 붙이는 법     | 시스템 설정에서 PDF를 고른다 | Finder 프로젝트 폴더에 끌어다 놓는다                                    |
| 저장하는 곳   | 프로젝트 정보의 칸 + 파일    | 파일뿐 (폴더 값이 곧 연결)                                              |
| 파일을 지우면 | 칸이 없는 파일을 가리킨다    | 버튼도 사라진다                                                         |
| 코드          | 설정 화면·검사·시험          | 설정 화면 40줄, 프로젝트 검사 9줄과 그 시험 13줄을 지웠다 (`617ef82dd`) |

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

프로젝트 폴더에 PDF가 하나라도 있으면, 프로젝트 페이지의 링크 묶음(여기서 열기, 데모, GitHub) 끝에 "발표 자료 보기" 버튼이 생긴다. 직접 짠 페이지와 템플릿 페이지(카드, 키노트, 벤토, 개발자 도구 등)가 모두 같은 버튼을 쓴다.

누르면 미리보기 앱이 맨 앞으로 오고 그 PDF가 열린다. PDF가 여럿이면 이름순으로 첫 파일이다. 거기서 ⇧⌘F를 누르면 바로 발표 화면이다. 휴대폰에서는 창이 없으니 PDF를 새 탭으로 연다.

![Finder 프로젝트 폴더의 PDF가 프로젝트 페이지 버튼과 미리보기 슬라이드쇼로 이어지는 흐름과 슬라이드쇼 키](./images/project-slides-flow.svg 'PDF를 폴더에 넣는 것만으로 버튼이 생기고, ⇧⌘F로 발표 화면이 된다')

## 확인

`apps/react/e2e/preview-slideshow.spec.ts`의 네 시험이다.

- "⇧⌘F로 지금 쪽부터 한 쪽씩 보이고, Esc로 끝내면 끝낸 쪽을 보인다"
- "보기 메뉴에서 시작하고, 조절 막대는 움직이면 보였다가 가만히 있으면 사라진다"
- "프로젝트 폴더에 PDF가 있으면 Safari에 버튼이 있고, 이름순 첫 PDF를 미리보기에서 연다"
- "프로젝트 폴더에 PDF가 없으면 버튼이 없다"

슬라이드쇼 커밋(`21b84be16`)은 `Slideshow.tsx` 192줄과 CSS 98줄이 대부분이다. 폴더 방식으로 바꾼 커밋(`617ef82dd`)에서 이 시험 파일을 62줄 고쳤다.

## 남은 것·배운 것

- PDF가 여럿이면 이름순 첫 파일만 연다. 발표 자료가 둘 이상인 프로젝트는 이름으로 순서를 정해야 한다.
- 휴대폰에서는 슬라이드쇼 없이 새 탭으로 PDF를 연다.
- 전체 화면은 브라우저가 허락할 때만 된다. 허락하지 않아도 슬라이드쇼는 창 안 검은 화면으로 돈다.
- 처음 만든 `slides` 칸은 하루 만에 뺐다. "어디에 붙일까"를 새 칸으로 풀기 전에, 이미 있는 구조(프로젝트 폴더)가 그 관계를 표현하고 있는지 먼저 보는 편이 빨랐다.

## 관련 글

- [Finder의 이력서 PDF와 그림을 미리보기 앱으로 열기](/memo/finder-files)
- [프로젝트를 앱으로 - 배포한 사이트를 창 안에 띄우기](/memo/project-apps)
- [사진 앱 - 프로젝트 화면을 앨범으로](/memo/photos-app)

#MacFolio #프론트엔드 #미리보기 #슬라이드쇼 #pdfjs #FullscreenAPI #프로젝트
