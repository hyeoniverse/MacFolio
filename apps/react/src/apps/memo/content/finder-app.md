---
title: 사이트 데이터를 폴더로 구성한 Finder 앱과 다른 앱에 보내는 열기 요청 store
date: 2026-10-03
category: 개발 기록/MacFolio/프론트엔드
summary: Dock에 Finder 아이콘은 있었지만 눌러도 창이 열리지 않았다. 저장소 문서, 프로젝트, 블로그 글, 앱을 폴더와 파일로 구성해 탐색하는 Finder를 만들었다. 문서는 Finder 안에서 GitHub처럼 렌더링하고(Mermaid 도식 포함), 글은 메모, 프로젝트는 Safari, 앱은 해당 앱으로 연다.
---

Dock 맨 왼쪽의 Finder는 아이콘만 있었고, 눌러도 창이 열리지 않았다. macOS에서 가장 기본이 되는 앱이 구현되지 않은 상태였다. 바탕화면에 폴더를 배치하려면 그 폴더를 열 창도 필요해서, Finder부터 만들었다. PR은 [#86](https://github.com/hyeoniverse/MacFolio/pull/86)이다.

![Finder 아이콘 보기와 목록 보기](./images/finder-app.jpg '왼쪽: 문서 폴더(아이콘 보기) / 오른쪽: 블로그 폴더(목록 보기)')

## 파일로 표시할 대상

이 사이트에는 실제 파일 시스템이 없다. 대신 사이트에 이미 있는 데이터를 폴더로 구성했다. 왼쪽 즐겨찾기의 네 위치가 그 구성이다.

| 위치          | 내용                                      | 열면                    |
| ------------- | ----------------------------------------- | ----------------------- |
| 문서          | 저장소의 README, CONTRIBUTING, docs/ 문서 | Finder 안에서 표시      |
| 프로젝트      | 포트폴리오 프로젝트 5개                   | Safari의 그 프로젝트 탭 |
| 블로그        | 블로그 글 (카테고리가 폴더)               | 메모에서 그 글          |
| 응용 프로그램 | 창이 있는 앱                              | 그 앱                   |

블로그 폴더는 글의 카테고리(`개발기/MacFolio/백엔드`)를 그대로 폴더 경로로 쓴다. 폴더의 수정일은 폴더 안 가장 최근 글의 날짜다. 문서 폴더에는 빈 `이력서` 폴더도 하나 만들었다. 저장소가 공개라 넣은 파일은 누구나 내려받을 수 있으므로, 공개용 이력서를 준비한 뒤에 추가하기로 했다.

트리 생성은 React와 분리된 순수 함수(`files.ts`)로 구현하고 단위 시험을 작성했다. 화면은 이 트리를 렌더링만 한다.

| 방법                                        | 장점                                 | 단점                                                               |
| ------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| 파일 목록(JSON)을 별도로 작성               | 실제 파일 시스템처럼 구조가 자유롭다 | 글·프로젝트가 추가될 때마다 목록을 직접 수정해야 한다              |
| GitHub API로 저장소 트리를 실행 시각에 조회 | 항상 최신                            | 요청 한도·지연. 블로그 글·앱처럼 파일이 아닌 항목은 표현할 수 없다 |
| **기존 데이터에서 트리를 계산**             | 글·프로젝트·앱이 추가되면 자동 반영  | "파일"의 의미가 위치마다 다르다(열었을 때 동작이 다르다)           |

셋째를 선택했다. 위치마다 "열었을 때의 동작"만 다르게 정의하면, 트리 구조는 하나의 함수로 생성할 수 있다.

## macOS Finder와 같은 조작

| 기능          | 동작                                                                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 선택과 열기   | 클릭하면 파란색으로 선택, 더블 클릭이나 Enter로 열기. 빈 곳을 클릭하면 선택 해제                                                                                                              |
| 키보드        | 방향키로 선택 이동. 아이콘 보기의 위아래 이동은 한 줄 단위인데, 한 줄의 항목 수는 창 폭에 따라 다르므로 `grid-template-columns`의 계산값에서 실제 열 개수를 읽는다. ⌘↑는 상위 폴더, ⌘↓는 열기 |
| 뒤로·앞으로   | 이동한 폴더와 문서를 기록한다. 브라우저 방문 기록처럼, 뒤로 이동한 뒤 다른 위치로 가면 앞쪽 기록은 삭제한다                                                                                   |
| 경로 막대     | 아래쪽에 현재 위치까지의 폴더를 표시하고, 클릭하면 그 폴더로 이동                                                                                                                             |
| 이름으로 찾기 | 현재 폴더가 아니라 모든 위치에서 이름에 검색어가 포함된 항목을 표시                                                                                                                           |

## 저장소 문서를 Finder에서 읽기

![Finder에서 읽는 저장소 문서](./images/finder-doc.jpg '백엔드 설계 문서의 Mermaid 구성도도 도식으로 렌더링한다')

문서는 빌드 시각에 Vite의 [`import.meta.glob`](https://vite.dev/guide/features#glob-import)으로 번들에 넣는다. 저장소의 Markdown 원문을 읽으므로, 문서를 수정하면 다음 배포에서 Finder의 문서도 함께 바뀐다.

GitHub와 같은 결과로 렌더링하기 위해 다음 네 가지를 맞췄다.

| 항목    | 처리                                                                                                                                                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML    | README에는 가운데 정렬과 표를 위한 HTML이 포함되어 있다. GitHub 앱의 README처럼 [`rehype-raw`](https://github.com/rehypejs/rehype-raw)로 렌더링하고 [`rehype-sanitize`](https://github.com/rehypejs/rehype-sanitize)(GitHub와 같은 규칙)로 스크립트를 제거한다 |
| 링크    | 다른 문서를 가리키는 상대 링크(`docs/deployment.md`)는 Finder 안에서 그 문서를 연다. 번들에 없는 파일이나 `#제목` 링크는 GitHub의 해당 파일을 새 탭에서 연다                                                                                                   |
| 그림    | `docs/images`의 그림은 번들에 포함하고, 그 밖의 그림은 GitHub 원본 주소에서 불러온다                                                                                                                                                                           |
| Mermaid | 백엔드 설계 문서의 구성도와 ERD는 [Mermaid](https://mermaid.js.org/) 코드 블록이다. Mermaid 라이브러리는 용량이 커서 도식이 있는 문서를 처음 열 때만 불러온다(`import('mermaid')`). 첫 화면 번들 크기는 변하지 않는다                                          |

## 다른 앱에 항목 열기 요청 보내기

글을 열면 메모가, 프로젝트를 열면 Safari가 해당 항목을 표시해야 한다. 그런데 메모는 처음 열 때 코드를 불러오는(lazy) 앱이라, Finder가 요청하는 시각에는 아직 마운트되지 않았을 수 있다.

그래서 작은 store(`openRequest.ts`)에 요청을 저장하고, 받는 앱이 마운트될 때 남은 요청을 읽어 처리하게 했다. 이미 열려 있으면 구독으로 바로 받는다. Safari는 닫힌 탭이면 다시 연다.

```ts
// apps/react/src/shared/lib/openRequest.ts
export const requestOpen = (app: LinkedApp, id: string) => openRequestStore.setState({ request: { app, id } });

export function useOpenRequest(app: LinkedApp, onOpen: (id: string) => void) {
	// …
	useEffect(() => {
		const take = () => {
			const { request } = openRequestStore.getState();
			if (request?.app !== app) return;
			openRequestStore.setState({ request: null });
			handler.current(request.id);
		};
		take(); // 마운트될 때 남아 있던 요청
		return openRequestStore.subscribe(take); // 이미 열려 있으면 바로
	}, [app]);
}
```

![Finder가 requestOpen으로 요청을 저장하고 openApp으로 창을 연다. 메모가 마운트되며 useOpenRequest로 읽는다](./images/finder-app-open-request.svg '요청은 store에 남아 있다가 받는 앱이 읽으면 삭제한다')

| 방법                               | 메모가 아직 코드를 불러오는 중일 때                             |
| ---------------------------------- | --------------------------------------------------------------- |
| `window.dispatchEvent` 같은 이벤트 | 수신하는 리스너가 없어서 요청이 유실된다                        |
| 주소(`/memo/<글>`) 변경            | 메모에는 동작하지만, Safari 탭이나 다른 앱에는 주소 규칙이 없다 |
| **값으로 남는 store**              | 마운트 후 남은 값을 읽어 처리한다                               |

이벤트는 발생 시각에 리스너가 없으면 사라지고, store의 값은 읽을 때까지 남는다. 이 경우에는 store가 맞았다.

## 클릭 이벤트가 발생하지 않던 링크

개발 중에 문서 안 링크를 눌러도 반응이 없는 문제가 있었다. 원인은 [react-markdown](https://github.com/remarkjs/react-markdown)에 전달하는 `components`였다. 렌더링마다 새 함수를 만들어 전달하자, react-markdown이 링크 요소를 매번 다시 마운트했다.

창을 클릭하면 그 창이 맨 앞으로 오면서 다시 렌더링된다. 그래서 `mousedown`을 받은 링크와 `mouseup`을 받은 링크가 서로 다른 DOM 요소가 되고, [`click` 이벤트](https://developer.mozilla.org/ko/docs/Web/API/Element/click_event)가 발생하지 않았다[^click]. `components`를 `useMemo`로 감싸 문서와 화면 모드가 바뀔 때만 새로 만들자 해결됐다.

```tsx
// apps/react/src/apps/finder/DocView.tsx
// 렌더링마다 새 컴포넌트를 넘기면 react-markdown이 요소를 다시 마운트해서,
// 창을 누를 때(맨 앞으로 오며 다시 그린다) 링크가 바뀌어 클릭이 사라진다. 문서·화면 모드가 바뀔 때만 새로 만든다
const components = useMemo<Components>(
	() => ({
		a: ({ node: _node, href = '', children, ...props }) => {
			const target = resolveLink(path, href, DOC_SET);
			// 묶은 문서면 Finder 안에서, 아니면 GitHub를 새 탭으로
		},
		img: /* docs/images면 묶은 그림, 아니면 GitHub 원본 주소 */,
	}),
	[path, dark]
);
```

메모 앱에도 같은 이유로 컴포넌트를 컴포넌트 바깥 상수로 정의하고 주석을 남겨 두었는데, 같은 문제를 다시 겪었다.

## 휴대폰에서는 '파일'

휴대폰에서는 iOS처럼 '파일'이라는 이름으로 홈 화면에 배치한다. 창이 좁으면([컨테이너 쿼리](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries) 600px 이하) 왼쪽 사이드바를 숨기고, 위치 목록을 위쪽에 한 줄로 배치한다.

## 확인

<details>
<summary>단위 시험과 E2E 시험 목록</summary>

- 단위 시험 `files.test.ts`: "즐겨찾기 위치: 문서, 프로젝트, 블로그, 응용 프로그램", "문서: 폴더(이력서 자리)가 위에, 문서는 이름순", "블로그: 카테고리를 폴더로, 폴더가 위에, 글은 최신순, 폴더 수정일은 가장 최근 글", "프로젝트와 앱", "위치에서 항목까지의 폴더들", "위치 전체에서 이름으로 (대소문자 무시)". `repoDocs.test.ts`는 문서 안 링크를 Finder 안에서 열지 GitHub로 보낼지 판단하는 규칙을 검사한다.
- E2E `finder.spec.ts` 6개: 문서 폴더에서 시작해 저장소 문서를 표시하는지, 빈 이력서 폴더의 안내, 목록 보기와 키보드로 선택·열기, 글을 열면 메모가·프로젝트를 열면 Safari가 해당 항목을 여는지, 응용 프로그램에서 앱 열기, 검색 결과가 없을 때의 안내.

</details>

- PR 크기: 파일 21개, +2,434/−3. 그중 616줄은 Mermaid를 추가하면서 바뀐 잠금 파일이고, `Finder.css` 587줄, `Finder.tsx` 355줄, `files.ts` 210줄이다.

## 남은 것과 배운 것

다음 작업은 바탕화면이었다. Finder 트리에 '데스크톱' 폴더를 추가하고, 그 안의 항목을 바탕화면에 아이콘으로 배치하는 계획이었다. 이후 [칸 단위 좌표와 포인터 캡처로 만든 바탕화면 아이콘 선택과 끌기](/memo/desktop-icons)([#259](https://github.com/hyeoniverse/MacFolio/pull/259))으로 구현했고, 빈 이력서 폴더도 [Cloudflare R2와 같은 출처 Worker로 Finder의 PDF·그림을 미리보기 앱에서 열기](/memo/finder-files)([#255](https://github.com/hyeoniverse/MacFolio/pull/255))에서 채웠다.

배운 것: 앱 사이에 열기 요청을 전달할 때는 받는 쪽이 아직 마운트되지 않았을 가능성을 먼저 고려해야 한다. 이벤트는 사라지고 값은 남는다. 그리고 react-markdown의 `components`는 참조가 바뀌면 요소를 다시 마운트한다. 같은 문제를 두 번 겪은 뒤, 이런 객체는 컴포넌트 바깥 상수나 `useMemo`로 정의하는 것을 규칙으로 정했다.

## 관련 글

- [서버 /finder/layout에 저장하는 Finder 파일 시스템과 메모 폴더 동기화](/memo/finder-filesystem)
- [칸 단위 좌표와 포인터 캡처로 만든 바탕화면 아이콘 선택과 끌기](/memo/desktop-icons)
- [글 안의 저장소 문서 링크를 Finder에서 열기](/memo/doc-links-in-finder): 메모 글의 문서 링크도 Finder로

[^click]: `click`은 같은 요소에서 `mousedown`과 `mouseup`이 모두 발생해야 발생한다. 두 이벤트 사이에 요소가 교체되면 `click`이 발생하지 않는다.

#MacFolio #데스크톱 #Finder
