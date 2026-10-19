---
title: 문자열은 문을 지나야 글 주소가 된다 — PostSlug·FolderPath 브랜드 타입
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 글 주소와 폴더 경로가 어디서나 string이라 주소창 문자열을 그대로 movePost에 넘겨도 컴파일이 됐다. PostSlug·FolderPath 브랜드 타입을 두고 바깥 문자열은 다섯 문을 지나야 그 타입이 되게 했다. 다른 방법과 비교, 브랜드하지 않은 것, 비용을 적었다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 마지막 항목 "`any`, 넓은 `string` 대신 쓸 수 있는 유니언·브랜드 타입 정리 (앱 이름, 폴더 경로, 슬러그)". [프로필 나누기](/memo/profile-split) 다음이다.

## 먼저 센 것

`any`는 프로젝트 전체에 0건이었다. 앱 이름은 이미 돼 있었다. `apps/manifest.ts`의 `AppName`은 내장 앱 유니언(`'memo' | 'safari' | …`)과 프로젝트 앱 브랜드(`string & { [projectApp]: true }`)의 합이고, `projectAppName(id)`가 문이다. 배경화면 id는 `` `custom:${string}` `` 템플릿 리터럴, 분석의 `EventType`·`Breakdown`, 프로젝트의 `ProjectLook`도 유니언이다.

남은 것은 글 주소(slug)와 폴더 경로였다. 둘 다 어디서나 `string`이다. `Post.slug: string`, `Organization.posts: Record<string, string>`, `movePost(org, slug: string, folder: string)`. 주소창에서 온 문자열, 끌어 놓는 항목의 id, API 파라미터가 아무 검사 없이 그대로 들어갈 수 있었다. 서버는 `SLUG.test()`로, 화면은 암묵적으로 믿었다.

![바깥의 string 다섯 곳이 문을 지나 안쪽 타입이 된다](./images/branded-ids-boundary.svg '주소창, API 파라미터, 파일 이름, 끌기 id, 요청 몸통이 postSlug()·folderPath()를 지나 PostSlug·FolderPath가 된다. 문을 거치지 않은 문자열은 tsc 오류')

## 방법 비교

| 방법                                | 실행 시 비용 | 막는 정도                                | 문제                                               |
| ----------------------------------- | ------------ | ---------------------------------------- | -------------------------------------------------- |
| 그대로 `string`, 서버에서만 정규식  | 없음         | 서버 한 곳만                             | 화면 안에서는 아무 문자열이나 오간다               |
| 타입 별칭 `type PostSlug = string`  | 없음         | 없다 (`string`과 똑같이 취급된다)        | 읽는 사람에게 힌트일 뿐                            |
| 클래스로 감싸기 (`new Slug(value)`) | 객체 하나씩  | 확실하다                                 | `Record`의 키, JSON, URL에 넣을 때마다 풀어야 한다 |
| 브랜드 타입 (고른 방법)             | 없음         | 문을 거치지 않은 `string`은 tsc가 막는다 | 시험 픽스처에 `as`가 붙는다                        |

slug는 `Record<PostSlug, FolderPath>`의 키로도 쓰이고 JSON으로 서버를 오간다. 실행 시에는 그냥 문자열이어야 했다.

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

![문을 지나는 길](./images/branded-ids-gate.svg '검사를 통과하면 같은 문자열에 표시만 붙는다. 통과하지 못하면 null')

`unique symbol`로 표시를 붙인 문자열이다. 실행 시에는 그냥 문자열이라 번들에 아무것도 안 들어가고 동작도 안 바뀐다. 다른 점은 하나다. `string`을 `PostSlug` 자리에 넣으면 컴파일이 안 된다. `PostSlug`를 만드는 길은 `postSlug()`뿐이고, 그 함수는 `POST_SLUG` 정규식을 본다.

## 어디가 문인가

바깥에서 문자열이 들어오는 곳 다섯을 찾아 문을 세웠다.

| 어디서 온 문자열      | 문                                                  |
| --------------------- | --------------------------------------------------- |
| 주소창 `/memo/<slug>` | `useNoteView`의 `postSlug(linkedId('memo'))`        |
| API `@Param('slug')`  | `checkSlug(slug): asserts slug is PostSlug`         |
| Markdown 파일 이름    | `createStaticPostRepository`의 `postSlug(이름)`     |
| 끌어 놓는 항목의 id   | `useNoteDrag`의 `postSlug(id)`·`folderPath(target)` |
| 요청 몸통 (정리 내용) | `parseOrganization`이 검사한 뒤 브랜드로            |

서버가 DB에서 읽은 slug는 넣을 때 검사한 값이라 `row.slug as PostSlug`로 표시만 붙인다. contracts의 `ServerPost`·`AdminPost` 스키마는 `z.custom<PostSlug>(isPostSlug)`라 서버 응답의 slug도 모양을 확인한 뒤 브랜드가 된다.

