---
title: PostSlug·FolderPath 브랜드 타입과 검사 지점으로 글 주소 문자열 구분하기
date: 2026-10-11
category: 개발 기록/MacFolio/구조·상태 관리
summary: 글 주소와 폴더 경로가 어디서나 string이라 주소창 문자열을 그대로 movePost에 넘겨도 컴파일이 됐다. PostSlug·FolderPath 브랜드 타입을 두고 외부 문자열은 다섯 검사 지점을 통과해야 그 타입이 되게 했다. 다른 방법과의 비교, 브랜드를 붙이지 않은 값, 비용을 정리했다.
---

블로그 글은 `/memo/cra-to-vite`처럼 주소 끝부분의 짧은 문자열로 구분한다. 이 부분을 **slug**라고 부르는데, 웹 주소에서 문서 하나를 가리키는 고유한 식별 부분을 뜻한다[^slug]. MacFolio에서는 글 파일 이름(`cra-to-vite.md`), 서버 DB의 글 행, 메모 앱의 선택 상태가 모두 이 slug로 같은 글을 가리킨다. 글이 속한 폴더도 `개발 기록/MacFolio/구조·상태 관리` 같은 **폴더 경로** 문자열로 표현한다.

두 값은 사이트 곳곳으로 전달된다. 주소창에서 잘라 낸 문자열, 사이드바에서 끌어 놓은 항목의 id, API 요청의 경로 파라미터가 모두 slug나 폴더 경로가 된다. 그런데 TypeScript 코드에서는 둘 다 그냥 `string`이었다. 형식이 맞지 않는 문자열(`"a/b?x=1"`)도 글 주소 자리에 그대로 넘길 수 있었고, 컴파일러는 이를 막지 못했다.

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 마지막 항목이 "`any`, 넓은 `string` 대신 쓸 수 있는 유니언·브랜드 타입 정리 (앱 이름, 폴더 경로, 슬러그)"였다. [프로필 나누기](/memo/module-splitting#import-경로를-유지하는-indexts-재내보내기-sharedprofile) 다음 작업으로 이 항목을 처리했다.

## 구조적 타입과 브랜드 타입

TypeScript는 **구조적 타입 시스템**(structural type system)을 사용한다. 두 타입의 이름이 달라도 구성(속성과 그 타입)이 같으면 같은 타입으로 취급한다[^structural]. 그래서 `type PostSlug = string`처럼 별칭을 만들어도 `PostSlug`와 `string`은 컴파일러에게 완전히 같은 타입이다. 별칭은 코드를 읽는 사람에게 의도를 알려 줄 뿐, 잘못된 값을 막지는 않는다.

**브랜드 타입**(branded type)은 이 성질을 이용해 구별을 만든다. `string`에 실제로는 존재하지 않는 속성 하나를 타입 수준에서만 덧붙여, "검사를 통과한 문자열"과 "아무 문자열"의 구성을 다르게 만든다. 실행 시에는 여전히 일반 문자열이므로 성능과 직렬화 방식은 바뀌지 않는다.

아래는 두 방식에 같은 코드를 적용하고 `tsc --strict`로 검사한 결과다. 주소창에서 잘라 낸 문자열 `fromAddress`를 글을 여는 함수에 바로 넘겼다.

```ts
const fromAddress: string = location.pathname.slice('/memo/'.length);
openPost(fromAddress); // 검사 없이 전달
```

```text
// type PostSlug = string 일 때: 오류 0개

// type PostSlug = string & { readonly [postSlugBrand]: true } 일 때:
error TS2345: Argument of type 'string' is not assignable to parameter of type 'PostSlug'.
  Type 'string' is not assignable to type '{ readonly [postSlugBrand]: true; }'.
```

![타입 별칭은 검사하지 않은 문자열을 통과시키고, 브랜드 타입은 TS2345로 거부한다](./images/branded-ids-alias-vs-brand.svg '같은 openPost(fromAddress) 호출이 별칭에서는 통과하고, 브랜드 타입에서는 postSlug()를 거친 값만 통과한다')

## 작업 전 집계: 넓은 타입이 남은 곳

작업 전에 넓은 타입이 어디에 남아 있는지 집계했다.

| 대상              | 상태                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `any`             | 프로젝트 전체 0건                                                                                                                                   |
| 앱 이름 `AppName` | 이미 정리됨. 내장 앱 유니언(`'memo' \| 'safari' \| …`)과 프로젝트 앱 브랜드(`string & { [projectApp]: true }`)의 합, 생성 함수 `projectAppName(id)` |
| 배경화면 id       | [템플릿 리터럴 타입](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html) `` `custom:${string}` ``                           |
| 분석·프로젝트     | `EventType`·`Breakdown`·`ProjectLook` 모두 유니언                                                                                                   |
| **글 주소(slug)** | 어디서나 `string`                                                                                                                                   |
| **폴더 경로**     | 어디서나 `string`                                                                                                                                   |

남은 대상은 글 주소와 폴더 경로였다. `Post.slug: string`, `Organization.posts: Record<string, string>`, `movePost(org, slug: string, folder: string)`처럼 모두 `string`이었다. 그래서 주소창에서 온 문자열, 끌어 놓는 항목의 id, API 파라미터가 ==아무 검사 없이 그대로 전달될 수 있었다==. 서버는 `SLUG.test()`로 형식을 검사했지만 화면 코드는 값을 검사 없이 신뢰했다.

![외부 문자열 다섯 종류가 postSlug()·folderPath() 검사를 통과해야 PostSlug·FolderPath가 된다](./images/branded-ids-boundary.svg '주소창, API 파라미터, 파일 이름, 끌기 id, 요청 본문이 postSlug()·folderPath()를 통과해 PostSlug·FolderPath가 된다. 검사를 거치지 않은 문자열은 tsc 오류')

## 방법 비교

| 방법                                | 실행 시 비용     | 막는 범위                                    | 문제                                                        |
| ----------------------------------- | ---------------- | -------------------------------------------- | ----------------------------------------------------------- |
| 기존 `string`, 서버에서만 정규식    | 없음             | 서버 한 곳                                   | 화면 안에서는 어떤 문자열이든 전달된다                      |
| 타입 별칭 `type PostSlug = string`  | 없음             | 없음 (`string`과 똑같이 취급된다)            | 코드를 읽는 사람에게 주는 힌트에 그친다                     |
| 클래스로 감싸기 (`new Slug(value)`) | 값마다 객체 생성 | 확실하다                                     | `Record`의 키, JSON, URL에 넣을 때마다 문자열로 꺼내야 한다 |
| 브랜드 타입 (선택한 방법)           | 없음             | 검사를 거치지 않은 `string`을 tsc가 거부한다 | 시험 픽스처에 `as`가 붙는다                                 |

slug는 `Record<PostSlug, FolderPath>`의 키로도 쓰이고, JSON으로 서버와 주고받는다. 클래스로 감싸면 `JSON.stringify`가 객체를 `{"value":"cra-to-vite"}` 같은 모양으로 바꾸고, 객체를 `Record`의 키로 쓰면 `"[object Object]"`라는 문자열 키가 생긴다. 실행 시에는 일반 문자열이어야 했으므로 브랜드 타입을 선택했다.

## 브랜드 타입 정의

```ts
// packages/desktop-core/src/memo/rules.ts
declare const postSlugBrand: unique symbol;
export type PostSlug = string & { readonly [postSlugBrand]: true };
export type FolderPath = string & { readonly [folderPathBrand]: true };

export const isPostSlug = (value: unknown): value is PostSlug => typeof value === 'string' && POST_SLUG.test(value);
export const postSlug = (value: unknown): PostSlug | null => (isPostSlug(value) ? value : null);
export const folderPath = (value: unknown): FolderPath | null => (isFolderPath(value) ? value : null);
```

코드의 각 부분이 하는 일은 다음과 같다.

| 부분                            | 뜻                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `declare const … unique symbol` | 이 파일에서만 쓰는 고유한 심볼 타입을 선언한다([`unique symbol`](https://www.typescriptlang.org/docs/handbook/symbols.html#unique-symbol)). `declare`라 실행 코드는 생성되지 않는다 |
| `string & { … }`                | [교차 타입](https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types). `string`이면서 그 속성도 가진 값이라는 뜻이다                                          |
| `isPostSlug`                    | 타입 가드[^guard]. `POST_SLUG` 정규식(`/^[\w-]{1,100}$/`)을 통과하면 `true`                                                                                                         |
| `postSlug`                      | 통과하면 같은 문자열을 `PostSlug`로, 실패하면 `null`을 반환한다                                                                                                                     |

`declare const`라 번들 크기와 동작은 바뀌지 않는다. 달라지는 점은 하나다. `string` 값을 `PostSlug` 자리에 넘기면 컴파일 오류가 난다. `PostSlug`를 만드는 방법은 `postSlug()`(또는 `isPostSlug()`)뿐이다.

![외부 문자열이 postSlug()의 POST_SLUG 검사를 통과하면 같은 문자열의 PostSlug, 실패하면 null이 된다](./images/branded-ids-gate.svg '검사를 통과하면 같은 문자열에 타입 표시만 붙는다. 통과하지 못하면 null')

`POST_SLUG`의 `\w`는 영문자·숫자·밑줄만 포함한다. 그래서 입력값마다 결과가 다음처럼 나뉜다.

| 입력               | `postSlug()` 결과           | 이유                 |
| ------------------ | --------------------------- | -------------------- |
| `"cra-to-vite"`    | `"cra-to-vite"` (PostSlug)  | 영문과 하이픈        |
| `"day-20250323"`   | `"day-20250323"` (PostSlug) | 영문·숫자·하이픈     |
| `"a/b?x=1"`        | `null`                      | `/`, `?`, `=` 포함   |
| `"한글-제목"`      | `null`                      | 한글은 `\w`가 아니다 |
| `""`               | `null`                      | 최소 1자             |
| `"x"`를 101번 반복 | `null`                      | 최대 100자           |

`PostSlug`는 `string`의 부분 집합이라 반대 방향은 자유롭다. `PostSlug`를 `string` 자리에 넘기는 것은 허용된다. 화면에 글자를 출력하거나 URL을 조합하는 기존 코드는 수정할 필요가 없었다.

![PostSlug는 string 안의 부분 집합이고, PostSlug에서 string으로는 대입되지만 반대는 postSlug()를 거쳐야 한다](./images/branded-ids-assignability.svg '검사를 통과한 문자열만 안쪽 집합에 들어간다. 안에서 밖으로는 자유롭고, 밖에서 안으로는 postSlug()만 통한다')

## 검사 지점

외부에서 문자열이 들어오는 다섯 곳을 찾아 각각 검사 함수를 배치했다.

| 문자열의 출처         | 검사 지점                                             | 실패 시 처리                 |
| --------------------- | ----------------------------------------------------- | ---------------------------- |
| 주소창 `/memo/<slug>` | `useNoteView`의 `postSlug(linkedId('memo'))`          | 선택된 글 없음으로 표시      |
| API `@Param('slug')`  | `checkSlug(slug): asserts slug is PostSlug`[^asserts] | 404 응답 (글이 없습니다.)    |
| Markdown 파일 이름    | `createStaticPostRepository`의 `postSlug(이름)`       | 해당 파일을 글 목록에서 제외 |
| 끌어 놓는 항목의 id   | `useNoteDrag`의 `postSlug(id)`·`folderPath(target)`   | 아무 동작도 하지 않음        |
| 요청 본문 (정리 내용) | `parseOrganization`이 검사한 뒤 브랜드 부여           | 400 응답                     |

예를 들어 방문자가 주소창에 `/memo/a%2Fb`를 입력하면, `useNoteView`는 잘라 낸 문자열을 `postSlug()`에 넘기고 `null`을 받는다. 메모 앱은 글 목록을 표시하되 선택된 글은 없는 상태로 열린다. 같은 주소로 API를 호출하면 `checkSlug`가 예외를 던져 404를 응답한다.

서버가 DB에서 읽은 slug는 저장 시점에 이미 검사한 값이므로 `row.slug as PostSlug`로 표시만 붙인다. contracts의 `ServerPost`·`AdminPost` 스키마는 `z.custom<PostSlug>(isPostSlug)`로 정의되어 있어, 서버 응답의 slug도 형식을 확인한 뒤 브랜드 타입이 된다.

브랜드 타입만 받는 내부 코드는 다음과 같다.

- `Post.slug`·`AdminPost.slug`
- `Organization`의 키와 값
- `movePost`·`setPinned`·`renameFolder` 같은 정리 함수
- 폴더 트리의 `FolderNode.path`
- 사이드바의 `onRenameFolder(path: FolderPath)` 콜백

폴더 트리의 경로는 글의 category와 관리자가 만든 폴더에서 오므로, 트리를 만드는 한 곳에서 표시를 붙였다.

## 브랜드를 붙이지 않은 값

`PostContent.category`는 `string`으로 유지했다. 처음에는 `FolderPath`로 바꿨다가 되돌렸다. 글 편집기의 입력 상태(`PostDraft`)가 `PostContent`와 같은 모양이라, 사용자가 입력하는 중간 값까지 `FolderPath`여야 했기 때문이다. 예를 들어 폴더 이름 칸에 `개발 기록/`까지만 입력한 상태는 마지막 이름이 비어 있어 폴더 경로 규칙을 통과하지 못하고, 아직 폴더를 선택하지 않은 상태도 타입으로 표현할 수 없다. ==브랜드는 검사가 끝난 값에 붙이는 표시이고, 입력 중인 값에는 맞지 않는다==. category는 `postInput` 스키마가 저장 전에 `folderPathError`로 검사한다.

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
- ==타입이 보장하는 것은 "검사를 거쳤는가"이지 "값이 올바른가"가 아니다==. 검사 함수 자체가 틀리면 브랜드 타입도 틀린 값을 신뢰한다. 정규식이 맞는지는 API e2e(`posts.e2e.test.ts` 등)가 잘못된 주소를 실제로 보내 확인한다.

## 따라 해 보기

외부 문자열이 글 주소가 되는 경로는 정해진 검사 함수뿐이다. 검사를 거치지 않은 값을 넘기면 타입 검사에서 실패한다.

```bash
pnpm typecheck                              # 브랜드 타입을 지키지 않은 곳이 있으면 여기서 실패
pnpm --filter @macfolio/desktop-core test   # postSlug()·folderPath() 검사 함수의 시험
```

> [!TIP] 오류 직접 확인하기
> 주소창 문자열을 `movePost`에 그대로 넘기는 줄을 추가하면 `Argument of type 'string' is not assignable to parameter of type 'PostSlug'`(TS2345) 오류가 난다. 확인한 뒤 그 줄을 삭제한다.

## 관련 글

- [index.ts 재내보내기로 import 경로를 유지하며 큰 모듈을 폴더로 나누기](/memo/module-splitting#import-경로를-유지하는-indexts-재내보내기-sharedprofile)
- [zod 스키마와 브랜드 타입으로 화면과 서버의 타입 통합하기](/memo/refactor-retrospective#1단계-타입과-데이터-구조)
- [History API로 SPA 창 상태를 /memo·/safari 주소와 연결하기](/memo/app-links)
- [Markdown 글은 두고 서버 JSON 한 행으로 겹치는 메모 폴더 정리](/memo/memo-organization-api)
- [표시 위치 JSON과 가상본 종류로 구성한 Finder 단일 루트 파일 시스템](/memo/finder-filesystem)

<details>
<summary>참고 문헌</summary>

- MDN, [Slug](https://developer.mozilla.org/en-US/docs/Glossary/Slug)
- TypeScript 핸드북, [Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)
- TypeScript 핸드북, [Object Types: Intersection Types](https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types)
- TypeScript 핸드북, [Symbols: unique symbol](https://www.typescriptlang.org/docs/handbook/symbols.html#unique-symbol)
- TypeScript 핸드북, [Narrowing: Using type predicates](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- TypeScript 3.7 릴리스 노트, [Assertion Functions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions)

</details>

[^slug]: MDN 용어 사전은 slug를 "웹 주소에서 문서를 고유하게 식별하는 부분으로, 보통 URL 끝에 온다"고 정의한다. [MDN: Slug](https://developer.mozilla.org/en-US/docs/Glossary/Slug)

[^structural]: 이름으로 타입을 구별하는 방식은 명목적 타입(nominal typing)이라고 한다. Java나 C#의 클래스가 이 방식이다. TypeScript는 JavaScript 코드의 객체가 대부분 클래스 없이 만들어지므로 구조로 비교한다. [TypeScript 핸드북: Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)

[^guard]: 반환 타입이 `value is PostSlug`인 함수. `true`를 반환한 분기 안에서 TypeScript가 값을 `PostSlug`로 좁혀 준다. [TypeScript 핸드북: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)

[^asserts]: [assertion 함수](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions). 정상적으로 반환하면 그 뒤의 코드에서 `slug`를 `PostSlug`로 간주하고, 검사에 실패하면 예외(`NotFoundException`)를 던진다. 형식이 맞지 않는 주소의 글은 존재할 수 없으므로 400이 아니라 404로 응답한다.

#MacFolio #리팩터링 #TypeScript
