---
title: Cloudflare Worker로 SPA의 HTML에 주소별 메타데이터와 본문 넣기
date: 2026-10-20
category: 개발 기록/MacFolio/프론트엔드
summary: 사이트가 자바스크립트로만 렌더링되어 검색엔진에는 빈 페이지로 보였다. Worker가 주소마다 제목·설명·Open Graph·구조화 데이터와 글·프로젝트 본문을 HTML에 넣고, 서버에 작성한 글까지 합친 sitemap.xml을 생성하게 했다.
---

이 사이트는 macOS 데스크톱을 웹으로 옮긴 것이라 화면 전체를 React가 렌더링한다. 서버가 응답하는 HTML에는 `<div id="root"></div>` 하나뿐이고, 글과 프로젝트 소개는 스크립트가 실행된 뒤에 생성된다. 사용자 화면에는 문제가 없지만 검색엔진에는 문제가 된다.

| 수집 주체                       | 스크립트 실행     | 수집 결과                         |
| ------------------------------- | ----------------- | --------------------------------- |
| Google 검색 로봇                | 실행하지만 지연됨 | 색인 시점과 결과가 불확실         |
| 네이버 검색 로봇                | 대부분 실행 안 함 | 빈 페이지                         |
| 링크 미리보기(카카오톡·Slack·X) | 실행 안 함        | 모든 주소의 제목이 "김정현의 Mac" |