안쪽은 `Post.slug`·`AdminPost.slug`, `Organization`의 키와 값, `movePost`·`setPinned`·`renameFolder` 같은 정리 함수, 폴더 트리의 `FolderNode.path`, 사이드바의 `onRenameFolder(path: FolderPath)` 콜백이다. 폴더 트리의 경로는 글의 category와 만든 폴더에서 오므로 트리를 만드는 한 곳에서 표시를 붙였다.

## 무엇을 브랜드하지 않았나

`PostContent.category`는 `string`으로 뒀다. 처음엔 `FolderPath`로 했다가 되돌렸다. 글 편집기의 입력 상태(`PostDraft`)가 `PostContent`와 같은 모양이라, 사용자가 타이핑하는 중간 값까지 `FolderPath`여야 했다. "폴더를 골라주세요"가 아직 안 된 상태를 타입이 표현할 수 없다. 브랜드는 "확인이 끝난 값"에 붙이는 것이지 입력 칸에 붙이는 것이 아니다. category는 `postInput` 스키마가 저장 전에 `folderPathError`로 검사한다.

## 비용

시험 픽스처다. `{ slug: 'a' }` 같은 리터럴 마흔세 곳이 `'a' as PostSlug`가 됐다. 브랜드 타입의 알려진 비용이고, 대신 픽스처가 "이건 검사 없이 믿는 값"이라고 적어 둔 셈이 됐다. 소스 코드에서 표시를 직접 붙인 곳은 넷뿐이다. DB 행을 읽는 서버(넣을 때 검사한 값), `parseOrganization`이 검사를 끝낸 값, 폴더 트리를 만드는 한 곳, 끌어 놓은 DOM `dataset`을 읽는 사이드바.

| 항목                      | 전               | 후                                |
| ------------------------- | ---------------- | --------------------------------- |
| slug·폴더 경로 타입       | `string`         | `PostSlug`·`FolderPath`           |
| 바깥 문자열이 들어오는 문 | 서버 1곳(정규식) | 5곳 (화면 3, 서버 1, 저장소 1)    |
| 동작 변화                 |                  | 없음 (Vitest 336·E2E 메모 그대로) |

이것으로 1단계 "타입과 데이터 구조" 네 항목이 끝났다. 다음은 4단계 공통 컴포넌트.

작업은 PR [#209](https://github.com/hyeoniverse/MacFolio/pull/209)의 커밋 하나다. 27개 파일에서 331줄을 더하고 129줄을 지웠다. 가장 많이 바뀐 곳은 `packages/desktop-core/src/memo/rules.ts`(42줄)다.

## 남은 것, 배운 것

- 지금 소스에서 `as PostSlug`로 표시를 직접 붙인 곳은 4곳, 시험 파일에서는 28줄이다. 픽스처를 만드는 작은 함수(`slug('a')`)를 두면 `as`를 줄일 수 있지만, 시험이 "검사 없이 믿는다"는 것을 숨기게 되어 그대로 두었다.
- 문이 다섯이면 다섯 군데에서 `null`을 다뤄야 한다. 주소창의 잘못된 slug는 고른 글이 없는 것으로, API는 404(글이 없습니다)로, 끌기는 아무 일도 하지 않는 것으로 다르게 처리한다. 브랜드 타입이 그 갈림을 각 문에서 정하게 만들었다.
- 타입으로 막는 것은 "검사를 했는가"이지 "값이 맞는가"가 아니다. 검사 함수 자체가 틀리면 브랜드도 틀린 값을 믿는다. 정규식이 맞는지는 API e2e(`posts.e2e.test.ts` 등)가 이상한 주소를 실제로 보내 확인한다.

## 써 보기

바깥 문자열이 글 주소가 되는 길은 정해진 함수 하나뿐이다. 문을 지나지 않은 값을 넘기면 타입 검사에서 막힌다.

```bash
pnpm typecheck        # 브랜드를 지키지 않은 곳이 있으면 여기서 실패
```

일부러 주소창 문자열을 `movePost`에 그대로 넘기는 줄을 써 보면 `string is not assignable to PostSlug` 같은 에러가 난다. 확인한 뒤 지운다. 브랜드 타입은 TypeScript의 교차 타입으로 만든 관례라, 런타임 비용이 없다([TypeScript 핸드북: Intersection Types](https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types)). 문 함수의 시험은 `pnpm --filter @macfolio/desktop-core test`다.

관련 글: [프로필 나누기](/memo/profile-split), [리팩터링 1 - 타입](/memo/refactor-step1-types), [글 주소에 앱 화면 붙이기](/memo/app-links), [메모 정리 API](/memo/memo-organization-api)

#MacFolio #리팩터링 #TypeScript
