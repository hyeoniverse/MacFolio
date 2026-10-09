---
title: 메모 로직을 desktop-core로 - localStorage는 어디에 둘까
date: 2026-10-09
category: 프론트엔드/구조·리팩터링
summary: 메모 앱의 글 읽기·정렬, 태그, 폴더 정리, 찾기, 글 검사를 React 앱에서 packages/desktop-core로 옮겼다. 대부분은 처음부터 순수 함수라 경로만 바뀌었는데, 세 파일은 localStorage를 직접 읽고 있었다. 값을 검사하는 일은 core에, 브라우저에 읽고 쓰는 일은 앱에 나눴다. 목록에 무엇을 보일지 정하던 hook 안의 계산도 core로 꺼냈다.
---

창 관리를 [desktop-core로 옮긴 다음](/memo/desktop-core-windows) 단계로, 메모 앱의 로직을 옮겼다.

## 옮긴 것

메모 폴더에는 React 컴포넌트·hook과 함께 순수 로직 파일이 섞여 있었다. 이번에 옮긴 것은 이 파일들이다.

| 파일                      | 하는 일                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `posts.ts`                | 머리말 읽기, 폴더 트리, 검색·검색 조건, 서버 글 겹치기, 이전·다음 글 |
| `tags.ts`, `tagFilter.ts` | 본문의 #태그 모으기, 태그 포함·제외로 거르기                         |
| `organize.ts`             | 관리자가 만든 폴더, 옮긴 글, 고정, 잠금                              |
| `arrange.ts`              | 정렬과 날짜별 묶기                                                   |
| `find.ts`                 | 본문 찾기 (대소문자, 단어 단위), 최근 검색어                         |
| `postRules.ts`            | 글을 저장하기 전 검사 (제목·요약·본문 길이, 있는 날짜인지, 폴더)     |
| `caption.ts`              | 이미지 캡션 속 링크 나누기                                           |
| `repository/`             | 글 저장소 인터페이스와 Markdown 파일로 만든 구현                     |

시험도 함께 옮겼다. 원래부터 Node에서 도는 시험이라 그대로 통과했다.

## localStorage를 쓰던 세 파일

`arrange.ts`, `find.ts`, `organize.ts`는 거의 순수 함수였는데, 끝에 `localStorage`를 읽고 쓰는 함수가 하나씩 붙어 있었다. core의 `tsconfig`에는 DOM 타입이 없어서, 이대로 옮기면 타입 검사에서 걸린다.

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

브라우저에서 꺼내는 일과, 꺼낸 값이 믿을 만한지 확인하는 일이다. 뒤쪽은 저장소가 `localStorage`든 Vue 앱의 다른 무엇이든 똑같다. 그래서 이렇게 나눴다.

- core: `parseArrangement(value: unknown)`. 무엇이 들어와도 맞는 보기 설정을 돌려준다
- 앱: `memoStorage.ts`. `localStorage`에서 읽어 JSON으로 풀고 `parseArrangement`에 넘긴다

최근 검색어도 같다. "같은 말은 맨 앞으로, 다섯 개까지"는 core의 `addRecentFind`가 하고, 앱의 `rememberFind`는 그 결과를 저장만 한다.

`organize.ts`에는 하나가 더 있었다. 예전에는 방문자도 폴더를 만들고 글을 옮길 수 있었고, 그 내용을 방문자 브라우저에 저장했다. 지금은 관리자만 정리하고 서버에 저장하는데, 그때 방문자 브라우저에 남은 값을 지우는 `discardVisitorOrganization`이 메모 앱을 열 때마다 돌고 있었다. 방명록 시절의 `macfolio:memos`를 지우는 코드도 비슷하게 남아 있었다. 남은 값은 아무도 읽지 않고 크기도 몇 바이트라, 옮기는 대신 이 청소 코드와 그 시험을 지웠다.

시험도 따라 나뉘었다. 전에는 `localStorage`를 `vi.stubGlobal`로 흉내 내서 잘못된 값을 넣어 보았는데, 이제 core 시험은 `parseArrangement({ sort: 'size', order: 1 })`처럼 값을 바로 넘긴다. 흉내가 필요한 시험은 앱의 `memoStorage.test.ts`에 세 개만 남았다.

## hook 안에 있던 계산

`useNoteView`는 지금 무엇을 보여 주는지(폴더, 검색어, 검색 조건, 태그, 정렬, 고른 글)를 상태로 갖고, 그것으로 목록에 보일 글을 계산하는 hook이다. 상태는 React의 일이지만 계산은 아니다.

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

"임시 저장·예약 글 조건은 관리자에게만"이라는 규칙이 삼항 연산자 두 겹 안에 묻혀 있었다. 이것을 core의 `noteView.ts`로 꺼냈다.

| 함수          | 하는 일                                                |
| ------------- | ------------------------------------------------------ |
| `postsInView` | 폴더면 그 폴더의 글, 태그로 보기면 고른 태그에 맞는 글 |
| `filterFor`   | 임시 저장·예약 조건은 관리자에게만                     |
| `listPosts`   | 최근 삭제된 항목은 검색어로만, 나머지는 거른 뒤 정렬   |
| `selectPost`  | 고른 글이 목록에 없으면 맨 위의 글 (고정된 글 먼저)    |
| `folderPaths` | 폴더 트리의 모든 경로                                  |

hook에는 상태와 `useMemo`, 주소 막대를 바꾸는 effect만 남았다. 이름이 붙으니 규칙마다 시험을 하나씩 쓸 수 있었다.

```ts
it('임시 저장·예약 조건은 관리자에게만', () => {
	expect(filterFor('draft', false)).toBeNull();
	expect(filterFor('draft', true)).toBe('draft');
	expect(filterFor('pinned', false)).toBe('pinned');
});
```

## import 바꾸기

옮긴 파일을 불러오는 곳이 34개 파일에 있었다. `./posts`, `../posts`, `@/apps/memo/posts`처럼 모양이 제각각이라 문자열 치환 대신, import 경로를 파일 위치에서 풀어서 옮긴 파일을 가리키는지 확인하는 스크립트로 바꿨다. 같은 import 안에서도 저장 함수(`loadArrangement` 등)는 `memoStorage`로, 나머지는 `@macfolio/desktop-core/memo`로 나눴다.

core 패키지는 `@macfolio/desktop-core`(창 관리)와 `@macfolio/desktop-core/memo`(메모)로 입구를 나눴다. 메모 로직의 `sortBy`, `Post` 같은 이름이 창 관리 쪽과 한데 섞이지 않게 하려는 것이다.

## 확인

- core 시험 120개 (창 관리 23 + 메모 97), 앱 시험 290개
- Playwright 354개 (데스크톱·iPhone·Android). 메모의 폴더·태그·검색·정렬·찾기·글쓰기 시험이 그대로 통과했다

서버(apps/api)도 폴더 정리 규칙을 따로 갖고 같은 검사를 한다. 이것을 core와 함께 쓸지는 다음에 정한다.

#MacFolio #메모앱 #리팩터링
