---
title: zod 스키마와 브랜드 타입으로 화면과 서버의 타입 통합하기
date: 2026-10-18
category: 개발 기록/MacFolio/아키텍처
series: 리팩터링
seriesOrder: 1
summary: 리팩터링 1단계 회고. 화면과 서버가 각각 정의하던 요청·응답 구조를 @macfolio/contracts의 zod 스키마로 통합하고, 1,629줄 profile.ts를 분리하고, 글 주소에 브랜드 타입을 적용했다. 채택한 방법과 제외한 방법, PR 열 개의 순서와 규모를 정리한다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 1단계 목표는 "같은 데이터 구조를 두 번 정의하지 않기"였다. 이 글은 단계 전체를 요약하고, 세부 내용은 PR마다 작성한 글로 연결한다.

리팩터링은 10월 1일 버튼 구조를 도식으로 정리하다가 공통 컴포넌트가 없다는 것을 확인하면서 시작됐다. 10월 10일 새벽에 타입·구조체 정리부터 공통 컴포넌트, 스타일, 보안까지 전 영역을 다루는 계획을 이슈로 작성했다. 그런데 실제 작업은 1단계보다 2단계가 먼저 진행되고 있었다. 의존 관계를 따져 보니 2 → 3 → 1 순서로 진행해야 하는 부분이 있어 2단계의 두 안 중 하나를 먼저 선택해야 했고, 그 선택은 작업 규모나 복잡도가 아니라 코드 품질만 기준으로 정했다.

## 왜

계획을 작성한 시각의 상태는 다음과 같았다.

