---
title: 참조 위치 API로 쓰는 곳 없는 서버 파일만 골라 지우기
date: 2026-10-09
category: 개발 기록/MacFolio/서버·API
summary: 메모 글에 넣은 이미지는 서버 DB에 별도로 저장되어, 글에서 빼거나 글을 삭제해도 남는다. 파일마다 참조 위치(현재 글, 이전 버전, 배경화면)를 알려 주는 API를 만들고, 휴지통에서 참조가 없는 파일만 골라 삭제하게 했다. 참조 중인 파일은 서버가 409로 거절한다.
---

## 글에 넣은 이미지가 서버에 남는 이유

관리자가 메모 편집기에 이미지를 드래그 앤 드롭하면 두 가지 일이 일어난다.

1. 브라우저가 파일을 `POST /files`로 업로드하고, 서버는 그 바이트를 PostgreSQL의 `Upload` 테이블에 `bytea`[^bytea] 열로 저장한다. 행의 id는 무작위 12바이트를 base64url[^base64url]로 인코딩한 16자 문자열이다(예: `Xq3k9Lm2Pz0aB7cD`).
2. 편집기는 글 본문(Markdown)에 `![](https://<API 주소>/files/Xq3k9Lm2Pz0aB7cD)` 한 줄을 삽입한다.

이 사이트는 별도의 객체 저장소(S3, R2 같은 파일 전용 저장 서비스)를 쓰지 않고 업로드 파일을 DB에 직접 보관한다. 글과 파일을 잇는 것은 본문 안의 주소 문자열 하나뿐이다.

관계형 DB에는 두 테이블의 관계를 DB가 직접 관리하게 하는 **외래 키**(foreign key)가 있다. 한 테이블의 열이 다른 테이블의 기본 키를 가리킨다고 선언하면, DB는 가리키는 행이 사라질 때 함께 삭제하거나(`CASCADE`) 삭제를 거절한다(`RESTRICT`). 이 사이트에서도 `PostRevision.postSlug`는 외래 키로 `Post.slug`를 가리키고 `onDelete: Cascade`라서, 글을 삭제하면 그 글의 버전 기록도 DB가 함께 삭제한다. 반면 글 본문 안의 `/files/<id>` 문자열은 그냥 텍스트라서 DB는 이 관계를 알지 못한다.

![글 본문의 주소 문자열과 Upload 행의 id가 같은 문자열일 뿐 외래 키가 없는 구조](./images/server-files-cleanup-string-link.svg '본문의 /files/<id>와 Upload.id는 같은 문자열일 뿐이다. 본문에서 줄을 지우거나 글을 지워도 Upload 행은 남는다')

따라서 ==글에서 그 줄을 삭제해도 파일은 삭제되지 않는다==. 글을 영구 삭제해도 같다. 편집 화면에서는 이미지가 사라졌지만 파일은 서버 DB에 남아 저장 공간을 차지한다. 파일 하나의 상한은 10MB(`MAX_UPLOAD_BYTES`)이므로, 스크린숏을 몇 번 바꿔 넣기만 해도 수십 MB가 누적될 수 있다.

## 글 저장 시각에 파일도 함께 삭제하는 방안

미사용 파일을 정리하는 방법 세 가지를 비교했다.

| 방법                                          | 장점                                    | 단점                                                                                                                   |
| --------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 저장 시각에 빠진 파일을 즉시 삭제             | 미사용 파일이 누적되지 않는다           | 이전 버전과 최근 삭제된 글의 이미지가 깨진다                                                                           |
| 글과 파일 사이에 참조 테이블을 두고 집계      | 참조 위치를 바로 조회한다               | 편집기가 삽입하는 것은 주소 문자열이라, 저장마다 본문을 파싱해 테이블을 동기화해야 한다. 동기화가 어긋나면 값이 틀린다 |
| 목록 조회 시각에 글을 스캔해 참조 계산 (선택) | 글 본문이 유일한 원본이라 불일치가 없다 | 목록을 열 때마다 모든 글과 버전을 읽는다                                                                               |

