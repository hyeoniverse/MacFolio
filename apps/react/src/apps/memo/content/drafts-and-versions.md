---
title: 게시본과 임시본을 한 행에 담고 CHECK 제약으로 지키는 Post 테이블
date: 2026-09-30
category: 개발 기록/MacFolio/서버·API
summary: 메모 앱처럼 글을 바로 편집하면 저장하는 즉시 방문자에게 공개되고 이전 내용으로 복원할 수 없다. 편집 중에는 임시 저장만 하고, 게시할 때마다 버전을 기록하고(글마다 50개), 미래 날짜로 게시하면 예약 발행되게 했다. NULL을 통과시키는 CHECK 제약도 수정했다.
---

## 배경: 저장과 공개를 분리하는 이유

블로그 관리 도구는 대부분 "저장"과 "공개"를 별도 동작으로 둔다. WordPress를 예로 들면 글마다 상태 값이 있어서, 작성 중인 글은 `draft`(임시 글), 공개한 글은 `publish`, 미래 날짜로 공개를 예약한 글은 `future` 상태로 저장된다[^wp-status]. 관리자는 임시 글을 여러 번 저장하면서 다듬고, 공개 버튼을 누른 시각에만 방문자에게 노출된다.

이 사이트의 관리자 글쓰기는 메모 앱 방식이다. 편집 버튼 없이 글을 클릭하면 바로 편집 상태가 되고, 입력이 멈추면 자동 저장한다([글 편집기](/memo/post-editor)). 편집 과정은 단순해졌지만, 저장과 공개가 하나로 묶여 있어 두 가지 문제가 생겼다.

| 문제                          | 구체적인 상황                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| 저장 즉시 방문자에게 공개된다 | 제목만 입력한 새 글, 절반만 고친 문단이 자동 저장되는 순간 방문자 화면에 표시된다      |
| 이전 내용으로 복원할 수 없다  | 실수로 문단 하나를 삭제하면 몇 초 뒤 자동 저장이 그 상태를 덮어써 원래 문단이 사라진다 |

