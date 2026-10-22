---
title: 무엇을 검색하고 들어왔나 - 검색어와 Google Search Console
date: 2026-10-22
category: 개발기/MacFolio/백엔드
summary: 유입 경로에는 www.google.com만 보이고 무엇을 검색했는지는 알 수 없었다. 검색엔진이 넘겨줄 때만 방문의 검색어를 받고, 구글 검색어는 서버가 6시간마다 Search Console API에서 가져오게 했다. 서비스 계정 JWT는 SDK 없이 직접 서명했다.
---

활동 상태 보기의 유입 경로에는 `www.google.com`, `search.naver.com` 같은 호스트가 보인다. 검색으로 들어온 사람이 있다는 것까지는 안다. 그런데 무엇을 검색했는지는 모른다. 이력서 이름으로 찾았는지, 블로그 글의 주제로 찾았는지에 따라 다음에 쓸 글이 달라진다.

## 왜 검색어가 오지 않나

사이트가 들어온 곳을 아는 길은 `document.referrer` 하나다. 요즘 브라우저는 다른 사이트로 넘어갈 때 기본으로 주소의 앞부분(origin)만 넘긴다(`strict-origin-when-cross-origin`). 그래서 구글 검색 결과에서 들어오면 `https://www.google.com/`만 온다. 구글과 빙은 검색 결과 쪽에서도 검색어를 넘기지 않는다.

검색엔진이 전체 주소를 넘기도록 정해 두었다면 주소의 검색어 칸(네이버의 `query`, 다음의 `q` 등)이 남는다. 이 경우는 사이트에서 바로 읽을 수 있다. 구글 검색어는 사이트가 알 길이 없다. 구글이 검색 결과를 세어 둔 Google Search Console에서 가져와야 한다.

![검색어를 아는 두 길](./images/search-keywords-paths.svg '방문할 때 사이트가 읽는 검색어와, 서버가 Search Console에서 가져오는 검색어')

| 길                         | 무엇을 아나                                   | 한계                                                          |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| 방문의 `document.referrer` | 그 방문이 무엇을 검색하고 들어왔는지          | 검색엔진이 넘겨줄 때만. 구글·빙은 없다                        |
| Search Console API         | 날짜·검색어·페이지별 노출·클릭 수와 평균 순위 | 2~3일 늦다. 방문 하나와 이어지지 않는다. 드문 검색어는 빠진다 |

둘 다 하기로 했다. 방문의 검색어는 설정 없이 바로 쌓이고, Search Console은 구글 검색어를 본다. Search Console에는 클릭으로 이어지지 않은 노출도 있어서, 어떤 검색어에 이 사이트가 나오는데 눌리지 않는지도 알 수 있다.

## 방문의 검색어

예전에는 들어온 곳의 호스트만 보내고 나머지는 버렸다. 이제 들어온 곳이 검색엔진이면 검색어 칸 하나만 더 읽는다(`apps/react/src/shared/analytics/analytics.ts`).

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

경로나 다른 칸은 여전히 보내지 않는다. 검색어는 앞뒤 공백을 빼고, 이어진 공백을 하나로 줄이고, 소문자로 바꿔 100자까지 남긴다. 이 규칙(`cleanSearchTerm`)은 `@macfolio/contracts`에 두고 사이트와 서버가 같이 쓴다. utm의 `cleanUtm`과 달리 공백을 `-`로 바꾸지 않는다. "macfolio 포트폴리오"는 그대로가 읽기 쉽다.

서버는 방문 이벤트의 새 열 `searchTerm`에 두고, 날마다 모을 때 `searchTerm` 지표로 센다. 들어온 곳의 호스트처럼 관리자에게만 보인다. 누가 무엇을 찾다 들어왔는지는 방문자 화면에 드러낼 값이 아니다.

## Search Console에서 가져오기

### 서비스 계정 토큰을 직접 서명했다

Search Console API는 OAuth 토큰이 필요하다. 서버가 혼자 부르니 사람의 로그인 대신 서비스 계정을 쓴다. 서비스 계정은 개인 키로 서명한 JWT를 보내 1시간짜리 접근 토큰을 받는다.

| 방법                                   | 좋은 점                    | 문제                                            |
| -------------------------------------- | -------------------------- | ----------------------------------------------- |
| `googleapis` 패키지                    | 토큰·재시도·타입이 다 있다 | API 하나를 부르려고 아주 큰 패키지를 들인다     |
| `google-auth-library`만                | 토큰만 맡긴다              | 그래도 의존성이 늘고, 요청은 어차피 직접 만든다 |
| `node:crypto`로 JWT를 직접 서명 (고름) | 의존성이 없다              | 서명이 맞는지 직접 확인해야 한다                |

[Oracle 요청 서명](/memo/oci-billing) 때와 같은 판단이다. JWT는 머리와 내용을 base64url로 이어 RS256으로 서명하면 끝이라 직접 만들었다(`apps/api/src/analytics/search-console.ts`).

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

범위는 읽기 전용(`webmasters.readonly`)이고, Search Console에도 서비스 계정을 "제한됨" 권한으로만 더한다. 시험에서는 키 쌍을 새로 만들어 서명하고, 공개 키로 서명이 맞는지 확인한다. 진짜 키는 시험에 없다.

