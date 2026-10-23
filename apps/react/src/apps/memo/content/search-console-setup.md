---
title: Google Search Console 연결하기 — 사이트 등록, 사이트맵 제출, 검색어 탭
date: 2026-10-23
category: 개발기/MacFolio/인프라
summary: 블로그 글을 검색에 노출하고 검색어를 활동 상태 보기에서 확인하기까지의 순서. Search Console 속성 추가와 사이트맵 제출, Google Cloud 서비스 계정 생성, Search Console 권한 추가, 서버 api.env 설정을 단계별로 정리하고, 도메인 속성에서 이 사이트 검색어만 거르는 방법을 적었다.
---

## 설치 순서

블로그 글을 Google 검색에 노출하고, 그 검색어를 활동 상태 보기의 **검색어** 탭에서 확인하기까지의 순서다. 1·2단계만으로 검색 노출은 끝나고, 3\~5단계는 검색어 탭을 연결할 때만 필요하다.

![Search Console 연결 구성](./images/search-console-setup-flow.svg 'Google Cloud 서비스 계정을 Search Console 속성에 제한됨 사용자로 추가하고, 키 값을 서버 api.env에 넣으면 API가 6시간마다 검색어를 가져온다')

| 단계 | 하는 곳                                                    | 하는 일                                                  |
| ---- | ---------------------------------------------------------- | -------------------------------------------------------- |
| 1    | [Search Console](https://search.google.com/search-console) | 속성 추가와 소유 확인                                    |
| 2    | Search Console                                             | `sitemap.xml` 제출, 필요하면 색인 생성 요청              |
| 3    | [Google Cloud 콘솔](https://console.cloud.google.com)      | Search Console API 사용 설정, 서비스 계정과 JSON 키 생성 |
| 4    | Search Console                                             | 서비스 계정을 속성 사용자(제한됨)로 추가                 |
| 5    | 서버 `~/deploy/api.env`                                    | 키의 두 값과 속성 주소 입력, API 재시작                  |

### 1. 속성 추가

Search Console에서 **속성 추가**를 누르면 두 종류 중 하나를 고른다.

| 속성       | 입력                                | 소유 확인                                                      | 범위             |
| ---------- | ----------------------------------- | -------------------------------------------------------------- | ---------------- |
| 도메인     | `hyeoniverse.com`                   | DNS에 TXT 레코드 추가                                          | 모든 하위 도메인 |
| URL 접두어 | `https://macfolio.hyeoniverse.com/` | HTML 태그·파일 등. 같은 계정으로 도메인 속성을 확인했으면 자동 | 이 주소 아래만   |

**어느 속성이든 검색어 탭에 연결할 수 있다.** 도메인 속성은 `www`, `blog` 같은 다른 하위 도메인의 검색어까지 담지만, 서버가 이 사이트 페이지만 요청하므로 섞이지 않는다([도메인 속성에서 이 사이트 검색어만 받기](#도메인-속성에서-이-사이트-검색어만-받기)). 도메인 속성이 이미 있으면 그대로 쓰면 된다.

<details>
<summary>도메인 속성의 TXT 레코드 추가 (Cloudflare)</summary>

1. Search Console이 보여 주는 `google-site-verification=…` 값을 복사한다
2. Cloudflare 대시보드 → 도메인 → **DNS → Records → Add record**
3. Type `TXT`, Name `@`, Content에 복사한 값을 넣고 저장한다
4. Search Console로 돌아가 **확인**을 누른다. 보통 몇 분, 늦으면 1시간 정도 걸린다

</details>

### 2. 사이트맵 제출과 색인 요청

- 왼쪽 **Sitemaps**에 `https://macfolio.hyeoniverse.com/sitemap.xml`을 제출한다. 이 파일은 Cloudflare Worker가 저장소 글·서버 글·프로젝트 주소를 합쳐 요청마다 생성한다([검색엔진이 읽게 하기](/memo/seo-crawlable))
- 특정 글을 빨리 수집하게 하려면 위쪽 **URL 검사**에 글 주소를 넣고 **색인 생성 요청**을 누른다. 하루 요청 수에 제한이 있다
- 색인된 주소 수는 **페이지** 보고서에서, 검색 노출·클릭은 **실적** 보고서에서 확인한다. 데이터는 속성을 추가한 날부터 수집되고 2\~3일 늦게 표시된다

### 3. 서비스 계정 만들기

서버가 Search Console API를 호출할 때 쓰는 계정이다. 사람 계정 대신 서비스 계정[^service-account]을 쓰면 비밀번호나 OAuth 동의 없이 키 하나로 인증한다.

1. **프로젝트**: 기존 프로젝트를 써도 된다. 프로젝트는 API와 서비스 계정을 담는 단위이고, Search Console API는 무료라 비용이 섞이지 않는다. 새로 만든다면 **프로젝트 ID는 나중에 바꿀 수 없다**(전체에서 고유, 6\~30자, 소문자로 시작). ID는 서비스 계정 이메일에만 쓰인다
2. **APIs & Services → Library**에서 **Google Search Console API**를 **Enable**
3. **IAM & Admin → Service Accounts → Create service account**

   | 칸               | 예                                                              | 비고                                                                                                    |
   | ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
   | 서비스 계정 이름 | `MacFolio Search Console`                                       | 나중에 바꿀 수 있다                                                                                     |
   | 서비스 계정 ID   | `macfolio-search-console`                                       | **바꿀 수 없다**. 이메일 `macfolio-search-console@<프로젝트ID>.iam.gserviceaccount.com`의 앞부분이 된다 |
   | 설명             | `MacFolio API가 Search Console 검색어를 읽기 전용으로 가져온다` |                                                                                                         |

4. 다음 화면의 **프로젝트 액세스 권한(역할)**과 **사용자 액세스 권한**은 비워 두고 완료한다. Search Console 권한은 Google Cloud 역할이 아니라 4단계에서 준다
5. 만든 계정 → **Keys → Add key → Create new key → JSON**. 이 파일은 다시 내려받을 수 없고, 비밀번호와 같으므로 저장소나 채팅에 붙여 넣지 않는다

기존 프로젝트를 쓰더라도 서비스 계정은 MacFolio 전용으로 만든다. 키를 교체하거나 폐기할 때 다른 서비스에 영향이 없다.

### 4. Search Console에 서비스 계정 추가

Google Cloud가 아니라 **Search Console 사이트**에서 한다.

1. 왼쪽 위 속성 선택에서 5단계의 `GSC_SITE_URL`로 쓸 속성을 고른다
2. 왼쪽 아래 **설정 → 사용자 및 권한 → 사용자 추가**
3. 서비스 계정 이메일(Google Cloud의 Service Accounts 목록에서 복사)을 넣고 권한은 **제한됨**

| 상황                           | 이유                                                    |
| ------------------------------ | ------------------------------------------------------- |
| 초대 메일이 오지 않는다        | 서비스 계정은 받은편지함이 없어 수락 없이 바로 추가된다 |
| **사용자 추가** 버튼이 없다    | 그 속성의 소유자 계정으로 로그인하지 않았다             |
| 나중에 `403 PERMISSION_DENIED` | 서버의 `GSC_SITE_URL`과 다른 속성에 추가했다            |

### 5. 서버에 넣기

키 파일을 서버로 옮긴 뒤 필요한 두 값만 `api.env`에 넣고 파일은 삭제한다. 명령은 [배포 문서](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md#검색어-google-search-console)에 있다.

```bash
# Mac
scp ~/Downloads/<키파일>.json macfolio:~/deploy/gsc.json
rm ~/Downloads/<키파일>.json
```

`macfolio`는 `~/.ssh/config`에 등록한 서버 별칭이다. `<…>`는 괄호까지 실제 값으로 바꾼다. 이 단계에서 `scp`가 `Operation timed out`으로 실패했고, 원인은 서버 주소를 잘못 기억한 것이었다([SSH가 시간 초과되던 이유](/memo/ssh-timeout-public-ip)). 별칭은 이 일을 겪고 등록했다.

서버에서 `GSC_SITE_URL`, `GSC_CLIENT_EMAIL`, `GSC_PRIVATE_KEY`를 넣고 `docker compose up -d api`로 다시 시작한 뒤, 사이트에 관리자로 로그인해 **활동 상태 보기 → 검색어 → 지금 가져오기**를 누른다. 처음에는 16개월치를 가져온다.

## 도메인 속성에서 이 사이트 검색어만 받기

처음 구현에서 서버는 Search Console API의 `searchAnalytics.query`를 속성 단위로 호출하고, 응답을 페이지 주소로 거르지 않았다. 그래서 `sc-domain:hyeoniverse.com` 같은 도메인 속성을 연결하면 `www`, `blog` 같은 다른 하위 도메인의 검색어도 MacFolio의 검색어 탭에 함께 표시되었다.

두 가지 해결 방법을 비교했다.

|                     | URL 접두어 속성 추가                              | 도메인 속성 + 서버에서 거르기 (선택)  |
| ------------------- | ------------------------------------------------- | ------------------------------------- |
| Search Console 설정 | 속성 추가, 서비스 계정 권한 추가, 사이트맵 재제출 | 변경 없음                             |
| 지난 자료           | 새 속성이라 보장되지 않음                         | 도메인 속성에 쌓인 자료를 그대로 사용 |
| 다른 하위 도메인    | Search Console에서 도메인 속성을 따로 열어야 함   | 도메인 속성 하나로 전체 확인          |
| 코드                | 변경 없음                                         | 요청에 페이지 조건 추가               |

서버가 검색어를 요청할 때 페이지 조건을 붙이도록 바꿨다. Search Console API의 `dimensionFilterGroups`[^filter]에 "페이지 주소가 이 사이트 주소로 시작" 조건을 넣는다.

```json
{
	"dimensions": ["date", "query", "page"],
	"dimensionFilterGroups": [
		{
			"filters": [
				{ "dimension": "page", "operator": "includingRegex", "expression": "^https://macfolio\\.hyeoniverse\\.com/" }
			]
		}
	]
}
```

| 연결한 속성                 | 거르는 주소                                           |
| --------------------------- | ----------------------------------------------------- |
| 도메인 속성 (`sc-domain:…`) | `FRONTEND_URL`(기본은 `CORS_ORIGINS`의 첫 주소) + `/` |
| URL 접두어 속성             | 거르지 않음 (이미 이 주소만 담는다)                   |
| `GSC_PAGE_PREFIX`를 지정    | 그 값 (빈 값이면 거르지 않음)                         |

- **이미 가져 둔 자료:** 거르기 전에 저장한 다른 하위 도메인의 줄은 화면에 보내기 전에 같은 조건(`starts_with`)으로 빼고, 다음 가져오기에서 DB에서도 지운다. 배포 직후부터 이 사이트 검색어만 보인다
- **성능:** 요청은 서버가 6시간마다 한 번 보내는 백그라운드 작업이라 방문자 화면과 관계없다. Google이 조건에 맞는 줄만 돌려주므로 받는 양은 오히려 줄어든다

## 관련 글

- [무엇을 검색하고 들어왔나 - 검색어와 Google Search Console](/memo/search-keywords): 검색어 탭과 서버의 Search Console API 호출을 만든 글
- [자바스크립트로만 그리는 데스크톱을 검색엔진이 읽게 하기](/memo/seo-crawlable): Worker가 본문과 sitemap.xml을 생성하는 구조
- [SSH가 시간 초과되던 이유 — 기억한 IP가 삭제한 임시 VM의 주소였다](/memo/ssh-timeout-public-ip): 5단계에서 서버에 접속하지 못한 원인

## 참고한 공식 문서

- [Search Console 도움말: 속성 추가](https://support.google.com/webmasters/answer/34592), [사이트 소유권 확인](https://support.google.com/webmasters/answer/9008080)
- [Search Console 도움말: 사이트맵 관리](https://support.google.com/webmasters/answer/7451001), [URL 검사 도구](https://support.google.com/webmasters/answer/9012289)
- [Search Console API: searchAnalytics.query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
- [Google Cloud: 서비스 계정 만들기](https://cloud.google.com/iam/docs/service-accounts-create)

[^service-account]: 사람이 아니라 애플리케이션이 쓰는 Google 계정. 비밀번호 대신 키로 인증하고, 권한은 그 계정을 추가한 서비스(여기서는 Search Console 속성)에서만 받는다.

[^filter]: 검색 결과를 차원(날짜·검색어·페이지·국가·기기) 값으로 거르는 조건. `includingRegex`는 RE2 정규식에 맞는 값만 남긴다([searchAnalytics.query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)).

#MacFolio #SEO #SearchConsole #인프라
