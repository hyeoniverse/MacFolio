---
title: git grep으로 찾은 공개 API에서 비밀 글을 서버 필터링하기
date: 2026-10-23
category: 개발 기록/MacFolio/백엔드
summary: 서버에 쓴 글을 관리자에게만 보이게 하는 비밀 글을 더했다. 글 주소를 받는 공개 API를 git grep으로 모두 찾아 서버에서 필터링하고, 방문자에게는 없는 글과 같은 응답을 보낸다. 저장소의 Markdown 글은 공개 저장소에 원문이 있어 대상에서 제외했다.
---

관리자가 메모 앱에서 쓴 글 가운데 공개하지 않을 글을 **비밀 글**로 지정할 수 있게 했다([#355](https://github.com/hyeoniverse/MacFolio/pull/355)). 비밀 글은 관리자 세션이 있는 요청에만 응답에 포함되고, 그 밖의 요청에는 글 목록·공유 카드·댓글·좋아요·인기글·조회수·트래픽 요약·메모 정리 내용 어디에도 포함되지 않는다.

![비밀 글을 연 관리자 화면](./images/memo-secret-posts-admin.jpg '목록의 제목 앞과 편집기 날짜 줄에 비밀 글 표시가 붙는다')

## 사용 방법

| 동작      | 위치                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| 지정·해제 | 목록 우클릭 메뉴, 본문 도구 막대의 ••• 메뉴, 휴대폰 본문의 ••• 메뉴            |
| 모아 보기 | 검색 칸의 검색 조건 → '비밀 메모'                                              |
| 표시      | 목록·갤러리 제목 앞의 `fa-user-lock` 아이콘, 편집기·읽기 화면의 '비밀 글' 알약 |
| API       | `PUT /posts/:slug/secret` (`{ "secret": true }`), 관리자 전용                  |

잠근 메모(`fa-lock`)는 **수정을 막는** 기능이고, 비밀 글(`fa-user-lock`)은 **공개 범위를 줄이는** 기능이다. 두 표시가 같은 자물쇠면 구별할 수 없어 아이콘과 색(systemIndigo)을 나눴다. 비밀 글은 다른 사람에게 열리지 않으므로 '링크 공유'도 감춘다.

![서버 글의 우클릭 메뉴](./images/memo-secret-posts-menu.jpg '서버에만 있는 글에는 비밀 글로 지정 항목이 켜진다')

### 저장소 글은 대상이 아니다

이 블로그의 글은 두 곳에 있다. 저장소의 `apps/react/src/apps/memo/content/*.md`가 기본이고, 관리자가 사이트에서 쓰거나 고친 글은 API의 `Post` 표에 저장한다([백엔드 설계](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md#데이터-모델)). 저장소는 공개 저장소라 Markdown 원문을 누구나 읽을 수 있다. 그래서 비밀 글은 **서버에만 있는 글**에만 지정한다. 저장소 글과 저장소 글을 서버에서 고친 글은 메뉴 항목을 끄고, 툴팁으로 이유("저장소의 글은 공개 저장소에 있어 비밀로 할 수 없습니다")를 보인다.

![저장소 글의 우클릭 메뉴](./images/memo-secret-posts-menu-repo.jpg '저장소 글은 비밀 글로 지정 항목이 꺼져 있다')

판정은 desktop-core의 순수 함수 하나다.

```ts
/** 비밀 글로 지정할 수 있는 글: 서버에만 있는 글 (관리자 목록에서 게시 상태가 있고 저장소 글을 가리지 않는 글) */
export const canBeSecret = (post: Post): boolean =>
	Boolean(post.status && !post.status.overridesRepo && !post.deletedAt);
```

서버는 저장소에 같은 주소의 파일이 있는지 모른다. API로 저장소 글을 고친 글을 직접 비밀로 지정하면, 방문자 목록에서 서버 글만 빠지고 저장소의 원래 글이 보인다. 원문은 이미 공개되어 있으므로 추가로 노출되는 내용은 없다.

## 화면에서 감추면 충분하지 않은 이유

방문자 화면은 API 응답을 그린다. 화면에서 비밀 글을 걸러도 응답에 들어 있으면 개발자 도구의 네트워크 탭이나 `curl`로 그대로 읽힌다. 그래서 필터링은 모두 서버에서 한다. 화면 코드는 바꾸지 않아도 방문자에게 비밀 글이 보이지 않는다.

또 하나는 **존재 여부**다. 글 주소는 `2026-10-23-a1b2c3`처럼 날짜와 6자리 16진수다. 비밀 글 주소에 403이나 다른 모양의 응답을 보내면, 주소를 대입해 비밀 글이 있는지 확인할 수 있다. 그래서 방문자에게는 없는 글과 **같은 응답**을 보낸다.

| 경로                                                         | 없는 글                      | 비밀 글 (방문자)             | 비밀 글 (관리자) |
| ------------------------------------------------------------ | ---------------------------- | ---------------------------- | ---------------- |
| `GET /posts`                                                 | 목록에 없음                  | 목록에 없음                  | 목록에 없음[^1]  |
| `GET /posts/:slug/og.png`                                    | 404 `글이 없습니다.`         | 404 `글이 없습니다.`         | 404              |
| `GET /posts/:slug/comments`                                  | `[]`                         | `[]`                         | 댓글 목록        |
| `GET /posts/:slug/likes`                                     | `{ count: 0, liked: false }` | `{ count: 0, liked: false }` | 실제 값          |
| `POST /posts/:slug/comments`, `PUT·DELETE /posts/:slug/like` | 201·200                      | 404                          | 201·200          |
| `GET /posts/stats`, `GET /analytics/views`                   | 키 없음                      | 키 없음                      | 실제 값          |
| `GET /analytics/summary`의 글 표                             | 행 없음                      | 행 없음                      | 실제 값          |
| `GET /memo/organization`                                     | 키 없음                      | 키 없음                      | 실제 값          |

[^1]: `GET /posts`는 관리자 세션이어도 비밀 글을 넣지 않는다. 이 응답은 Worker(첫 화면 본문·sitemap·RSS)와 최근 글 위젯이 쿠키 없이 받는 공개 목록이고, 쿠키에 따라 응답이 달라지면 캐시가 섞일 위험이 생긴다. 관리자 화면은 원래 `GET /posts/admin`으로 모든 글을 받는다.

쓰기 요청(댓글 쓰기, 좋아요 누르기)만 404로 차이가 난다. 없는 글에 댓글을 쓰면 지금도 저장되기 때문이다. 이 경로는 IP마다 1분 요청 제한(`@RateLimit('comment')`, `@RateLimit('like')`)이 있어 주소 대입에 쓸 수 있는 횟수가 적다.

## 필터링할 경로 찾기

글 주소(`slug`)를 받거나 글 주소를 키로 쓰는 응답을 모두 찾아야 한다. `git grep`으로 세 가지를 검색했다.

```sh
git grep -n -E "prisma\.post\b|\.post\.(find|count|group)|listPublic|findPublic" -- apps/api/src
git grep -n -E "postSlug|\bslug\b" -- apps/api/src
git grep -n -i -E "rss|sitemap|/posts\b|og\.png" -- apps/react/worker apps/react/src
```

<details>
<summary>검색으로 찾은 경로와 판단</summary>

| 찾은 곳                             | 내용                                | 판단                                        |
| ----------------------------------- | ----------------------------------- | ------------------------------------------- |
| `posts.service.ts` `listPublic`     | 방문자 목록                         | `secret: false` 조건 추가                   |
| `posts.service.ts` `findPublic`     | 공유 카드(og.png)                   | `row.secret`이면 404                        |
| `comments.service.ts`               | 댓글 목록·쓰기·삭제                 | 관리자가 아니면 빈 목록·404                 |
| `likes.service.ts`                  | 글·댓글 좋아요, 인기글 집계         | 관리자가 아니면 0·404, 집계에서 키 제외     |
| `analytics-stats.service.ts`        | 조회수, 요약의 글 표(`memo/<slug>`) | 관리자가 아니면 키 제외                     |
| `memo.service.ts`                   | 정리 내용의 `posts`·`pins`·`locks`  | 관리자가 아니면 키 제외                     |
| `worker/serverPosts.ts`             | 첫 화면 본문·sitemap·RSS·og:image   | 쿠키 없이 `GET /posts`를 받으므로 변경 없음 |
| `desktop/widgets/recentPostsApi.ts` | 최근 글 위젯                        | `GET /posts`를 받으므로 변경 없음           |
| `files.service.ts`                  | 업로드 파일이 쓰인 글 (관리자 전용) | 변경 없음                                   |
| `summary`·`translate`·`speech`      | 화면이 보낸 본문을 처리, 주소 없음  | 변경 없음                                   |

검색은 화면 안(`MemoSearch`)에서 받은 목록을 대상으로 하므로 목록에서 빠지면 검색에도 나오지 않는다.

</details>

![비밀 글을 필터링하는 위치](./images/memo-secret-posts-filter.svg '방문자 요청은 SecretPosts로 확인하고 없는 글과 같은 응답을 보낸다')

여러 모듈이 같은 확인을 하므로 `SecretPosts` 서비스 하나로 모았다. `PostsModule`이 내보내고 댓글·좋아요·트래픽 분석·메모 모듈이 가져다 쓴다.

```ts
@Injectable()
export class SecretPosts {
	constructor(private readonly prisma: PrismaService) {}

	async slugs(): Promise<Set<string>> {
		const rows = await this.prisma.post.findMany({ where: { secret: true }, select: { slug: true } });
		return new Set(rows.map(({ slug }) => slug));
	}

	async isSecret(slug: string): Promise<boolean> {
		return (await this.prisma.post.count({ where: { slug, secret: true } })) > 0;
	}
}
```

관리자인지는 비밀 글일 때만 확인한다. 세션 확인(`AuthService.findAdmin`)은 DB를 한 번 더 조회하므로, 대부분의 요청(비밀 글이 아닌 글)에는 쿼리 하나(`count`)만 더해진다.

### 1분 캐시와 순서

조회수와 방문자용 트래픽 요약은 DB 부하를 줄이려고 1분 동안 같은 값을 보낸다. 필터링을 캐시 안에서 하면, 방금 비밀로 지정한 글이 최대 1분 동안 응답에 남는다. 그래서 **캐시에서 꺼낸 뒤에** 비밀 글을 뺀다. 캐시에는 전체 값을 보관하고, 응답할 때마다 비밀 글 주소 목록(`slugs()`)으로 필터링한다.

### 메모 정리 내용

메모 정리 내용(`GET /memo/organization`)은 옮긴 글·고정·잠금을 글 주소를 키로 저장한다. 비밀 글을 다른 폴더로 옮기면 주소가 키로 남는다. 방문자에게는 이 키를 뺀 정리 내용을 보낸다.

관리자 화면은 정리 내용을 통째로 받아 고친 뒤 통째로 저장한다(`PUT /memo/organization`). 관리자가 필터링된 값을 받아 저장하면 비밀 글의 키가 지워진다. 관리자 로그인은 GitHub로 이동했다가 돌아오는 방식이라 로그인한 시각에 페이지를 새로 불러오고, 그 시각부터 정리 내용 요청에 세션 쿠키가 붙는다. 세션이 만료된 상태에서는 저장이 401로 거절된다. 따라서 필터링된 정리 내용이 저장되는 경로는 없다.

## 데이터와 배포

`Post`에 열 하나를 더했다.

```sql
ALTER TABLE "Post" ADD COLUMN "secret" BOOLEAN NOT NULL DEFAULT false;
```

기본값이 `false`라 기존 글은 그대로 공개되고, 이전 코드도 이 열을 무시하고 동작한다([배포는 이미지만 되돌리고 DB는 되돌리지 않는다](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md#구성도)). 반대로 배포가 실패해 이미지가 이전 버전으로 돌아가면 이전 코드는 `secret`을 읽지 않으므로, 되돌린 동안 비밀 글이 공개된다. 이 위험은 열을 하나 더하는 방식으로는 피할 수 없어 PR과 [백엔드 설계](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md#설계-결정)에 적었다.

| 방식                  | 장점                              | 단점                                                        |
| --------------------- | --------------------------------- | ----------------------------------------------------------- |
| 화면에서만 숨기기     | 서버 변경 없음                    | 응답을 직접 조회하면 보인다                                 |
| 별도 표(`SecretPost`) | 글 표와 분리                      | 모든 조회에 조인, 게시·버전·삭제 흐름을 다시 구현해야 한다  |
| **`Post.secret` 열**  | 게시·버전·삭제 흐름을 그대로 사용 | 공개 경로마다 필터링을 빠뜨리지 않아야 한다 (시험으로 고정) |

## 시험

- API e2e(`apps/api/test/secret-posts.e2e.test.ts`): 실제 PostgreSQL로 여섯 가지를 확인한다. 관리자만 지정(401·400·404·409), 방문자 목록·공유 카드에서 제외(관리자 쿠키여도 공개 목록은 같음), 지운 표시로도 내보내지 않음, 댓글·좋아요가 없는 글과 같은 응답, 인기글·조회수·요약에서 제외(관리자는 보임), 정리 내용에서 키 제외.
- 경로 표 시험(`routes.e2e.test.ts`)에 `PUT /posts/:slug/secret: 'admin'`을 더했다. 가드나 요청 제한을 빠뜨리면 실패한다.
- 단위: `canBeSecret`, `mergeAdminPosts`의 `status.secret`, 검색 조건 '비밀 메모', 메뉴 항목(저장소 글·잠긴 메모에서 꺼짐), `setPostSecret` 요청 모양.
- Playwright(`e2e/memo-secret.spec.ts`): 우클릭으로 지정하면 목록·편집기에 표시가 붙고 가짜 API의 방문자 목록에서 빠지는지, 저장소 글 메뉴가 꺼지는지, 방문자 목록에 비밀 글이 없는지 확인한다.

![방문자 화면](./images/memo-secret-posts-visitor.jpg '같은 데이터를 방문자로 열면 비밀 글이 목록에 없다')

## 관련 글

- [메모 잠그기 - 실수로 고치지 않게](/memo/memo-lock)
- [임시 저장, 버전 기록, 예약 발행을 한 행에 담는 Post 테이블과 CHECK 제약](/memo/drafts-and-versions)
- [최근 삭제된 항목 - 지운 메모를 30일 동안 되살리기](/memo/memo-recently-deleted)
- [블로그에 좋아요와 인기글 폴더 붙이기](/memo/memo-likes-popular)
- [Reflect.getMetadata로 읽은 API 경로 64개를 표 하나로 고정하는 시험](/memo/api-route-table-test)

#MacFolio #메모앱 #보안