### 날마다 받아 두고 기간으로 묶는다

화면을 열 때마다 Google에 묻지 않고, 서버가 6시간마다 가져와 `SearchQueryStat` 표에 둔다. 날짜·검색어·페이지마다 한 행이다.

- **처음에는 16개월:** Search Console이 두는 기간이다. 한 번에 25,000줄씩 받고, 꽉 차면 다음 쪽을 묻는다
- **다음부터는 마지막 날의 7일 전부터:** 최근 며칠의 자료는 확정되며 바뀐다(`dataState: 'all'`로 확정 전 자료도 받는다). 그 날들을 지우고 새로 넣는다. 한 트랜잭션이라 받는 데 실패하면 가져 둔 자료는 그대로다
- **실패하면 이유를 남긴다:** 권한이 없거나 키가 틀리면 Google이 돌려준 이유를 화면의 상태 줄 아래에 그대로 보인다

기간으로 묶을 때 클릭과 노출은 더하면 되지만, 평균 순위는 그냥 평균을 내면 틀린다. 노출 1번에 1위인 날과 노출 100번에 9위인 날을 같은 무게로 치게 되기 때문이다. 그래서 노출로 가중한다.

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

화면은 이 (검색어, 페이지) 줄을 받아 검색어별·페이지별로 다시 묶는다(같은 가중 평균, `model.ts`의 `groupSearchRows`).

## 화면

활동 상태 보기에 **검색어** 탭을 더했다. 관리자만 본다.

![검색어 탭](./images/search-keywords-tab.jpg '왼쪽은 검색어, 오른쪽은 페이지. 아래는 검색엔진이 넘겨준 방문의 검색어')

- **검색어:** 구글 검색 결과에 이 사이트가 나온 검색어. 클릭·노출·순위로 정렬한다
- **페이지:** 블로그 글이면 글 제목으로 보인다. 누르면 왼쪽 표에 그 페이지로 들어온 검색어만 남는다
- **검색엔진이 넘겨준 검색어:** 방문 때 받은 것. 기간을 바꾸면 다른 표와 함께 바뀐다
- **지금 가져오기:** 6시간을 기다리지 않고 바로 가져온다

![페이지를 고른 검색어 표](./images/search-keywords-page.jpg '페이지를 누르면 그 페이지로 들어온 검색어만')

휴대폰에서는 표가 한 줄씩 쌓이고, 탭이 일곱 개가 되어 탭 옆 여백을 줄였다.

## 개인정보

[개인정보 문서](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)의 "들어온 곳의 경로와 검색어는 모으지 않는다"를 고쳤다. 이제 검색엔진이 들어온 주소에 실어 보낸 검색어는 모은다. 경로와 다른 칸은 여전히 버린다. Search Console 자료는 구글이 센 합계라 사람 하나와 이어지지 않고, 사람을 알아볼 수 있는 드문 검색어는 구글이 빼고 준다. 둘 다 관리자만 보고, 날마다 모은 숫자와 같이 계속 둔다.

## 시험

- **단위:** 검색어 다듬기와 받는 쪽 검사(contracts 3개), 검색엔진별로 검색어 칸 읽기(사이트 2개), 검색어 세기와 JWT 서명·쪽 넘기기·거절 이유(서버 5개), 검색어·페이지 묶기(화면 3개)
- **API e2e:** 방문의 검색어는 관리자에게만, Search Console은 처음 16개월 → 다음은 7일 갈아 끼우기 → 거절되면 이유만 남기기 (Google은 가짜 fetch)
- **E2E:** 네이버 주소로 들어오면 검색어를 보내고 구글은 보내지 않는다, 검색어 탭의 정렬·페이지 고르기·지금 가져오기, 설정이 없을 때, 방문자에게는 잠김

## 켜기

서버에 세 값을 넣으면 켜진다. 서비스 계정을 만들고 Search Console에 더하는 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 "검색어 (Google Search Console)"에 적었다.

```
GSC_SITE_URL=sc-domain:hyeoniverse.com
GSC_CLIENT_EMAIL=…@….iam.gserviceaccount.com
GSC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
```

## 남은 것

- **네이버가 정말 검색어를 넘기는지:** 주소의 검색어 칸을 읽는 것은 시험했지만, 지금 네이버가 전체 주소를 넘기는지는 배포한 뒤 숫자로 확인한다. 넘기지 않으면 이 표는 비어 있을 것이다
- **네이버 검색어:** 네이버 서치어드바이저에는 검색어를 가져올 API가 없다. 넘겨받지 못하면 서치어드바이저 화면에서 본다

참고 문서: [서비스 계정으로 토큰 받기](https://developers.google.com/identity/protocols/oauth2/service-account#httprest), [Search Analytics: query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [Referrer-Policy](https://developer.mozilla.org/docs/Web/HTTP/Headers/Referrer-Policy).

## 관련 글

- [트래픽 분석 1 - 쿠키 없이 순방문자 세기](/memo/analytics-api)
- [트래픽 분석 2 - 사이트에서 모아 보내기](/memo/analytics-collect)
- [종량제 요금과 예산 한도 - Oracle API 요청 서명을 SDK 없이](/memo/oci-billing)

#MacFolio #백엔드 #트래픽분석 #SearchConsole
