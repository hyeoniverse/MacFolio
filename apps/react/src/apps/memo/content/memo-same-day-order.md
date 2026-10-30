---
title: git 첫 커밋 시각을 Vite 가상 모듈로 넣어 같은 날 글 정렬하기
date: 2026-10-23
category: 개발 기록/MacFolio/구조·상태 관리
summary: 머리말 date에는 시각이 없어 같은 날 글이 제목 순으로 정렬됐다. 저장소 글은 빌드 시각에 git에서 첫 커밋 시각을 읽고, 서버 글은 처음 게시한 시각을 새 열에 한 번만 기록해 목록·위젯·RSS를 같은 순서로 맞췄다.
---

메모 목록에서 같은 날 올린 글이 올린 순서가 아니라 **제목 순**으로 정렬됐다. 10월 22일에는 글 다섯 편을 09:50부터 22:47까지 차례로 올렸다. 그런데 가장 마지막에 올린 `macOS Safari와 iOS Safari의 렌더링 차이`가 두 번째에 있고, 21:10에 올린 `iOS Safari에서만 음악 위젯 모서리가 각지는 문제`가 맨 위에 있었다. 영문 소문자 `i`가 `m`보다 앞서기 때문이다. 바탕화면의 최근 글 위젯, 글 아래의 이전·다음 글, RSS도 같은 순서를 따랐다.

## 원인: 정렬에 쓸 시각이 없다

머리말의 `date`에는 날짜만 있다(`2026-10-22`). `packages/desktop-core`의 `sortPosts`는 날짜 다음에 바로 제목을 비교했다.

```ts
// 고치기 전
posts.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
```

같은 날 글을 구분할 시각 정보가 데이터 어디에도 없었다. 머리말에 시각을 추가하는 방법도 있지만, 이미 있는 글 210여 편을 모두 수정해야 하고 앞으로 글을 쓸 때마다 시각을 직접 입력해야 한다. 그래서 글이 이미 가진 기록에서 시각을 읽기로 했다.

## 고친 방법: 날짜와 제목 사이에 '올린 시각'

비교 순서를 날짜 → **올린 시각**(`createdAt`) → 제목으로 바꿨다. 날짜가 같으면 나중에 올린 글이 위로 오고, 올린 시각까지 같으면(한 커밋으로 함께 들어온 글) 기존처럼 제목 순이다.

```ts
/** 올린 시각의 비교 값. 모르면 가장 최근으로 (아직 커밋하지 않은, 지금 쓰고 있는 글) */
const createdKey = (post: { createdAt?: string }) => post.createdAt ?? '￿';

export const compareCreated = (a: { createdAt?: string }, b: { createdAt?: string }) =>
	createdKey(a).localeCompare(createdKey(b));

export function sortPosts(posts: Post[]): Post[] {
	return [...posts].sort(
		(a, b) => b.date.localeCompare(a.date) || compareCreated(b, a) || a.title.localeCompare(b.title)
	);
}
```

`createdAt`은 ISO 8601 UTC 문자열이라 문자열 비교가 곧 시각 비교다. 값이 없으면 `U+FFFF`로 비교해 같은 날 글 중 맨 위에 놓인다. 작성 중인 글이 가장 최근 글이라는 가정이다.

![정렬 규칙과 올린 시각의 출처](./images/memo-same-day-order-rule.svg '세 기준을 차례로 비교한다. 올린 시각은 저장소 글·서버 글·시각을 모르는 글마다 읽는 곳이 다르다')

블로그 글은 두 곳에서 온다. 저장소의 Markdown 파일(`memo/content/*.md`)과 관리자가 편집기로 쓴 서버 글(PostgreSQL)이다. 출처마다 '올린 시각'을 읽는 곳이 다르다.

### 저장소 글: 빌드 시각에 git에서 첫 커밋 시각을 읽는다

저장소 글의 올린 시각은 그 파일을 git에 처음 추가한 커밋의 시각이다. Vite 설정(`vite.config.ts`)이 빌드 시각에 `git log`를 실행한다.

