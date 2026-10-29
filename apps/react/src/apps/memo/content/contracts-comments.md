---
title: contracts 스키마 1 - zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기
date: 2026-10-11
category: 개발 기록/MacFolio/백엔드
summary: 댓글 모양을 서버(CommentView)와 화면(Comment)이 각자 적고 있어서 서버가 필드를 바꿔도 화면은 알 수 없었다. packages/contracts에 zod 스키마를 두고 서버는 검증에, 화면은 타입에 함께 쓰게 했다. 첫 사례인 댓글·좋아요와, 이후 열두 도메인으로 확장된 과정.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계 "타입과 데이터 구조"의 첫 항목이다. 3단계에서 서버 요청을 [공통 모듈 1 - 공통 API 클라이언트 api()·apiFetch()로 fetch 호출과 401 처리 통합하기](/memo/shared-api-client) 하나로 모았으므로, 다음 순서는 그 요청과 응답의 **모양**을 한 곳에 정의하는 것이다.

## 같은 모양을 두 번 적고 있었다

댓글 하나의 모양은 서버 `comments.service.ts`의 `CommentView`와 화면 `commentsApi.ts`의 `Comment`에 각각 정의되어 있었다. 필드 열 개가 글자 그대로 같다. 서버에 `likes` 필드를 추가했을 때 화면 쪽도 수정했는지는 사람이 기억해야 했다. 두 파일은 서로를 import하지 않으므로, 둘이 어긋나도 타입 검사는 오류를 내지 않는다.

검증도 마찬가지다. "내용은 1~500자"라는 규칙과 "내용을 입력해주세요."라는 문구는 서버 `rules.ts`의 `if`문 안에만 있었다. 화면은 규칙을 모른 채 요청을 보내고, 400 응답이 오면 서버가 보낸 문구를 그대로 표시한다. 화면에서 글자 수를 안내하려면 `500`을 화면 코드에 한 번 더 적어야 한다.

![전: 서버 CommentView와 화면 Comment가 각자 정의. 후: contracts의 스키마 하나를 서버는 검증에, 화면은 타입에 사용](./images/contracts-comments-shape.svg '전: 서버와 화면이 각자, 후: 스키마 하나에서 둘 다')

## contracts 패키지