이 화면은 관리자 한 명이 가끔 여는 화면이다. 열 때마다 계산하면 구현이 단순하고, 본문 외에 별도로 동기화할 데이터가 없으므로 불일치도 생기지 않는다.

첫 번째 방법(즉시 삭제)은 이 사이트에서 사용할 수 없다. 이 사이트에는 현재 본문에서 빠진 이미지를 다시 필요로 하는 기능이 두 개 있다.

- **이전 버전.** 게시할 때마다 `PostRevision` 행이 생성되고(글마다 최근 50개), 관리자는 이전 버전으로 되돌릴 수 있다. 버전 2에서 뺀 이미지도 버전 1의 본문에는 그대로 남아 있다([임시 저장과 버전 기록](/memo/drafts-and-versions)).
- **최근 삭제된 항목.** 삭제한 글은 `deletedAt` 시각이 기록된 채 30일 동안 남아 있고, 그 사이에 복구할 수 있다.

예를 들어 버전 1에 그림 A를 넣어 게시하고, 버전 2에서 그 줄을 지워 게시하는 시각에 A를 삭제했다고 하자. 이후 버전 1로 되돌리면 본문에는 `/files/A`가 다시 들어오지만 서버에는 A가 없어 이미지 자리가 빈다.

![저장할 때 빠진 그림을 바로 지우면 생기는 일](./images/server-files-cleanup-why.svg '버전 되돌리기와 최근 삭제 복구 시 이미지가 깨진다')

==즉시 삭제하면 이 두 기능이 깨진다==. 그래서 자동으로 삭제하지 않고, 파일마다 **참조 위치**를 표시해 관리자가 삭제 여부를 선택하게 했다.

## 참조 위치 찾기

### 정규식으로 본문에서 파일 id 추출

파일과 글은 문자열로만 연결되므로, 글 본문 문자열에서 파일 주소를 정규식(regular expression, 문자열 패턴을 기술하는 표기법)으로 검색한다.

```ts
export function uploadIdsIn(text: string | null | undefined): string[] {
	if (!text) return [];
	return [...new Set([...text.matchAll(/\/files\/([\w-]{16})(?![\w-])/g)].map((match) => match[1]))];
}
```

정규식을 부분별로 읽으면 다음과 같다.

| 부분          | 뜻                                                                                    |
| ------------- | ------------------------------------------------------------------------------------- |
| `\/files\/`   | 문자 그대로의 `/files/`. 앞의 API 주소가 무엇이든(전체 주소든 `/files/…` 경로든) 일치 |
| `([\w-]{16})` | 영문자·숫자·`_`·`-` 정확히 16자. 괄호 안이 반환할 id                                  |
| `(?![\w-])`   | 부정 전방 탐색. 바로 뒤에 같은 종류의 문자가 오면 일치로 보지 않는다                  |
| `g`           | 본문 전체에서 모든 일치를 찾는다 (`matchAll`)                                         |

부정 전방 탐색(negative lookahead)은 "이 위치 뒤에 특정 패턴이 오지 않아야 한다"는 조건만 검사하고 문자는 소비하지 않는 정규식 문법이다. 파일 id는 정확히 16자이므로, 16자 뒤에 문자가 더 이어지는 `/files/Xq3k9Lm2Pz0aB7cD_v2`는 다른 주소로 판단해 제외한다. 결과는 `Set`에 넣어 같은 id가 본문에 두 번 나와도 한 번만 반환한다.

![전체 주소와 경로 형식은 일치하고, 16자 뒤에 문자가 붙은 주소는 제외되는 예](./images/server-files-cleanup-regex.svg '세 줄의 본문에서 반환하는 id는 하나다')

이 함수는 서버와 화면이 함께 쓰는 `packages/contracts/src/files.ts`에 있다.

### 서버가 모든 글과 버전을 스캔

서버의 `GET /files`(관리자 전용)는 모든 글의 게시본, 임시 저장본, 이전 버전을 이 함수로 스캔해 파일마다 참조 위치를 반환한다. 응답의 파일 하나는 다음 모양이다(`UploadUsage` 스키마의 일부 필드).

