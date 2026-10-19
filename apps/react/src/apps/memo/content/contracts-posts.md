---
title: 타입은 desktop-core에, 스키마는 contracts에 — 글 도메인 옮기기
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 블로그 글(posts)의 요청·응답을 contracts로 옮겼다. 글 타입은 이미 desktop-core에 있어서 스키마를 그 타입에 맞춰 선언(ZodType<PostContent>)하고, 어긋나면 tsc가 막게 했다. 서버의 if문 스물한 줄이 스키마 하나가 됐고 400 이유의 순서도 그대로다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 둘째 PR([#201](https://github.com/hyeoniverse/MacFolio/pull/201))이다. [댓글·좋아요](/memo/contracts-comments)에서 정한 방식을 글(posts)에 적용했다.

## 배경: 글 하나가 거치는 길

이 블로그의 글은 두 곳에서 온다. 저장소의 Markdown 파일(지금 읽는 이 글)과, 관리자가 메모 앱 편집기로 써서 서버 DB에 저장한 글이다. 관리자 글은 `POST /posts`·`PUT /posts/:slug`로 서버에 가고, 서버는 몸통을 다듬고 검사한 뒤 저장한다. 문제가 있으면 400과 함께 이유 목록을 돌려주고, 편집기는 그 이유를 칸 아래에 보여 준다.

이 길에서 글의 모양은 세 곳에 적혀 있었다.

- `packages/desktop-core/src/memo/posts.ts`: `PostContent`·`AdminPost`·`ServerPost`. 화면이 저장소 글과 서버 글을 합칠 때 쓴다.
- `apps/api/src/posts/rules.ts`: `PostInput` 인터페이스와 `parsePostInput` 함수.
- `apps/api/src/posts/posts.service.ts`: `PublicPost`·`AdminPost`·`RevisionSummary` 인터페이스. 화면 `postsApi.ts`에도 `RevisionSummary`가 따로 있었다.

같은 이름의 `AdminPost`가 desktop-core와 서버에 각각 있었고, 그중 `deletedAt` 하나가 서로 달랐다(아래 "덤으로 맞춘 것").

## 댓글과 다른 점: 타입이 이미 있다

댓글은 모양이 서버와 화면에 따로 적혀 있어서 contracts에 새로 적으면 됐다. 글은 다르다. `PostContent`·`AdminPost`·`ServerPost` 타입이 이미 `desktop-core/memo`에 있고, 화면의 글 목록 합치기(`mergeAdminPosts`)와 휴지통 계산이 그 타입을 쓴다. contracts에 또 적으면 세 번째 사본이 된다.

방법을 셋 놓고 견줬다.

| 방법                                                 | 좋은 점                               | 나쁜 점                                                                |
| ---------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| contracts에 스키마를 적고 `z.infer`로 타입을 뽑는다  | 댓글과 같은 방식                      | desktop-core 타입과 사본이 둘이 된다. 어느 쪽이 원본인지 흐려진다      |
| desktop-core 타입을 지우고 contracts 타입으로 바꾼다 | 원본이 하나                           | desktop-core가 contracts(그리고 zod)에 기대게 된다. 의존이 거꾸로 선다 |
| desktop-core 타입은 두고, 스키마를 그 타입에 맞춘다  | 원본은 desktop-core, 검사는 contracts | 스키마 선언에 타입 인자를 손으로 붙여야 한다                           |

셋째를 골랐다. 스키마를 **그 타입에 맞춰 선언**했다.

```ts
import type { PostContent as PostContentShape } from '@macfolio/desktop-core/memo';

export const PostContent: z.ZodType<PostContentShape> = z.object({
	title: z.string(),
	date: z.string(),
	category: z.string(),
	summary: z.string(),
	body: z.string(),
});
```

`z.ZodType<PostContentShape>`로 적으면 스키마가 내는 값이 그 타입과 다를 때 tsc가 막는다. 필드를 빼먹거나 `nullable`을 잘못 붙이면 컴파일이 안 된다. 타입의 출처는 desktop-core 한 곳이고, contracts는 "그 타입대로 검사하는 값"만 가진다.

![글 모양이 흐르는 길: desktop-core → contracts → api·react](./images/contracts-posts-flow.svg)

의존 방향은 `contracts → desktop-core` 한쪽이다. 길이 한도(`POST_LIMITS`), 날짜 검사(`isCalendarDate`), 폴더 경로 규칙(`folderPathError`)도 desktop-core에 있던 것을 그대로 가져다 쓴다. 거꾸로 desktop-core가 contracts를 보게 하면 순환이 된다.

## 서버의 if문 스물한 줄

서버 `posts/rules.ts`의 `parsePostInput`은 이렇게 생겼었다.

```ts
// 전: apps/api/src/posts/rules.ts (일부)
const text = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string).trim() : '');
const value: PostInput = { title: text('title'), date: text('date') || today, … };
const errors: string[] = [];
if (!value.title) errors.push('제목을 입력해주세요.');
else if (value.title.length > POST_LIMITS.title) errors.push(`제목은 ${POST_LIMITS.title}자까지 …`);
if (!isCalendarDate(value.date)) errors.push('날짜가 올바르지 않습니다.');
// … 폴더, 요약, 본문
return errors.length > 0 ? { errors } : { value };
```

이 함수는 칸마다 다듬고 검사하는 `if`가 스물한 줄이었다. 날짜가 비면 오늘로, 본문은 뒤 공백만 떼고, 폴더는 비면 "폴더를 골라주세요." 아니면 경로 규칙. 스키마로 옮기면서 동작을 하나도 바꾸지 않으려고 기존 시험(`rules.test.ts`)의 경우를 contracts 시험으로 그대로 옮겨 통과시켰다.

```ts
export const postInput = (today: string): z.ZodType<PostContentShape, unknown> =>
	requestBody({
		title: text()
			.refine((t) => t.length > 0, '제목을 입력해주세요.')
			.refine(/* 100자 */),
		date: text()
			.transform((d) => d || today)
			.refine(isCalendarDate, '날짜가 올바르지 않습니다.'),
		category: text().superRefine((c, ctx) => {
			/* 비면 '폴더를 골라주세요.', 아니면 folderPathError */
		}),
		summary: text().refine(/* 200자 */),
		body: z
			.preprocess((v) => (typeof v === 'string' ? v.replace(/\s+$/, '') : ''), z.string())
			.refine(/* 비었는지, 50,000자 */),
	});
```

서버 쪽은 한 줄이 남았다. 이름과 돌려주는 모양(`{ value } | { errors }`)이 같아서 `posts.service.ts`의 부르는 곳은 고치지 않았다.

```ts
// 후: apps/api/src/posts/rules.ts
export const parsePostInput = (input: unknown, today: string) => parse(postInput(today), input);
```

`parse`는 contracts의 공용 도우미다. zod의 `safeParse` 결과를 `{ value }` 또는 `{ errors: string[] }`로 바꾸고, 같은 문구는 한 번만 담는다. `requestBody`는 몸통이 객체가 아니면(null, 문자열) 빈 객체로 보고 칸마다 문구를 내게 한다. zod 기본 문구 "Invalid input: expected object"가 사용자에게 보이지 않게 하려는 것이다.

![요청 몸통이 requestBody → 칸별 text()·refine → parse를 거쳐 값이나 이유 목록이 된다](./images/contracts-posts-parse.svg '이유는 키 순서대로 모인다. 정렬 코드는 없다')

`today`를 인자로 받는 함수인 이유는 "날짜가 비면 오늘"의 오늘이 서버 시간(서울)이기 때문이다. 서버는 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' })`로 오늘을 만든다. 스키마를 모듈 로드 시점에 한 번 만들면 서버를 띄운 날의 날짜가 박혀서, 다음 날 쓴 글도 어제 날짜가 된다. 요청마다 스키마를 새로 만드는 비용은 객체 몇 개라 무시할 만하다.

**이유의 순서.** 원래 코드는 제목 → 날짜 → 폴더 → 요약 → 본문 순서로 이유를 모았고 e2e가 그 순서를 본다. zod는 객체의 키 순서대로 모든 칸을 검사하므로, 스키마의 키를 그 순서로 적으면 같은 배열이 나온다. 별도 정렬 코드가 없다.

**문자열이 아닌 칸.** 원래 코드는 `typeof raw[key] === 'string'`이 아니면 빈 문자열로 봤다(숫자 날짜 `20260929`를 보내면 "날짜가 올바르지 않습니다"가 아니라 오늘). `z.string()`은 숫자에 "expected string"을 내므로, 앞에 `z.preprocess`로 빈 문자열로 바꾸는 `text()` 도우미를 뒀다. 사소하지만 동작이 바뀌지 않게 하려면 이런 것까지 맞춰야 한다.

## 덤으로 맞춘 것

`AdminPost.deletedAt`이 desktop-core에서는 `?: string | null`, 서버에서는 `string | null`이었다. 서버는 늘 보내는데 화면 타입은 없을 수도 있다고 했던 것이다. 스키마를 하나로 두니 바로 드러나서 `string | null`로 맞췄다. 시험 픽스처 한 곳에 `deletedAt: null`을 더한 것이 전부다.

## 확인

- `packages/contracts/src/posts.test.ts`에 다섯 개를 썼다. "다듬고, 날짜가 없으면 오늘, 모르는 필드는 버린다", "이유를 칸 순서대로 모두 모은다", "길이를 넘으면 이유", "문자열이 아닌 칸은 빈 칸으로 본다 (숫자 날짜 → 오늘)", "관리자 글·공개 글·버전 모양을 받아들인다".
- 서버 `apps/api/src/posts/rules.test.ts`의 `parsePostInput` 시험은 고치지 않고 그대로 두었다. 함수 속이 스키마로 바뀌어도 같은 입력에 같은 결과가 나와야 하기 때문이다. 제목 빈칸·`2026-02-30`·깊이 4 폴더·공백 본문을 한 번에 보내 이유 네 개가 순서대로 나오는 경우가 그대로 통과했다.
- `packages/desktop-core/src/memo/posts.test.ts`는 `deletedAt: null` 한 줄을 더했다.
- E2E는 글 15개와 메모 정리 4개가 그대로 통과했다. E2E는 가짜 API(`e2e/fakeApi.ts`)를 쓰므로 서버 문구 자체는 보지 않는다. 문구와 순서가 같은지는 위의 서버 시험이 맡는다.
- 커밋은 파일 12개, +316/−73. 글·그림·잠금 파일을 빼면 코드는 +191/−73이고, 그중 시험이 80줄이다.

## 숫자

| 항목                        | 전            | 후                                      |
| --------------------------- | ------------- | --------------------------------------- |
| 서버 `parsePostInput`       | 21줄          | 1줄 (스키마는 contracts)                |
| `RevisionSummary`가 적힌 곳 | 2 (서버·화면) | 1                                       |
| `AdminPost.deletedAt` 타입  | 2가지         | 1가지                                   |
| 동작 변화                   |               | 없음 (e2e 글 15개·메모 정리 4개 그대로) |

## 남은 것과 배운 것

글 주소(`POST_SLUG`, `newSlug`)는 서버 `rules.ts`에 남겼다. 주소는 서버가 정하고 화면은 받은 값을 쓸 뿐이라 같이 쓸 이유가 없다.

`z.ZodType<PostContentShape>`로 묶는 방법은 타입이 이미 다른 패키지에 있을 때 쓸 만하다. 다만 한계가 있다. tsc는 스키마가 내는 값이 그 타입에 "들어맞는지"만 본다. 타입에 선택 필드를 새로 더하면 스키마가 그 필드를 모르고 버려도 컴파일은 지나간다. 필드를 더할 때는 스키마도 같이 보는 습관이 필요하다.

배운 것: 동작을 바꾸지 않는 리팩터링이라면 기존 시험을 고치지 않고 통과시키는 것이 가장 강한 증거다. 이번에는 숫자 날짜처럼 사소한 경우까지 기존 시험이 이미 적어 두어서, 새 스키마가 같은 답을 내는지 바로 알 수 있었다.

관련 글: [글 임시 저장과 버전](/memo/drafts-and-versions), [desktop-core에 메모 규칙 모으기](/memo/desktop-core-memo). 다음은 [메시지](/memo/contracts-messages)·[연락 메일](/memo/contracts-contact)·[배경화면](/memo/contracts-wallpapers)·[파일](/memo/contracts-files)·[분석](/memo/contracts-analytics) 순으로 같은 방식.

#MacFolio #리팩터링 #zod #TypeScript