`packages/contracts`(`@macfolio/contracts`)를 만들고 [zod](https://zod.dev/) 스키마를 정의했다. zod 스키마는 실행 시에 값을 검사하는 객체이면서, `z.infer`로 TypeScript 타입도 만들어 낸다. 그래서 스키마와 타입에 같은 이름을 붙인다.

```ts
// packages/contracts/src/comments.ts
export const CommentInput = requestBody({
	body: z
		.string({ error: '내용을 입력해주세요.' })
		.trim()
		.min(1, '내용을 입력해주세요.')
		.max(COMMENT_BODY_MAX, `내용은 ${COMMENT_BODY_MAX}자까지 입력할 수 있습니다.`),
	turnstileToken: z.string().optional(),
});
export type CommentInput = z.infer<typeof CommentInput>;

export const Comment = z.object({ id: z.string(), name: z.string(), ipPrefix: z.string().nullable() /* … */ });
export type Comment = z.infer<typeof Comment>;
```

| 사용처 | 가져오는 방법                                               | 쓰는 것                     |
| ------ | ----------------------------------------------------------- | --------------------------- |
| 서버   | `import { CommentInput, parse } from '@macfolio/contracts'` | 스키마(값)로 요청 본문 검사 |
| 화면   | `import type { Comment } from '@macfolio/contracts'`        | 타입만                      |

**서버**는 `parse(CommentInput, body)`로 검사한다. 반환 모양은 서버가 이미 쓰던 `{ value } | { errors: string[] }` 그대로라, 서비스의 `if ('errors' in parsed) throw new BadRequestException(parsed.errors)`는 수정하지 않았다. `rules.ts`의 `parseBody`는 8줄짜리 `if`문에서 1줄이 됐다.

**화면**은 [`import type`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export)으로 타입만 가져온다. `import type`은 컴파일 후 제거되므로 화면 번들에 zod가 포함되지 않는다(추가 크기 0바이트). 직접 적어 두었던 `interface Comment`·`Likes`·`PostCounts`는 삭제했다.

패키지 구조는 `desktop-core`와 같다. `package.json`의 [conditional exports](https://nodejs.org/api/packages.html#conditional-exports)에 `source` 조건을 두어, 화면(Vite)은 `src`를 직접 읽고 서버는 빌드한 `dist`를 읽는다. Dockerfile은 `desktop-core`와 `contracts`를 함께 빌드한다.

## 검토한 방법

| 방법                                | 서버 검증  | 화면 타입 | 문제                                                   |
| ----------------------------------- | ---------- | --------- | ------------------------------------------------------ |
| 기존처럼 각자 정의                  | `if`문     | 직접 작성 | 둘이 어긋나도 감지할 수 없다                           |
| `class-validator` DTO를 화면도 사용 | 데코레이터 | 클래스    | 데코레이터와 `reflect-metadata`가 화면 번들에 들어간다 |
| 타입만 공유하는 패키지              | `if`문     | 공유      | 규칙(500자)과 문구는 여전히 서버에만 있다              |
| zod 스키마 패키지 (선택한 방법)     | `parse`    | `z.infer` | 서버가 zod를 런타임 의존성으로 쓴다                    |

- **zod 4**. 스키마에 오류 문구를 한국어로 적을 수 있고(`.min(1, '…')`), 타입이 추론되며, 화면은 타입만 가져다 쓸 수 있다. NestJS의 [`class-validator`](https://docs.nestjs.com/techniques/validation)는 클래스 데코레이터 기반이라 화면 번들에 넣기 부적합해 선택하지 않았다.
- **`requestBody()`**: 요청 본문이 `null`이나 문자열이면 zod는 "Invalid input: expected object"를 반환한다. 사용자에게 보여 줄 문구가 아니다. `requestBody()`는 객체가 아닌 본문을 빈 객체로 간주해 각 필드의 문구를 내게 하는 도우미다. 이전에 `parseBody(null)`이 "내용을 입력해주세요."를 반환하던 동작이 유지된다.
- **응답 스키마도 정의한다**. 현재 화면은 응답을 검증하지 않고 타입만 쓴다. 스키마가 있으므로 필요해지면 `parse(Comment, json)` 한 줄로 서버 응답을 검증할 수 있다.
- **한 도메인만 옮긴다**. 이 PR에서는 댓글·좋아요(요청 스키마 1개, 응답 스키마 3개)만 옮겼다. 나머지(글, 메시지, 메일, 배경화면, 파일, 분석 …)는 도메인마다 PR 하나씩 같은 방식으로 진행했다. 처음부터 전부 옮기면 PR이 너무 커서 검토하기 어렵다.

## 수치

| 항목                    | 전   | 후                              |
| ----------------------- | ---- | ------------------------------- |
| 댓글 모양이 적힌 곳     | 2    | 1                               |
| `parseBody` 줄 수       | 8    | 1                               |
| 검증 문구가 적힌 곳     | 서버 | contracts (화면도 읽을 수 있다) |
| 화면 번들에 추가된 크기 | -    | 0 B (타입만)                    |

이 PR([#200](https://github.com/hyeoniverse/MacFolio/pull/200))에서 코드가 바뀐 파일은 서버 3개(`comments.service.ts`, `comments/rules.ts`, `likes.service.ts`)와 화면 2개(`commentsApi.ts`, `likesApi.ts`)다. 이 다섯 파일에서 61줄이 삭제되고 19줄이 추가되었다. 나머지는 새 패키지(스키마 43줄, 도우미 19줄, 시험 65줄)와 빌드 설정이다.

## 확인

- `packages/contracts/src/comments.test.ts`(시험 4개): **앞뒤 공백을 다듬고, 모르는 필드(이름·비밀번호)는 버린다**, **비었거나 500자를 넘으면 이유를 알린다**, **사람 확인 토큰은 있으면 그대로**, **서버가 주는 댓글 모양을 받아들이고, 해시 같은 여분 필드는 거른다**
- `packages/contracts/src/parse.test.ts`(시험 2개): **실패하면 스키마에 적은 문구를 순서대로, 같은 문구는 한 번만**
- 서버 e2e(`apps/api/test/comments.e2e.test.ts`)는 수정하지 않고 통과했다. 400 응답 문구가 이전과 한 글자도 다르지 않다는 뜻이다.

## 이후 진행

같은 날 PR 일곱 개가 더 이어졌다. 그 뒤로는 새 기능도 처음부터 contracts에 스키마를 정의하고 시작했다.

![#200부터 #207까지 첫날 여덟 PR, 이후 #235·#236·#255·#263 네 도메인이 contracts에 추가된 순서](./images/contracts-comments-timeline.svg '첫날 여덟 PR, 그 뒤 네 도메인')

<details>
<summary>도메인별 PR과 글 (12개)</summary>

| PR                                                       | 스키마 파일     | 도메인                            | 글                                                                                                                               |
| -------------------------------------------------------- | --------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [#200](https://github.com/hyeoniverse/MacFolio/pull/200) | `comments.ts`   | 댓글·좋아요                       | 이 글                                                                                                                            |
| [#201](https://github.com/hyeoniverse/MacFolio/pull/201) | `posts.ts`      | 블로그 글                         | [글 도메인](/memo/contracts-posts)                                                                                               |
| [#202](https://github.com/hyeoniverse/MacFolio/pull/202) | `messages.ts`   | 메시지                            | [메시지 도메인](/memo/contracts-messages)                                                                                        |
| [#203](https://github.com/hyeoniverse/MacFolio/pull/203) | `contact.ts`    | 연락 메일                         | [연락 메일](/memo/contracts-contact)                                                                                             |
| [#204](https://github.com/hyeoniverse/MacFolio/pull/204) | `wallpapers.ts` | 배경화면                          | [배경화면](/memo/contracts-wallpapers)                                                                                           |
| [#205](https://github.com/hyeoniverse/MacFolio/pull/205) | `files.ts`      | 올린 파일                         | [파일](/memo/contracts-files)                                                                                                    |
| [#206](https://github.com/hyeoniverse/MacFolio/pull/206) | `analytics.ts`  | 분석 이벤트                       | [분석](/memo/contracts-analytics)                                                                                                |
| [#207](https://github.com/hyeoniverse/MacFolio/pull/207) | `site.ts`       | 사이트 프로필                     | [사이트 프로필](/memo/contracts-site)                                                                                            |
| [#235](https://github.com/hyeoniverse/MacFolio/pull/235) | `settings.ts`   | 사진 캡션·사람 확인·GitHub 저장소 | [설정 입력 검사](/memo/settings-schemas)                                                                                         |
| [#236](https://github.com/hyeoniverse/MacFolio/pull/236) | `demos.ts`      | 데모 입력                         | [contracts 스키마 8 - 관리자 설정과 AI 데모의 if 문 입력 검사 일곱 개를 contracts의 zod 스키마로 옮기기](/memo/settings-schemas) |
| [#255](https://github.com/hyeoniverse/MacFolio/pull/255) | `documents.ts`  | 문서 파일 (새 기능)               | [Finder 문서 파일](/memo/finder-files)                                                                                           |
| [#263](https://github.com/hyeoniverse/MacFolio/pull/263) | `finder.ts`     | 폴더 구조 (새 기능)               | [Finder 3 - R2 키는 두고 JSON 한 행에 표시 위치만 기록하는 Finder 파일 시스템](/memo/finder-filesystem)                          |

</details>

현재 `packages/contracts/src`에는 시험을 제외한 파일이 14개(도메인 스키마 12개, `parse.ts`, `index.ts`)다. `CONTRIBUTING.md`에도 "API 요청·응답의 모양은 `packages/contracts`의 zod 스키마에 정의한다"를 규칙으로 적었다.

## 남은 것, 배운 것

- 화면은 지금도 응답을 실행 시에 검증하지 않는다. `parse(Comment, json)` 한 줄이면 되지만, 그러면 화면 번들에 zod가 포함된다. 서버와 화면이 같은 저장소에서 함께 배포되므로 타입 검사만으로 충분하다고 판단했다.
- 첫 PR을 한 도메인으로 작게 나눈 덕분에 나머지 일곱 PR을 하루에 마칠 수 있었다. 패키지 구조, Dockerfile, CI, `requestBody()`·`parse()` 도우미가 첫 PR에서 정해졌고, 이후 PR은 스키마만 옮기면 됐다.
- 핵심은 스키마가 "값이면서 타입"이라는 점이다. 타입만 공유하면 규칙이 서버에 남고, 규칙만 공유하면 타입이 따로 관리된다.

## 따라 해 보기

계약을 바꿀 때는 `packages/contracts`를 먼저 수정하고, 서버와 화면이 모두 새 모양을 따르는지 확인한다.

```bash
pnpm --filter @macfolio/contracts test          # 스키마 시험
pnpm --filter @macfolio/contracts build         # 서버는 빌드된 JS를 읽는다
pnpm typecheck                                  # 화면·서버가 새 모양을 따르는지
pnpm --filter @macfolio/api test:e2e test/comments.e2e.test.ts
```

`Comment`의 필드 이름을 하나 바꿔 보면 `pnpm typecheck`가 서버와 화면에서 동시에 실패한다. 계약을 바꾸면 양쪽에서 컴파일 오류로 드러나는 것이 이 작업의 효과다. 확인한 뒤에는 변경을 되돌린다. HTTP 경계 시험(e2e)을 실행하려면 먼저 `pnpm --filter @macfolio/api db:up`으로 로컬 PostgreSQL을 실행한다.

## 관련 글

- [공통 모듈 1 - 공통 API 클라이언트 api()·apiFetch()로 fetch 호출과 401 처리 통합하기](/memo/shared-api-client)
- [contracts 스키마 4 - zod superRefine으로 첫 실패 문구만 반환하는 화면·서버 공통 검사](/memo/contracts-contact)
- [contracts 스키마 2 - ZodType<PostContent>로 기존 타입과 zod 스키마의 일치를 tsc로 검사하기](/memo/contracts-posts)
- [트래픽 분석 5 - zod 스키마 하나로 분석 이벤트의 전송 형식과 서버 검증 통합하기](/memo/contracts-analytics)
- [contracts 스키마 7 - parseProfile의 if문 검증을 zod 스키마로 옮기기](/memo/contracts-site)

#MacFolio #리팩터링 #zod #TypeScript