```json
{
	"id": "Xq3k9Lm2Pz0aB7cD",
	"name": "screen.png",
	"type": "image/png",
	"size": 184320,
	"usedBy": { "posts": [], "revisions": ["example-post"], "wallpaper": false }
}
```

이 예의 파일은 현재 글에서는 쓰이지 않고 `example-post`의 이전 버전에만 남아 있다. 참조 위치는 네 가지로 분류된다.

| 참조 위치       | 의미                                            | 삭제 가능 여부                                     |
| --------------- | ----------------------------------------------- | -------------------------------------------------- |
| 현재 글         | 게시본이나 임시 저장본 (최근 삭제된 글도 포함)  | 불가 (409)                                         |
| 배경화면        | 관리자가 업로드한 배경화면의 원본·썸네일        | 불가 (배경화면 설정에서 삭제)                      |
| 이전 버전에서만 | 현재 글에서는 뺐지만 이전 버전 본문에 남아 있다 | 가능 (그 버전으로 되돌리면 이미지가 표시되지 않음) |
| 없음            | 어디에서도 참조하지 않음                        | 가능                                               |

![글과 배경화면에서 파일 주소를 찾아 쓰는 곳별로 지울 수 있는지 나누는 도식](./images/server-files-cleanup-usage.svg '현재 참조 중인 파일은 서버가 409로 거절한다')

서버는 게시본 요약·본문, 임시 저장본 요약·본문, 이전 버전 요약·본문을 모두 스캔한다.

```ts
// apps/api/src/files/files.service.ts
for (const post of posts)
	for (const text of [post.summary, post.body, post.draftSummary, post.draftBody])
		for (const id of uploadIdsIn(text)) add(current, id, post.slug);
for (const revision of revisions)
	for (const text of [revision.summary, revision.body])
		for (const id of uploadIdsIn(text)) add(old, id, revision.postSlug);
```

현재 글에서 참조하는 파일은 이전 버전 집합에서 제외한다. 같은 이미지를 버전 1부터 지금까지 계속 쓰고 있다면 "현재 글"로만 분류되고, "이전 버전에서만"에는 현재 본문에서 빠진 파일만 남는다.

### 삭제 요청도 서버가 다시 검사

`DELETE /files/:id`도 같은 규칙으로 거절한다. HTTP 409 Conflict는 "요청 자체는 올바르지만 서버의 현재 상태와 충돌해 처리할 수 없다"는 의미의 상태 코드이고, 참조 중인 파일 삭제가 이 경우에 해당한다.

```ts
if (row.wallpaperImage || row.wallpaperThumb) throw new ConflictException('배경화면에서 쓰는 파일입니다.');
const posts = (await this.references()).current.get(id);
if (posts?.size) throw new ConflictException(`글에서 쓰는 파일입니다: ${[...posts].sort().join(', ')}`);
```

==화면에서 삭제 버튼을 숨기는 것만으로는 부족하다==. `curl`처럼 화면을 거치지 않는 직접 요청이 있을 수 있고, 화면이 목록을 조회한 뒤 그 파일이 다른 글에 삽입됐을 수도 있다. 아래 순서가 두 번째 경우다. 휴지통 탭이 ② 시각의 목록을 표시하는 동안 다른 탭에서 글 b에 같은 파일을 넣어 저장하면, 휴지통 화면에는 여전히 삭제 버튼이 있다. 서버가 삭제 요청을 받는 시각에 다시 스캔하므로 이 요청은 409로 거절된다.

![휴지통이 목록을 받은 뒤 다른 탭에서 그 파일을 글에 넣으면, 서버가 DELETE 시각에 다시 검사해 409로 거절하는 순서](./images/server-files-cleanup-race.svg '화면의 목록은 조회한 시각의 상태다. 최종 판단은 서버가 삭제 요청을 받는 시각에 한다')

409 응답 메시지에 글 slug를 포함해, 어느 글에서 이미지를 빼야 하는지 바로 알 수 있게 했다. 응답 본문은 예를 들어 `글에서 쓰는 파일입니다: example-post, memo-editor`다.

### 목록 조회에서 파일 내용은 제외

