---
title: 브라우저별 localStorage 값을 서버 사이트 기본값으로 옮겨 첫 HTML에 싣기
date: 2026-10-25
category: 개발 기록/MacFolio/서버·API
series: 위젯
seriesOrder: 5
summary: 노트북에서 고른 사진 위젯 폴더가 아이폰 Safari에서는 보이지 않았다. 고른 값이 브라우저의 localStorage에만 저장됐기 때문이다. 관리자가 고른 앨범을 서버에 사이트 기본값으로 저장하고, 첫 HTML에 실어 모든 브라우저가 쓰게 했다. 방문자가 직접 고른 값은 그 브라우저에서 우선한다.
---

MacFolio의 바탕화면과 휴대폰 홈 화면에는 macOS 위젯 모양의 사진 위젯이 있다. 사진 앱의 앨범이나 Finder › 그림의 폴더 하나를 고르면, 위젯이 그 앨범의 사진을 몇 초 간격으로 바꿔 가며 표시한다. 앨범을 고르지 않으면 모든 앨범의 사진을 차례로 표시한다.

노트북에서 사진 위젯의 앨범을 그림 폴더로 골라 두었다. 노트북에서는 데스크톱 화면과 휴대폰 화면(창을 좁힌 화면) 모두 그 폴더의 사진이 표시됐다. 그런데 실제 아이폰의 Safari로 접속하면 위젯이 모든 앨범의 사진을 차례로 표시했다.

![휴대폰 전후](./images/photo-widget-site-album-mobile.jpg '왼쪽은 고른 앨범이 없는 브라우저(고치기 전 아이폰과 같은 상태), 오른쪽은 관리자가 고른 앨범이 사이트 기본값으로 적용된 화면. iPhone 13 크기, 가짜 API로 촬영')

## 원인: 고른 값이 브라우저에만 있었다

### localStorage의 범위

