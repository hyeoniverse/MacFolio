---
title: desktop-core로 메모 로직을 옮기며 값 검사와 localStorage 읽기·쓰기 나누기
date: 2026-10-09
category: 개발 기록/MacFolio/설계
summary: 메모 앱의 글 읽기·정렬, 태그, 폴더 정리, 찾기, 글 검사를 packages/desktop-core로 옮겼다. localStorage를 직접 읽던 세 파일은 값 검사는 core, 브라우저 읽기·쓰기는 앱으로 나눴고, 목록에 표시할 글을 정하던 hook 안의 계산도 core의 noteView로 분리했다.
---

창 관리를 [desktop-core로 옮긴 다음](/memo/desktop-core-windows) 단계로, 메모 앱의 로직을 옮겼다. 작업은 [#140](https://github.com/hyeoniverse/MacFolio/pull/140)에서 했고, desktop-core 분리 계획([#16](https://github.com/hyeoniverse/MacFolio/issues/16))의 두 번째 단계다.

메모 앱은 이 사이트에서 가장 큰 앱이다. 지금 읽는 블로그가 바로 메모 앱이고, 폴더·태그·검색·정렬·고정·잠금·찾기·글쓰기가 모두 들어 있다. 앱 폴더(`apps/react/src/apps/memo`)에는 컴포넌트와 hook 사이에 순수 로직 파일이 섞여 있었다. 어떤 파일이 화면이고 어떤 파일이 규칙인지 파일 이름만으로는 구분할 수 없었다.

![메모 앱. 왼쪽에 폴더와 태그, 가운데 글 목록, 오른쪽에 본문](./images/desktop-core-memo-window.jpg '폴더·태그·정렬·선택한 글을 정하는 계산을 이번에 core로 옮겼다')

## 옮긴 것

메모 폴더에는 React 컴포넌트·hook과 함께 순수 로직 파일이 섞여 있었다. 이번에 옮긴 것은 이 파일들이다.

| 파일                      | 하는 일                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `posts.ts`                | 머리말 읽기, 폴더 트리, 검색·검색 조건, 서버 글 겹치기, 이전·다음 글 |
| `tags.ts`, `tagFilter.ts` | 본문의 #태그 수집, 태그 포함·제외 필터링                             |
| `organize.ts`             | 관리자가 만든 폴더, 옮긴 글, 고정, 잠금                              |
| `arrange.ts`              | 정렬과 날짜별 묶기                                                   |
| `find.ts`                 | 본문 찾기 (대소문자, 단어 단위), 최근 검색어                         |
| `postRules.ts`            | 글을 저장하기 전 검사 (제목·요약·본문 길이, 있는 날짜인지, 폴더)     |
| `caption.ts`              | 이미지 캡션 속 링크 나누기                                           |
| `repository/`             | 글 저장소 인터페이스와 Markdown 파일로 만든 구현                     |

시험도 함께 옮겼다. 처음부터 Node 환경에서 실행하던 시험이라 수정 없이 통과했다.

옮기는 기준은 하나였다. "React나 브라우저 없이 실행할 수 있는가". 컴포넌트, hook, `localStorage`·`fetch`를 호출하는 파일은 앱에 남기고, 입력을 받아 값을 반환하는 파일만 옮겼다. 서버에 글을 읽고 쓰는 `postsApi.ts`·`organizationApi.ts`도 네트워크를 쓰므로 앱에 남았다. core에는 저장소의 인터페이스와 Markdown 파일로 만든 구현만 간다.

## localStorage를 쓰던 세 파일

`arrange.ts`, `find.ts`, `organize.ts`는 대부분 순수 함수였는데, 파일 끝에 [`localStorage`](https://developer.mozilla.org/ko/docs/Web/API/Window/localStorage)를 읽고 쓰는 함수가 하나씩 있었다. core의 `tsconfig`에는 DOM 타입이 없어서[^dom], 이대로 옮기면 타입 검사에서 오류가 난다.

`loadArrangement`를 보면 하는 일이 둘이다.

```ts
export function loadArrangement(): Arrangement {
	try {
		const saved = JSON.parse(localStorage.getItem(ARRANGEMENT_KEY) ?? 'null') as Partial<Arrangement> | null;
		if (!saved) return DEFAULT_ARRANGEMENT;
		return {
			sort: saved.sort === 'title' ? 'title' : 'date',
			order: saved.order === 'asc' ? 'asc' : 'desc',
			groupByDate: typeof saved.groupByDate === 'boolean' ? saved.groupByDate : DEFAULT_ARRANGEMENT.groupByDate,
		};
	} catch {
		return DEFAULT_ARRANGEMENT;
	}
}
```

브라우저 저장소에서 값을 읽는 일과, 읽은 값이 올바른 형식인지 검사하는 일이다. 뒤쪽은 저장소가 `localStorage`든 Vue 앱의 다른 저장소든 같다. 그래서 다음처럼 나눴다.

- core: `parseArrangement(value: unknown)`. 어떤 값을 받아도 올바른 보기 설정을 반환한다
- 앱: `memoStorage.ts`. `localStorage`에서 읽어 JSON으로 풀고 `parseArrangement`에 넘긴다

나누는 방법은 몇 가지가 있었다.

| 방법                                 | 좋은 점                         | 나쁜 점                                                                |
| ------------------------------------ | ------------------------------- | ---------------------------------------------------------------------- |
| core `tsconfig`에 DOM 타입을 넣는다  | 코드를 수정 없이 옮긴다         | core가 브라우저에 의존한다. 창 관리에서 세운 규칙을 어긴다             |
| core가 `Storage` 인터페이스를 받는다 | 저장도 core가 맡는다            | 읽기·쓰기 키 이름까지 core가 알아야 한다. 앱마다 저장소가 다를 수 있다 |
| **검사는 core, 읽기·쓰기는 앱**      | core는 값만 다룬다. 시험이 쉽다 | 앱에 작은 파일(`memoStorage.ts`, 52줄)이 하나 추가된다                 |

![localStorage 읽기와 값 검사의 나눔](./images/desktop-core-memo-split.svg '저장소에서 읽는 일은 앱의 memoStorage, 값 검사는 core의 parseArrangement')

최근 검색어도 같은 방식이다. "같은 검색어는 맨 앞으로, 최대 다섯 개" 규칙은 core의 `addRecentFind`가 처리하고, 앱의 `rememberFind`는 그 결과를 저장만 한다.

`organize.ts`에는 하나가 더 있었다. 예전에는 방문자도 폴더를 만들고 글을 옮길 수 있었고, 그 내용을 방문자 브라우저에 저장했다. 지금은 관리자만 정리하고 서버에 저장하는데, 그 시기에 방문자 브라우저에 남은 값을 삭제하는 `discardVisitorOrganization`이 메모 앱을 열 때마다 실행되고 있었다. 방명록 시절의 `macfolio:memos`를 삭제하는 코드도 남아 있었다. 남은 값은 어떤 코드도 읽지 않고 크기도 몇 바이트라, 옮기는 대신 이 정리 코드와 그 시험을 삭제했다.

시험도 같이 나뉘었다. 전에는 `localStorage`를 [`vi.stubGlobal`](https://vitest.dev/api/vi.html#vi-stubglobal)로 모의(mock) 객체로 바꾸고 잘못된 값을 넣었는데, 이제 core 시험은 `parseArrangement({ sort: 'size', order: 1 })`처럼 값을 직접 넘긴다. 모의 객체가 필요한 시험은 앱의 `memoStorage.test.ts`에 세 개만 남았다.

## hook 안에 있던 계산

`useNoteView`는 현재 보기 조건(폴더, 검색어, 검색 조건, 태그, 정렬, 선택한 글)을 상태로 보관하고, 그 상태로 목록에 표시할 글을 계산하는 hook이다. 상태 보관은 React가 맡을 일이지만 계산은 React와 관계가 없다.

```ts
const visible = useMemo(
	() =>
		inTrash
			? filterPosts(trash, ALL_CATEGORY, query)
			: sortBy(
					filterPosts(
						inCategory,
						ALL_CATEGORY,
						query,
						editing ? filter : filter === 'draft' || filter === 'scheduled' ? null : filter
					),
					arrangement
				),
	[inTrash, trash, inCategory, query, filter, editing, arrangement]
);
```

"임시 저장·예약 글 조건은 관리자에게만"이라는 규칙이 중첩된 삼항 연산자 안에 들어 있었다. 이 계산을 core의 `noteView.ts`로 분리했다.

| 함수          | 하는 일                                                |
| ------------- | ------------------------------------------------------ |
| `postsInView` | 폴더면 그 폴더의 글, 태그로 보기면 고른 태그에 맞는 글 |
| `filterFor`   | 임시 저장·예약 조건은 관리자에게만                     |
| `listPosts`   | 최근 삭제된 항목은 검색어로만, 나머지는 필터링 후 정렬 |
| `selectPost`  | 선택한 글이 목록에 없으면 맨 위의 글 (고정된 글 먼저)  |
| `folderPaths` | 폴더 트리의 모든 경로                                  |

hook에는 상태와 `useMemo`, 주소 막대를 바꾸는 effect만 남았다. 규칙마다 함수 이름이 생겨서 규칙별로 시험을 하나씩 작성했다.

```ts
it('임시 저장·예약 조건은 관리자에게만', () => {
	expect(filterFor('draft', false)).toBeNull();
	expect(filterFor('draft', true)).toBe('draft');
	expect(filterFor('pinned', false)).toBe('pinned');
});
```

## import 바꾸기

옮긴 파일을 import하는 곳이 34개 파일에 있었다. `./posts`, `../posts`, `@/apps/memo/posts`처럼 경로 형식이 서로 달라서, 문자열 치환 대신 import 경로를 각 파일 위치 기준으로 해석해 옮긴 파일을 가리키는지 확인하는 스크립트로 바꿨다. 같은 import 안에서도 저장 함수(`loadArrangement` 등)는 `memoStorage`로, 나머지는 `@macfolio/desktop-core/memo`로 나눴다.

core 패키지는 `@macfolio/desktop-core`(창 관리)와 `@macfolio/desktop-core/memo`(메모)로 진입점을 나눴다([subpath exports](https://nodejs.org/api/packages.html#subpath-exports)). 메모 로직의 `sortBy`, `Post` 같은 이름이 창 관리 쪽 이름과 한 진입점에 섞이지 않게 하기 위해서다.

![useNoteView 안의 계산이 core의 다섯 함수로 나뉘고, hook에는 상태와 effect만 남았다](./images/desktop-core-memo-noteview.svg 'postsInView → filterFor → listPosts → selectPost 순서로 목록과 선택한 글이 정해진다')

## 확인

- core 시험 120개 (창 관리 23 + 메모 97), 앱 시험 290개. 새로 쓴 `noteView.test.ts`에 9개가 있다
- 모의 객체가 필요한 시험은 앱의 `memoStorage.test.ts`에 세 개만 남았다
- Playwright 354개 (데스크톱·iPhone·Android). 메모의 폴더·태그·검색·정렬·찾기·글쓰기 시험이 수정 없이 통과했다
- 커밋은 파일 62개, +498/−208이다. 변경 파일 대부분은 경로만 바뀐 이동과 import 수정이다. `useNoteView.ts`는 68줄이 바뀌어 계산이 빠지고 상태만 남았다

## 남은 것과 배운 것

서버(apps/api)도 폴더 정리 규칙을 별도로 구현해 같은 검사를 했다. 같은 날 [#142](https://github.com/hyeoniverse/MacFolio/pull/142)에서 [화면과 서버가 같은 규칙을 쓰게](/memo/desktop-core-shared-rules) 했다.

배운 것: hook 안의 계산은 React와 관계없는 규칙을 React 코드처럼 보이게 한다. 중첩된 삼항 연산자 속의 "관리자에게만" 규칙은 함수 이름이 없어서 시험도 없었다. 함수로 분리해 이름을 붙이자 시험 한 줄로 동작을 고정할 수 있었다. 그리고 `localStorage`처럼 브라우저 API를 쓰는 일을 "읽기"와 "검사"로 나누면, 검사 쪽은 어느 환경에서나 실행되는 순수 함수가 된다.

## 관련 글

- [창 관리 규칙을 useSyncExternalStore로 구독하는 프레임워크 무관 패키지로 옮기기](/memo/desktop-core-windows): desktop-core 분리의 첫 단계
- [결과 값을 돌려주는 store로 재생 대기열과 audio 요소 제어 분리하기](/memo/desktop-core-music): 세 번째 단계
- [package.json exports 조건으로 Vite에는 소스, Node에는 빌드한 JS 제공하기](/memo/desktop-core-shared-rules): 글 검사 규칙을 API와 함께 쓰기

[^dom]: `tsconfig.json`의 `lib`에 `DOM`이 없으면 `window`, `localStorage` 같은 브라우저 전역 이름의 타입이 없어 `Cannot find name` 오류가 난다. core의 설정은 [창 관리 글](/memo/desktop-core-windows)에서 설명했다.

#MacFolio #메모앱 #리팩터링
