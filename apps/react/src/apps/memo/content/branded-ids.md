---
title: 문자열은 문을 지나야 글 주소가 된다 — PostSlug·FolderPath 브랜드 타입
date: 2026-10-11
category: 개발 기록/MacFolio/아키텍처
summary: 글 주소와 폴더 경로가 어디서나 string이라 주소창 문자열을 그대로 movePost에 넘겨도 컴파일이 됐다. PostSlug·FolderPath 브랜드 타입을 두고 외부 문자열은 다섯 검사 지점을 통과해야 그 타입이 되게 했다. 다른 방법과의 비교, 브랜드를 붙이지 않은 값, 비용을 정리했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 마지막 항목 "`any`, 넓은 `string` 대신 쓸 수 있는 유니언·브랜드 타입 정리 (앱 이름, 폴더 경로, 슬러그)"를 다룬다. [프로필 나누기](/memo/profile-split) 다음 작업이다.

> **브랜드 타입**(branded type)은 `string` 같은 기본 타입에 타입 수준의 표시만 덧붙여, 같은 문자열이라도 검사를 통과한 값과 그렇지 않은 값을 컴파일러가 구별하게 하는 기법이다. 실행 시에는 일반 문자열이다.

## 먼저 집계한 것

작업 전에 넓은 타입이 어디에 남아 있는지 집계했다.

| 대상              | 상태                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `any`             | 프로젝트 전체 0건                                                                                                                                   |
| 앱 이름 `AppName` | 이미 정리됨. 내장 앱 유니언(`'memo' \| 'safari' \| …`)과 프로젝트 앱 브랜드(`string & { [projectApp]: true }`)의 합, 생성 함수 `projectAppName(id)` |
| 배경화면 id       | [템플릿 리터럴 타입](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html) `` `custom:${string}` ``                           |
| 분석·프로젝트     | `EventType`·`Breakdown`·`ProjectLook` 모두 유니언                                                                                                   |
| **글 주소(slug)** | 어디서나 `string`                                                                                                                                   |
| **폴더 경로**     | 어디서나 `string`                                                                                                                                   |

남은 것은 글 주소와 폴더 경로였다. `Post.slug: string`, `Organization.posts: Record<string, string>`, `movePost(org, slug: string, folder: string)`처럼 모두 `string`이었다. 그래서 주소창에서 온 문자열, 끌어 놓는 항목의 id, API 파라미터가 아무 검사 없이 그대로 전달될 수 있었다. 서버는 `SLUG.test()`로 검사했지만 화면은 검사 없이 값을 신뢰했다.

![외부 문자열 다섯 종류가 postSlug()·folderPath() 검사를 통과해야 PostSlug·FolderPath가 된다](./images/branded-ids-boundary.svg '주소창, API 파라미터, 파일 이름, 끌기 id, 요청 본문이 postSlug()·folderPath()를 통과해 PostSlug·FolderPath가 된다. 검사를 거치지 않은 문자열은 tsc 오류')

## 방법 비교

| 방법                                | 실행 시 비용     | 막는 범위                                    | 문제                                                        |
| ----------------------------------- | ---------------- | -------------------------------------------- | ----------------------------------------------------------- |
| 기존 `string`, 서버에서만 정규식    | 없음             | 서버 한 곳                                   | 화면 안에서는 어떤 문자열이든 전달된다                      |
| 타입 별칭 `type PostSlug = string`  | 없음             | 없음 (`string`과 똑같이 취급된다)            | 코드를 읽는 사람에게 주는 힌트에 그친다                     |
| 클래스로 감싸기 (`new Slug(value)`) | 값마다 객체 생성 | 확실하다                                     | `Record`의 키, JSON, URL에 넣을 때마다 문자열로 꺼내야 한다 |
| 브랜드 타입 (선택한 방법)           | 없음             | 검사를 거치지 않은 `string`을 tsc가 거부한다 | 시험 픽스처에 `as`가 붙는다                                 |

slug는 `Record<PostSlug, FolderPath>`의 키로도 쓰이고 JSON으로 서버와 주고받는다. 그래서 실행 시에는 일반 문자열이어야 했다.

## 브랜드 타입

