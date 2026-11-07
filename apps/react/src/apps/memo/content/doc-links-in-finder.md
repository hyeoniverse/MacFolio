---
title: 클릭 가로채기로 GitHub 문서 링크를 사이트에 번들된 문서로 열기
date: 2026-10-19
category: 개발 기록/MacFolio/인터랙션·브라우저 API
series: Finder
seriesOrder: 4
summary: 블로그 글의 저장소 문서 링크(GitHub의 docs/*.md, README, CONTRIBUTING)를 누르면 새 탭의 GitHub 대신 사이트의 Finder에서 그 문서를 연다. 사이트 빌드에 이미 포함된 문서라 외부 사이트로 이동할 필요가 없다.
---

## 배경

MacFolio 저장소에는 코드 말고도 Markdown 문서가 있다. `README.md`, `CONTRIBUTING.md`, 그리고 `docs/` 폴더 아래의 `backend-design.md`(백엔드 구성), `rollback-drill.md`(배포 되돌리기 연습 절차) 같은 문서다. 블로그 글에 "따라 하기" 절을 넣으면서 이런 저장소 문서로 가는 링크를 많이 추가했다.

링크 주소는 GitHub의 파일 보기 주소였다. GitHub는 저장소 파일을 `https://github.com/<소유자>/<저장소>/blob/<브랜치>/<경로>` 형식의 주소로 보여 준다. 예를 들어 `docs/rollback-drill.md`의 주소는 다음과 같다.

```text
https://github.com/hyeoniverse/MacFolio/blob/main/docs/rollback-drill.md
```

블로그 본문의 바깥 링크는 새 탭으로 열리므로, 이 링크를 누르면 브라우저에 새 탭이 생기고 GitHub 페이지가 열렸다.

![GitHub에서 연 docs/backend-design.md](./images/doc-links-in-finder-github.jpg '수정 전 동작. 글의 문서 링크를 누르면 새 탭에 GitHub의 파일 보기 화면이 열린다. 왼쪽에 저장소 파일 목록, 가운데에 Markdown을 렌더링한 본문이 보인다')

그런데 ==이 문서들은 이미 사이트 빌드에 포함되어 있다.== Finder의 '문서' 폴더는 빌드 시각에 README, CONTRIBUTING, `docs/*.md`를 번들에 넣어 표시한다. 번들은 빌드 도구(MacFolio는 Vite)가 소스 파일을 묶어 만든 배포용 JavaScript 파일이다. Vite의 `import.meta.glob`[^glob]은 `'docs/**/*.md'` 같은 파일 패턴에 맞는 파일을 빌드 시각에 모두 찾아 모듈로 가져오는 기능이고, `?raw` 옵션을 붙이면 파일 내용을 문자열 그대로 번들에 넣는다. Apple 메뉴의 '개인정보 처리 방침'도 이렇게 번들된 `docs/privacy.md`를 Finder에서 연다.

같은 문서가 사이트 안에 있으므로, 데스크톱 화면에서 글을 읽다가 외부 사이트로 이동할 이유가 없었다. 글의 문서 링크도 사이트 안에서 열리게 했다. 작업은 [#272](https://github.com/hyeoniverse/MacFolio/pull/272)에서 했다.

## 구현

### 두 가지 방법 비교

| 방법                                            | 장점                                     | 단점                                                      |
| ----------------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| 글의 링크를 사이트 주소로 바꾸기                | 링크가 짧다                              | GitHub에서 글(저장소의 md)을 볼 때 링크가 동작하지 않는다 |
| 링크는 GitHub 주소로 두고, 클릭 시각에 가로채기 | 저장소와 사이트 양쪽에서 링크가 동작한다 | 가로챌 주소 규칙이 필요하다                               |

블로그 글은 저장소의 `apps/react/src/apps/memo/content/*.md` 파일이라 GitHub에서도 읽힌다. 링크를 `/docs/rollback-drill.md` 같은 사이트 주소로 바꾸면 GitHub에서 글을 읽는 사람에게는 존재하지 않는 경로가 된다. 그래서 두 번째 방법을 선택했다.

### 주소 판별: bundledDocOf

`repoDocs.ts`에 `bundledDocOf(href)`를 추가했다. 링크 주소를 받아, 사이트 번들에 들어 있는 문서를 가리키면 그 저장소 경로를 반환하고 아니면 `null`을 반환한다. 조건은 두 가지다.

1. 주소가 `https://github.com/hyeoniverse/MacFolio/blob/main/`으로 시작한다. 다른 브랜치(`blob/dev/`)의 문서는 사이트에 번들된 `main`의 문서와 내용이 다를 수 있다.
2. 그 뒤의 경로가 Finder 번들에 들어가는 형식(`README.md`, `CONTRIBUTING.md`, `docs/<이름>.md`)이다. `docs/images/` 아래의 그림은 제외한다.

```ts
export function bundledDocOf(href: string | undefined): string | null {
	const prefix = `${REPO_URL}/blob/main/`;
	if (!href?.startsWith(prefix) || href.includes('#') || href.includes('?')) return null;
	// …경로를 정규화해 번들 문서 형식이면 그 경로
}
```

`#제목`이 붙은 링크는 GitHub에서 연다. `#` 뒤의 부분(프래그먼트)은 문서 안의 특정 제목으로 이동하라는 뜻인데, Finder 본문에는 제목 앵커(제목마다 붙는 `id`)가 없어 그 위치로 이동할 수 없기 때문이다.

![bundledDocOf가 주소를 접두어와 경로로 나눠 검사하는 도식과 입력별 반환값](./images/doc-links-in-finder-url-match.svg '접두어가 맞고 경로가 번들 형식일 때만 경로를 반환한다. #제목, 문서가 아닌 파일, 그림 폴더, 다른 브랜치는 null이다')

### 클릭 가로채기

링크를 누르면 브라우저는 `click` 이벤트를 발생시킨 뒤, 그 이벤트의 기본 동작(default action)으로 링크 주소를 연다. 이벤트 핸들러에서 [`preventDefault()`](https://developer.mozilla.org/ko/docs/Web/API/Event/preventDefault)를 호출하면 이 기본 동작이 취소된다. 링크의 `href`는 그대로 남으므로 마우스를 올렸을 때 상태 표시줄에 GitHub 주소가 보이고, 링크 복사도 GitHub 주소로 된다.

글 본문의 링크 컴포넌트(`MarkdownLink`)는 `bundledDocOf`가 경로를 반환하면 `preventDefault()`로 새 탭 열기를 막고 `requestFinderDoc(경로)`와 `openApp('finder')`를 호출한다. Apple 메뉴의 개인정보 처리 방침과 같은 경로다.

| 누른 링크 (접두어 생략)    | `bundledDocOf` 반환값      | 결과                      |
| -------------------------- | -------------------------- | ------------------------- |
| `docs/rollback-drill.md`   | `'docs/rollback-drill.md'` | Finder 창에 문서가 열린다 |
| `docs/backend-design.md#…` | `null`                     | GitHub 새 탭              |
| `ops/deploy.sh`            | `null`                     | GitHub 새 탭              |

==⌘·Ctrl·Shift를 누른 채 클릭하거나 가운데 버튼으로 클릭하면 브라우저 기본 동작대로 GitHub를 새 탭에 연다.== 핸들러는 [`MouseEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)의 `metaKey`·`ctrlKey`·`shiftKey`와 `button`(0이면 주 버튼) 값을 확인해, 보조 키를 눌렀거나 주 버튼이 아니면 아무것도 하지 않고 반환한다. 이런 클릭은 사용자가 "새 탭에서 열기"를 의도한 경우이므로 원래 동작을 유지했다.

![링크 클릭 시 bundledDocOf가 경로를 반환하면 Finder에서 열고, null이면 GitHub 새 탭으로 연다](./images/doc-links-in-finder-flow.svg '보조 키를 누른 클릭과 번들에 없는 경로는 브라우저 기본 동작으로 처리한다')

### 번들 목록 대신 경로 형식을 검사한 이유

번들된 문서 목록은 `docsBundle.ts`에 있다. 이 목록으로 "번들에 있는 문서인지"를 직접 확인하면 정확하지만, 그러려면 메모 앱이 `docsBundle.ts`를 import해야 한다. `docsBundle.ts`는 문서 원문을 문자열로 포함하고 있어, import하는 순간 문서 원문 전체가 메모 앱의 번들에 함께 들어간다. 2026년 11월 기준으로 README·CONTRIBUTING·`docs/` 아래 Markdown은 19개 파일, 원문 약 690KB다. 그러면 블로그 글만 읽는 방문자도 이 원문을 함께 내려받는다.

![메모 앱 청크와 Finder 청크, docsBundle.ts를 import하지 않는 이유](./images/doc-links-in-finder-bundle.svg '메모 앱 청크에는 경로 형식을 검사하는 정규식만 들어간다. 문서 원문은 Finder 청크에만 있다')

그래서 `docsBundle.ts`의 glob 패턴과 같은 규칙을 정규식(`BUNDLED_DOC`)으로 옮겨 경로 형식만 검사했다.

> [!WARNING] 두 곳에 있는 번들 규칙
> 번들 규칙이 바뀌면 두 곳을 함께 수정해야 하므로, 정규식 옆에 `docsBundle.ts`의 [glob](https://vite.dev/guide/features#glob-import)과 같아야 한다는 주석을 남겼다.

## 확인

| 시험                    | 확인하는 것                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 단위 `repoDocs.test.ts` | docs 문서·README는 경로를, `#제목`이 붙은 링크·다른 브랜치·`ops/deploy.sh`·`docs/images/` 아래·외부 주소는 null을 반환   |
| E2E `memo.spec.ts`      | 'MacFolio 백엔드 한 장으로 보기' 글의 `docs/backend-design.md` 링크를 누르면 새 탭이 열리지 않고 Finder에 그 문서가 열림 |

## 이후 변경: 텍스트 편집기에서 열기

10월 21일 Markdown 문서를 여는 텍스트 편집기 앱([#309](https://github.com/hyeoniverse/MacFolio/pull/309))이 추가되면서, 같은 링크는 Finder 대신 텍스트 편집기에서 열린다. 링크 판별(`bundledDocOf`)은 그대로이고, 열기 처리만 `useOpenLink`의 `openDocument`로 바뀌었다. E2E 시험 이름도 "글 안의 저장소 문서 링크(GitHub의 docs/*.md)는 텍스트 편집기에서 그 문서를 연다"로 바뀌었다.

![메모 글의 docs/backend-design.md 링크를 눌러 텍스트 편집기에 문서가 열린 화면](./images/doc-links-in-finder-opened.jpg '현재 동작. 링크를 누르면 새 탭 없이 메모 창 위에 텍스트 편집기가 열리고 backend-design.md를 표시한다')

## 남은 것

`ops/*.sh`나 워크플로처럼 문서가 아닌 저장소 파일은 계속 GitHub에서 연다. Finder가 코드 파일을 표시하게 되면 같은 방법으로 범위를 넓힐 수 있다.

## 관련 글

- [openRequest store로 Finder에서 고른 항목을 다른 앱에서 열기](/memo/finder-app): 저장소 문서를 표시하는 Finder 앱
- [요청 계층과 위험별 설계 결정으로 정리한 MacFolio 백엔드 구성도](/memo/backend-design): E2E 시험에서 링크를 누르는 글
- [10월 21일 - Markdown 이력서, 텍스트 편집기, 위젯, 첫 방문자를 위한 둘러보기](/memo/day-1021): 텍스트 편집기 앱을 만든 날의 기록

[^glob]: Vite 문서의 Glob Import 절에 따르면 `import.meta.glob`은 파일 시스템에서 패턴에 맞는 여러 모듈을 가져오며, `eager: true`를 지정하면 지연 로딩 대신 바로 import하고, `query: '?raw'`를 지정하면 파일 내용을 문자열로 가져온다. [Vite: Glob Import](https://vite.dev/guide/features#glob-import)

<details>
<summary>참고 문헌</summary>

- [Vite: Glob Import](https://vite.dev/guide/features#glob-import)
- [MDN: Event.preventDefault()](https://developer.mozilla.org/ko/docs/Web/API/Event/preventDefault)
- [MDN: MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent)
- [MDN: MouseEvent.button](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button)

</details>

<details>
<summary>사진 출처</summary>

- GitHub 파일 보기 화면: GitHub, [hyeoniverse/MacFolio의 docs/backend-design.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md), 2026년 11월 직접 캡처

</details>

#MacFolio #프론트엔드 #Finder #메모앱
