---
title: 글은 Markdown에 두고 정리만 서버에
date: 2026-09-29
category: 개발기/MacFolio/백엔드
summary: 관리자가 메모 폴더를 정리하게 하면서 글은 Markdown에 그대로 두고, 정리 내용(폴더·옮김·고정)만 서버에 JSON 하나로 두어 겹쳐 보였다. 떠나는 페이지의 keepalive가 막힌 뒤 편집마다 바로, 줄 세워 저장한다.
---

관리자 로그인이 붙었으니, 잠가 두었던 메모 편집(폴더 만들기, 글 옮기기, 고정)을 켤 차례였다. 처음 계획은 글을 전부 DB로 옮기는 것이었다. 그런데 다시 따져 보니 필요한 것은 **글쓰기가 아니라 정리**였다. 이 일은 [#42](https://github.com/hyeoniverse/MacFolio/pull/42)로 들어갔다. 21개 파일, 785줄 더하기, 112줄 지우기다.

![관리자가 보는 폴더 메뉴](./images/memo-folder-menu.jpg '관리자로 로그인하면 폴더에 ••• 메뉴가 생긴다. 글이 들어 있는 폴더는 지울 수 없다')

## 글을 옮기지 않은 이유

글은 저장소의 Markdown 파일이다. 커밋 기록이 남고, 이미지는 빌드할 때 함께 묶이고, 본문을 고칠 때 편집기와 Git을 그대로 쓴다. 이걸 DB로 옮기면 글쓰기 화면, 이미지 업로드, 옮기는 스크립트까지 만들어야 한다.

한편 메모 앱에는 이미 **정리 내용을 글 위에 겹쳐 보여 주는** 순수 함수가 있었다. 방문자가 자기 브라우저에서만 정리하던 시절에 만든 것이다.

```ts
// 만든 폴더, 옮긴 글·폴더, 고정을 원래 글에 겹친다. 원래 글은 바꾸지 않는다
const organized = organizePosts(posts, organization);
```

| 방법                                     | 좋은 점                             | 걸리는 점                                                                     |
| ---------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| 글을 모두 DB로                           | 정리도 글쓰기도 한곳에서            | 글쓰기 화면·이미지 올리기·옮기는 스크립트가 먼저 필요하다. 커밋 기록을 잃는다 |
| 정리를 Markdown 머리말에 (관리자가 커밋) | 서버가 필요 없다                    | 폴더를 옮길 때마다 커밋·배포. 방문자 화면에 바로 안 보인다                    |
| **정리 내용만 서버, 글은 Markdown**      | 이미 있는 겹치기 함수를 그대로 쓴다 | 글이 두 곳(저장소, 서버의 정리)에서 모양을 얻는다                             |

그래서 정리 내용(`{ folders, posts, moves, pins }`)만 서버에 두기로 했다. 브라우저 저장소에 두던 것을 서버로 옮기는 것뿐이라, 화면과 정리 로직은 그대로 다시 쓴다.

![Markdown 글 위에 서버의 정리 내용을 겹치는 구조](./images/memo-overlay.svg '정리 내용을 비우면 글은 원래 폴더로 돌아간다')

## API는 두 개

```text
GET /memo/organization   누구나. 방문자도 관리자가 정리한 폴더로 본다
PUT /memo/organization   관리자만 (AdminGuard). 통째로 바꾼다
```

정리 내용은 한 행에 JSON으로 저장한다. 관리자가 한 명이라 동시에 고칠 일이 없고, 통째로 바꾸면 화면의 상태와 서버의 상태가 어긋날 틈이 적다.

화면에서 막는 규칙은 서버에서 **한 번 더** 검사한다. 폴더는 3단까지, 이름은 30자 이하에 앞뒤 공백 없이, 글 주소는 정해진 문자만, 항목 수는 상한까지. 화면을 거치지 않고 요청을 직접 보낼 수 있기 때문이다. 어긴 규칙은 모두 모아 400으로 돌려준다.

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["폴더는 3단까지입니다: a/b/c/d"] }
```

## 저장을 놓치지 않기

처음에는 편집하고 0.4초 뒤에 저장했다. 연달아 바꾸면 마지막 것만 보내려는 생각이었다. 그런데 테스트에서 편집 직후 새로고침하자 편집이 사라졌다. 사람도 고정 버튼을 누르자마자 창을 닫을 수 있다.

페이지를 떠날 때(`pagehide`) `fetch(..., { keepalive: true })`로 남은 편집을 보내 보았지만 요청이 아예 나가지 않았다. JSON을 보내는 PUT은 브라우저가 먼저 CORS 확인 요청(preflight)을 보내야 하는데, 떠나는 페이지의 keepalive 요청은 그 확인을 거칠 수 없다.

돌아보니 모아 보낼 이유가 없었다. 편집은 타이핑이 아니라 폴더 만들기, 옮기기, 고정처럼 **한 번씩 누르는 동작**이다. 그래서 편집하면 바로 저장한다. 대신 연달아 누르면 요청이 뒤바뀌어 도착해 이전 상태가 이길 수 있으므로, 저장은 줄을 세워 차례로 보낸다.

```ts
saveQueue.current = saveQueue.current.then(async () => {
	if (await saveOrganization(env.apiUrl, snapshot)) return;
	notify({ app: 'memo', title: '저장하지 못함', body: '메모 정리를 저장하지 못했습니다. 다시 로그인해 주세요.' });
	setOrganization(await fetchOrganization(env.apiUrl)); // 서버 내용으로 되돌린다
});
```

저장에 실패하면(세션이 끝났거나 규칙을 어겼거나) 알리고 서버의 내용으로 되돌린다. 화면에만 남은 편집이 저장된 것처럼 보이지 않게 하려는 것이다.

## 테스트

- API: 규칙 검사는 순수 함수로 단위 테스트하고, 실제 PostgreSQL에 붙여 누구나 읽기, 로그인하지 않으면 401, 규칙을 어기면 관리자라도 400, 관리자는 저장을 확인한다
- 화면: 가짜 API(`page.route`)가 정리 내용을 메모리에 들고 있다. 지금 `e2e/fakeApi.ts`의 가짜 API는 서버 기능을 쓰는 화면 시험 대부분이 함께 쓴다. 꺼 두었던 관리자 편집 E2E를 다시 켜서 폴더 만들기·옮기기·이름 바꾸기·고정이 서버에 저장되고 새로고침해도 남는지, 방문자도 관리자가 정리한 대로 보는지, 저장에 실패하면 되돌아가는지 확인한다

## 그 뒤

정리 내용은 그 뒤 칸이 늘었다. 다음 날 잠금(`locks`, [메모 잠그기](/memo/memo-lock)), 그다음 날 폴더 순서(`order`, [폴더 순서를 손잡이로](/memo/memo-folder-order))가 들어갔다. 칸이 늘 때마다 "예전에 저장한 JSON에는 이 칸이 없다"를 세 곳(서버 검사, 서버가 읽어 줄 때, 화면이 받을 때)에서 빈 값으로 채웠다. 10월 9일에는 이 모양과 검사 규칙을 `packages/desktop-core/src/memo/rules.ts`로 옮겨 화면과 서버가 같은 코드를 쓴다([메모 규칙을 desktop-core로](/memo/desktop-core-memo)).

```ts
export const EMPTY_ORGANIZATION: Organization = { folders: [], posts: {}, moves: [], pins: {}, locks: {}, order: [] };
```

![정리 내용이 자란 길](./images/memo-organization-api-growth.svg '네 칸으로 시작해 잠금과 순서가 더해졌고, 규칙은 desktop-core로 옮겼다')

"글은 Markdown에"도 같은 날 반쯤 바뀌었다. 관리자 글쓰기([#44](https://github.com/hyeoniverse/MacFolio/pull/44))가 붙어, 관리자가 쓰거나 고친 글은 서버에 저장된다. 그래도 저장소의 Markdown 글은 그대로 있고, 서버 글과 Markdown 글이 같은 목록에 섞여 보인다. 정리 내용은 둘 위에 똑같이 겹친다.

## 남은 것·배운 것

- 정리 내용은 통째로 바꾼다. 관리자가 두 탭에서 동시에 고치면 늦게 저장한 쪽이 이긴다. 지금은 관리자가 한 명이라 받아들였다.
- 떠나는 페이지에서 JSON을 보내는 것은 CORS 확인 요청 때문에 안 된다. 한 번씩 누르는 동작은 바로 보내고, 줄을 세워 차례를 지키는 편이 단순하다.
- "옮기지 않는" 결정은 나중에 옮길 때도 도움이 된다. 겹치기 함수가 원래 글을 바꾸지 않으니, 정리 내용을 비우면 글은 원래 자리로 돌아간다.

## 직접 확인하는 방법

폴더 정리 규칙은 서버와 화면이 함께 쓰는 [packages/desktop-core/src/memo/rules.ts](https://github.com/hyeoniverse/MacFolio/blob/main/packages/desktop-core/src/memo/rules.ts)에 있다. 서버 없이 화면만 볼 때는 E2E가 쓰는 가짜 API([apps/react/e2e/fakeApi.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/e2e/fakeApi.ts))로 충분하다.

```bash
pnpm --filter @macfolio/api test          # 서버 단위 시험
cd apps/react && npx vitest run src/apps/memo
npx playwright test e2e/memo-admin.spec.ts --project=desktop-chromium
```

로컬에서 서버까지 띄워 보려면 루트에서 `pnpm dev:all`로 API와 사이트를 함께 띄우고 관리자로 로그인한다. 정리한 결과는 DB에 남고 글 파일(`content/*.md`)은 그대로인지 `git status`로 본다.

참고 문서: [NestJS 문서](https://docs.nestjs.com/), [Prisma 문서](https://www.prisma.io/docs).

## 관련 글

- [관리자 로그인 (GitHub OAuth)](/memo/admin-login-github-oauth)
- [관리자 글쓰기](/memo/post-editor)
- [읽기 전용 메모](/memo/read-only-memo)
- [메모 규칙을 desktop-core로](/memo/desktop-core-memo)

#MacFolio #백엔드 #메모앱