```ts
// packages/desktop-core/src/memo/rules.ts
declare const postSlugBrand: unique symbol;
export type PostSlug = string & { readonly [postSlugBrand]: true };
export type FolderPath = string & { readonly [folderPathBrand]: true };

export const isPostSlug = (value: unknown): value is PostSlug => typeof value === 'string' && POST_SLUG.test(value);
export const postSlug = (value: unknown): PostSlug | null => (isPostSlug(value) ? value : null);
export const folderPath = (value: unknown): FolderPath | null => (isFolderPath(value) ? value : null);
```

![외부 문자열이 postSlug()의 POST_SLUG 검사를 통과하면 같은 문자열의 PostSlug, 실패하면 null이 된다](./images/branded-ids-gate.svg '검사를 통과하면 같은 문자열에 타입 표시만 붙는다. 통과하지 못하면 null')

[`unique symbol`](https://www.typescriptlang.org/docs/handbook/symbols.html#unique-symbol)을 키로 하는 속성을 [교차 타입](https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types)으로 덧붙인 문자열이다. `declare const`라 실행 코드가 생성되지 않으므로 번들 크기와 동작은 바뀌지 않는다. 달라지는 점은 하나다. `string` 값을 `PostSlug` 자리에 넘기면 컴파일 오류가 난다. `PostSlug`를 만드는 방법은 `postSlug()`(또는 타입 가드[^guard] `isPostSlug()`)뿐이고, 이 함수는 `POST_SLUG` 정규식(`/^[\w-]{1,100}$/`)으로 값을 검사한다.

## 검사 지점

외부에서 문자열이 들어오는 다섯 곳을 찾아 각각 검사 함수를 배치했다.

| 문자열의 출처         | 검사 지점                                             | 실패 시 처리                 |
| --------------------- | ----------------------------------------------------- | ---------------------------- |
| 주소창 `/memo/<slug>` | `useNoteView`의 `postSlug(linkedId('memo'))`          | 선택된 글 없음으로 표시      |
| API `@Param('slug')`  | `checkSlug(slug): asserts slug is PostSlug`[^asserts] | 404 응답 (글이 없습니다.)    |
| Markdown 파일 이름    | `createStaticPostRepository`의 `postSlug(이름)`       | 해당 파일을 글 목록에서 제외 |
| 끌어 놓는 항목의 id   | `useNoteDrag`의 `postSlug(id)`·`folderPath(target)`   | 아무 동작도 하지 않음        |
| 요청 본문 (정리 내용) | `parseOrganization`이 검사한 뒤 브랜드 부여           | 400 응답                     |

서버가 DB에서 읽은 slug는 저장 시점에 이미 검사한 값이므로 `row.slug as PostSlug`로 표시만 붙인다. contracts의 `ServerPost`·`AdminPost` 스키마는 `z.custom<PostSlug>(isPostSlug)`로 정의되어 있어, 서버 응답의 slug도 형식을 확인한 뒤 브랜드 타입이 된다.

브랜드 타입만 받는 내부 코드는 다음과 같다.

- `Post.slug`·`AdminPost.slug`
- `Organization`의 키와 값
- `movePost`·`setPinned`·`renameFolder` 같은 정리 함수
- 폴더 트리의 `FolderNode.path`
- 사이드바의 `onRenameFolder(path: FolderPath)` 콜백

폴더 트리의 경로는 글의 category와 관리자가 만든 폴더에서 오므로, 트리를 만드는 한 곳에서 표시를 붙였다.

## 브랜드를 붙이지 않은 값

`PostContent.category`는 `string`으로 유지했다. 처음에는 `FolderPath`로 바꿨다가 되돌렸다. 글 편집기의 입력 상태(`PostDraft`)가 `PostContent`와 같은 모양이라, 사용자가 입력하는 중간 값까지 `FolderPath`여야 했기 때문이다. 아직 폴더를 선택하지 않은 상태를 타입으로 표현할 수 없다. 브랜드는 검사가 끝난 값에 붙이는 표시이고, 입력 중인 값에는 맞지 않는다. category는 `postInput` 스키마가 저장 전에 `folderPathError`로 검사한다.

## 비용

비용은 시험 픽스처에 생긴다. `{ slug: 'a' }` 같은 리터럴 43곳이 `'a' as PostSlug`로 바뀌었다. 브랜드 타입의 알려진 비용이며, 대신 픽스처에 "검사 없이 신뢰하는 값"이라는 표시가 남는다. 이 작업 시점에 소스 코드에서 `as`로 표시를 직접 붙인 곳은 네 곳이었다.

1. DB 행을 읽는 서버 (저장 시 검사한 값)
2. `parseOrganization`이 검사를 마친 값
3. 폴더 트리를 만드는 함수
4. 끌어 놓은 DOM 요소의 `dataset`을 읽는 사이드바

| 항목                  | 전               | 후                                       |
| --------------------- | ---------------- | ---------------------------------------- |
| slug·폴더 경로 타입   | `string`         | `PostSlug`·`FolderPath`                  |
| 외부 문자열 검사 지점 | 서버 1곳(정규식) | 5곳 (화면 3, 서버 1, 저장소 1)           |
| 동작 변화             | -                | 없음 (Vitest 336개·메모 E2E 그대로 통과) |

이것으로 1단계 "타입과 데이터 구조"의 네 항목을 모두 마쳤다. 다음 단계는 4단계 공통 컴포넌트다.

작업은 PR [#209](https://github.com/hyeoniverse/MacFolio/pull/209)의 커밋 하나(`9a4d7b2f3`)다. 27개 파일에서 331줄이 추가되고 129줄이 삭제되었다. 가장 많이 바뀐 파일은 `packages/desktop-core/src/memo/rules.ts`(42줄)다.

## 남은 것, 배운 것

- 이후 Finder 폴더 편집 기능([#263](https://github.com/hyeoniverse/MacFolio/pull/263))에서 `apps/react/src/apps/finder/edit.ts`에 `as PostSlug`·`as FolderPath`가 추가되었다. 2026-10-23 기준 시험 파일에서 `as PostSlug`·`as FolderPath`가 있는 줄은 46줄이다. 픽스처를 만드는 도우미 함수(`slug('a')`)를 두면 `as`를 줄일 수 있지만, 시험이 "검사 없이 신뢰한다"는 사실을 숨기게 되어 그대로 두었다.
- 검사 지점이 다섯 곳이면 다섯 곳에서 `null`을 처리해야 한다. 위 표의 "실패 시 처리"처럼 각 지점이 다르게 대응한다. 브랜드 타입 때문에 이 분기를 각 검사 지점에서 명시적으로 정하게 되었다.
- 타입이 보장하는 것은 "검사를 거쳤는가"이지 "값이 올바른가"가 아니다. 검사 함수 자체가 틀리면 브랜드 타입도 틀린 값을 신뢰한다. 정규식이 맞는지는 API e2e(`posts.e2e.test.ts` 등)가 잘못된 주소를 실제로 보내 확인한다.

## 따라 해 보기

외부 문자열이 글 주소가 되는 경로는 정해진 검사 함수뿐이다. 검사를 거치지 않은 값을 넘기면 타입 검사에서 실패한다.

```bash
pnpm typecheck                              # 브랜드 타입을 지키지 않은 곳이 있으면 여기서 실패
pnpm --filter @macfolio/desktop-core test   # postSlug()·folderPath() 검사 함수의 시험
```

주소창 문자열을 `movePost`에 그대로 넘기는 줄을 추가해 보면 `Argument of type 'string' is not assignable to parameter of type 'PostSlug'` 같은 오류가 난다. 확인한 뒤 그 줄을 삭제한다.

## 관련 글

- [1,629줄 한 파일을 폴더로 — 프로젝트마다 한 파일, 경로는 그대로](/memo/profile-split)
- [리팩터링 1단계 — 타입과 데이터 구조](/memo/refactor-step1-types)
- [앱 안의 화면에 주소 붙이기 - 글과 프로젝트 공유 링크](/memo/app-links)
- [글은 Markdown에 두고 정리만 서버에](/memo/memo-organization-api)
- [Finder 폴더를 진짜 데스크탑처럼: 새 폴더, 이름 변경, 끌어서 옮기기](/memo/finder-filesystem)

[^guard]: 반환 타입이 `value is PostSlug`인 함수. `true`를 반환한 분기 안에서 TypeScript가 값을 `PostSlug`로 좁혀 준다. [TypeScript 핸드북: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)

[^asserts]: [assertion 함수](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions). 정상적으로 반환하면 그 뒤의 코드에서 `slug`를 `PostSlug`로 간주하고, 검사에 실패하면 예외(`NotFoundException`)를 던진다. 형식이 맞지 않는 주소의 글은 존재할 수 없으므로 400이 아니라 404로 응답한다.

#MacFolio #리팩터링 #TypeScript
