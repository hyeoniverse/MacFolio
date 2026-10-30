---
title: 리퍼러 검색어와 Search Console API로 유입 검색어 수집하기
date: 2026-10-22
category: 개발 기록/MacFolio/서버·API
series: 트래픽 분석
seriesOrder: 8
summary: 유입 경로에는 www.google.com만 보이고 검색어는 알 수 없었다. 리퍼러에 검색어가 있을 때만 수집하고, 구글 검색어는 서버가 6시간마다 Search Console API에서 가져온다. SDK 없이 서명한 서비스 계정 JWT, 설정 순서, 도메인 속성에서 이 사이트만 거르는 방법을 정리했다.
---

활동 상태 보기의 유입 경로에는 `www.google.com`, `search.naver.com` 같은 호스트가 표시된다. 검색으로 유입된 방문이 있다는 사실까지는 확인할 수 있지만, 검색어는 알 수 없었다. 이름으로 검색했는지, 블로그 글의 주제로 검색했는지에 따라 다음에 작성할 글의 주제가 달라진다([#327](https://github.com/hyeoniverse/MacFolio/pull/327)).

## 검색어가 전달되지 않는 이유

사이트가 유입 경로를 알 수 있는 수단은 `document.referrer`[^referrer] 하나다. 현재 브라우저는 다른 사이트로 이동할 때 기본으로 주소의 origin(스킴·호스트·포트)만 전달한다(Referrer-Policy 기본값 `strict-origin-when-cross-origin`). 그래서 구글 검색 결과에서 유입되면 `https://www.google.com/`만 전달된다. 구글과 빙은 검색 결과 페이지에서도 검색어를 전달하지 않도록 설정되어 있다.

검색엔진이 전체 주소를 전달하도록 설정한 경우에는 주소의 검색어 파라미터(네이버의 `query`, 다음의 `q` 등)가 남으므로 사이트에서 바로 읽을 수 있다. 구글 검색어는 사이트에서 알 수 없고, 구글이 검색 결과 노출·클릭을 집계한 Google Search Console에서 가져와야 한다.

![검색어를 아는 두 길](./images/search-keywords-paths.svg '방문 시각에 사이트가 읽는 검색어와, 서버가 Search Console에서 가져오는 검색어')

| 수단                       | 알 수 있는 값                                 | 한계                                                                |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| 방문의 `document.referrer` | 해당 방문의 검색어                            | 검색엔진이 전달할 때만. 구글·빙은 없다                              |
| Search Console API         | 날짜·검색어·페이지별 노출·클릭 수와 평균 순위 | 2~3일 지연된다. 개별 방문과 연결되지 않는다. 드문 검색어는 제외된다 |

두 수단을 모두 적용했다. 방문의 검색어는 별도 설정 없이 바로 집계되고, Search Console로 구글 검색어를 확인한다. Search Console에는 클릭으로 이어지지 않은 노출도 포함되어, 이 사이트가 검색 결과에 노출되지만 클릭되지 않는 검색어도 확인할 수 있다.

## 방문의 검색어

이전에는 리퍼러의 호스트만 전송하고 나머지는 버렸다. 이제 리퍼러가 검색엔진이면 검색어 파라미터 하나만 추가로 읽는다(`apps/react/src/shared/analytics/analytics.ts`).

```ts
const SEARCH_PARAMS: [RegExp, string][] = [
	[/(^|\.)naver\.com$/, 'query'],
	[/(^|\.)daum\.net$/, 'q'],
	[/(^|\.)google\.[a-z.]+$/, 'q'],
	// bing, yahoo(p), duckduckgo, baidu(wd), yandex(text), ecosia
];

export function searchTermOf(referrer: string): string | undefined {
	try {
		const url = new URL(referrer);
		const param = SEARCH_PARAMS.find(([pattern]) => pattern.test(url.hostname.toLowerCase()))?.[1];
		return param ? cleanSearchTerm(url.searchParams.get(param)) : undefined;
	} catch {
		return undefined;
	}
}
```

경로와 다른 파라미터는 계속 전송하지 않는다. 검색어는 다음 순서로 정규화한다.

1. 앞뒤 공백 제거
2. 연속 공백을 하나로 축소
3. 소문자로 변환
4. 100자까지만 저장

이 규칙(`cleanSearchTerm`)은 `@macfolio/contracts`에 정의하고 사이트와 서버가 공유한다. utm 값을 정리하는 `cleanUtm`과 달리 공백을 `-`로 바꾸지 않는다. "macfolio 포트폴리오"처럼 공백을 유지해야 읽기 쉽기 때문이다.

서버는 방문 이벤트의 새 열 `searchTerm`에 저장하고, 일별 집계에서 `searchTerm` 지표로 집계한다. 리퍼러 호스트와 마찬가지로 관리자에게만 표시한다. 방문별 검색어는 방문자 화면에 공개할 값이 아니기 때문이다.

## Search Console에서 가져오기

### 서비스 계정 토큰 직접 서명

Search Console API는 OAuth 접근 토큰이 필요하다. 서버가 사용자 개입 없이 호출하므로 사람의 로그인 대신 서비스 계정[^sa]을 사용한다. 서비스 계정은 개인 키로 서명한 JWT[^jwt]를 Google 토큰 엔드포인트에 보내 유효 시간 1시간의 접근 토큰을 발급받는다.

| 방법                                   | 장점                         | 단점                                             |
| -------------------------------------- | ---------------------------- | ------------------------------------------------ |
| `googleapis` 패키지                    | 토큰·재시도·타입을 모두 제공 | API 하나를 호출하려고 대형 패키지를 추가한다     |
| `google-auth-library`만                | 토큰 발급만 위임             | 의존성이 추가되고, API 요청은 결국 직접 작성한다 |
| `node:crypto`로 JWT를 직접 서명 (선택) | 의존성이 없다                | 서명 검증을 직접 시험해야 한다                   |

[Oracle 요청 서명](/memo/oci-billing)과 같은 판단이다. JWT는 헤더와 페이로드를 base64url로 인코딩해 `.`으로 연결하고 RS256으로 서명하면 완성되므로 직접 구현했다(`apps/api/src/analytics/search-console.ts`).

```ts
export function serviceAccountAssertion(credentials: SearchConsoleCredentials, now: Date): string {
	const iat = Math.floor(now.getTime() / 1000);
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
		iss: credentials.clientEmail,
		scope: 'https://www.googleapis.com/auth/webmasters.readonly',
		aud: 'https://oauth2.googleapis.com/token',
		iat,
		exp: iat + 3600,
	})}`;
	const signature = createSign('RSA-SHA256').update(unsigned).sign(normalizePem(credentials.privateKey), 'base64url');
	return `${unsigned}.${signature}`;
}
```

범위(scope)는 읽기 전용(`webmasters.readonly`)이고, Search Console에도 서비스 계정을 "제한됨" 권한으로만 추가한다. 시험에서는 키 쌍을 새로 생성해 서명하고, 공개 키로 서명을 검증한다. 실제 키는 시험 코드에 포함하지 않는다.

### 일별 저장과 기간 집계

화면을 열 때마다 Google API를 호출하지 않고, 서버가 6시간마다 가져와 `SearchQueryStat` 테이블에 저장한다. 날짜·검색어·페이지 조합마다 한 행이다.

| 실행      | 요청 구간                                          | 처리                                                                                                           |
| --------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 첫 실행   | 어제부터 480일 전까지 (`BACKFILL_DAYS`)            | Search Console 보관 기간(16개월) 전체. 25,000행씩 요청하고, 응답이 25,000행이면 다음 페이지 요청               |
| 이후 실행 | 마지막 저장일 7일 전부터 어제까지 (`REFRESH_DAYS`) | 최근 자료는 확정되면서 값이 바뀐다(`dataState: 'all'`로 확정 전 자료도 수신). 해당 날짜 행을 삭제 후 다시 저장 |
| 실패      | —                                                  | 삭제·저장이 한 트랜잭션이라 기존 행은 유지. Google이 반환한 오류 메시지를 화면 상태 줄 아래에 표시             |

![첫 실행은 480일 전체, 이후 실행은 마지막 저장일 7일 전부터 어제까지를 삭제 후 다시 저장하는 구간 도식](./images/search-keywords-sync.svg '첫 실행과 이후 실행의 요청 구간')

기간으로 집계할 때 클릭과 노출은 합산하면 되지만, 평균 순위를 단순 평균하면 값이 틀린다. 노출 1회에 1위인 날과 노출 100회에 9위인 날이 같은 가중치를 갖기 때문이다. 단순 평균은 5위, 노출 가중 평균은 약 8.9위다. 그래서 노출 수로 가중 평균한다.

```sql
SELECT "query", "page",
	SUM("clicks")::int AS "clicks",
	SUM("impressions")::int AS "impressions",
	COALESCE(SUM("position" * "impressions") / NULLIF(SUM("impressions"), 0), AVG("position"))::float8 AS "position"
FROM "SearchQueryStat"
WHERE "day" >= $1 AND "day" <= $2
GROUP BY "query", "page"
ORDER BY "impressions" DESC, "clicks" DESC, "query" ASC
LIMIT 1000
```

화면은 이 (검색어, 페이지) 행을 받아 검색어별·페이지별로 다시 집계한다(같은 가중 평균, `model.ts`의 `groupSearchRows`).

## 화면

활동 상태 보기에 관리자 전용 **검색어** 탭을 추가했다.

![검색어 탭](./images/search-keywords-tab.jpg '왼쪽은 검색어, 오른쪽은 페이지. 아래는 검색엔진이 넘겨준 방문의 검색어')

| 영역                         | 내용                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------ |
| **검색어**                   | 구글 검색 결과에 이 사이트가 노출된 검색어. 클릭·노출·순위로 정렬              |
| **페이지**                   | 블로그 글이면 글 제목으로 표시. 클릭하면 왼쪽 표를 그 페이지의 검색어로 필터링 |
| **검색엔진이 넘겨준 검색어** | 방문 시각에 리퍼러에서 읽은 검색어. 기간을 바꾸면 다른 표와 함께 갱신          |
| **지금 가져오기**            | 6시간 주기를 기다리지 않고 즉시 동기화                                         |

![페이지를 고른 검색어 표](./images/search-keywords-page.jpg '페이지를 클릭하면 그 페이지로 유입된 검색어만 표시한다')

휴대폰 화면에서는 표가 세로로 배치되고, 탭이 7개로 늘어 탭 좌우 여백을 줄였다.

## 개인정보

[개인정보 문서](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)에서 "들어온 곳의 경로와 검색어는 모으지 않는다" 문장을 수정했다. 이제 검색엔진이 리퍼러 주소에 포함한 검색어는 수집한다. 경로와 다른 파라미터는 계속 버린다. Search Console 자료는 구글이 집계한 합계라 개별 방문자와 연결되지 않고, 개인을 식별할 수 있는 드문 검색어는 구글이 제외하고 제공한다. 두 자료 모두 관리자만 조회하며, 일별 집계값처럼 기간 제한 없이 보관한다.

## 시험

| 종류    | 확인 항목                                                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위    | 검색어 정규화와 수신 검사(contracts 3개), 검색엔진별 검색어 파라미터 파싱(사이트 2개), 검색어 집계와 JWT 서명·페이지 요청·오류 메시지(서버 5개), 검색어·페이지 집계(화면 3개) |
| API e2e | 방문의 검색어는 관리자에게만 응답, Search Console 첫 실행 16개월 → 이후 7일 교체 → 거절되면 오류 메시지만 기록 (Google은 가짜 `fetch`)                                        |
| E2E     | 네이버 주소로 유입되면 검색어를 전송하고 구글은 전송하지 않음, 검색어 탭의 정렬·페이지 필터·지금 가져오기, 설정이 없을 때 안내, 방문자에게는 잠김                             |

## 설정 순서

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

서버가 Search Console API를 호출할 때 쓰는 계정이다. 사람 계정 대신 서비스 계정을 쓰면 비밀번호나 OAuth 동의 없이 키 하나로 인증한다.

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

키 파일을 서버로 옮긴 뒤 필요한 두 값(`client_email`, `private_key`)과 속성 주소만 `~/deploy/api.env`에 넣고 파일은 삭제한다. 명령은 [배포 문서](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md#검색어-google-search-console)의 "검색어 (Google Search Console)" 절에 있다.

```bash
# Mac
scp ~/Downloads/<키파일>.json macfolio:~/deploy/gsc.json
rm ~/Downloads/<키파일>.json
```

`macfolio`는 `~/.ssh/config`에 등록한 서버 별칭이다. `<…>`는 괄호까지 실제 값으로 바꾼다. 이 단계에서 `scp`가 `Operation timed out`으로 실패했고, 원인은 서버 주소를 잘못 기억한 것이었다([부트 볼륨을 임시 VM에 연결해 authorized_keys를 고치는 Oracle 서버 SSH 키 복구](/memo/oracle-ssh-key-recovery)). 별칭은 이 일을 겪고 등록했다.

```bash
# ~/deploy/api.env
GSC_SITE_URL=sc-domain:hyeoniverse.com
GSC_CLIENT_EMAIL=…@….iam.gserviceaccount.com
GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
```

`docker compose up -d api`로 다시 시작한 뒤, 사이트에 관리자로 로그인해 **활동 상태 보기 → 검색어 → 지금 가져오기**를 누른다. 처음에는 16개월치를 가져온다.

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

## 남은 과제

- **네이버의 검색어 전달 여부:** 주소의 검색어 파라미터 파싱은 시험했지만, 현재 네이버가 전체 주소를 리퍼러로 전달하는지는 배포 후 집계값으로 확인해야 한다. 전달하지 않으면 이 표는 비어 있게 된다
- **네이버 검색어 API:** 네이버 서치어드바이저에는 검색어를 조회하는 API가 없다. 리퍼러로 전달받지 못하면 서치어드바이저 웹 화면에서 확인한다

참고 문서: [서비스 계정으로 토큰 받기](https://developers.google.com/identity/protocols/oauth2/service-account#httprest), [Search Analytics: query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [Referrer-Policy](https://developer.mozilla.org/docs/Web/HTTP/Headers/Referrer-Policy), [Search Console 도움말: 속성 추가](https://support.google.com/webmasters/answer/34592), [사이트 소유권 확인](https://support.google.com/webmasters/answer/9008080), [사이트맵 관리](https://support.google.com/webmasters/answer/7451001), [URL 검사 도구](https://support.google.com/webmasters/answer/9012289), [Google Cloud: 서비스 계정 만들기](https://cloud.google.com/iam/docs/service-accounts-create).

## 관련 글

- [쿠키 없이 하루 해시로 순방문자를 집계하는 분석 API](/memo/analytics-api)
- [sendBeacon으로 5초마다 묶어 보내는 방문 이벤트](/memo/analytics-collect)
- [node:crypto로 SDK 없이 Oracle API 요청 서명 만들고 문서 시험 값으로 검증하기](/memo/oci-billing)
- [차트 라이브러리 없이 SVG 하나로 그리는 지표 그래프](/memo/analytics-activity-monitor)
- [Cloudflare Worker로 SPA의 HTML에 주소별 메타데이터와 본문 넣기](/memo/seo-crawlable)
- [부트 볼륨을 임시 VM에 연결해 authorized_keys를 고치는 Oracle 서버 SSH 키 복구](/memo/oracle-ssh-key-recovery)

[^referrer]: 현재 페이지로 이동하기 직전 페이지의 주소. 브라우저가 `Referer` 요청 헤더와 `document.referrer`로 제공한다([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/referrer)).

[^sa]: 사람이 아닌 애플리케이션이 사용하는 Google Cloud 계정. 이메일 형식의 ID와 개인 키를 가진다.

[^jwt]: JSON Web Token. 헤더·페이로드·서명 세 부분을 `.`으로 연결한 토큰 형식([RFC 7519](https://www.rfc-editor.org/rfc/rfc7519)).

[^filter]: 검색 결과를 차원(날짜·검색어·페이지·국가·기기) 값으로 거르는 조건. `includingRegex`는 RE2 정규식에 맞는 값만 남긴다([searchAnalytics.query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)).

#MacFolio #백엔드 #트래픽분석 #SearchConsole #SEO
