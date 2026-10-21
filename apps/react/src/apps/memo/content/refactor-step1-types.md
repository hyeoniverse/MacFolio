---
title: 리팩터링 1단계 — 타입과 데이터 구조
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 리팩터링 1단계를 돌아본다. 화면과 서버가 따로 적던 요청·응답 모양을 @macfolio/contracts의 zod 스키마로 모았고, 1,629줄 profile.ts를 나눴고, 글 주소에 브랜드 타입을 붙였다. 고른 방법과 버린 방법, PR 열 개의 순서와 크기를 적는다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 1단계는 "같은 모양을 두 번 적지 않기"였다. 이 글은 단계 전체를 요약하고, 자세한 내용은 PR마다 쓴 글로 넘긴다.

리팩터링은 10월 1일 버튼 구조를 그림으로 정리하다가 공통 컴포넌트가 없다는 것을 확인하면서 시작됐다. 10월 10일 새벽에 타입·구조체 정리부터 공통 컴포넌트, 스타일, 보안까지 전 영역을 다루는 계획을 이슈로 세웠다. 그런데 실제로는 1단계보다 2단계를 먼저 하고 있었다. 순서를 따져 보니 2 → 3 → 1 순서로 갈 수밖에 없는 부분이 있어 2단계의 두 안 중 하나를 먼저 골라야 했고, 그 선택은 작업 규모나 복잡도가 아니라 코드 품질만 보고 정했다.

## 왜

계획을 세울 때의 상태는 이랬다.

- 화면이 API 응답 타입을 손으로 다시 적었다 (예: `commentsApi.ts`의 `Comment`).
- API는 전역 `ValidationPipe`(whitelist)를 켜 두었지만 DTO 클래스가 없어 실제로 걸러지는 값이 없었고, 서비스마다 직접 검사했다.
- `shared/profile.ts` 한 파일 1,629줄에 프로필·기술·`PROJECTS`·타입이 함께 있었다.

### 어긋나면 어떻게 되나

댓글 하나로 보면 이렇다. 화면의 `commentsApi.ts`는 댓글 모양을 인터페이스로 다시 적었고, 서버의 `comments/rules.ts`는 내용 길이를 if문으로 검사했다.

```ts
// 화면 (apps/react/src/apps/memo/comments/commentsApi.ts, #200 전)
export interface Comment {
	id: string;
	name: string;
	ipPrefix: string | null;
	isAdmin: boolean;
	body: string;
	createdAt: string;
	mine: boolean;
	likes: number;
	liked: boolean;
}

// 서버 (apps/api/src/comments/rules.ts, #200 전)
export const LIMITS = { body: { min: 1, max: 500 } } as const;
export function parseBody(input: unknown) {
	const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
	const body = typeof raw.body === 'string' ? raw.body.trim() : '';
	if (body.length < LIMITS.body.min) return { errors: ['내용을 입력해주세요.'] };
	if (body.length > LIMITS.body.max) return { errors: [`내용은 ${LIMITS.body.max}자까지 입력할 수 있습니다.`] };
	return { value: { body } };
}
```

서버가 응답에 칸을 하나 더하거나 이름을 바꾸면 화면의 타입은 그대로라 컴파일러가 알아채지 못한다. 상한 500자도 화면과 서버에 따로 있었다. 이런 짝이 도메인마다 있었다.

## 고른 방법과 버린 방법

같은 모양을 한 번만 적는 방법을 견줘 보면 이렇다. `class-validator`는 데코레이터라 화면에서 쓸 수 없다는 것이 처음부터 고르지 않은 까닭이었다.

| 방법                                     | 좋은 점                                                       | 걸린 점                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| NestJS DTO 클래스 + `class-validator`    | 이미 켜 둔 `ValidationPipe`가 바로 쓴다                       | 데코레이터 클래스라 화면(React)에서 가져다 쓰기 어렵다. 타입과 검사 규칙이 서버 쪽에만 생긴다       |
| OpenAPI 문서에서 화면 타입을 만들어 내기 | Swagger 문서가 이미 있다                                      | 만들어 낸 파일을 다시 커밋하거나 빌드에 끼워야 한다. 문서가 실제 검사와 같다는 보장이 따로 필요하다 |
| 공유 패키지에 zod 스키마 (고름)          | 스키마 하나에서 검사(`parse`)와 타입(`z.infer`)이 같이 나온다 | 패키지가 하나 늘고, 서버 Dockerfile과 CI가 이 패키지를 먼저 빌드해야 한다                           |

zod를 고른 까닭은 화면도 같은 규칙을 "실행"해야 했기 때문이다. 글 편집기와 메일 앱은 보내기 전에 같은 상한으로 막는다. 타입만 나누는 방법으로는 이 일을 할 수 없다. 전역 `ValidationPipe`는 지우지 않았다. DTO가 없으니 지금은 하는 일이 없지만, 나중에 DTO를 쓰는 경로가 생겨도 같은 설정이 적용되게 남겨 두었다.

