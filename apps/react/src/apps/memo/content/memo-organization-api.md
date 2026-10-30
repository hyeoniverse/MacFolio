---
title: Markdown 글은 두고 서버 JSON 한 행으로 겹치는 메모 폴더 정리
date: 2026-09-29
category: 개발 기록/MacFolio/서버·API
series: 메모 폴더
seriesOrder: 2
summary: 관리자가 메모 폴더를 정리하게 하면서 글은 Markdown에 그대로 두고, 정리 내용(폴더·이동·고정)만 서버에 JSON 하나로 저장해 글 목록 위에 겹쳐 표시했다. 페이지를 떠나는 시각의 keepalive 요청이 전송되지 않아, 편집마다 즉시 순차 저장한다.
---

[관리자 로그인](/memo/admin-login-github-oauth)을 추가한 뒤, 비활성화했던 메모 편집(폴더 생성, 글 이동, 고정)을 관리자에게 열었다. 처음 계획은 글을 전부 DB로 이전하는 것이었다. 요구 사항을 다시 정리하니 필요한 기능은 **글 작성이 아니라 정리**였다. 이 작업은 [PR #42](https://github.com/hyeoniverse/MacFolio/pull/42)의 커밋 `0150b9be1`로 반영했다. 21개 파일, 785줄 추가, 112줄 삭제다.

![관리자가 보는 폴더 메뉴](./images/memo-folder-menu.jpg '관리자로 로그인하면 폴더에 ••• 메뉴가 생긴다. 글이 들어 있는 폴더는 지울 수 없다')

## 글을 DB로 이전하지 않은 이유

글은 저장소의 Markdown 파일이다(`apps/react/src/apps/memo/content/*.md`). 커밋 기록이 남고, 이미지는 빌드 시각에 [`import.meta.glob`](https://vite.dev/guide/features.html#glob-import)으로 함께 번들링되며, 본문은 코드 편집기와 Git으로 수정한다. 글을 DB로 이전하려면 글 작성 화면, 이미지 업로드, 이전 스크립트를 먼저 만들어야 한다.

한편 메모 앱에는 이미 **정리 내용을 글 목록 위에 겹쳐 표시하는** 순수 함수[^pure]가 있었다. 방문자가 자기 브라우저에서만 정리하던 시기에 만든 함수다.

```ts
// 만든 폴더, 옮긴 글·폴더, 고정을 원래 글에 겹친다. 원래 글은 바꾸지 않는다
const organized = organizePosts(posts, organization);
```

| 방법                                          | 장점                               | 단점                                                                          |
| --------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| 글을 모두 DB로 이전                           | 정리와 글 작성을 한 곳에서 처리    | 글 작성 화면·이미지 업로드·이전 스크립트가 먼저 필요하다. 커밋 기록이 끊긴다  |
| 정리를 Markdown 머리말에 기록 (관리자가 커밋) | 서버가 필요 없다                   | 폴더를 이동할 때마다 커밋·배포가 필요하다. 방문자 화면에 즉시 반영되지 않는다 |
| **정리 내용만 서버, 글은 Markdown** (채택)    | 기존 `organizePosts`를 그대로 사용 | 글의 최종 위치가 두 곳(저장소의 머리말, 서버의 정리 내용)으로 결정된다        |

정리 내용(`{ folders, posts, moves, pins }`)만 서버에 저장하기로 했다. 브라우저 저장소에 보관하던 값을 서버로 옮기는 변경이므로 화면과 정리 로직은 그대로 재사용한다. 방문자 브라우저에 저장하던 정리 기능은 제거하고, 남아 있던 이전 값은 삭제한다.

| 필드      | 내용                                             |
| --------- | ------------------------------------------------ |
| `folders` | 관리자가 만든 폴더 경로 목록                     |
| `posts`   | 글 slug → 이동한 폴더 경로                       |
| `moves`   | 이동한 폴더 `{ from, to }` 목록. 순서대로 적용   |
| `pins`    | 글 slug → 고정 여부 (머리말의 `pinned`보다 우선) |

![Markdown 글 위에 서버의 정리 내용을 겹치는 구조](./images/memo-overlay.svg '정리 내용을 비우면 글은 원래 폴더로 돌아간다')

## API 두 개

| 경로                     | 권한                    | 동작                                                    |
| ------------------------ | ----------------------- | ------------------------------------------------------- |
| `GET /memo/organization` | 누구나                  | 방문자도 관리자가 정리한 폴더 구조로 글 목록을 조회한다 |
| `PUT /memo/organization` | 관리자만 (`AdminGuard`) | 정리 내용 전체를 교체한다                               |

정리 내용은 한 행에 JSON으로 저장한다. 관리자가 한 명이라 동시 수정이 발생하지 않고, 전체를 교체하면 화면 상태와 서버 상태가 어긋나는 경우가 줄어든다.

화면에서 막는 규칙은 서버에서 **한 번 더** 검사한다. 화면을 거치지 않고 요청을 직접 보낼 수 있기 때문이다.

| 규칙          | 값                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------- |
| 폴더 깊이     | 3단까지 (`MAX_FOLDER_DEPTH = 3`)                                                            |
| 폴더 이름     | 30자 이하, 앞뒤 공백 없음 (`FOLDER_NAME_MAX = 30`)                                          |
| 글 주소(slug) | 허용한 문자만                                                                               |
| 항목 수       | 상한 이하. 현재 값은 폴더 200, 옮긴 글 500, 옮긴 폴더 200, 고정 500 (`ORGANIZATION_LIMITS`) |

위반한 규칙은 모두 수집해 400으로 반환한다.

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["폴더는 3단까지입니다: a/b/c/d"] }
```

## 저장 누락 방지

처음에는 편집 후 0.4초 뒤에 저장했다(디바운스). 연속으로 편집하면 마지막 상태만 전송하려는 의도였다. 그런데 E2E 시험에서 편집 직후 새로고침하자 편집 내용이 사라졌다. 실제 사용자도 고정 버튼을 누른 직후 창을 닫을 수 있다.

페이지를 떠나는 시각(`pagehide`)에 [`fetch(..., { keepalive: true })`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#keepalive)로 남은 편집을 전송해 보았지만 요청이 전송되지 않았다. JSON 본문을 보내는 교차 출처 PUT은 브라우저가 먼저 [CORS preflight](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request) 요청(`OPTIONS`)을 보내야 하는데, 페이지를 떠나는 시각의 keepalive 요청은 이 preflight를 거칠 수 없다.

편집 내용을 묶어 전송할 이유도 없었다. 편집은 타이핑이 아니라 폴더 생성, 이동, 고정처럼 **한 번씩 클릭하는 동작**이다. 그래서 편집할 때마다 즉시 저장한다. 다만 연속으로 클릭하면 요청 도착 순서가 뒤바뀌어 이전 상태가 최신 상태를 덮어쓸 수 있으므로, 저장 요청은 대기열(`saveQueue`)에 넣어 앞 요청이 끝난 뒤 다음 요청을 보낸다.

![정리 내용 저장 시점의 전후](./images/memo-organization-api-save-queue.svg '0.4초 지연 저장은 새로고침 시각에 편집을 잃었고, 즉시 저장 + 순차 전송으로 바꿨다')

```ts
saveQueue.current = saveQueue.current.then(async () => {
	if (await saveOrganization(env.apiUrl, snapshot)) return;
	notify({ app: 'memo', title: '저장하지 못함', body: '메모 정리를 저장하지 못했습니다. 다시 로그인해 주세요.' });
	setOrganization(await fetchOrganization(env.apiUrl)); // 서버 내용으로 되돌린다
});
```

저장에 실패하면(세션 만료 또는 규칙 위반) 알림을 표시하고 서버의 정리 내용으로 되돌린다. 저장되지 않은 편집이 화면에만 남아 저장된 것처럼 보이는 상태를 막기 위해서다.

## 시험

| 범위     | 방식                                                                                                        | 확인 항목                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| API 단위 | 규칙 검사 순수 함수                                                                                         | 깊이·이름·slug·항목 수 위반을 모두 수집하는지                                                                                       |
| API e2e  | 실제 PostgreSQL                                                                                             | 누구나 조회, 비로그인 401, 규칙 위반은 관리자라도 400, 관리자 저장                                                                  |
| 화면 E2E | 가짜 API([`page.route`](https://playwright.dev/docs/api/class-page#page-route))가 정리 내용을 메모리에 보관 | 폴더 생성·이동·이름 변경·고정이 저장되고 새로고침 후에도 유지되는지, 방문자에게도 같은 구조가 표시되는지, 저장 실패 시 되돌아가는지 |

비활성화했던 관리자 편집 E2E를 이 가짜 API로 다시 켰다. 현재는 `e2e/fakeApi.ts`의 가짜 API를 서버 기능을 사용하는 화면 시험 대부분이 공유한다. API e2e는 같은 DB를 사용하므로 이 PR부터 파일을 순차 실행한다.

## 이후 변경

정리 내용의 필드는 이후 두 개가 추가됐다. 다음 날 잠금(`locks`, [메모 잠그기](/memo/memo-lock)), 그다음 날 폴더 순서(`order`, [폴더 순서를 손잡이로 바꾸기](/memo/memo-folder-order))다. 필드를 추가할 때마다 "이전에 저장한 JSON에는 이 필드가 없다"는 경우를 세 곳(서버 검사, 서버 응답, 화면 수신)에서 빈 값으로 채웠다. 10월 9일에는 이 구조와 검사 규칙을 `packages/desktop-core/src/memo/rules.ts`로 옮겨 화면과 서버가 같은 코드를 사용한다([desktop-core로 메모 로직을 옮기며 값 검사와 localStorage 읽기·쓰기 나누기](/memo/desktop-core-memo)).

```ts
export const EMPTY_ORGANIZATION: Organization = { folders: [], posts: {}, moves: [], pins: {}, locks: {}, order: [] };
```

![정리 내용이 자란 길](./images/memo-organization-api-growth.svg '네 칸으로 시작해 잠금과 순서가 더해졌고, 규칙은 desktop-core로 옮겼다')

"글은 Markdown에"라는 결정도 같은 날 일부 바뀌었다. 관리자 글쓰기([PR #44](https://github.com/hyeoniverse/MacFolio/pull/44), [Markdown 블로그에 글쓰기 붙이기](/memo/post-editor))가 추가되어 관리자가 작성하거나 수정한 글은 서버에 저장된다. 저장소의 Markdown 글은 그대로 유지되고, 서버 글과 Markdown 글이 같은 목록에 함께 표시된다. 정리 내용은 두 종류의 글에 같은 방식으로 적용된다.

## 남은 것·배운 것

- 정리 내용은 전체를 교체한다. 관리자가 두 탭에서 동시에 수정하면 나중에 저장한 쪽이 반영된다(last write wins). 관리자가 한 명이므로 이 동작을 허용했다.
- 페이지를 떠나는 시각에 JSON을 교차 출처로 전송하는 요청은 CORS preflight 때문에 전송되지 않는다. 한 번씩 클릭하는 동작은 즉시 전송하고 대기열로 순서를 보장하는 편이 단순하다.
- 글을 이전하지 않은 결정은 이후 변경에도 유리하다. `organizePosts`가 원래 글을 수정하지 않으므로, 정리 내용을 비우면 글은 원래 폴더로 돌아간다.

## 직접 확인하는 방법

폴더 정리 규칙은 서버와 화면이 함께 쓰는 [packages/desktop-core/src/memo/rules.ts](https://github.com/hyeoniverse/MacFolio/blob/main/packages/desktop-core/src/memo/rules.ts)에 있다. 서버 없이 화면만 확인할 때는 E2E가 쓰는 가짜 API([apps/react/e2e/fakeApi.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/e2e/fakeApi.ts))로 충분하다.

```bash
pnpm --filter @macfolio/api test          # 서버 단위 시험
cd apps/react && npx vitest run src/apps/memo
npx playwright test e2e/memo-admin.spec.ts --project=desktop-chromium
```

로컬에서 서버까지 실행하려면 루트에서 `pnpm dev:all`로 API와 사이트를 함께 실행하고 관리자로 로그인한다. 정리한 결과는 DB에 저장되고 글 파일(`content/*.md`)은 변경되지 않았는지 `git status`로 확인한다.

참고 문서: [NestJS Guards](https://docs.nestjs.com/guards), [Prisma Json 필드](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields), [MDN Preflight request](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request).

## 관련 글

- [GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기](/memo/admin-login-github-oauth)
- [Markdown 블로그에 글쓰기 붙이기](/memo/post-editor)
- [정적 사이트의 편집 권한을 useCanEditMemo 하나로 관리자에게만 열기](/memo/read-only-memo)
- [desktop-core로 메모 로직을 옮기며 값 검사와 localStorage 읽기·쓰기 나누기](/memo/desktop-core-memo)
- [메모 잠그기](/memo/memo-lock)
- [폴더 순서를 손잡이로 바꾸기](/memo/memo-folder-order)

[^pure]: 같은 입력에 항상 같은 결과를 반환하고 입력 값이나 외부 상태를 변경하지 않는 함수. `organizePosts`는 글 목록과 정리 내용을 받아 새 목록을 반환하며, 원래 글 객체는 수정하지 않는다.

#MacFolio #백엔드 #메모앱