- 화면이 API 응답 타입을 직접 다시 정의했다 (예: `commentsApi.ts`의 `Comment`).
- API는 전역 [`ValidationPipe`](https://docs.nestjs.com/techniques/validation)(whitelist)를 활성화했지만 DTO 클래스가 없어 실제로 필터링되는 값이 없었고, 서비스마다 직접 검사했다.
- `shared/profile.ts` 한 파일 1,629줄에 프로필·기술·`PROJECTS`·타입이 함께 있었다.

### 정의가 어긋나면 생기는 문제

댓글을 예로 들면 다음과 같다. 화면의 `commentsApi.ts`는 댓글 구조를 인터페이스로 다시 정의했고, 서버의 `comments/rules.ts`는 내용 길이를 if문으로 검사했다.

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

서버가 응답에 필드를 추가하거나 이름을 바꾸면 화면의 타입은 그대로이므로 컴파일러가 감지하지 못한다. 상한 500자도 화면과 서버에 각각 정의되어 있었다. 이런 중복 정의가 도메인마다 있었다.

## 채택한 방법과 제외한 방법

같은 구조를 한 번만 정의하는 방법을 비교하면 다음과 같다. `class-validator`는 데코레이터 기반이라 화면에서 사용할 수 없다는 점이 처음부터 제외한 이유였다.

| 방법                                  | 장점                                                          | 단점                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| NestJS DTO 클래스 + `class-validator` | 이미 활성화한 `ValidationPipe`가 바로 사용한다                | 데코레이터 클래스라 화면(React)에서 재사용하기 어렵다. 타입과 검사 규칙이 서버 쪽에만 생긴다         |
| OpenAPI 문서에서 화면 타입을 생성     | Swagger 문서가 이미 있다                                      | 생성한 파일을 커밋하거나 빌드 단계에 추가해야 한다. 문서가 실제 검사와 같다는 보장이 별도로 필요하다 |
| 공유 패키지에 zod 스키마 (채택)       | 스키마 하나에서 검사(`parse`)와 타입(`z.infer`)을 함께 얻는다 | 패키지가 하나 늘고, 서버 Dockerfile과 CI가 이 패키지를 먼저 빌드해야 한다                            |

[zod](https://zod.dev)를 채택한 이유는 화면도 같은 규칙을 "실행"해야 했기 때문이다. 글 편집기와 메일 앱은 전송 전에 같은 상한으로 입력을 차단한다. 타입만 공유하는 방법으로는 이 검사를 할 수 없다. 전역 `ValidationPipe`는 삭제하지 않았다. DTO가 없어 현재는 동작하지 않지만, 이후 DTO를 쓰는 경로가 생겨도 같은 설정이 적용되도록 유지했다.

## 변경 목록

| 항목                               | PR                                                       | 글                                                                                                 |
| ---------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/contracts`와 댓글·좋아요 | [#200](https://github.com/hyeoniverse/MacFolio/pull/200) | [zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-comments) |
| 글                                 | [#201](https://github.com/hyeoniverse/MacFolio/pull/201) | [글 도메인 옮기기](/memo/contracts-posts)                                                          |
| 메시지                             | [#202](https://github.com/hyeoniverse/MacFolio/pull/202) | [메시지 도메인 옮기기](/memo/contracts-messages)                                                   |
| 연락 메일                          | [#203](https://github.com/hyeoniverse/MacFolio/pull/203) | [연락 메일의 검사 규칙을 하나로](/memo/contracts-contact)                                          |
| 배경화면                           | [#204](https://github.com/hyeoniverse/MacFolio/pull/204) | [배경화면 도메인 옮기기](/memo/contracts-wallpapers)                                               |
| 파일                               | [#205](https://github.com/hyeoniverse/MacFolio/pull/205) | [올린 파일 규칙을 둘로 나누기](/memo/contracts-files)                                              |
| 분석                               | [#206](https://github.com/hyeoniverse/MacFolio/pull/206) | [분석 이벤트의 모양을 하나로](/memo/contracts-analytics)                                           |
| 사이트 프로필                      | [#207](https://github.com/hyeoniverse/MacFolio/pull/207) | [사이트 프로필로 1단계 마무리](/memo/contracts-site)                                               |
| `profile.ts` 분리                  | [#208](https://github.com/hyeoniverse/MacFolio/pull/208) | [index.ts 재내보내기로 import 경로를 유지하며 큰 모듈을 폴더로 나누기](/memo/profile-split)        |
| 브랜드 타입                        | [#209](https://github.com/hyeoniverse/MacFolio/pull/209) | [PostSlug·FolderPath 브랜드 타입](/memo/branded-ids)                                               |

방식은 하나다.

1. 요청·응답의 구조는 `@macfolio/contracts`에 zod 스키마로 정의한다.
2. 서버는 `parse()`로 검증한다.
3. 화면은 `import type`으로 같은 타입만 가져온다.
4. 타입과 순수 규칙(글 길이·날짜 등)은 `desktop-core`에 유지한다.

여덟 도메인이 모두 이 구조로 이전했다.

![desktop-core, contracts, api, react의 관계와 contracts 밖에 남긴 것](./images/refactor-step1-types-contracts.svg '1단계가 끝난 뒤 요청·응답 모양이 흐르는 길')

## 구현: 공통 도구와 도메인 여덟 개

첫 PR([#200](https://github.com/hyeoniverse/MacFolio/pull/200))에서 패키지와 함께 헬퍼 두 개를 만들었다. 이후 도메인 PR은 모두 이 둘을 사용했다.

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

`parse()`의 반환 형태 `{ value } | { errors }`는 서버의 기존 수동 검사 함수들이 쓰던 형태와 같다. 그래서 컨트롤러와 화면은 수정할 필요가 없었다. `requestBody()`는 요청 본문이 `null`이나 문자열일 때 zod의 영어 기본 메시지 대신 필드별 한국어 메시지가 출력되게 한다.

그 결과 댓글의 서버 검사는 한 줄이 됐다.

```ts
// apps/api/src/comments/rules.ts (#200 뒤)
export const parseBody = (input: unknown) => parse(CommentInput, input);
```

순서는 작은 도메인부터 정했다. 댓글·좋아요(#200)에서 패키지 기본 구조와 Dockerfile·CI의 빌드 순서를 맞추고, 글(#201)·메시지(#202)·연락 메일(#203)·배경화면(#204)·파일(#205)·분석(#206)·사이트 프로필(#207)을 하나씩 이전했다. 열 개 PR이 10월 11일 오전 네 시간 사이에 병합되었다. 도메인 PR은 글과 그림까지 합쳐 300줄 안팎이었고, `profile.ts` 분리(#208)만 파일 이동 때문에 1,775줄을 추가하고 1,630줄을 삭제했다.

![1단계 PR 열 개의 더한 줄과 지운 줄](./images/refactor-step1-types-prs.svg 'profile.ts 나누기를 빼면 PR마다 300줄 안팎이다')

### 글 도메인: 스키마를 기존 타입에 맞추기

글은 타입이 이미 `desktop-core`에 있었다(`PostContent`, `AdminPost`). 스키마를 새로 작성하면 타입 정의가 둘이 된다. 그래서 스키마에 그 타입을 지정해, 둘이 어긋나면 `tsc`가 실패하게 했다.

```ts
export const postInput = (today: string): z.ZodType<PostContentShape, unknown> =>
	requestBody({
		title: text()
			.refine((title) => title.length > 0, '제목을 입력해주세요.')
			.refine((title) => title.length <= POST_LIMITS.title, `제목은 ${POST_LIMITS.title}자까지 입력할 수 있습니다.`),
		// date, category, summary, body …
	});
```

오류 메시지는 필드 순서(제목 → 날짜 → 폴더 → 요약 → 본문)대로 모두 수집한다. 기존 if문도 그 순서로 수집했기 때문에, 메시지와 순서를 비교하는 기존 단위 시험이 그대로 통과해야 이전 완료로 판단했다.

### 브랜드 타입: 검사를 통과한 문자열만

글 주소와 폴더 경로는 둘 다 `string`이라, 함수 인수의 순서를 바꿔 전달해도 컴파일러가 감지하지 못한다. [#209](https://github.com/hyeoniverse/MacFolio/pull/209)에서 브랜드 타입[^brand]을 적용했다.

```ts
// packages/desktop-core/src/memo/rules.ts
declare const postSlugBrand: unique symbol;
export type PostSlug = string & { readonly [postSlugBrand]: true };

/** 글 주소 모양이면 PostSlug, 아니면 null (바깥에서 온 문자열을 글 주소로 바꾸는 유일한 길) */
export const postSlug = (value: unknown): PostSlug | null => (isPostSlug(value) ? value : null);
```

런타임에는 일반 문자열이므로 비용이 없다. 외부에서 들어온 값(주소창, 서버 응답, 브라우저 저장소)은 `postSlug()`·`folderPath()`를 거쳐야 하므로, 검사가 누락된 경로가 컴파일 오류로 드러난다.

## 전후

|                     | 전                    | 후                                                               |
| ------------------- | --------------------- | ---------------------------------------------------------------- |
| 응답 타입           | 화면·서버가 각각 정의 | 여덟 도메인이 contracts 한 곳                                    |
| `shared/profile.ts` | 1,629줄 한 파일       | 프로젝트마다 한 파일, 외부 import 27곳은 변경 없음               |
| `any`               | —                     | 0건                                                              |
| 글 주소·폴더 경로   | `string`              | `PostSlug`·`FolderPath`, `postSlug()`·`folderPath()`를 거쳐야 함 |

글 PR에서는 서버의 if문 21줄이 스키마 하나로 바뀌었고, 사이트 프로필에서는 if문 58줄을 zod로 이전하며 메시지 11개와 순서를 시험으로 고정했다.

## 확인

- 도메인 PR마다 기존 API 단위·e2e 시험을 수정하지 않고 통과시켰다. 메시지가 바뀌면 시험이 실패하므로 "동작 유지"의 판단 기준이 됐다.
- contracts에는 도메인마다 시험 파일을 두었다. 현재 `packages/contracts/src`에 시험 파일이 13개 있다.
- 서버 Docker 이미지가 contracts를 먼저 빌드하는지는 #200에서 Dockerfile과 CI 순서를 함께 수정해 확인했다.
- 현재 `apps/react/src`와 `apps/api/src`에서 `@macfolio/contracts`를 import하는 파일은 67개다.

## 의도적으로 남긴 것

- 배경화면 업로드는 multipart 요청이라 스키마가 없고, 이름만 같은 함수를 거친다.
- 매직 바이트[^magic] 확인·EXIF 삭제처럼 서버만 수행하는 처리는 contracts로 옮기지 않았다. 기준은 "화면도 알아야 하는 규칙인가"였다.
- 관리자 설정과 데모의 요청 검사는 6단계(서버)에서 같은 방식으로 이전했다.

## 배운 것

- **반환 형태를 먼저 맞추면 이전이 쉽다.** `parse()`가 기존 함수와 같은 `{ value } | { errors }`를 반환해서, 호출하는 쪽은 한 줄도 수정하지 않았다.
- **메시지 시험이 안전망이다.** 사용자에게 표시되는 거절 메시지를 그대로 비교하는 시험이 있어서, 검사 방식을 전부 바꿔도 외부 동작이 같다는 것을 확인할 수 있었다.
- **작게 나누면 하루에 끝난다.** 도메인 하나에 PR 하나로 나누니, 열 개가 반나절 만에 병합되었다.

다음 단계: [2단계 — 폴더 구조와 의존](/memo/refactor-step2-structure). 전체 회고는 [리팩터링 계획을 마치며](/memo/refactor-retrospective)에 있다.

## 관련 글

- [zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-comments)
- [PostSlug·FolderPath 브랜드 타입](/memo/branded-ids)
- [index.ts 재내보내기로 import 경로를 유지하며 큰 모듈을 폴더로 나누기](/memo/profile-split)
- [서버 if 문 검사와 화면 상한을 zod 스키마 하나로 합치기](/memo/settings-schemas)
- [순환 의존 차단과 큰 파일 분할로 정리한 모듈 구조](/memo/refactor-step2-structure)

[^brand]: 브랜드 타입(branded type)은 `string` 같은 기본 타입에 런타임에는 존재하지 않는 표시 속성을 교차 타입으로 붙여, 검사 함수를 거친 값만 그 타입으로 인정하게 하는 TypeScript 기법이다.

[^magic]: 매직 바이트는 파일 앞부분의 고정된 바이트 열이다. 예를 들어 PNG는 `89 50 4E 47`로 시작한다. 확장자나 `Content-Type` 대신 실제 파일 형식을 확인하는 데 쓴다.

#MacFolio #리팩터링 #TypeScript #zod