목록 조회에서는 파일 내용(`data` 열, 바이트)을 읽지 않는다. 파일 하나가 최대 10MB이므로, 내용까지 조회하면 파일 수 × 크기만큼 DB에서 API 서버로 전송된다. Prisma 쿼리의 `select`에서 `data`를 제외해 이름·형식·크기·작성 시각 같은 몇 개 열만 전송한다.

## 서버가 알 수 없는 글

이 블로그의 글은 두 곳에 있다.

- **저장소 Markdown.** 대부분의 글은 저장소의 `content/*.md` 파일이고, 빌드 시각에 사이트 번들에 포함된다. 서버 DB에는 없다.
- **서버 DB.** 관리자가 사이트에서 편집한 글만 있다.

==저장소 글이 서버의 이미지를 참조하면 서버는 그 참조를 알 수 없다==. 예를 들어 사이트에서 업로드한 이미지 주소를 복사해 저장소의 Markdown 글에 붙여 넣었다면, 서버의 스캔 결과로는 그 파일이 "없음"으로 분류된다.

그래서 화면에서 한 번 더 검사한다. 휴지통(`apps/bin/filesApi.ts`의 `usageOf`)은 번들에 포함된 저장소 글 본문에 `/files/<id>` 문자열이 포함됐는지 검사하고, 하나라도 있으면 "글에서 쓰는 파일"로 분류해 삭제 버튼을 숨긴다.

| 글의 위치           | 참조를 검사하는 곳                     |
| ------------------- | -------------------------------------- |
| 서버 DB (편집한 글) | 서버 `GET /files`, `DELETE /files/:id` |
| 저장소 Markdown     | 화면(휴지통)                           |

## 휴지통 화면

관리자로 로그인하면 휴지통 사이드바에 "서버 파일" 항목이 추가된다. 상단에 참조가 없는 파일의 개수와 합계 크기가 표시되고, 파일을 하나씩 또는 일괄 삭제할 수 있다. 삭제는 되돌릴 수 없으므로 실행 전에 확인 대화상자를 표시한다.

![관리자 휴지통의 서버 파일 목록](./images/server-files-cleanup-list.jpg '참조가 없는 파일에만 지우기 버튼이 표시되고, 글이 참조하는 파일에는 글 slug가 표시된다 (e2e/fakeApi.ts로 캡처)')

처음 구현한 목록에는 블로그 이미지가 하나도 표시되지 않아, 조회 오류인지 먼저 확인했다. 원인은 오류가 아니었다. 저장소 Markdown 글의 이미지는 저장소 `content/images/`에 있어 사이트와 함께 정적 파일로 배포되고, ==서버에는 메모 편집기로 업로드한 파일과 배경화면만 저장된다==. 같은 혼동을 막기 위해 목록 상단과 빈 화면에 이 목록에 표시되는 파일의 범위를 한 줄로 안내했다.

[휴지통](/memo/bin-app)은 방문자에게는 "이 사이트가 내 브라우저에 저장한 데이터"를, 관리자에게는 "글에서 제거했지만 서버에 남은 파일"을 표시한다. 두 목록 모두 실제로 삭제할 수 있는 항목만 담는다.

## 시험

| 종류     | 파일                              | 확인 항목                                                                                                    |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 단위     | `uploadIdsIn` 시험                | 전체 주소·경로 형식 인식, 같은 id는 한 번만, 16자보다 긴 주소 제외                                           |
| API e2e  | `apps/api/test/files.e2e.test.ts` | 현재 글·이전 버전·배경화면 참조 구분 / 미참조·이전 버전 전용 파일은 삭제, 나머지는 409 / 관리자가 아니면 401 |
| 화면 E2E | `apps/react/e2e/bin.spec.ts`      | 가짜 서버에 네 종류 파일을 두고, 참조 중인 파일에는 삭제 버튼이 없고 나머지는 개별·일괄 삭제되는지           |

<details>
<summary>API e2e 시험 이름 원문</summary>

- "파일마다 지금 글, 예전 버전, 배경화면 중 어디에서 쓰는지 알려 준다"
- "안 쓰는 파일과 예전 버전에서만 쓰는 파일은 지우고, 지금 글이나 배경화면이 쓰는 파일은 409"
- "관리자가 아니면 목록을 보거나 지울 수 없다 (401)"