[`localStorage`](https://developer.mozilla.org/ko/docs/Web/API/Window/localStorage)는 브라우저가 사이트마다 제공하는 키·값 저장소다. 문자열 값을 키 이름으로 저장하고, 브라우저를 닫았다 열어도 값이 남는다. 서버를 거치지 않으므로 로그인 없이 방문자별 설정을 저장하기에 적합하다.

위젯의 자리와 고른 값(사진 위젯의 앨범, 메모 위젯의 글 보기)도 `localStorage`에 저장한다. 데스크톱은 `macfolio:desktop:widgets`, 휴대폰 홈 화면은 `macfolio:mobile:widgets` 키다. 같은 위젯의 고른 값은 한쪽에서 바꾸면 다른 쪽 키에도 기록한다(`desktop/widgets/sharedOptions.ts`)[^share].

문제는 저장소의 범위다. `localStorage`는 ==출처(origin)마다, 그리고 브라우저마다 따로 있다==. 출처는 주소의 스킴(`https`)·호스트(`macfolio.hyeoniverse.com`)·포트(`443`) 세 값의 조합이며, 셋 중 하나라도 다르면 다른 출처로 취급한다. 예를 들어 개발 서버 `http://localhost:5173`과 배포 사이트 `https://macfolio.hyeoniverse.com`은 같은 코드를 실행해도 서로의 `localStorage`를 읽지 못한다. 같은 출처라도 노트북의 Chrome과 아이폰의 Safari는 서로 다른 기기의 서로 다른 프로그램이므로 저장소를 공유하지 않는다.

![localStorage 범위](./images/photo-widget-site-album-origin.svg '세로는 브라우저, 가로는 출처. 관리자가 노트북 Chrome에서 고른 값은 왼쪽 위 칸에만 있다')

| 화면                           | 읽는 저장소               | 앨범 값   | 결과      |
| ------------------------------ | ------------------------- | --------- | --------- |
| 노트북 데스크톱                | 노트북 브라우저           | 그림 폴더 | 폴더 사진 |
| 노트북 휴대폰 화면 (창을 좁힘) | 노트북 브라우저 (같은 곳) | 그림 폴더 | 폴더 사진 |
| 아이폰 Safari                  | 아이폰 브라우저           | 없음      | 모든 앨범 |

노트북에서는 두 화면이 같은 저장소를 읽어서 둘 다 적용된 것처럼 보였다. 처음 온 방문자도 아이폰과 같은 상태다. 관리자가 고른 앨범은 관리자 브라우저 밖으로 전달된 적이 없다.

## 고르는 값이 두 종류였다

사진 위젯의 앨범에는 성격이 다른 두 선택이 섞여 있었다.

| 선택        | 내용                                                 | 적용 범위              |
| ----------- | ---------------------------------------------------- | ---------------------- |
| 사이트 주인 | "방문자에게 이 폴더의 사진을 보여 준다"              | 모든 기기, 모든 방문자 |
| 방문자      | 위젯을 오른쪽 클릭하거나 편집 중 앨범 단추로 고른 값 | 고른 브라우저 하나     |

> [!IMPORTANT] 두 선택의 저장 위치
> 그래서 관리자가 고른 값만 서버에 **사이트 기본값**으로 저장하고, 방문자가 고른 값은 지금처럼 `localStorage`에 저장한다.

위젯이 표시할 앨범은 다음 순서로 정한다.

| 순서 | 값                          | 저장 위치                               |
| ---- | --------------------------- | --------------------------------------- |
| ①    | 이 브라우저에서 고른 앨범   | `localStorage`의 위젯 자리 (`album`)    |
| ②    | 관리자가 고른 사이트 기본값 | 서버 `GET /site`의 `widgets.photoAlbum` |
| ③    | 모든 앨범                   | 코드의 기본 동작                        |

![저장 위치와 우선순위](./images/photo-widget-site-album-flow.svg '도식. 위: 고치기 전에는 브라우저마다 저장소가 따로라 아이폰에 값이 없었다. 가운데: 관리자가 고른 값을 서버에 저장하고 Worker가 첫 HTML에 싣는다. 아래: 위젯이 보일 앨범을 정하는 순서')

순서는 함수 하나로 구현했다. `??`(널 병합 연산자)는 왼쪽 값이 `null`이나 `undefined`일 때만 오른쪽 값을 사용한다.

```ts
// desktop/widgets/catalog.ts
export const effectiveAlbum = (local: string | undefined, siteDefault: string | null): string | undefined =>
	local ?? siteDefault ?? undefined;
```

### '모든 앨범'을 고른 것과 고르지 않은 것

예전에는 '모든 앨범'을 고르면 `album`을 비웠다(`undefined`). 이제 ==비어 있으면 "고르지 않았다"는 뜻이라 사이트 기본값을 따른다==. 방문자가 '모든 앨범'을 직접 고르면 사이트 기본값보다 우선해야 하므로, 이 선택은 `'all'`(`ALL_ALBUMS`)로 저장한다. `'all'`은 `undefined`가 아니므로 `??`에서 그대로 결과가 된다.

![effectiveAlbum 예](./images/photo-widget-site-album-resolve.svg '네 가지 입력과 결과. 세 번째 줄처럼 방문자가 모든 앨범을 고르면 사이트 기본값이 있어도 모든 앨범을 표시한다')

`'all'`은 앨범 id가 아니어서, 사진 목록을 만드는 `photosOf`는 기존 규칙대로 모든 앨범을 표시한다. 메뉴와 편집 시트의 체크 표시도 같은 순서(`effectiveAlbum`)로 정한 앨범에 붙인다.

## 서버: SiteContent에 칸 하나

설정을 저장할 곳은 이미 있었다. 관리자가 시스템 설정에서 고친 프로필·프로젝트·이력서를 한 행(`id = 1`)에 저장하는 `SiteContent` 테이블이다. 누구나 `GET /site`로 읽고 관리자만 바꾼다. 여기에 비워 둘 수 있는 JSONB 칸 `widgets`를 추가했다. JSONB는 PostgreSQL이 JSON 문서를 파싱한 이진 형식으로 저장하는 열 형식으로, 칸 하나에 `{ "photoAlbum": "folder:widget01" }` 같은 객체를 통째로 저장한다. 나중에 다른 위젯의 기본값이 생겨도 열을 추가하지 않고 객체에 키만 더하면 된다.

```sql
-- prisma/migrations/20261025120000_site_widgets
ALTER TABLE "SiteContent" ADD COLUMN "widgets" JSONB;
```

| 요청                | 권한                                        | 동작                                                                                                              |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /site`         | 누구나                                      | 기존 응답에 `widgets`가 더해졌다. 저장한 값이 없으면 `null`                                                       |
| `PUT /site/widgets` | 관리자 (`AdminGuard`·`@RateLimit('write')`) | 몸통은 `{ "photoAlbum": "folder:…" }`. `null`이나 빈 값이면 기본값 삭제. 응답은 저장 뒤의 `GET /site`와 같은 모양 |

- **검사:** 앨범 id는 화면이 위젯 자리를 읽을 때와 같은 한도(100자)로 `@macfolio/contracts`의 `WidgetDefaultsInput` 스키마가 검사한다. 글자가 아니거나, 너무 길거나, 제어 문자가 있으면 400과 한국어 이유를 돌려준다. 서버와 화면이 같은 스키마를 사용한다. 예를 들어 `{ "photoAlbum": 3 }`이나 101자 문자열은 저장되지 않는다.
- **배포 호환:** 새 칸은 비워 둘 수 있어서, 배포가 실패해 이전 이미지로 되돌아가도 이전 코드는 이 칸을 모른 채 그대로 동작한다. 이전 서버의 응답에는 `widgets`가 없으므로 화면은 칸이 없으면 기본값 없음으로 읽는다.

## 화면: 첫 HTML에 실려 온다

`GET /site`의 결과는 배포한 사이트에서 Cloudflare Worker가 첫 HTML(`index.html`)에 JSON으로 삽입한다. Cloudflare Worker는 Cloudflare 네트워크에서 요청마다 실행되는 JavaScript 함수로, MacFolio에서는 정적 파일 앞에서 HTML을 고쳐 응답한다. 삽입 위치는 `</head>` 바로 앞이고, `type="application/json"`인 `<script>` 태그는 브라우저가 실행하지 않고 데이터로만 보관한다. 화면은 앱 코드를 불러오기 전에 이 값을 읽는다([프로젝트 관리 글](/memo/site-projects-editing)에서 만든 구조).

![첫 HTML에 실리는 순서](./images/photo-widget-site-album-first-html.svg 'Worker가 GET /site 결과를 HTML에 넣고, 브라우저는 그 JSON으로 store를 채운 뒤 위젯을 처음 렌더링한다')

`widgets`도 같은 응답에 들어 있으므로 별도 요청이 없고, 위젯이 처음 렌더링되는 시각에 이미 사이트 기본값이 있다. 기본값을 별도 API 요청으로 받으면, 위젯이 먼저 모든 앨범을 표시하다가 응답이 도착한 뒤 폴더 사진으로 바뀐다. Worker는 받은 값을 1분 동안 캐시하므로, 관리자가 바꾼 앨범은 ==길어야 1분 뒤 다른 기기의 새로고침에 반영된다==.

화면 쪽 변경은 세 곳이다.

1. **`shared/site/widgetDefaultsStore.ts`:** 사이트 기본값 store. 앱 시작 시각에 `applySiteContent`가 채우고, 위젯은 React의 `useSyncExternalStore`로 구독한다. 관리자가 저장하면 응답으로 바로 갱신한다.
2. **`desktop/widgets/Widget.tsx`:** 사진 위젯에 `effectiveAlbum(이 브라우저의 값, 사이트 기본값)`을 넘긴다. 바탕화면과 휴대폰 홈 화면이 같은 컴포넌트이므로 한 곳만 바꿨다.
3. **`desktop/widgets/useSiteAlbum.ts`:** 앨범을 고를 때 관리자로 로그인했으면 `PUT /site/widgets`도 보낸다. '모든 앨범'은 기본값 없음(`null`)으로 보낸다(`siteAlbumOf`). 실패하면 "저장하지 못함" 알림을 띄우고, 이 브라우저에 고른 값은 그대로 유지한다.

> [!WARNING] 배포 전에 고른 앨범
> 관리자가 고른 값도 관리자 브라우저의 `localStorage`에 함께 저장된다. 이 기능이 배포되기 전에 고른 앨범은 서버에 없으므로, 배포 뒤 관리자가 한 번 다시 골라야 다른 기기에 적용된다.

<details>
<summary>서버 기본값이 가리키는 폴더를 삭제하면</summary>

사진 위젯이 고를 수 있는 곳은 사진 앱의 앨범과 Finder › 그림의 폴더다. 관리자가 기본값으로 고른 폴더를 나중에 삭제하면 그 id는 고를 수 있는 목록에 없다. `photosOf`는 목록에 없는 id를 받으면 원래 모든 앨범을 표시한다(단위 시험 `photoSources.test.ts`가 확인한다). 그래서 별도 처리 없이 ③으로 넘어간다. 그림 폴더 목록은 Finder 구조를 받은 뒤에 생기므로, 첫 순간에는 모든 앨범이 표시됐다가 폴더 사진으로 바뀔 수 있다. 이 동작은 이 브라우저에서 폴더를 고른 경우와 같다.

</details>

## 시험

| 종류                      | 확인 항목                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| contracts 단위            | 앞뒤 공백 제거, 빈 값·`null`은 기본값 없음, 101자·숫자·제어 문자는 거절, `SiteView`에 `widgets`가 있어도 없어도 읽힌다                                                                                                                                                                                                                                        |
| 화면 단위                 | `effectiveAlbum`의 순서(① > ② > ③, `'all'`도 ①), `siteAlbumOf`('모든 앨범'은 `null`), `'all'`이 저장한 위젯 자리에서 그대로 읽힌다, `applySiteContent`가 `widgets`를 store에 넣고 틀린 값·없는 칸은 기본값 없음                                                                                                                                               |
| API E2E (실제 PostgreSQL) | 로그인하지 않으면 401, 101자는 400과 이유, 저장한 값을 누구나 `GET /site`로 읽음, 모르는 필드는 버림, `null`로 삭제                                                                                                                                                                                                                                           |
| E2E (데스크톱)            | 사이트 기본값이 있으면 앨범을 고르지 않은 위젯은 그 앨범을, 이 브라우저에서 QRU를 고른 위젯은 QRU를 표시. 메뉴의 체크도 기본값에 붙는다. 방문자가 '모든 앨범'을 고르면 `'all'`이 저장되고 서버에는 보내지 않는다. 관리자가 고르면 `PUT /site/widgets`가 `{ photoAlbum: 'sproutfarm' }`, '모든 앨범'은 `{ photoAlbum: null }`. `GET /site`가 500이면 모든 앨범 |
| E2E (휴대폰, iPhone)      | `localStorage`가 빈 브라우저에서 홈 화면 3쪽의 사진 위젯이 사이트 기본값 앨범을 표시하고, 위젯 자리는 저장하지 않는다                                                                                                                                                                                                                                         |

## 관련 글

- [180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets): 위젯 공통 부품, 사진 위젯의 앨범 선택과 그림 폴더
- [openRequest로 위젯이 표시 중인 사진을 사진 앱 크게 보기로 넘기기](/memo/photo-widget-open-current): 위젯의 앨범 id와 사진 앱의 앨범 id
- [코드 기본값 위에 서버의 덮어쓸 값만 합치는 프로젝트 편집](/memo/site-projects-editing): `GET /site`와 Worker가 첫 HTML에 싣는 구조
- [Pointer Events와 FLIP으로 2열 격자 위젯 순서 바꾸기](/memo/mobile-widget-reorder): 휴대폰 위젯 자리 저장과 페이지 순서

<details>
<summary>참고 문헌</summary>

- MDN, [Window: localStorage property](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- MDN, [Origin](https://developer.mozilla.org/en-US/docs/Glossary/Origin)
- MDN, [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- MDN, [Nullish coalescing operator (??)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing)
- PostgreSQL, [JSON Types](https://www.postgresql.org/docs/current/datatype-json.html)
- Cloudflare, [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/)
- React, [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)

</details>

[^share]: 바탕화면과 휴대폰 홈 화면은 위젯 구성이 달라 자리를 따로 저장하지만, 같은 id·종류의 위젯은 고른 값을 함께 사용한다. 이 공유도 같은 브라우저 안에서만 일어난다.

#MacFolio #위젯 #localStorage #NestJS #트러블슈팅
