---
title: 글 안의 저장소 문서 링크를 Finder에서 열기
date: 2026-10-19
category: 개발 기록/MacFolio/프론트엔드/앱
summary: 블로그 글의 저장소 문서 링크(GitHub의 docs/*.md, README, CONTRIBUTING)를 누르면 새 탭의 GitHub 대신 사이트의 Finder에서 그 문서를 연다. 사이트 빌드에 이미 포함된 문서라 외부 사이트로 이동할 필요가 없다.
---

## 배경

블로그 글에 "따라 하기" 절을 넣으면서 `docs/rollback-drill.md` 같은 저장소 문서 링크를 많이 추가했다. 링크는 GitHub 주소(`https://github.com/hyeoniverse/MacFolio/blob/main/docs/…`)라서 누르면 새 탭에 GitHub가 열렸다. 그런데 이 문서들은 이미 사이트 빌드에 포함되어 있다. Finder의 '문서' 폴더는 빌드 시각에 README, CONTRIBUTING, `docs/*.md`를 번들에 넣어 표시하고, Apple 메뉴의 '개인정보 처리 방침'도 `docs/privacy.md`를 Finder에서 연다. 데스크톱 화면에서 글을 읽다가 외부 사이트로 이동할 필요가 없었다. 작업은 [#272](https://github.com/hyeoniverse/MacFolio/pull/272)에서 했다.

## 구현

| 방법                                            | 장점                                     | 단점                                                      |
| ----------------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| 글의 링크를 사이트 주소로 바꾸기                | 링크가 짧다                              | GitHub에서 글(저장소의 md)을 볼 때 링크가 동작하지 않는다 |
| 링크는 GitHub 주소로 두고, 클릭 시각에 가로채기 | 저장소와 사이트 양쪽에서 링크가 동작한다 | 가로챌 주소 규칙이 필요하다                               |

두 번째를 선택했다. `repoDocs.ts`에 `bundledDocOf(href)`를 추가했다. 주소가 `…/blob/main/`으로 시작하고, 경로가 Finder 번들에 들어가는 형식(`README.md`, `CONTRIBUTING.md`, `docs/<이름>.md`)이면 그 경로를 반환한다. `#제목`이 붙은 링크는 GitHub에서 연다. Finder 본문에는 제목 앵커가 없기 때문이다.

```ts
export function bundledDocOf(href: string | undefined): string | null {
	const prefix = `${REPO_URL}/blob/main/`;
	if (!href?.startsWith(prefix) || href.includes('#') || href.includes('?')) return null;
	// …경로를 정규화해 번들 문서 형식이면 그 경로
}
```

글 본문의 링크 컴포넌트(`MarkdownLink`)는 이 경로가 있으면 [`preventDefault()`](https://developer.mozilla.org/ko/docs/Web/API/Event/preventDefault)로 기본 동작을 막고 `requestFinderDoc(경로)`와 `openApp('finder')`를 호출한다. Apple 메뉴의 개인정보 처리 방침과 같은 경로다. ⌘·Ctrl·Shift를 누른 채 클릭하거나 가운데 버튼으로 클릭하면 브라우저 기본 동작대로 GitHub를 새 탭에 연다.

![링크 클릭 시 bundledDocOf가 경로를 반환하면 Finder에서 열고, null이면 GitHub 새 탭으로 연다](./images/doc-links-in-finder-flow.svg '보조 키를 누른 클릭과 번들에 없는 경로는 브라우저 기본 동작으로 처리한다')

번들 문서 목록(`docsBundle.ts`)을 메모 앱에서 import하지 않고 경로 형식만 검사한 이유는, 그 목록이 문서 원문을 모두 포함하고 있어 메모 앱 번들 크기가 커지기 때문이다. 번들 규칙이 바뀌면 두 곳을 함께 수정해야 하므로, 정규식 옆에 `docsBundle.ts`의 [glob](https://vite.dev/guide/features#glob-import)과 같아야 한다는 주석을 남겼다.

## 확인

- 단위 시험(`repoDocs.test.ts`): docs 문서·README는 경로를, `#제목`이 붙은 링크·다른 브랜치·`ops/deploy.sh`·`docs/images/` 아래·외부 주소는 null을 반환한다.
- E2E(`memo.spec.ts`): 'MacFolio 백엔드 한 장으로 보기' 글의 `docs/backend-design.md` 링크를 누르면 새 탭이 열리지 않고 Finder에 그 문서가 열린다.

## 이후 변경: 텍스트 편집기에서 열기

10월 21일 Markdown 문서를 여는 텍스트 편집기 앱([#309](https://github.com/hyeoniverse/MacFolio/pull/309))이 추가되면서, 같은 링크는 Finder 대신 텍스트 편집기에서 열린다. 링크 판별(`bundledDocOf`)은 그대로이고, 열기 처리만 `useOpenLink`의 `openDocument`로 바뀌었다. E2E 시험 이름도 "글 안의 저장소 문서 링크(GitHub의 docs/*.md)는 텍스트 편집기에서 그 문서를 연다"로 바뀌었다.

![메모 글의 docs/backend-design.md 링크를 눌러 텍스트 편집기에 문서가 열린 화면](./images/doc-links-in-finder-opened.jpg '현재 동작. 링크를 누르면 새 탭 없이 메모 창 위에 텍스트 편집기가 열리고 backend-design.md를 표시한다')

## 남은 것

`ops/*.sh`나 워크플로처럼 문서가 아닌 저장소 파일은 계속 GitHub에서 연다. Finder가 코드 파일을 표시하게 되면 같은 방법으로 범위를 넓힐 수 있다.

## 관련 글

- [Finder 앱 - 사이트를 파일처럼 둘러보기](/memo/finder-app): 저장소 문서를 표시하는 Finder 앱
- [MacFolio 백엔드 한 장으로 보기 - 구성도와 설계 결정](/memo/backend-design): E2E 시험에서 링크를 누르는 글
- [10월 21일 - 이력서를 Markdown 한 장으로, 텍스트 편집기, 위젯, 처음 온 사람을 위한 둘러보기](/memo/day-1021): 텍스트 편집기 앱을 만든 날의 기록

#MacFolio #프론트엔드 #Finder #메모앱
