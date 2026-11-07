---
title: Markdown 글은 두고 서버 JSON 한 행으로 겹치는 메모 폴더 정리
date: 2026-09-29
category: 개발 기록/MacFolio/서버·API
series: 메모 폴더
seriesOrder: 2
summary: 관리자가 메모 폴더를 정리하게 하면서 글은 Markdown에 그대로 두고, 정리 내용(폴더·이동·고정)만 서버에 JSON 하나로 저장해 글 목록 위에 겹쳐 표시했다. 페이지를 떠나는 시각의 keepalive 요청이 전송되지 않아, 편집마다 즉시 순차 저장한다.
---

MacFolio의 블로그는 메모 앱 모양이다. 왼쪽 사이드바에 폴더가 있고, 폴더를 고르면 그 폴더의 글 목록이 나온다. 글이 어느 폴더에 들어갈지는 각 Markdown 파일 머리말의 `category` 값(예: `개발 기록/MacFolio/서버·API`)이 정한다. 머리말은 파일 맨 위 `---` 두 줄 사이에 적는 제목·날짜·분류 같은 속성이다.

[관리자 로그인](/memo/admin-login-github-oauth)을 추가한 뒤, 비활성화했던 메모 편집(폴더 생성, 글 이동, 고정)을 관리자에게 열었다. 처음 계획은 글을 전부 DB로 이전하는 것이었다. 요구 사항을 다시 정리하니 필요한 기능은 **글 작성이 아니라 정리**였다. 폴더를 새로 만들고, 글을 다른 폴더로 옮기고, 자주 보는 글을 목록 맨 위에 고정하는 일이다. 이 작업은 [PR #42](https://github.com/hyeoniverse/MacFolio/pull/42)의 커밋 `0150b9be1`로 반영했다. 21개 파일, 785줄 추가, 112줄 삭제다.

![관리자가 보는 폴더 메뉴](./images/memo-folder-menu.jpg '관리자로 로그인하면 폴더에 ••• 메뉴가 생긴다. 글이 들어 있는 폴더는 지울 수 없다')

## 글을 DB로 이전하지 않은 이유

글은 저장소의 Markdown 파일이다(`apps/react/src/apps/memo/content/*.md`). 커밋 기록이 남고, 이미지는 빌드 시각에 [`import.meta.glob`](https://vite.dev/guide/features.html#glob-import)으로 함께 번들링되며, 본문은 코드 편집기와 Git으로 수정한다. 글을 DB로 이전하려면 글 작성 화면, 이미지 업로드, 이전 스크립트를 먼저 만들어야 한다.

한편 메모 앱에는 이미 **정리 내용을 글 목록 위에 겹쳐 표시하는** 순수 함수[^pure]가 있었다. 방문자가 자기 브라우저에서만 정리하던 시기에 만든 함수다.

```ts
// 만든 폴더, 옮긴 글·폴더, 고정을 원래 글에 겹친다. 원래 글은 바꾸지 않는다
const organized = organizePosts(posts, organization);
```

"겹친다"는 것은 원래 글 목록을 수정하지 않고, 정리 내용에 적힌 변경만 적용한 새 목록을 만든다는 뜻이다. 예를 들어 머리말이 `학습/네트워크`인 글 `b`를 정리 내용에서 `보관` 폴더로 옮기면, 파일의 머리말은 그대로 `학습/네트워크`이고 화면에는 `보관` 폴더에 표시된다.

![organizePosts 입력과 결과의 예](./images/memo-organization-api-overlay-example.svg '저장소 글 세 개와 정리 내용 한 행을 넣으면 b는 보관 폴더로, c는 고정된 상태로 표시된다. 파일은 바뀌지 않는다')

| 방법                                          | 장점                               | 단점                                                                          |
| --------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| 글을 모두 DB로 이전                           | 정리와 글 작성을 한 곳에서 처리    | 글 작성 화면·이미지 업로드·이전 스크립트가 먼저 필요하다. 커밋 기록이 끊긴다  |
| 정리를 Markdown 머리말에 기록 (관리자가 커밋) | 서버가 필요 없다                   | 폴더를 이동할 때마다 커밋·배포가 필요하다. 방문자 화면에 즉시 반영되지 않는다 |
| **정리 내용만 서버, 글은 Markdown** (채택)    | 기존 `organizePosts`를 그대로 사용 | 글의 최종 위치가 두 곳(저장소의 머리말, 서버의 정리 내용)으로 결정된다        |

정리 내용(`{ folders, posts, moves, pins }`)만 서버에 저장하기로 했다. 브라우저 저장소에 보관하던 값을 서버로 옮기는 변경이므로 화면과 정리 로직은 그대로 재사용한다. 방문자 브라우저에 저장하던 정리 기능은 제거하고, 남아 있던 이전 값은 삭제한다.

| 필드      | 내용                                             | 예                                        |
| --------- | ------------------------------------------------ | ----------------------------------------- |
| `folders` | 관리자가 만든 폴더 경로 목록                     | `["보관", "보관/2025"]`                   |
| `posts`   | 글 slug → 이동한 폴더 경로                       | `{ "b": "보관" }`                         |
| `moves`   | 이동한 폴더 `{ from, to }` 목록. 순서대로 적용   | `[{ "from": "학습", "to": "보관/학습" }]` |
| `pins`    | 글 slug → 고정 여부 (머리말의 `pinned`보다 우선) | `{ "c": true }`                           |

![Markdown 글 위에 서버의 정리 내용을 겹치는 구조](./images/memo-overlay.svg '정리 내용을 비우면 글은 원래 폴더로 돌아간다')

## API 두 개

| 경로                     | 권한                    | 동작                                                    |
| ------------------------ | ----------------------- | ------------------------------------------------------- |
| `GET /memo/organization` | 누구나                  | 방문자도 관리자가 정리한 폴더 구조로 글 목록을 조회한다 |
| `PUT /memo/organization` | 관리자만 (`AdminGuard`) | 정리 내용 전체를 교체한다                               |

`AdminGuard`는 NestJS의 가드(guard)다. 가드는 요청이 컨트롤러 함수에 도달하기 전에 실행되어 요청을 통과시킬지 결정하는 클래스이고, 여기서는 세션 쿠키가 DB의 관리자 세션과 일치하는지 확인한다. 일치하지 않으면 401로 거절한다.

==정리 내용은 한 행에 JSON으로 저장한다==. 관리자가 한 명이라 동시 수정이 발생하지 않고, 전체를 교체하면 화면 상태와 서버 상태가 어긋나는 경우가 줄어든다. "글 b를 보관으로 옮겨라" 같은 변경 명령을 하나씩 보내는 방식은 명령 하나가 누락되면 서버와 화면의 상태가 달라진다. 전체 교체는 마지막으로 성공한 요청의 내용이 곧 서버 상태다.

> [!IMPORTANT] 서버에서 다시 검사
> 화면에서 막는 규칙은 서버에서 **한 번 더** 검사한다. 화면을 거치지 않고 요청을 직접 보낼 수 있기 때문이다.

| 규칙          | 값                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------- |
| 폴더 깊이     | 3단까지 (`MAX_FOLDER_DEPTH = 3`)                                                            |
| 폴더 이름     | 30자 이하, 앞뒤 공백 없음 (`FOLDER_NAME_MAX = 30`)                                          |
| 글 주소(slug) | 허용한 문자만                                                                               |
| 항목 수       | 상한 이하. 현재 값은 폴더 200, 옮긴 글 500, 옮긴 폴더 200, 고정 500 (`ORGANIZATION_LIMITS`) |

위반한 규칙은 모두 수집해 400으로 반환한다. 예를 들어 `folders`에 `"a/b/c/d"`를 넣어 보내면 다음 응답을 받는다.

```json
{ "statusCode": 400, "error": "Bad Request", "message": ["폴더는 3단까지입니다: a/b/c/d"] }
```

첫 번째 위반에서 멈추지 않고 모두 수집하므로, 깊이와 이름 길이를 동시에 어긴 요청에는 `message` 배열에 두 항목이 들어간다.

## 저장 누락 방지

처음에는 편집 후 0.4초 뒤에 저장했다. 이런 방식을 디바운스(debounce)라 한다. 마지막 입력 후 일정 시간 동안 새 입력이 없을 때만 한 번 실행하는 방식으로, 0.4초 안에 고정을 세 번 누르면 요청은 마지막 상태로 한 번만 나간다. 그런데 E2E 시험에서 편집 직후 새로고침하자 편집 내용이 사라졌다. 0.4초가 지나기 전에 페이지가 닫혀 요청이 나가지 않았기 때문이다. 실제 사용자도 고정 버튼을 누른 직후 창을 닫을 수 있다.

### keepalive 요청이 전송되지 않은 이유

페이지를 떠나는 시각(`pagehide` 이벤트)에 [`fetch(..., { keepalive: true })`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#keepalive)로 남은 편집을 전송해 보았지만 요청이 전송되지 않았다. `keepalive`는 페이지가 닫힌 뒤에도 브라우저가 요청을 끝까지 보내도록 하는 옵션이다.

원인은 CORS다. CORS(Cross-Origin Resource Sharing)는 브라우저가 다른 출처(도메인·포트·프로토콜이 다른 주소)의 서버에 요청하고 그 응답을 페이지 코드에 넘겨도 되는지, 서버의 허락을 확인하는 규칙이다. 사이트와 API의 주소가 다르므로 정리 내용 저장은 교차 출처 요청이다. 교차 출처 요청 가운데 메서드가 `GET`·`HEAD`·`POST`가 아니거나, `Content-Type`이 `application/json`처럼 허용 목록 밖에 있으면, 브라우저는 본 요청 전에 [CORS preflight](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request) 요청(`OPTIONS`)을 먼저 보내 서버의 허락을 받는다.

![MDN의 CORS preflight 순서](./images/memo-organization-api-mdn-preflight.png 'MDN 문서의 예. 브라우저가 OPTIONS로 메서드와 헤더를 먼저 묻고, 서버가 204로 허락한 뒤에 본 요청을 보낸다')

정리 내용 저장 요청은 다음과 같아서 두 조건에 모두 해당한다.

```http
PUT /memo/organization
Origin: https://<사이트 주소>
Content-Type: application/json
Cookie: macfolio_session=…

{ "folders": ["보관"], "posts": { "b": "보관" }, "moves": [], "pins": {} }
```

==페이지를 떠나는 시각의 keepalive 요청은 이 preflight를 거칠 수 없다==. 페이지를 떠나는 시각에 쓰는 다른 API인 [`navigator.sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)은 항상 `POST`로만 보내므로 `PUT` 경로에 쓸 수 없다.

### 편집마다 즉시 순차 저장

편집 내용을 묶어 전송할 이유도 없었다. 편집은 타이핑이 아니라 폴더 생성, 이동, 고정처럼 **한 번씩 클릭하는 동작**이다. 그래서 ==편집할 때마다 즉시 저장한다==.

다만 연속으로 클릭하면 요청 도착 순서가 뒤바뀔 수 있다. 예를 들어 폴더를 만들고(스냅숏 1) 바로 글을 고정하면(스냅숏 2), 네트워크 상태에 따라 스냅숏 2가 먼저 도착하고 스냅숏 1이 나중에 도착할 수 있다. 서버는 전체 교체 방식이라 나중에 도착한 스냅숏 1이 최종 상태가 되고, 고정이 사라진다. 그래서 저장 요청은 대기열(`saveQueue`)에 넣어 앞 요청이 끝난 뒤 다음 요청을 보낸다.

![정리 내용 저장 시점의 전후](./images/memo-organization-api-save-queue.svg '0.4초 지연 저장은 새로고침 시각에 편집을 잃었고, 즉시 저장 + 순차 전송으로 바꿨다')

```ts
saveQueue.current = saveQueue.current.then(async () => {
	if (await saveOrganization(env.apiUrl, snapshot)) return;
	notify({ app: 'memo', title: '저장하지 못함', body: '메모 정리를 저장하지 못했습니다. 다시 로그인해 주세요.' });
	setOrganization(await fetchOrganization(env.apiUrl)); // 서버 내용으로 되돌린다
});
```

`saveQueue.current`는 직전 저장 요청의 Promise다. 새 저장을 `.then()`으로 이어 붙이므로, 앞 요청의 응답이 오기 전에는 다음 요청이 시작되지 않는다.

> [!NOTE] 저장 실패 시각의 처리
> 저장에 실패하면(세션 만료 또는 규칙 위반) 알림을 표시하고 서버의 정리 내용으로 되돌린다. 저장되지 않은 편집이 화면에만 남아 저장된 것처럼 보이는 상태를 막기 위해서다.

## 시험

| 범위     | 방식                                                                                                        | 확인 항목                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| API 단위 | 규칙 검사 순수 함수                                                                                         | 깊이·이름·slug·항목 수 위반을 모두 수집하는지                                                                                       |
| API e2e  | 실제 PostgreSQL                                                                                             | 누구나 조회, 비로그인 401, 규칙 위반은 관리자라도 400, 관리자 저장                                                                  |
| 화면 E2E | 가짜 API([`page.route`](https://playwright.dev/docs/api/class-page#page-route))가 정리 내용을 메모리에 보관 | 폴더 생성·이동·이름 변경·고정이 저장되고 새로고침 후에도 유지되는지, 방문자에게도 같은 구조가 표시되는지, 저장 실패 시 되돌아가는지 |

비활성화했던 관리자 편집 E2E를 이 가짜 API로 다시 켰다. `page.route`는 브라우저가 보내는 요청을 가로채 시험 코드가 응답을 대신 만들어 주는 Playwright 기능이다. 현재는 `e2e/fakeApi.ts`의 가짜 API를 서버 기능을 사용하는 화면 시험 대부분이 공유한다. API e2e는 같은 DB를 사용하므로 이 PR부터 파일을 순차 실행한다.

## 이후 변경

정리 내용의 필드는 이후 두 개가 추가됐다. 다음 날 잠금(`locks`, [메모 잠그기](/memo/memo-lock)), 그다음 날 폴더 순서(`order`, [폴더 순서를 손잡이로 바꾸기](/memo/memo-folder-order))다. 필드를 추가할 때마다 "이전에 저장한 JSON에는 이 필드가 없다"는 경우를 세 곳(서버 검사, 서버 응답, 화면 수신)에서 빈 값으로 채웠다. 10월 9일에는 이 구조와 검사 규칙을 `packages/desktop-core/src/memo/rules.ts`로 옮겨 화면과 서버가 같은 코드를 사용한다([desktop-core로 메모 로직을 옮기며 값 검사와 localStorage 읽기·쓰기 나누기](/memo/desktop-core-stores#메모-값-검사와-localstorage-읽기쓰기-분리)).

```ts
export const EMPTY_ORGANIZATION: Organization = { folders: [], posts: {}, moves: [], pins: {}, locks: {}, order: [] };
```

![정리 내용이 자란 길](./images/memo-organization-api-growth.svg '네 칸으로 시작해 잠금과 순서가 더해졌고, 규칙은 desktop-core로 옮겼다')

"글은 Markdown에"라는 결정도 같은 날 일부 바뀌었다. 관리자 글쓰기([PR #44](https://github.com/hyeoniverse/MacFolio/pull/44), [Markdown 블로그에 글쓰기 붙이기](/memo/post-editor))가 추가되어 관리자가 작성하거나 수정한 글은 서버에 저장된다. 저장소의 Markdown 글은 그대로 유지되고, 서버 글과 Markdown 글이 같은 목록에 함께 표시된다. 정리 내용은 두 종류의 글에 같은 방식으로 적용된다.

## 남은 것

- 정리 내용은 전체를 교체한다. 관리자가 두 탭에서 동시에 수정하면 나중에 저장한 쪽이 반영된다(last write wins). 관리자가 한 명이므로 이 동작을 허용했다.
- 페이지를 떠나는 시각에 JSON을 교차 출처로 전송하는 요청은 CORS preflight 때문에 전송되지 않는다. 한 번씩 클릭하는 동작은 즉시 전송하고 대기열로 순서를 보장하는 편이 단순하다.
- 글을 이전하지 않은 결정은 이후 변경에도 유리하다. `organizePosts`가 원래 글을 수정하지 않으므로, 정리 내용을 비우면 글은 원래 폴더로 돌아간다.

## 직접 확인하는 방법

폴더 정리 규칙은 서버와 화면이 함께 쓰는 [packages/desktop-core/src/memo/rules.ts](https://github.com/hyeoniverse/MacFolio/blob/main/packages/desktop-core/src/memo/rules.ts)에 있다. 서버 없이 화면만 확인하려면 E2E가 쓰는 가짜 API([apps/react/e2e/fakeApi.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/e2e/fakeApi.ts))로 충분하다.

```bash
pnpm --filter @macfolio/api test          # 서버 단위 시험
cd apps/react && npx vitest run src/apps/memo
npx playwright test e2e/memo-admin.spec.ts --project=desktop-chromium
```

로컬에서 서버까지 실행하려면 루트에서 `pnpm dev:all`로 API와 사이트를 함께 실행하고 관리자로 로그인한다. 정리한 결과는 DB에 저장되고 글 파일(`content/*.md`)은 변경되지 않았는지 `git status`로 확인한다.

## 관련 글

- [GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기](/memo/admin-login-github-oauth)
- [Markdown 블로그에 글쓰기 붙이기](/memo/post-editor)
- [정적 사이트의 편집 권한을 useCanEditMemo 하나로 관리자에게만 열기](/memo/read-only-memo)
- [desktop-core로 메모 로직을 옮기며 값 검사와 localStorage 읽기·쓰기 나누기](/memo/desktop-core-stores#메모-값-검사와-localstorage-읽기쓰기-분리)
- [메모 잠그기](/memo/memo-lock)
- [폴더 순서를 손잡이로 바꾸기](/memo/memo-folder-order)

[^pure]: 같은 입력에 항상 같은 결과를 반환하고 입력 값이나 외부 상태를 변경하지 않는 함수. `organizePosts`는 글 목록과 정리 내용을 받아 새 목록을 반환하며, 원래 글 객체는 수정하지 않는다.

<details>
<summary>참고 문헌</summary>

- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [MDN: Preflight request](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
- [MDN: RequestInit keepalive](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#keepalive)
- [MDN: Navigator.sendBeacon()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- [MDN: Window pagehide event](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event)
- [NestJS: Guards](https://docs.nestjs.com/guards)
- [Prisma: Working with Json fields](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields)
- [Playwright: page.route](https://playwright.dev/docs/api/class-page#page-route)

</details>

<details>
<summary>사진 출처</summary>

- CORS preflight 순서도: MDN Web Docs, [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)의 [preflight-correct.svg](https://mdn.github.io/shared-assets/images/diagrams/http/cors/preflight-correct.svg), CC-BY-SA 2.5 (PNG로 변환)

</details>

#MacFolio #백엔드 #메모앱