별도 편집 모드로 되돌리는 방안도 검토했지만, 바로 편집하는 방식은 유지하고 **저장과 공개를 분리하기로** 했다. 서버 변경은 [PR #44](https://github.com/hyeoniverse/MacFolio/pull/44)에 포함됐다.

데이터를 어떻게 저장할지는 세 방법을 비교했다. 여기서 행(row)은 DB 테이블의 레코드 하나, 열(column)은 그 레코드의 필드 하나다.

| 방법                                      | 장점                        | 단점                                                                         |
| ----------------------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| 편집 모드로 복귀 (편집 → 저장)            | 저장 = 공개가 명확하다      | 바로 편집하는 방식을 포기한다. 저장 전에 창을 닫으면 편집 내용이 유실된다    |
| 글을 두 행으로 (공개 글·초안 글)          | 테이블 구조가 단순하다      | 주소(slug)가 두 개. 공개와 초안을 전환할 때 행을 이동해야 한다               |
| **한 행에 두 벌 (게시한 내용·임시 저장)** | 주소 하나. 게시는 "열 복사" | 열이 두 배. "둘 다 비었거나 둘 다 규칙에 맞는다"는 조건을 DB가 보장해야 한다 |

세 번째 방법을 선택했다. 글 주소(`/memo/<slug>`)는 행의 기본 키라서, 한 행에 두 벌을 저장하면 공개 여부와 관계없이 주소가 하나로 유지된다.

## 임시 저장과 게시

![게시한 내용과 임시 저장 두 벌, 그리고 게시할 때 쌓이는 버전](./images/drafts-and-versions-states.svg '자동 저장은 임시 저장에만, 게시하면 임시 저장이 게시한 내용이 되고 버전이 하나 쌓인다')

글 하나에 내용을 두 벌 저장한다.

| 내용        | 조회 대상 | 갱신 시점                      |
| ----------- | --------- | ------------------------------ |
| 게시한 내용 | 방문자    | **게시** 버튼을 누른 시각      |
| 임시 저장   | 관리자    | 입력이 멈출 때마다 (자동 저장) |

자동 저장은 임시 저장에만 기록한다. 날짜 줄 오른쪽의 **게시**를 눌러야 임시 저장이 게시한 내용으로 복사되고, 그 시각부터 방문자에게 공개된다. 게시하지 않은 편집은 **변경 사항 버리기**로 폐기하고 게시한 내용으로 복원할 수 있다.

예를 들어 게시한 글의 제목을 "Vite 이전 기록"에서 "CRA에서 Vite로 옮긴 기록"으로 고치면 다음 순서로 값이 바뀐다.

| 시점                   | `title` (게시한 내용)    | `draftTitle` (임시 저장) | 방문자에게 보이는 제목   |
| ---------------------- | ------------------------ | ------------------------ | ------------------------ |
| 고치기 전              | Vite 이전 기록           | `NULL`                   | Vite 이전 기록           |
| 제목 입력 후 자동 저장 | Vite 이전 기록           | CRA에서 Vite로 옮긴 기록 | Vite 이전 기록           |
| **게시** 누름          | CRA에서 Vite로 옮긴 기록 | `NULL`                   | CRA에서 Vite로 옮긴 기록 |

새 메모는 임시 저장 상태로 생성된다. 게시 전에는 관리자 외에는 조회할 수 없으므로 여러 날에 걸쳐 작성할 수 있다.

관리자 목록에는 상태 표시를 추가했다.

| 표시      | 의미                                         |
| --------- | -------------------------------------------- |
| 임시 저장 | 한 번도 게시하지 않은 글                     |
| 점(•)     | 게시한 글에 아직 게시하지 않은 편집이 있다   |
| 예약      | 게시했지만 게시 날짜가 아직 도래하지 않은 글 |

![관리자 목록의 게시 상태](./images/drafts-status.jpg '예약한 글은 예정 묶음에, 게시하지 않은 편집은 제목 옆 점으로, 새 메모는 임시 저장 표시로 보인다')

저장소의 Markdown 글도 같은 방식이다. 편집하면 임시 저장만 생성되고, 방문자는 게시 전까지 원래 파일 내용을 조회한다.

## 버전 기록

게시할 때마다 그 내용을 버전으로 기록한다(글마다 최근 50개, `MAX_REVISIONS`). 자동 저장마다 기록하면 몇 초 간격으로 버전이 쌓여 목록에서 원하는 시점을 찾기 어렵다. =="게시"는 관리자가 직접 정한 시점이므로 그 시각만 기록한다.==

게시 요청 하나는 DB 트랜잭션[^tx] 안에서 세 작업을 실행한다. 게시한 내용 갱신과 임시 저장 비우기, `PostRevision`에 한 줄 추가, 51번째 이후의 오래된 버전 삭제다. 셋 중 하나라도 실패하면 모두 취소되므로 "게시는 됐는데 버전은 기록되지 않은" 상태가 생기지 않는다.

1. 도구 막대의 시계 버튼을 누르면 버전 목록이 열린다.
2. 버전을 선택하면 내용을 미리 볼 수 있다.
3. **이 버전으로 되돌리기**를 누르면 그 내용이 편집기에 들어간다. 이 시점에는 공개되지 않고 임시 저장에만 기록되므로, 확인한 뒤 게시한다.

저장소 글이면 목록 맨 아래에 **원본** 항목이 있어 최초 파일 내용으로도 복원할 수 있다.

![버전 기록](./images/memo-versions.jpg#float-right '게시할 때마다 남은 버전과 저장소 원본. 고르면 미리 보고 되돌릴 수 있다')

되돌리기는 편집기를 다시 렌더링하는 대신 **편집기 내부에서 내용을 교체하도록** 구현했다. 외부에서 새 내용으로 편집기를 다시 마운트하면, 언마운트되는 편집기가 마지막 편집을 저장하는 요청과 되돌린 내용을 저장하는 요청이 경쟁 상태(race condition)가 된다. 경쟁 상태는 결과가 작업의 실행·도착 순서에 따라 달라지는 상황을 말한다[^race]. 두 HTTP 요청을 거의 동시에 보내면 어느 쪽이 먼저 서버에 도착할지 정해져 있지 않고, 나중에 도착한 요청이 최종 값이 되므로 되돌린 내용이 이전 편집으로 덮어써질 수 있다.

편집기(`PostWriter.tsx`)는 저장 요청을 Promise 체인 `queue.current = queue.current.then(…)`으로 이어 붙인다. 앞 요청의 응답을 받은 뒤에 다음 요청을 보내므로, ==되돌린 내용을 이 대기열에 넣으면 요청 순서가 보장된다.== 게시와 변경 사항 버리기도 같은 대기열을 사용한다.

![재마운트하면 두 저장 요청이 순서 없이 도착하고, 내부 대기열을 쓰면 차례로 처리된다](./images/drafts-and-versions-revert-race.svg '편집기를 다시 마운트하면 늦게 도착한 마지막 편집이 되돌린 내용을 덮어쓴다')

| 구현                         | 서버에 도착하는 요청 순서                                | 최종 임시 저장              |
| ---------------------------- | -------------------------------------------------------- | --------------------------- |
| 편집기 재마운트              | ① 되돌린 내용 ② 언마운트 시 마지막 편집 (순서 보장 없음) | 마지막 편집 (되돌리기 유실) |
| 편집기 내부 저장 대기열 사용 | ① 마지막 편집 ② 되돌린 내용                              | 되돌린 내용                 |

## 예약 발행

날짜를 미래로 선택하면 게시 버튼이 **예약**으로 바뀐다. 누르면 게시 처리는 되지만, 방문자에게는 그 날짜부터 표시된다.

예약 발행은 보통 정해진 시각에 작업을 실행하는 스케줄러(cron 등)로 구현한다. 이 사이트는 별도 작업을 두지 않았다. 방문자가 글 목록을 요청하면 서버가 **게시 날짜가 오늘(Asia/Seoul 기준) 이후인 글을 필터링한다.** ==날짜가 지나면 다음 요청부터 자동으로 표시된다.== 저장소 글을 미래 날짜로 다시 게시했다면, 원래 파일 내용도 그 날짜까지 숨긴다.

![오늘 날짜보다 뒤인 글은 목록에서 제외하고, 날짜가 지나면 다음 요청부터 포함한다](./images/drafts-and-versions-schedule.svg '날짜는 YYYY-MM-DD 문자열이라 사전순 비교가 곧 날짜 비교다')

"오늘"은 요청마다 [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)`('en-CA', { timeZone: 'Asia/Seoul' })`로 계산한다. `en-CA` 로캘은 날짜를 `2026-09-30`처럼 `YYYY-MM-DD` 형식으로 출력해서, 글의 날짜 문자열과 그대로 비교할 수 있다. 시간대를 지정하지 않으면 서버 프로세스의 시간대를 사용한다. 서버가 UTC로 동작한다면 서울 시각 10월 1일 오전 8시(UTC 9월 30일 23시)에도 "오늘"이 9월 30일이 되어 10월 1일 예약 글이 계속 제외된다.

관리자 목록에서 미래 날짜 글이 '오늘' 묶음에 표시되던 문제도 수정했다. 날짜별로 묶을 때 미래 날짜는 **예정** 묶음으로 분리한다.

## 서버: 두 벌의 내용과 CHECK 제약

`Post` 테이블에 게시한 내용(`title`…`body`, `publishedAt`)과 임시 저장(`draftTitle`…`draftBody`, `draftUpdatedAt`) 열을 함께 정의하고, 버전은 `PostRevision` 테이블에 기록한다.

```text
GET    /posts                    누구나: 게시한 글 중 날짜가 된 것, 가릴 표시
GET    /posts/admin              관리자: 게시한 내용과 임시 저장
POST   /posts                    새 글 (임시 저장으로)
PUT    /posts/:slug/draft        임시 저장 (자동 저장)
DELETE /posts/:slug/draft        변경 사항 버리기
POST   /posts/:slug/publish      게시 (버전이 하나 남는다)
GET    /posts/:slug/revisions    버전 목록, /:id 로 내용
```

### CHECK 제약과 NULL

CHECK 제약은 테이블에 행을 삽입하거나 수정할 때마다 DB가 조건식을 평가해, 조건에 맞지 않는 행을 거절하는 규칙이다. 애플리케이션 코드가 아니라 DB가 직접 검사하므로, 어느 코드 경로로 값을 넣더라도 같은 규칙이 적용된다.

SQL에는 값이 없음을 뜻하는 `NULL`이 있고, 비교식의 결과도 `true`·`false`에 `NULL`(알 수 없음)을 더한 세 가지 값이 된다. 이를 3값 논리(three-valued logic)라고 한다[^3vl]. `NULL`이 들어간 연산은 대부분 `NULL`을 반환한다.

| 식                 | 결과    | 이유                                                           |
| ------------------ | ------- | -------------------------------------------------------------- |
| `NULL > 0`         | `NULL`  | 값을 모르므로 비교 결과도 알 수 없다                           |
| `true AND NULL`    | `NULL`  | `NULL`이 `true`이면 `true`, `false`이면 `false`라 정할 수 없다 |
| `false AND NULL`   | `false` | 한쪽이 `false`면 다른 쪽과 관계없이 `false`다                  |
| `false OR NULL`    | `NULL`  | `NULL`의 값에 따라 결과가 달라진다                             |
| `NULL IS NOT NULL` | `false` | `IS NULL`·`IS NOT NULL`은 항상 `true`나 `false`를 반환한다     |

DB에는 "두 벌 각각 **모든 열이 비어 있거나, 모든 열이 규칙에 맞는다**"는 CHECK 제약을 걸었다. 처음 작성한 제약에는 오류가 있었다.

```sql
("title" IS NULL AND ... ) OR (length(btrim("title")) BETWEEN 1 AND 100 AND length(btrim("body")) > 0 ...)
```

제목만 있고 본문이 `NULL`인 행을 삽입하는 시험에서, 거절되어야 할 행이 **삽입에 성공했다.** `btrim(NULL)`은 `NULL`이고 `NULL > 0`도 `NULL`이므로 뒤쪽 식 전체가 `NULL`이 된다. CHECK 제약은 결과가 `false`일 때만 거절하고 **`NULL`이면 통과시킨다**[^check-null]. 각 열이 `IS NOT NULL`인지 먼저 검사하도록 수정했다.

![본문이 NULL인 행에서 처음 식은 NULL로 평가되어 통과하고, 수정한 식은 false로 평가되어 거절된다](./images/drafts-and-versions-check-null.svg 'IS NOT NULL 검사가 false를 만들어 NULL을 덮는다')

```sql
ALTER TABLE "Post" ADD CONSTRAINT "Post_published_fields" CHECK (
  ("title" IS NULL AND "date" IS NULL AND … AND "publishedAt" IS NULL)
  OR (
    "title" IS NOT NULL AND "date" IS NOT NULL AND "category" IS NOT NULL AND "body" IS NOT NULL
    AND length(btrim("title")) BETWEEN 1 AND 100 AND … AND "publishedAt" IS NOT NULL
  )
);
```

임시 저장 열에도 같은 구조의 `Post_draft_fields`를 걸고, 세 번째로 `Post_has_content`(삭제된 글이 아니면 두 벌 중 하나는 있어야 한다)를 걸었다. ==애플리케이션 코드가 검사를 누락해도 DB가 규칙에 맞지 않는 행을 거절한다.==

| 식                          | 결과    | CHECK    |
| --------------------------- | ------- | -------- |
| `length(btrim('제목')) > 0` | `true`  | 통과     |
| `length(btrim('')) > 0`     | `false` | 거절     |
| `length(btrim(NULL)) > 0`   | `NULL`  | **통과** |
| `NULL IS NOT NULL AND …`    | `false` | 거절     |

Prisma 스키마 파일에는 CHECK 제약을 정의하는 문법이 없다. 그래서 세 제약은 [Prisma 마이그레이션](https://www.prisma.io/docs/orm/prisma-migrate)이 생성한 SQL 파일에 직접 추가했다.

### 기존 글 변환

기존 글은 마이그레이션에서 변환했다. 삭제 표시 행은 내용을 비우고, 나머지는 게시한 글로 간주해 현재 내용을 첫 버전으로 기록한다. 이전 구조의 행을 넣은 빈 DB에 마이그레이션을 순서대로 적용해 결과를 확인했다. 마이그레이션 파일(`20260929162900_post_drafts_revisions`)은 87줄이고, 그중 `UPDATE` 문 두 개와 `INSERT` 문 하나가 기존 글을 변환한다.

## 확인

API e2e `apps/api/test/posts.e2e.test.ts`가 실제 PostgreSQL로 이 흐름을 실행한다.

<details>
<summary>이 기능에 해당하는 시험 이름 7개</summary>

- "새 글은 임시 저장으로 시작해서, 게시하기 전에는 방문자에게 보이지 않는다"
- "게시한 글을 고쳐도 게시할 때까지 방문자는 게시한 내용을 본다. 버리면 게시한 내용으로 돌아간다"
- "게시한 적 없는 글의 임시 저장을 버리면 글이 없어진다 (저장소 글이면 원래대로 보인다)"
- "관리자 목록은 게시한 내용과 임시 저장을 따로 보여 준다"
- "날짜가 미래인 글은 게시해도 그날까지 가려진다 (예약 발행, 저장소 글도 가린다)"
- "게시할 때마다 버전을 남기고, 버전의 내용을 읽을 수 있다", "버전은 글마다 최근 50개만 남긴다"
- "규칙을 어기면 관리자라도 400 (임시 저장도 같은 규칙)"

</details>

서버 커밋 변경량은 파일 5개, +550/−102다.

## 남은 과제와 배운 점

- 예약 발행은 "다음 요청부터 표시" 방식이라, 정해진 시각에 알림을 보내거나 RSS를 갱신하는 작업은 할 수 없다. 현재 그런 기능이 없으므로 스케줄러를 두지 않았다.
- 버전 비교(두 버전의 diff 표시) 기능은 없다. 선택한 버전 전체를 미리 보기로 표시할 뿐이다.
- 이후 [deletedAt 열과 CHECK 제약으로 삭제한 글을 복구하는 소프트 삭제](/memo/memo-recently-deleted)과 [잠금](/memo/memo-lock)이 추가되면서 `deletedAt` 열과 잠금 검사(409)가 같은 테이블에 추가됐다.

> [!IMPORTANT] 배운 점
> SQL의 CHECK는 "참이어야 통과"가 아니라 "거짓이 아니면 통과"다. NULL이 들어올 수 있는 열은 `IS NOT NULL`을 먼저 검사해야 한다. 이 오류는 "규칙에 맞지 않는 행을 넣으면 거절되는가"를 확인하는 시험으로 발견했다. 규칙에 맞는 행만 삽입하는 시험이었다면 발견하지 못했을 것이다.

## 직접 써 보기

관리자 로그인이 필요한 기능이므로 로컬에서 실행한다([관리자 로그인 붙이기](/memo/admin-login-github-oauth)의 개발용 OAuth App이 필요하다).

```bash
pnpm --filter @macfolio/api db:up
pnpm dev:all
```

1. 메모 앱에서 새 글을 작성한다. 임시 저장 상태이므로 방문자 창(시크릿 창)에는 표시되지 않는다.
2. 게시한다. 시크릿 창을 새로고침하면 표시된다.
3. 수정해서 다시 게시하고, 버전 기록에서 이전 버전을 선택한다. 되돌린 내용은 임시 저장에 들어가고, 다시 게시하면 새 버전으로 기록되므로 기존 기록은 삭제되지 않는다.

같은 흐름을 시험으로 실행하려면 `pnpm --filter @macfolio/api test:e2e test/posts.e2e.test.ts`를 사용한다.

CHECK 제약의 NULL 처리는 `psql`에서 바로 확인할 수 있다. `SELECT NULL > 0, (NULL > 0) IS NOT FALSE;`를 실행하면 첫 열은 빈 값(`NULL`), 둘째 열은 `t`가 나온다. 둘째 열이 CHECK 제약이 행을 통과시키는 조건이다.

## 관련 글

- [GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기](/memo/admin-login-github-oauth)
- [ZodType<PostContent>로 기존 타입과 zod 스키마의 일치를 tsc로 검사하기](/memo/contracts-package#블로그-글-스키마를-desktop-core-타입에-고정하기-201)
- [최근 삭제된 항목 - 지운 메모를 30일 동안 되살리기](/memo/memo-recently-deleted)
- [pg_dump와 R2로 하는 DB 백업과 복원 시험](/memo/db-backup)
- [요청 계층과 위험별 설계 결정으로 정리한 MacFolio 백엔드 구성도](/memo/backend-design)

<details>
<summary>참고 문헌</summary>

- PostgreSQL, [5.5. Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html): CHECK 제약이 true와 NULL을 모두 통과시키는 규칙
- PostgreSQL, [9.1. Logical Operators](https://www.postgresql.org/docs/current/functions-logical.html): AND·OR의 3값 진리표
- PostgreSQL, [9.2. Comparison Functions and Operators](https://www.postgresql.org/docs/current/functions-comparison.html): `IS NULL`·`IS NOT NULL`·`IS NOT FALSE`
- PostgreSQL, [Appendix A. Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html): `23514 check_violation`
- PostgreSQL, [3.4. Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- WordPress, [Post Status](https://wordpress.org/documentation/article/post-status/): draft·publish·future 상태
- MDN, [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- MDN, [Promise.prototype.then()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then)
- Wikipedia, [Race condition](https://en.wikipedia.org/wiki/Race_condition), [Three-valued logic](https://en.wikipedia.org/wiki/Three-valued_logic)
- Prisma, [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)

</details>

[^wp-status]: WordPress 문서 [Post Status](https://wordpress.org/documentation/article/post-status/)에 따르면 `future` 상태는 "미래 날짜에 게시되도록 예약된 글"이다.

[^tx]: 여러 SQL 문을 하나의 단위로 묶어, 전부 적용하거나 전부 취소하는 DB 기능. 서버는 Prisma의 `$transaction`으로 게시 작업을 묶는다.

[^race]: Wikipedia, [Race condition](https://en.wikipedia.org/wiki/Race_condition). 웹 화면에서는 같은 자원을 수정하는 요청 두 개를 동시에 보내는 경우가 대표적인 예다.

[^3vl]: PostgreSQL 문서 [9.1. Logical Operators](https://www.postgresql.org/docs/current/functions-logical.html)에 AND·OR의 진리표가 있다. `NULL`은 "unknown"으로 표기된다.

[^check-null]: PostgreSQL 문서: "a check constraint is satisfied if the check expression evaluates to true or the null value" ([5.5.1. Check Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS)).

#MacFolio #백엔드 #메모앱