```bash
git log --diff-filter=A --format=%x00%cI --name-only --relative -- .
```

| 옵션              | 역할                                                      |
| ----------------- | --------------------------------------------------------- |
| `--diff-filter=A` | 파일을 추가(Added)한 커밋만 출력                          |
| `%x00%cI`         | 커밋마다 NUL 문자 뒤에 커밋 시각(ISO 8601)                |
| `--name-only`     | 그 커밋이 추가한 파일 이름                                |
| `--relative`      | `content` 폴더 기준 경로. `images/…`는 slug 추출에서 제외 |

출력은 최신 커밋이 먼저다. `seo/posts.ts`의 `createdTimes()`가 NUL로 커밋을 나누고 `slug → ISO UTC 시각` 객체를 만든다. 뒤에 나오는(더 오래된) 커밋이 값을 덮어쓰므로, 삭제했다가 다시 추가한 글은 가장 처음 추가한 시각이 남는다. 사이트맵의 `lastmod`를 git 기록에서 읽는 방식과 같다([`git log` 문서](https://git-scm.com/docs/git-log)).

이 객체는 가상 모듈 `virtual:post-created`로 번들에 포함한다. 메모 앱은 글 원문 청크(`contentFiles.ts`)와 함께 불러오고, 최근 글 위젯용 `virtual:recent-posts`와 SEO용 글 목록·RSS는 빌드 시각에 같은 값으로 정렬한다.

```ts
// apps/react/src/apps/memo/repository/contentFiles.ts
export { default as created } from 'virtual:post-created';
export const files = import.meta.glob<string>('../content/*.md', { query: '?raw', import: 'default', eager: true });
```

#### shallow clone 빌드

기록의 일부만 받은 저장소(`git clone --depth 1`)에서는 모든 파일이 마지막 커밋 하나에서 추가된 것으로 보인다. 이 값을 쓰면 모든 글의 올린 시각이 같아지고, 결과는 제목 순과 같지만 '시각을 안다'는 잘못된 전제가 남는다. 그래서 `git rev-parse --is-shallow-repository`가 `false`가 아니면 빈 객체를 반환한다. git이 없는 환경도 `try/catch`로 빈 객체다. 이 경우 같은 날 글은 기존처럼 제목 순이다. 배포 작업(`ci.yml`의 production)은 `actions/checkout`을 `fetch-depth: 0`으로 실행하므로 전체 기록을 읽는다.

### 서버 글: 처음 게시한 시각을 새 열에 기록한다

서버 글에는 쓸 수 있어 보이는 시각이 이미 세 가지 있었다. 모두 '처음 게시한 시각'과 다르다.

- **`Post.createdAt`:** 행을 만든 시각, 즉 처음 임시 저장한 시각이다. 오전에 초안을 쓰고 저녁에 게시하면 오전 시각으로 정렬된다.
- **`Post.publishedAt`:** 마지막으로 게시한 시각이다. 오타 하나를 고쳐 다시 게시하면 그 글이 같은 날 글 중 맨 위로 올라간다.
- **`PostRevision`의 가장 이른 `createdAt`:** 게시할 때마다 버전이 하나 생기지만 글마다 최근 50개만 보관한다. 50번 넘게 고친 글은 첫 게시 버전이 삭제된다.

그래서 열을 하나 추가했다. `Post.firstPublishedAt`(`TIMESTAMP(3)`, NULL 허용)이다. `publish` 트랜잭션 안에서 이 열이 NULL일 때만 값을 기록한다.

```ts
// apps/api/src/posts/posts.service.ts — publish 트랜잭션 안
// 처음 게시한 시각은 한 번만 적는다
await tx.post.updateMany({
	where: { slug, firstPublishedAt: null },
	data: { firstPublishedAt: published.publishedAt },
});
```

`update` 대신 `updateMany`를 쓴 이유는 조건에 맞는 행이 없을 때의 동작이다. Prisma의 `update`는 대상 행이 없으면 `P2025` 오류를 던지고, `updateMany`는 0건을 갱신하고 끝난다. 두 번째 게시부터는 조건에 맞는 행이 없는 것이 정상이다. 읽고 비교한 뒤 쓰는 두 단계가 아니라 SQL `UPDATE … WHERE "firstPublishedAt" IS NULL` 한 문장이므로 동시에 게시해도 값이 한 번만 기록된다.

API 응답에는 이 값을 `createdAt` 필드로 담는다. 프론트엔드의 `Post.createdAt`과 같은 이름이어서, 저장소 글과 서버 글이 같은 비교 함수를 지난다.

![서버 글의 시각 열 변화](./images/memo-same-day-order-timeline.svg '오전 9시에 임시 저장하고 저녁 7시에 게시한 뒤 다음 날 고쳐 다시 게시해도, 정렬에 쓰는 값은 처음 게시한 19:00로 유지된다')

#### 이미 게시한 글: 마이그레이션에서 채운다

새 열은 기존 글에서 NULL이다. 마이그레이션 `20261023120000_post_first_published_at`이 남은 버전 중 가장 이른 시각과 마지막 게시 시각 중 이른 쪽으로 채운다.

```sql
ALTER TABLE "Post" ADD COLUMN "firstPublishedAt" TIMESTAMP(3);

UPDATE "Post" p
SET "firstPublishedAt" = LEAST(p."publishedAt", (SELECT MIN(r."createdAt") FROM "PostRevision" r WHERE r."postSlug" = p."slug"))
WHERE p."publishedAt" IS NOT NULL;
```

PostgreSQL의 [`LEAST`](https://www.postgresql.org/docs/current/functions-conditional.html#FUNCTIONS-GREATEST-LEAST)는 NULL 인자를 무시하므로, 버전 기록이 없는 글은 `publishedAt`이 그대로 들어간다. 버전이 50개를 넘게 쌓인 글은 실제 첫 게시보다 늦은 시각이 들어갈 수 있다. 정확한 첫 게시 시각은 이미 삭제되어 복원할 방법이 없다.

### 저장소 글을 서버에서 고친 경우

같은 slug의 서버 글은 저장소 글을 덮어쓴다. 관리자가 저장소 글을 편집기에서 고쳐 게시하면 서버에 같은 slug의 행이 생긴다. 이때 서버의 `firstPublishedAt`(방금 게시한 시각)을 쓰면 오래된 글이 그날 맨 위로 이동한다. 목록을 합칠 때 저장소 글의 시각을 우선한다.

```ts
// 저장소 글을 서버에서 고쳐도 올린 시각은 저장소에 처음 들어온 시각
...((original?.createdAt ?? item.createdAt) && { createdAt: original?.createdAt ?? item.createdAt }),
```

### 배포 호환성

API와 사이트는 따로 배포된다. 어느 쪽이 먼저 배포돼도 동작하도록 두 가지를 지켰다.

- `packages/contracts`의 `ServerPost`·`AdminPost`에서 `createdAt`은 `z.string().optional()`이다. 새 사이트가 이전 API를 만나면 값이 없어 같은 날 글 중 맨 위로 볼 뿐이다.
- 마이그레이션은 NULL 허용 열 하나를 추가한다. 배포가 이전 이미지로 롤백돼도 이전 코드는 이 열을 조회하지 않으므로 그대로 동작한다. 배포 스크립트는 이미지만 되돌리고 DB는 되돌리지 않기 때문에 이 조건이 필요하다.

## 같은 순서를 쓰는 곳

순서는 `desktop-core`의 `sortPosts`·`compareCreated` 하나로 정하고, 아래가 모두 이 함수를 지난다.

- 메모 목록: 최신 순과 오래된 순 모두. 보기 설정의 `sortBy`가 날짜 방향과 같은 부호로 `compareCreated`를 곱하므로, 오래된 순이면 같은 날 안에서도 먼저 올린 글이 위다.
- 글 아래의 이전·다음 글(`adjacentPosts`)
- 바탕화면·휴대폰 홈 화면의 최근 글 위젯(`virtual:recent-posts`)
- 검색엔진용 글 목록과 RSS(`seo/posts.ts`)

![10월 22일 글 다섯 편의 순서 비교](./images/memo-same-day-order-compare.jpg '왼쪽은 고치기 전(제목 순), 오른쪽은 고친 뒤(나중에 올린 글이 위). 아래 시각은 각 글이 git에 처음 들어온 커밋의 시각(KST)이고, 09:50의 두 글은 같은 커밋이라 제목 순이다')

## 시험

변경은 PR [#331](https://github.com/hyeoniverse/MacFolio/pull/331)이다.

| 위치                           | 확인 내용                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `posts.test.ts`                | 같은 날은 나중에 올린 글이 위. 서버에서 고친 저장소 글은 저장소에 처음 들어온 시각을 유지      |
| `arrange.test.ts`              | 최신 순이면 나중에 올린 글이 위, 오래된 순이면 아래. 시각을 모르는 글은 가장 최근으로 정렬     |
| `staticPostRepository.test.ts` | 빌드가 넘긴 `slug → 시각` 객체로 같은 날 글을 정렬                                             |
| `seo/posts.test.ts`            | `createdTimes()`가 git 출력에서 글마다 처음 추가한 시각을 UTC로 추출하고, 위젯·RSS가 같은 순서 |
| `posts.e2e.test.ts`            | 게시 전 응답에 `createdAt` 없음, 처음 게시하면 그 시각, 다시 게시해도 유지                     |

`posts.e2e.test.ts`는 실제 PostgreSQL에 대해 실행한다.

```ts
const first = await admin('post', `/posts/${slug}/publish`).send(POST).expect(200);
const again = await admin('post', `/posts/${slug}/publish`)
	.send({ ...POST, body: '다시 게시' })
	.expect(200);
expect(again.body.publishedAt).not.toBe(first.body.publishedAt);
expect(again.body.createdAt).toBe(first.body.publishedAt);
```

## 남은 것

- **이름 불일치:** DB 열은 `firstPublishedAt`, API 응답과 프론트엔드 타입은 `createdAt`이다. 한편 DB의 `Post.createdAt`은 '처음 임시 저장한 시각'이라 같은 이름이 서로 다른 값을 가리킨다. 응답 필드 이름을 바꾸려면 contracts·openapi·프론트엔드를 함께 바꾸고 두 번에 나눠 배포해야 한다.
- **git 커밋 시각의 한계:** `%cI`는 커미터 시각이다. 브랜치를 리베이스하면 커밋 시각이 리베이스한 시각으로 바뀐다. 이 저장소는 머지 커밋으로 병합하므로 현재는 문제가 없지만, 병합 방식을 squash나 rebase로 바꾸면 저장소 글의 올린 시각이 병합 시각으로 바뀐다.
- **50개를 넘긴 글:** 마이그레이션 이전에 버전이 50개를 넘은 서버 글은 첫 게시 시각이 실제보다 늦을 수 있다. 마이그레이션 이후 처음 게시한 글은 정확하다.

## 관련 글

- [게시본과 임시본을 한 행에 담고 CHECK 제약으로 지키는 Post 테이블](/memo/drafts-and-versions): 같은 행에 게시본과 임시본을 보관하고 게시마다 버전을 남기는 구조
- [Cloudflare Worker로 SPA의 HTML에 주소별 메타데이터와 본문 넣기](/memo/seo-crawlable): 빌드 시각에 글 목록과 사이트맵을 만드는 `seo/posts.ts`
- [180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets): 최근 글 위젯
- [ZodType<PostContent>로 기존 타입과 zod 스키마의 일치를 tsc로 검사하기](/memo/contracts-posts): `createdAt?`을 추가한 contracts의 글 응답 스키마
- [pointer 이벤트와 translateY로 라이브러리 없이 구현한 순서 바꾸기 드래그](/memo/memo-folder-order): 메모 목록의 다른 정렬 규칙

#MacFolio #메모앱 #git #Prisma #PostgreSQL