글이 180편을 넘었지만 검색으로는 한 편도 찾을 수 없었다. 이 문제는 [#267](https://github.com/hyeoniverse/MacFolio/issues/267)로 정리했고 [#269](https://github.com/hyeoniverse/MacFolio/pull/269)에서 해결했다.

<details>
<summary>수정 전후의 HTML 비교</summary>

수정 전에는 어느 주소를 요청해도 같은 HTML이 응답됐다.

```html
<title>김정현의 Mac</title>
<meta name="description" content="…" />
…
<div id="root"></div>
```

수정 후 `/memo/<글>` 응답에는 그 글의 정보가 들어간다.

```html
<title>글 제목</title>
<meta name="description" content="글 요약" />
<link rel="canonical" href="https://macfolio.hyeoniverse.com/memo/<글>" />
<meta property="og:title" content="글 제목" />
<script type="application/ld+json">
	{"@type":"BlogPosting", …}
</script>
…
<div id="root"><div class="seo-content">제목, 날짜, 글 본문</div></div>
```

</details>

![검색 로봇이 글 주소를 요청하면 Worker가 posts.json, API의 서버 글, 사이트 콘텐츠를 조회해 head와 #root에 글 정보를 넣은 HTML을 응답하는 흐름](./images/seo-crawlable-flow.svg '빌드 결과와 API의 서버 글을 합쳐 주소마다 다른 HTML을 응답한다')

## 구현

### 빌드: 글 목록과 sitemap

Vite 플러그인(`seoPlugin`)이 빌드 시각에 저장소의 Markdown 글을 모두 읽는다. 머리말 파싱 규칙은 메모 앱과 같은 코드(desktop-core)를 사용하고, 본문은 react-markdown으로 HTML 문자열을 생성한다. 화면과 같은 Markdown 규칙(GFM, 한국어 굵게)이라 표와 목록도 같은 구조로 출력된다. 결과는 두 파일이다.

- `seo/posts.json`: 글마다 주소, 제목, 날짜, 요약, 카테고리, 태그, 본문 HTML
- `sitemap.xml`: 첫 화면, 모든 글(`lastmod`는 글 날짜), 모든 프로젝트 주소 ([sitemap 형식](https://www.sitemaps.org/protocol.html))

`robots.txt`에는 sitemap 주소를 한 줄 추가했다.

### Worker: 주소마다 다른 첫 화면

`/memo/<글>`이나 `/safari/<프로젝트>` 같은 앱 주소는 원래도 Cloudflare Worker가 index.html을 응답한다. 여기에 단계를 하나 추가했다. Worker가 `posts.json`을 한 번 내려받아 보관하고, 주소에 맞는 페이지 정보를 HTML에 삽입한다.

| 주소                 | 제목·설명                 | 구조화 데이터   | 본문                         |
| -------------------- | ------------------------- | --------------- | ---------------------------- |
| `/`                  | 사이트 이름과 소개        | Person, WebSite | 소개와 모든 글·프로젝트 링크 |
| `/memo/<글>`         | 글 제목, 글 요약          | BlogPosting     | 제목, 날짜, 글 본문          |
| `/safari/<프로젝트>` | 프로젝트 이름, 한 줄 소개 | CreativeWork    | 소개, 기술, 저장소·데모 링크 |

구조화 데이터는 [JSON-LD](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)[^jsonld] 형식으로 넣는다. `<head>`에는 canonical[^canonical], [Open Graph](https://ogp.me/)(`og:title`, `og:image` 등), Twitter 카드도 넣는다. 기존 `<title>`과 description은 추가하지 않고 교체한다. 같은 태그가 두 개 있으면 검색엔진이 어느 쪽을 사용할지 정할 수 없기 때문이다. 공유 카드의 이미지는 데스크톱 화면을 1200×630으로 캡처해 `og-image.jpg`로 저장했다.

존재하지 않는 글이나 프로젝트 주소에는 `noindex`를 붙인다. PR 미리보기 주소(`*.workers.dev`)는 응답 헤더에 `X-Robots-Tag: noindex`를 붙여 실제 사이트와 중복 색인되지 않게 했다.

### 본문은 숨기되 같은 내용으로

본문을 `#root` 안에 넣으면 스크립트를 내려받는 동안 글자가 잠깐 표시될 수 있다. 그래서 index.html의 인라인 스타일로 1px 크기로 클리핑해 숨긴다. 화면 읽기 프로그램용 텍스트를 숨기는 방식과 같다. 앱이 렌더링을 시작하면 React가 `#root` 내부를 통째로 교체하므로 앱에는 영향이 없다.

검색엔진에만 다른 내용을 보여 주는 것은 클로킹[^cloaking]이라 검색 순위에서 불이익을 받는다. 여기서 넣는 내용은 앱이 표시하는 글·프로젝트와 같은 데이터에서 나온다. 관리자가 시스템 설정에서 수정한 프로필과 프로젝트도, Worker가 이미 조회하던 사이트 콘텐츠를 합쳐서 사용한다(숨긴 프로젝트는 제외한다).

모든 문자열은 HTML로 이스케이프하고, JSON-LD 안의 `<`는 `<`로 바꿔 `</script>`로 스크립트 블록을 벗어나지 못하게 했다.

## 확인 방법

- **Worker 단위 시험**: 주소마다 제목·설명·canonical·og·JSON-LD 출력, 제목과 description이 하나씩만 있는지, 존재하지 않는 글의 `noindex`, 미리보기의 `X-Robots-Tag`, 제목에 `<`, `&`, `"`, `</script>`가 들어간 글의 이스케이프
- **빌드 시험**: 저장소의 모든 글과 프로젝트가 sitemap에 있는지, 본문의 HTML 태그가 실행되지 않고 문자열로 출력되는지
- **빌드 결과**: `seo/posts.json`과 `sitemap.xml`이 생성되는지

화면 E2E는 `vite preview`로 실행되어 Worker를 거치지 않는다. 그래서 이 부분은 단위 시험으로만 확인한다.

## 배포 후 작업

코드 배포만으로는 검색 결과에 바로 나타나지 않는다. 검색엔진에 사이트를 등록해야 한다.

1. **[Google Search Console](https://search.google.com/search-console)**에 `https://macfolio.hyeoniverse.com`을 등록한다. 도메인 속성이면 Cloudflare DNS에 TXT 레코드를 추가해 소유권을 확인한다.
2. Search Console의 Sitemaps에 `sitemap.xml`을 제출하고, URL 검사에 글 주소 하나를 입력해 "페이지 색인 생성 요청"을 누른다. "크롤링된 페이지 보기"의 HTML에 제목과 본문이 있으면 정상이다.
3. **[네이버 서치어드바이저](https://searchadvisor.naver.com/)**에 사이트를 등록하고(HTML 태그나 파일로 소유권 확인), 요청 › 사이트맵 제출에 같은 주소를 입력한다.
4. 카카오톡이나 Slack에 글 주소를 붙여 넣어 공유 카드에 제목·요약·이미지가 표시되는지 확인한다.

## 서버에 작성한 글도 sitemap에 포함

관리자가 API로 작성한 글(저장소에 Markdown 파일이 없는 글)은 빌드 시각에 존재하지 않으므로 `posts.json`에 없다. 처음에는 그런 글의 주소에 `noindex`를 붙였는데, 그러면 서버에서 작성한 글은 검색 결과에 나타나지 않는다.

그래서 `sitemap.xml`을 빌드 결과 파일 대신 Worker가 생성하도록 바꿨다(`run_worker_first`에 `/sitemap.xml`을 추가했다). Worker는 API의 `GET /posts` 응답을 1분 동안 캐시하고, 화면과 같은 규칙으로 저장소 글과 합친다.

| 경우                       | 처리                       |
| -------------------------- | -------------------------- |
| 같은 주소의 서버 글이 있음 | 서버 글이 저장소 글을 대체 |
| 삭제한 글, 예약 글         | 목록에서 제외              |
| 서버에만 있는 글           | 목록에 추가                |
| API에 연결할 수 없음       | 저장소 글만으로 생성       |

글 주소의 검색엔진용 첫 화면도 같은 목록을 사용하므로, 서버에만 있는 글도 제목·요약·본문이 들어간다.

Worker에서는 Markdown 변환기를 실행하지 않는다. 번들 크기가 커지고 요청마다 처리량이 늘기 때문이다. 서버 글 본문은 제목 줄은 `h2`로, 나머지는 빈 줄 단위 문단으로만 변환하고 모든 문자열을 이스케이프한다. 검색엔진이 본문을 읽는 데는 이 정도 구조로 충분하다.

## 남은 과제

sitemap의 프로젝트 목록은 관리자가 수정한 사이트 콘텐츠까지 반영하지만, 관리자가 변경한 프로필 사진 같은 이미지는 이 글을 작성한 시각에는 공유 카드에 사용하지 않았다. 모든 주소가 기본 이미지(`og-image.jpg`)를 사용하고, 프로젝트만 대표 이미지가 있으면 그 이미지를 사용했다. 이후 글마다 공유 이미지와 RSS 피드, 존재하지 않는 글 주소의 404 응답을 [#303](https://github.com/hyeoniverse/MacFolio/pull/303)에서 추가했고, 서버에 작성한 글의 공유 카드를 API가 생성하는 작업은 [#306](https://github.com/hyeoniverse/MacFolio/pull/306)에서 추가했다.

## 관련 글

- [보안 점검 2 - CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers)
- [not_found_handling 뒤 Worker 함수로 SPA 주소와 없는 자산의 404 나누기](/memo/asset-404)

참고 문서: [Google 검색 센터 — JavaScript SEO 기본사항](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Cloudflare Workers 정적 자산 라우팅(run_worker_first)](https://developers.cloudflare.com/workers/static-assets/binding/#run_worker_first)

[^jsonld]: JSON for Linking Data. 페이지가 무엇에 관한 것인지(글, 사람, 작품 등)를 `<script type="application/ld+json">` 안에 schema.org 어휘로 적는 구조화 데이터 형식.

[^canonical]: `<link rel="canonical">`. 같은 내용에 주소가 여러 개 있을 때 검색엔진이 색인할 대표 주소를 지정한다.

[^cloaking]: 검색 로봇과 사용자에게 서로 다른 내용을 보여 주는 행위. Google 검색 스팸 정책에서 금지한다.

#MacFolio #SEO #CloudflareWorkers #인프라 #검색엔진 #OpenGraph
