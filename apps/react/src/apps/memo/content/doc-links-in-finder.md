---
title: 글 안의 저장소 문서 링크를 Finder에서 열기
date: 2026-10-19
category: 개발기/MacFolio/프론트엔드
summary: 블로그 글에 단 저장소 문서 링크(GitHub의 docs/*.md, README, CONTRIBUTING)를 누르면 새 탭의 GitHub 대신 사이트의 Finder에서 그 문서를 연다. 사이트에 이미 묶여 있는 문서라 밖으로 나갈 까닭이 없다.
---

## 왜

블로그 글에 "따라 하기" 절을 넣으면서 `docs/rollback-drill.md` 같은 저장소 문서 링크를 많이 달았다. 링크는 GitHub 주소(`https://github.com/hyeoniverse/MacFolio/blob/main/docs/…`)라서 누르면 새 탭에 GitHub가 열렸다. 그런데 이 문서들은 이미 사이트에 묶여 있다. Finder의 '문서' 폴더가 빌드할 때 README, CONTRIBUTING, `docs/*.md`를 함께 묶어 보여 주고, Apple 메뉴의 '개인정보 처리 방침'도 `docs/privacy.md`를 Finder에서 연다. 데스크톱 안에서 읽던 흐름을 끊고 밖으로 나갈 까닭이 없었다.

## 어떻게

| 방법                                        | 좋은 점                        | 나쁜 점                                          |
| ------------------------------------------- | ------------------------------ | ------------------------------------------------ |
| 글의 링크를 사이트 주소로 바꾸기            | 링크가 짧다                    | GitHub에서 글을 볼 때(저장소의 md) 링크가 깨진다 |
| 링크는 GitHub 주소로 두고, 누를 때 가로채기 | 저장소에서도 사이트에서도 맞다 | 가로챌 주소 규칙이 필요하다                      |

두 번째를 골랐다. `repoDocs.ts`에 `bundledDocOf(href)`를 더했다. 주소가 `…/blob/main/`으로 시작하고, 경로가 Finder가 묶는 모양(`README.md`, `CONTRIBUTING.md`, `docs/<이름>.md`)이면 그 경로를 돌려준다. `#제목`이 붙은 링크는 GitHub에서 연다. Finder 본문에는 제목 앵커가 없기 때문이다.

```ts
export function bundledDocOf(href: string | undefined): string | null {
	const prefix = `${REPO_URL}/blob/main/`;
	if (!href?.startsWith(prefix) || href.includes('#') || href.includes('?')) return null;
	// …경로를 정리해 묶는 문서 모양이면 그 경로
}
```

글 본문의 링크(`MarkdownLink`)는 이 경로가 있으면 기본 동작을 막고 `requestFinderDoc(경로)`와 `openApp('finder')`를 부른다. Apple 메뉴의 개인정보 처리 방침과 같은 길이다. ⌘·Ctrl·Shift를 누르거나 가운데 버튼으로 누르면 브라우저 기본대로 GitHub를 새 탭에 연다.

묶을 문서 목록(`docsBundle.ts`)을 메모 앱에서 불러오지 않고 경로 모양만 본 것은, 그 목록이 문서 원문을 모두 담고 있어 메모 앱 묶음이 커지기 때문이다. 묶는 규칙이 바뀌면 두 곳을 함께 고쳐야 해서, 정규식 옆에 docsBundle.ts의 glob과 같아야 한다고 적어 두었다.

## 확인

- 단위 시험(`repoDocs.test.ts`): docs 문서·README는 경로를, `#제목`이 붙은 링크·다른 브랜치·`ops/deploy.sh`·`docs/images/` 아래·바깥 주소는 null을 돌려준다.
- E2E(`memo.spec.ts`): 'MacFolio 백엔드 한 장으로 보기' 글의 `docs/backend-design.md` 링크를 누르면 새 탭이 뜨지 않고 Finder에 그 문서가 열린다.

## 남은 것

`ops/*.sh`나 워크플로 같은 문서가 아닌 저장소 파일은 그대로 GitHub에서 연다. Finder가 코드 파일을 보여 주게 되면 같은 방법으로 넓힐 수 있다.

#MacFolio #프론트엔드 #Finder #메모앱