## 무엇을 바꿨나

| 항목                               | PR   | 글                                                        |
| ---------------------------------- | ---- | --------------------------------------------------------- |
| `packages/contracts`와 댓글·좋아요 | #200 | [응답 타입을 두 번 적지 않기](/memo/contracts-comments)   |
| 글                                 | #201 | [글 도메인 옮기기](/memo/contracts-posts)                 |
| 메시지                             | #202 | [메시지 도메인 옮기기](/memo/contracts-messages)          |
| 연락 메일                          | #203 | [연락 메일의 검사 규칙을 하나로](/memo/contracts-contact) |
| 배경화면                           | #204 | [배경화면 도메인 옮기기](/memo/contracts-wallpapers)      |
| 파일                               | #205 | [올린 파일 규칙을 둘로 나누기](/memo/contracts-files)     |
| 분석                               | #206 | [분석 이벤트의 모양을 하나로](/memo/contracts-analytics)  |
| 사이트 프로필                      | #207 | [사이트 프로필로 1단계 마무리](/memo/contracts-site)      |
| `profile.ts` 나누기                | #208 | [1,629줄 한 파일을 폴더로](/memo/profile-split)           |
| 브랜드 타입                        | #209 | [PostSlug·FolderPath 브랜드 타입](/memo/branded-ids)      |

방식은 하나다. 요청·응답의 모양은 `@macfolio/contracts`에 zod 스키마로 두고, 서버는 `parse()`로 검증하고, 화면은 `import type`으로 같은 타입을 쓴다. 타입과 순수 규칙은 `desktop-core`에 남는다. 여덟 도메인이 모두 이 자리로 옮겨 갔다.

![desktop-core, contracts, api, react의 관계와 contracts 밖에 남긴 것](./images/refactor-step1-types-contracts.svg '1단계가 끝난 뒤 요청·응답 모양이 흐르는 길')

## 구현: 공통 도구 하나와 도메인 여덟