</details>

## 직접 확인하는 방법

```bash
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
cd apps/react && npx playwright test e2e/bin.spec.ts
```

1. 관리자로 로그인해 휴지통의 "서버 파일"을 연다
2. 삭제 전에 파일 이름으로 글을 검색해 참조 여부를 한 번 더 확인한다
3. 삭제 후 관련 글을 열어 이미지가 깨지지 않았는지 확인한다

> [!CAUTION] 삭제한 서버 파일은 복구할 수 없다
> 삭제한 서버 파일은 복구할 수 없으므로, 삭제 전에 [R2 백업](/memo/db-backup)의 최근 실행 시각을 확인한다.

응답 모양은 [packages/contracts/src/files.ts](https://github.com/hyeoniverse/MacFolio/blob/main/packages/contracts/src/files.ts), 시험은 [apps/api/test/files.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/files.e2e.test.ts).

## 남은 과제

- **목록 조회는 모든 글을 읽는다.** 글과 버전이 늘면 목록 조회 시간도 늘어난다. 현재는 관리자 한 명이 가끔 여는 화면이라 유지했다. 느려지면 참조 테이블을 도입하고, 현재의 스캔 로직은 참조 테이블이 정확한지 검증하는 시험으로 전환한다.
- **파일 내용은 조회하지 않는다.** 목록 쿼리의 `select`에서 `data`를 제외해, 파일이 늘어도 목록 응답은 이름·크기 같은 몇 개 열만 전송한다.
- **서버가 알 수 없는 글이 있다.** 저장소 Markdown의 참조는 화면만 알 수 있다. 데이터가 두 곳에 나뉜 구조에서는 한쪽 기준만으로 삭제하면 안 된다.
- **자동 삭제 대신 근거를 표시하고 선택하게 한다.** 되돌릴 수 없는 삭제는 참조 위치를 표시하고 관리자가 선택하게 했다. 그 결과 "이전 버전에서만"처럼 판단이 필요한 경우도 화면에 그대로 드러난다.

## 관련 글

- [localStorage 키 목록과 2초 주기 확인으로 구현한 휴지통 앱](/memo/bin-app)
- [게시본과 임시본을 한 행에 담고 CHECK 제약으로 지키는 Post 테이블](/memo/drafts-and-versions)
- [JPEG·PNG·WebP 세그먼트를 순회해 EXIF를 지우고 방향 값만 남기기](/memo/upload-strip-exif)
- [pg_dump와 R2로 하는 DB 백업과 복원 시험](/memo/db-backup)
- [화면이 알아야 하는가를 기준으로 파일 검사 규칙을 contracts와 서버로 나누기](/memo/contracts-validation#업로드-파일-화면이-알아야-하는-값만-contracts로-205)

<details>
<summary>참고 문헌</summary>

- PostgreSQL 문서, [Binary Data Types (bytea)](https://www.postgresql.org/docs/current/datatype-binary.html)
- PostgreSQL 문서, [Constraints: Foreign Keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- Prisma 문서, [Referential actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions)
- Prisma 문서, [Select fields](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields)
- MDN, [409 Conflict](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409)
- MDN, [Lookahead assertion: (?=...), (?!...)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Lookahead_assertion)
- MDN, [String.prototype.matchAll()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll)
- RFC 4648, [The Base16, Base32, and Base64 Data Encodings, 5. Base 64 Encoding with URL and Filename Safe Alphabet](https://www.rfc-editor.org/rfc/rfc4648#section-5)

</details>

[^bytea]: PostgreSQL의 이진 데이터 열 타입. 이미지·PDF 같은 바이트열을 행 안에 그대로 저장한다.

[^base64url]: 바이트를 영문 대소문자·숫자·`-`·`_` 64종류 문자로 표현하는 인코딩(RFC 4648 5절). 일반 base64의 `+`·`/` 대신 `-`·`_`를 써서 주소에 그대로 넣을 수 있다. 3바이트가 4글자가 되므로 12바이트는 16자다.

#MacFolio #백엔드 #NestJS #Prisma
