---
title: 방문자 쿠키 HMAC으로 중복을 막는 로그인 없는 좋아요
date: 2026-10-10
category: 개발 기록/MacFolio/서버·API
summary: 글과 댓글에 로그인 없이 누르는 좋아요를 추가하고, 조회·댓글·좋아요로 점수를 계산해 상위 10개를 표시하는 '인기글' 폴더를 만들었다. 서버는 저장소의 Markdown 글 목록이 없으므로 글마다 집계 값만 반환하고, 순위는 화면에서 계산한다.
---

블로그 글에는 조회수와 댓글이 있었지만, 독자가 글을 쓰지 않고 반응을 남길 방법은 없었다. 그래서 글과 댓글에 좋아요 버튼을 추가하고, 반응이 많은 글을 모아 보는 '인기글' 폴더를 만들었다. 커밋 하나(`2bdb8d6da`)로 서버·화면·시험을 함께 추가했고, 변경 규모는 38개 파일, 1,400줄 추가, 47줄 삭제다.

## 배경: 로그인 없는 좋아요에 필요한 것

좋아요는 "이 글에 반응한 사람 수"를 집계하는 기능이다. 집계가 의미를 가지려면 같은 사람이 버튼을 여러 번 눌러도 1로 집계되어야 한다. 회원 가입이 있는 서비스는 사용자 ID로 중복을 확인하지만, 이 블로그는 방문자에게 로그인을 요구하지 않는다. 그래서 두 가지를 정해야 했다.

| 질문                            | 이 글의 답                                                              |
| ------------------------------- | ----------------------------------------------------------------------- |
| 누가 눌렀는지 무엇으로 구분하나 | 댓글 기능이 이미 쓰던 방문자 쿠키(`macfolio_visitor`)                   |
| 그 값을 DB에 어떻게 저장하나    | 쿠키 값 대신, 서버만 아는 비밀 키로 계산한 HMAC 값                      |
| 반복 클릭은 어떻게 처리하나     | 같은 요청을 여러 번 보내도 결과가 같은 멱등 API + IP마다 요청 횟수 제한 |
| 인기 순위는 어디서 계산하나     | 서버는 글마다 집계 값만 반환하고, 화면이 점수와 순위를 계산             |

쿠키는 서버가 응답 헤더(`Set-Cookie`)로 브라우저에 저장하게 하고, 브라우저가 이후 같은 사이트로 보내는 요청마다 자동으로 붙이는 작은 문자열이다. 방문자 쿠키는 처음 접속한 브라우저에 무작위 토큰 32자를 1년 동안 저장하며, `httpOnly` 속성이 있어 페이지의 JavaScript는 이 값을 읽을 수 없다. 같은 브라우저라면 언제 접속해도 같은 토큰이 붙으므로, 로그인 없이도 "같은 브라우저"를 구분할 수 있다.

## 좋아요의 주체와 횟수 제한

같은 사람의 중복 좋아요는 방문자 쿠키로 막는다. 서버는 쿠키 값을 그대로 저장하지 않고 비밀 키로 계산한 HMAC[^hmac] 값만 저장한다. 실제 계산은 `apps/api/src/visitors/visitor.ts`의 함수 한 줄이다.

```ts
export const hashVisitor = (token: string, secret: string) =>
	createHmac('sha256', secret).update(`visitor:${token}`).digest('hex');
```