첫 PR(#200)에서 패키지와 함께 도구 두 개를 만들었다. 이후 도메인 PR은 모두 이 둘을 썼다.

```ts
// packages/contracts/src/parse.ts
export type Parsed<T> = { value: T } | { errors: string[] };

export function parse<S extends z.ZodType>(schema: S, input: unknown): Parsed<z.output<S>> {
	const result = schema.safeParse(input);
	if (result.success) return { value: result.data };
	return { errors: [...new Set(result.error.issues.map((issue) => issue.message))] };
}

export const requestBody = <T extends z.ZodRawShape>(shape: T) =>
	z.preprocess((input) => (typeof input === 'object' && input !== null ? input : {}), z.object(shape));
```

`parse()`의 돌려주는 모양 `{ value } | { errors }`는 서버의 손 검사 함수들이 이미 쓰던 모양이다. 그래서 컨트롤러와 화면은 고칠 필요가 없었다. `requestBody()`는 몸통이 `null`이나 문자열일 때 zod의 영어 기본 문구 대신 칸마다의 한국어 문구가 나오게 한다.

그 뒤 댓글의 서버 검사는 한 줄이 됐다.

```ts
// apps/api/src/comments/rules.ts (#200 뒤)
export const parseBody = (input: unknown) => parse(CommentInput, input);
```

순서는 작은 도메인부터 잡았다. 댓글·좋아요(#200)에서 패키지 뼈대와 Dockerfile·CI의 빌드 순서를 맞추고, 글(#201)·메시지(#202)·연락 메일(#203)·배경화면(#204)·파일(#205)·분석(#206)·사이트 프로필(#207)을 하나씩 옮겼다. 열 개 PR이 10월 11일 오전 네 시간 사이에 머지되었다. 도메인 PR은 글과 그림까지 합쳐 300줄 안팎이었고, `profile.ts` 나누기(#208)만 파일을 옮기느라 1,775줄을 더하고 1,630줄을 지웠다.

![1단계 PR 열 개의 더한 줄과 지운 줄](./images/refactor-step1-types-prs.svg 'profile.ts 나누기를 빼면 PR마다 300줄 안팎이다')

### 글 도메인: 스키마가 타입을 따라가게

글은 타입이 이미 `desktop-core`에 있었다(`PostContent`, `AdminPost`). 스키마를 새로 적으면 타입이 둘이 된다. 그래서 스키마에 그 타입을 붙여, 둘이 어긋나면 `tsc`가 실패하게 했다.

```ts
export const postInput = (today: string): z.ZodType<PostContentShape, unknown> =>
	requestBody({
		title: text()
			.refine((title) => title.length > 0, '제목을 입력해주세요.')
			.refine((title) => title.length <= POST_LIMITS.title, `제목은 ${POST_LIMITS.title}자까지 입력할 수 있습니다.`),
		// date, category, summary, body …
	});
```

이유는 칸 순서(제목 → 날짜 → 폴더 → 요약 → 본문)대로 모두 모은다. 옛 if문도 그 순서로 모았기 때문에, 문구와 순서를 비교하는 기존 단위 시험이 그대로 통과해야 옮긴 것으로 쳤다.

### 브랜드 타입: 검사를 지난 문자열만

글 주소와 폴더 경로는 둘 다 `string`이라, 함수에 순서를 바꿔 넣어도 컴파일러가 모른다. #209에서 이름표를 붙였다.

```ts
// packages/desktop-core/src/memo/rules.ts
declare const postSlugBrand: unique symbol;
export type PostSlug = string & { readonly [postSlugBrand]: true };

/** 글 주소 모양이면 PostSlug, 아니면 null (바깥에서 온 문자열을 글 주소로 바꾸는 유일한 길) */
export const postSlug = (value: unknown): PostSlug | null => (isPostSlug(value) ? value : null);
```

실행할 때는 그냥 문자열이라 비용이 없다. 바깥에서 온 값(주소창, 서버 응답, 저장소)은 `postSlug()`·`folderPath()`를 지나야 하므로, 검사를 빼먹은 길이 컴파일 오류로 드러난다.

## 전후

|                     | 전                    | 후                                                               |
| ------------------- | --------------------- | ---------------------------------------------------------------- |
| 응답 타입           | 화면·서버가 각자 적음 | 여덟 도메인이 contracts 한 곳                                    |
| `shared/profile.ts` | 1,629줄 한 파일       | 프로젝트마다 한 파일, 바깥 import 27곳은 그대로                  |
| `any`               | —                     | 0건                                                              |
| 글 주소·폴더 경로   | `string`              | `PostSlug`·`FolderPath`, `postSlug()`·`folderPath()`를 지나야 함 |

글 PR에서는 서버의 if문 스물한 줄이 스키마 하나가 됐고, 사이트 프로필에서는 if문 58줄을 zod로 옮기며 문구 열한 개와 순서를 시험으로 고정했다.

## 확인

- 도메인 PR마다 기존 API 단위·e2e 시험을 고치지 않고 통과시켰다. 문구가 바뀌면 시험이 실패하므로 "동작 그대로"의 기준이 됐다.
- contracts에는 도메인마다 시험 파일을 두었다. 지금 `packages/contracts/src`에 시험 파일이 13개 있다.
- 서버 Docker 이미지가 contracts를 먼저 빌드하는지는 #200에서 Dockerfile과 CI 순서를 함께 고쳐 확인했다.
- 지금 `apps/react/src`와 `apps/api/src`에서 `@macfolio/contracts`를 불러오는 파일은 67개다.

## 일부러 남긴 것

- 배경화면 올리기는 multipart라 스키마가 없고, 이름만 같은 함수를 거친다.
- 매직 바이트 확인·EXIF 지우기처럼 서버만 하는 일은 contracts로 옮기지 않았다. 기준은 "화면도 알아야 하는가"였다.
- 관리자 설정과 데모의 요청 검사는 6단계(서버)에서 같은 방식으로 옮겼다.

## 배운 것

- **돌려주는 모양을 먼저 맞추면 옮기기가 쉽다.** `parse()`가 옛 함수와 같은 `{ value } | { errors }`를 돌려줘서, 부르는 쪽은 한 줄도 고치지 않았다.
- **문구 시험이 안전망이다.** 사용자에게 보이는 거절 문구를 그대로 비교하는 시험이 있어서, 검사 방법을 통째로 바꿔도 겉으로 보이는 동작이 같다는 것을 확인할 수 있었다.
- **작게 나누면 하루에 끝난다.** 도메인 하나에 PR 하나로 나누니, 열 개가 반나절 만에 머지되었다.

관련 글: [응답 타입을 두 번 적지 않기](/memo/contracts-comments) · [PostSlug·FolderPath 브랜드 타입](/memo/branded-ids) · [손으로 쓴 입력 검사 세 개를 공유 스키마로](/memo/settings-schemas). PR: [#200](https://github.com/hyeoniverse/MacFolio/pull/200), [#208](https://github.com/hyeoniverse/MacFolio/pull/208), [#209](https://github.com/hyeoniverse/MacFolio/pull/209).

다음 단계: [2단계 — 폴더 구조와 의존](/memo/refactor-step2-structure). 전체 회고는 [리팩터링 회고](/memo/refactor-retrospective)에 있다.

#MacFolio #리팩터링 #TypeScript #zod