HMAC은 해시 함수(SHA-256)에 비밀 키를 섞어 계산한다. 입력이 같으면 결과도 같으므로 같은 브라우저는 항상 같은 해시를 얻고, 비밀 키를 모르는 사람은 토큰에서 해시를 만들 수도, 해시에서 토큰을 되돌릴 수도 없다. 아래 그림은 [RFC 2104](https://www.rfc-editor.org/rfc/rfc2104)가 정의한 HMAC의 계산 순서다. 키를 안쪽 패딩(`i_pad`)과 XOR한 값을 메시지 앞에 붙여 한 번 해시하고, 그 결과에 바깥 패딩(`o_pad`)과 XOR한 키를 다시 붙여 한 번 더 해시한다.

![HMAC 계산 구조](./images/memo-likes-popular-hmac-structure.png 'HMAC의 두 단계 해시. 그림의 예는 SHA-1(결과 20바이트)이고, MacFolio는 같은 구조에 SHA-256(결과 32바이트, 16진수 64자)을 쓴다')

이 해시를 좋아요 테이블의 기본 키에 넣는다.

```prisma
model PostLike {
  postSlug    String
  visitorHash String
  @@id([postSlug, visitorHash])
}

model CommentLike {
  commentId   String
  comment     PostComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  visitorHash String
  @@id([commentId, visitorHash])
}
```

![방문자 쿠키에서 좋아요 행까지](./images/memo-likes-popular-visitor-hash.svg '같은 브라우저는 같은 해시를 얻으므로 (글, 해시) 기본 키가 중복 행을 막는다. 다른 브라우저는 다른 해시라 새 행이 된다')

- 기본 키가 (글, 방문자)라서 같은 브라우저가 두 번 눌러도 행은 하나다. 누르기는 [`createMany({ skipDuplicates: true })`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#createmany), 취소는 `deleteMany`라서, 같은 요청을 두 번 보내도 오류 없이 결과가 같다. 이 성질을 멱등성(idempotency)이라 한다. HTTP 명세([RFC 9110](https://www.rfc-editor.org/rfc/rfc9110#name-idempotent-methods))도 `PUT`과 `DELETE`를 멱등 메서드로 정의하므로, 누르기를 `PUT`, 취소를 `DELETE`로 만들었다.
- 글은 저장소의 Markdown 파일일 수도 있어서 `Post` 테이블과 외래 키로 연결하지 않고 주소(slug)만 저장한다. 댓글 수를 집계할 때와 같은 방식이다.
- 댓글 좋아요는 댓글을 삭제하면 함께 삭제된다(`onDelete: Cascade`).
- 쿠키를 삭제하거나 다른 브라우저로 접속하면 다시 누를 수 있다. 로그인 없는 좋아요의 한계이고, 개인 블로그에서는 허용 가능한 수준으로 판단했다.

예를 들어 같은 브라우저에서 `PUT /posts/memo-lock/like`를 세 번 보내면 세 응답 모두 같은 값이다.

```http
PUT /posts/memo-lock/like
Cookie: macfolio_visitor=…

200 OK
{ "count": 5, "liked": true }
```

| 요청                            | 동작                              |
| ------------------------------- | --------------------------------- |
| `GET /posts/:slug/likes`        | `{ count, liked }`                |
| `PUT /posts/:slug/like`         | 누르기 (이미 눌렀으면 변화 없음)  |
| `DELETE /posts/:slug/like`      | 취소                              |
| `PUT·DELETE /comments/:id/like` | 댓글에 누르기·취소                |
| `GET /posts/stats`              | 글마다 댓글 수·좋아요 수 (인기글) |

댓글 목록에는 댓글마다 `likes`(수)와 `liked`(이 브라우저가 눌렀는지)가 포함된다. 누가 눌렀는지(방문자 해시)는 응답에 포함하지 않는다. 기존 API 시험이 댓글 응답의 키 목록을 정확히 비교하고 있어서, 새 키를 그 시험의 기대값에도 추가했다.

## 요청 제한

요청 제한(rate limiting)은 한 클라이언트가 일정 시간 안에 보낼 수 있는 요청 수를 정하고, 넘으면 [429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429)로 거절하는 장치다. 스크립트로 버튼을 수천 번 누르는 요청이 DB에 쓰기를 반복하지 못하게 한다.

댓글 쓰기는 IP마다 1분에 5회로 제한하는데, 좋아요는 누르기와 취소를 반복할 수 있어서 이 제한은 너무 낮다. 그래서 `like`라는 별도 제한을 추가했다(`LIKE_RATE_LIMIT`, 기본 30).

> [!WARNING] 경로마다 따로 집계하는 요청 제한
> NestJS의 [요청 제한](https://docs.nestjs.com/security/rate-limiting)(`@nestjs/throttler`)은 **경로마다** 집계한다. 처음에는 "누르기와 취소를 합쳐 30회"라고 문서화하고 시험도 그렇게 작성했는데 실패했다. 누르기 경로와 취소 경로를 별도로 집계한다는 것을 확인하고, 설명과 시험을 "경로마다 30회"로 수정했다.

![경로마다 따로 집계되는 요청 제한](./images/memo-likes-popular-throttle.svg '한 IP가 1분에 PUT 30회, DELETE 30회를 각각 보낼 수 있고, 31번째 PUT만 429로 거절된다')

제한을 하나 추가하면, `ThrottlerGuard`를 쓰는 다른 경로(로그인, 댓글, 메시지)에도 새 제한을 건너뛰도록 `@SkipThrottle({ ..., like: true })`를 붙여야 한다. ==붙이지 않으면 댓글 쓰기 요청이 좋아요 제한에도 집계된다==.

## 화면

- 글 아래, 이전·다음 글 링크 위에 가운데 정렬한 캡슐 버튼 `♡ 4`. Apple 앱처럼 테두리 없이 옅은 회색 바탕(iOS의 tertiarySystemFill)에 하트와 수만 표시한다. 누르면 하트와 바탕이 systemPink(`#ff2d55`, 다크 모드 `#ff375f`)로 바뀌고, 누르는 동안 버튼이 축소됐다가 하트가 스프링 애니메이션으로 커진다.
- 댓글마다 본문 아래에 작은 하트 버튼. 수가 0이면 숫자를 숨기고, 마우스를 올리면 같은 옅은 회색 바탕이 표시된다.
- 누르는 즉시 화면을 갱신하고(낙관적 업데이트[^optimistic]), 서버 응답 값으로 보정한다. 요청이 실패하면 누르기 전 상태로 되돌린다.
- 서버가 없으면(로컬에서 API 없이 실행) 좋아요 버튼과 인기글 폴더를 표시하지 않는다.

![낙관적 업데이트의 성공과 실패](./images/memo-likes-popular-optimistic.svg '숫자는 설명용 예시다. 성공하면 서버가 보낸 count로 덮어쓰고, 실패하면 누르기 전 값으로 되돌린다')

서버 응답을 기다린 뒤 하트를 바꾸면, 네트워크 왕복 시간만큼 버튼이 반응하지 않는 것처럼 보인다. 좋아요는 실패할 가능성이 낮고 실패해도 되돌리기 쉬운 동작이라 먼저 바꾸는 방식이 적합하다. 응답의 `count`로 덮어쓰는 단계가 있으므로, 그사이 다른 방문자가 누른 좋아요도 화면에 반영된다.

## 인기글: 순위는 화면에서 계산

순위를 계산할 위치는 세 가지를 비교해 선택했다.

| 방법                              | 장점                                                | 단점                                                                               |
| --------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 서버가 순위까지 계산              | 화면의 계산량이 적다                                | 서버에는 저장소의 Markdown 글 목록이 없다. 글 목록을 서버에 별도로 업로드해야 한다 |
| 빌드 과정에서 계산                | 요청이 없다                                         | 좋아요가 실시간으로 반영되지 않는다                                                |
| **서버는 집계 값만, 화면이 순위** | 저장소 글과 서버 글을 함께 다룬다, 누르면 즉시 반영 | 글이 많아지면 모든 글의 집계 값을 내려받아야 한다                                  |

이 블로그의 글은 대부분 저장소의 Markdown 파일이고, 빌드 시각에 화면 번들에 포함된다. 서버 DB에 있는 글은 관리자가 사이트에서 작성하거나 수정한 글뿐이다. 그래서 ==서버가 "인기글 10개"를 직접 반환할 수 없다==. 서버가 아는 것은 "주소 `cra-to-vite`의 좋아요 3개"처럼 주소별 숫자뿐이고, 그 주소에 해당하는 글이 지금 존재하는지는 화면만 안다. 그래서 서버는 **글마다 집계 값**만 반환하고, 순위는 화면에서 계산한다.

- 조회수: 원래 있던 `GET /analytics/views?app=memo`
- 댓글 수·좋아요 수: 새 `GET /posts/stats`

점수 계산식은 다음과 같다.

```text
점수 = 조회 × 1 + 좋아요 × 3 + 댓글 × 5
```

![인기글 순위를 매기는 흐름](./images/memo-likes-popular-ranking.svg '서버는 글마다 집계 값만 반환하고, 점수와 순위는 화면이 계산한다')

| 항목   | 가중치 | 이유                                  |
| ------ | ------ | ------------------------------------- |
| 조회   | 1      | 가장 흔한 반응이다                    |
| 좋아요 | 3      | 버튼 한 번이지만 의도적인 반응이다    |
| 댓글   | 5      | 글을 작성해야 하므로 비용이 가장 크다 |

예를 들어 조회 10, 좋아요 4, 댓글 3인 글 B의 점수는 다음과 같다.

$$
10 \times 1 + 4 \times 3 + 3 \times 5 = 10 + 12 + 15 = 37
$$

조회만 40인 글 A의 점수 40과 3점 차이다. 조회수만으로 정렬하면 B는 A의 4분의 1이지만, 가중치를 두면 반응이 있는 글이 상위권에 들어온다.

![점수 예](./images/memo-likes-popular-score.svg '조회가 많은 글과 반응이 있는 글의 점수 차이가 좁혀진다')

점수가 같으면 좋아요, 댓글, 조회가 많은 순서이고, 그래도 같으면 최근 글이 먼저다. 점수가 0인 글(반응이 없는 글)은 제외한다.

이 계산은 프레임워크에 의존하지 않는 `desktop-core`의 `popularPosts()`에 구현하고, 단위 시험으로 순서와 10개 제한을 확인했다.

<details>
<summary>popularPosts() 전체 코드</summary>

```ts
export function popularPosts(posts: Post[], stats: Record<string, Partial<PostStats>>, limit = POPULAR_LIMIT): Post[] {
	return posts
		.map((post) => ({ post, stats: statsOf(stats, post.slug) }))
		.map((entry) => ({ ...entry, score: popularityScore(entry.stats) }))
		.filter((entry) => entry.score > 0)
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.stats.likes - a.stats.likes ||
				b.stats.comments - a.stats.comments ||
				b.stats.views - a.stats.views ||
				b.post.date.localeCompare(a.post.date)
		)
		.slice(0, limit)
		.map((entry) => entry.post);
}
```

</details>

## 인기글 폴더

사이드바의 '모든 글' 바로 아래에 **인기글**이 있다. 다른 폴더와 같은 폴더 아이콘을 사용한다. 태그 보기, 최근 삭제된 항목처럼 실제 폴더가 아니라 가상 보기라서, 폴더 경로에 쓸 수 없는 문자로 시작하는 식별자(`\u0000popular`)를 사용한다. `\u0000`은 문자 코드 0인 제어 문자(NUL)이고, 폴더 경로 규칙이 허용하지 않는 문자다. 따라서 'popular'라는 이름의 폴더를 만들어도 인기글 보기와 충돌하지 않는다.

| 항목             | 일반 폴더                  | 인기글                                            |
| ---------------- | -------------------------- | ------------------------------------------------- |
| 정렬             | 정렬 설정·고정·날짜별 그룹 | **순위 그대로**                                   |
| 제목 앞          | 없음                       | 순위 번호 (1~3위는 주황)                          |
| 날짜·요약 위치   | 날짜와 요약                | `조회 42 · 댓글 3 · 좋아요 5` (0인 항목 제외)     |
| 검색 필터링      | 결과만 표시                | 순위 번호 유지 (필터링 결과에서 다시 매기지 않음) |
| 좋아요·댓글 직후 | -                          | 서버 재요청 없이 집계 값을 갱신해 순위에 반영     |

![인기글 폴더와 글 아래 좋아요 버튼](./images/memo-likes-popular-folder.jpg '순위 번호(1~3위 주황)와 조회·댓글·좋아요 집계가 목록에 표시되고, 본문 아래에 좋아요 캡슐 버튼이 있다. 가짜 API(e2e/fakeApi.ts)의 집계 값으로 캡처했다')

검색 결과에서 순위를 다시 매기지 않는 이유는 번호의 의미를 유지하기 위해서다. 인기글 3위 글이 검색 결과에 하나만 남아도 번호는 1이 아니라 3으로 표시된다.

## 시험

<details>
<summary>시험 항목 (단위, API e2e, E2E)</summary>

- 단위: 점수, 반응이 없는 글 제외, 같은 점수의 순서, 10개 제한, 인기글 보기의 순위 유지(정렬·고정 무시, 검색)
- API e2e: 브라우저마다 1회, 다시 눌러도 결과 동일, 취소, 댓글 목록의 `likes`·`liked`, 댓글 삭제 시 좋아요도 삭제, `/posts/stats`, 요청 제한 429
- E2E: 글 좋아요 누르기·취소, 댓글 좋아요, 서버가 없으면 숨김, 인기글 순위·반응 표시·좋아요 후 순위 변경, 10개 제한과 검색 후에도 유지되는 순위

</details>

## 이후: 병합에서 누락된 좋아요

같은 시기에 쓰기 경로 전체에 요청 제한을 적용하는 작업([#162](https://github.com/hyeoniverse/MacFolio/pull/162))이 다른 브랜치에서 진행 중이었다. 그 브랜치에 main을 병합하면서 좋아요 모듈과 `like` 제한이 누락됐고, 바로 복원했다. 복원하면서 서버의 경로 표 시험(`routes.e2e.test.ts`)에 좋아요 경로 여섯 개를 추가했다. 이 표는 GET이 아닌 경로마다 제한이 적용되어 있는지 확인하므로, ==같은 누락이 다시 생기면 이 시험이 실패한다==.

이 작업에서 위의 `@SkipThrottle({ ..., like: true })` 방식도 제거했다. 이제 경로마다 `@RateLimit('like')`처럼 이름 하나만 붙이고, 제한 이름과 값은 `common/rate-limit.ts` 한 곳에 정의한다(`like`: 30). 제한이 일곱 개가 되자 경로마다 건너뛸 이름을 여섯 개씩 나열해야 해서 데코레이터 하나로 통합했다. 자세한 내용은 [쓰기 경로 33개에 요청 제한](/memo/rate-limit-all-writes)에 있다.

`RateLimit()`은 지정한 이름을 뺀 나머지 제한 이름을 모두 건너뛰도록 계산한다(`common/rate-limit.ts`).

```ts
export function RateLimit(name: RateLimitName) {
	const skip = Object.fromEntries(RATE_LIMIT_NAMES.filter((other) => other !== name).map((other) => [other, true]));
	return applyDecorators(SetMetadata(RATE_LIMIT_KEY, name), SkipThrottle(skip), UseGuards(ThrottlerGuard));
}
```

## 남은 것

- 쿠키를 삭제하면 다시 누를 수 있다. 좋아요 수로 경쟁하는 서비스가 아니므로 허용했다.
- 글이 수백 편이 되면 화면이 모든 글의 집계 값을 내려받는 비용이 커진다. 그 시점에는 서버가 상위 일부만 반환하는 방법을 다시 검토한다.
- 가중치(1·3·5)는 데이터 없이 정한 값이다. 실제 집계 값이 쌓이면 다시 조정한다.
- 모듈 등록처럼 누락돼도 컴파일 오류가 나지 않는 항목은 경로 표 같은 시험으로 검증한다.

## 관련 글

- [블로그 댓글](/memo/post-comments)
- [방문자를 가입 없이 알아보기](/memo/visitor-identity)
- [쓰기 경로 33개에 요청 제한](/memo/rate-limit-all-writes)
- [API 경로 표 시험](/memo/api-route-table-test)

[^hmac]: Hash-based Message Authentication Code. 비밀 키와 입력 값을 함께 해시한 값이다. 키를 모르면 같은 해시를 만들 수 없으므로, DB가 유출돼도 쿠키 값을 추측해 대조할 수 없다. Node.js에서는 [`crypto.createHmac`](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options)으로 계산한다.

[^optimistic]: 서버 응답을 기다리지 않고 성공을 가정해 화면을 먼저 갱신하는 방식. 응답이 오면 서버 값으로 맞추고, 실패하면 이전 상태로 되돌린다.

<details>
<summary>참고 문헌</summary>

- [RFC 2104: HMAC: Keyed-Hashing for Message Authentication](https://www.rfc-editor.org/rfc/rfc2104)
- [Node.js: crypto.createHmac](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options)
- [MDN: Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies)
- [RFC 9110: HTTP Semantics, 9.2.2 Idempotent Methods](https://www.rfc-editor.org/rfc/rfc9110#name-idempotent-methods)
- [MDN: 429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429)
- [NestJS: Rate Limiting](https://docs.nestjs.com/security/rate-limiting)
- [Prisma Client API: createMany](https://www.prisma.io/docs/orm/reference/prisma-client-reference#createmany)

</details>

<details>
<summary>사진 출처</summary>

- HMAC 계산 구조: Gdrooid, Wikimedia Commons, [File:SHAhmac.svg](https://commons.wikimedia.org/wiki/File:SHAhmac.svg), CC0 (PNG로 변환)

</details>

#MacFolio #프론트엔드 #백엔드 #좋아요 #인기글
