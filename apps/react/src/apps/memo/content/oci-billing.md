---
title: 종량제 요금과 예산 한도 - Oracle API 요청 서명을 SDK 없이
date: 2026-10-10
category: 개발기/MacFolio/백엔드
summary: 종량제 Oracle 계정의 이번 달 요금과 예산을 서버 탭에 보이고 80%·100%에서 메일로 알리게 했다. 요청 서명은 SDK 없이 node:crypto로 직접 만들고, 진짜 키 없이 Oracle 문서의 시험 값과 한 글자씩 비교해 확인했다.
---

[무료 서버가 회수되기 전에](/memo/resource-monitor)에서 사용률을 재고 회수 위험을 알리게 했다. 계정을 종량제(Pay As You Go)로 올리면 회수 걱정은 없어지지만, 대신 요금이 생길 수 있다. Always Free 한도 안에서는 0원이지만, 실수로 한도 밖의 자원을 만들면 청구된다. 그래서 종량제일 때는 이번 달 요금과 예산 한도를 보여 주고, 예산에 가까워지면 알리게 했다.

## 배경

API 서버는 Oracle Cloud의 Always Free `VM.Standard.E2.1.Micro`(1GB) 한 대다. 무료 계정은 7일 동안 사용률이 낮으면 회수될 수 있어서, 종량제로 올리는 것이 회수를 피하는 가장 확실한 방법이다. 대신 종량제에서는 무료 한도 밖의 자원을 실수로 만들면 바로 돈이 나간다. 콘솔에 들어가야만 요금을 볼 수 있으면, 그런 실수는 다음 달 청구서에서야 알게 된다.

Oracle 콘솔에도 예산 알림이 있지만, 이 사이트는 이미 [서버 자원 감시](/memo/resource-monitor)에서 Resend로 경고 메일을 보내고 활동 상태 보기의 서버 탭에 상태를 보이고 있었다. 요금도 같은 곳에서 보는 편이 낫다고 판단했다.

## 두 API

Oracle의 공식 Python SDK 소스에서 주소와 응답 모양을 확인했다(API 문서 페이지는 자바스크립트로 그려져서 읽기 어려웠다).

| 무엇         | 요청                                                                | 쓰는 값                                    |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| 예산         | `GET https://usage.{region}.oci.oraclecloud.com/20190111/budgets`   | `amount`, `actualSpend`, `forecastedSpend` |
| 이번 달 요금 | `POST https://usageapi.{region}.oci.oraclecloud.com/20200107/usage` | `items[].computedAmount`, `currency`       |

요금은 일 단위로 묻는데, 이때 시작과 끝 시각이 0시여야 한다. 이번 달 1일 0시부터 내일 0시까지(UTC)를 묻고 더한다.

## 요청 서명

Oracle API는 요청마다 `Authorization` 머리글에 RSA-SHA256 서명을 붙여야 한다. 방법은 셋이었다.

| 방법                                      | 좋은 점                         | 문제                                                             |
| ----------------------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| 공식 SDK(`oci-sdk`)                       | 서명·재시도·응답 타입이 다 있다 | 두 API를 부르려고 큰 의존성을 들인다. 1GB 서버의 이미지가 커진다 |
| 서버에 OCI CLI를 깔고 불러 쓴다           | 코드가 거의 없다                | 컨테이너에 Python과 CLI가 더 들어간다. 출력 파싱이 필요하다      |
| `node:crypto`로 서명을 직접 만든다 (고름) | 의존성이 없다. 158줄            | 서명이 맞는지 직접 확인해야 한다                                 |

두 API를 부르려고 큰 의존성을 들이기보다 서명을 직접 만들었다. 서명할 문자열은 이렇게 생겼다.

```
date: Thu, 05 Jan 2014 21:31:40 GMT
(request-target): get /20160918/instances?availabilityDomain=...
host: iaas.us-phoenix-1.oraclecloud.com
```

POST는 여기에 `content-length`, `content-type`, `x-content-sha256`(본문의 SHA-256을 base64로)이 더 붙는다. 이 문자열을 개인 키로 서명하고, 어떤 머리글을 어떤 순서로 서명했는지와 함께 보낸다.

```
Signature version="1",keyId="<테넌시>/<사용자>/<지문>",algorithm="rsa-sha256",headers="date (request-target) host",signature="..."
```

코드로는 이렇다(`apps/api/src/resources/oci.ts`).

```ts
export function signingString({ method, url, date, body, contentType = 'application/json' }: SignInput) {
	const { host, pathname, search } = new URL(url);
	const lower = method.toLowerCase();
	const headers: [string, string][] = [
		['date', date],
		['(request-target)', `${lower} ${pathname}${search}`],
		['host', host],
	];
	if (lower === 'post' || lower === 'put' || lower === 'patch') {
		const payload = body ?? '';
		headers.push(
			['content-length', String(Buffer.byteLength(payload))],
			['content-type', contentType],
			['x-content-sha256', contentSha256(payload)]
		);
	}
	// names: 'date (request-target) host ...', text: 'name: value' 줄들
}
```

`content-length`는 `body.length`가 아니라 `Buffer.byteLength`로 센다. 본문에 한글(예산 이름)이 있으면 글자 수와 바이트 수가 다르기 때문이다.

![요청 서명과 예산 알림 단계](./images/oci-billing-signing.svg '서명 문자열을 개인 키로 서명해 Authorization 머리글에 담는다')

## 진짜 키 없이 맞는지 확인하기

내 계정의 키로 직접 불러 볼 수 없으니, Oracle 문서의 시험 값으로 확인했다. 문서에는 시험용 개인 키·공개 키와, GET·POST 요청마다 서명할 문자열이 그대로 나온다.

- GET 예시의 주소와 날짜를 넣었을 때 만든 서명 문자열이 문서의 것과 **한 글자도 다르지 않은지**
- POST는 문서와 같은 머리글 순서인지, 빈 본문의 SHA-256이 알려진 값(`47DEQpj8...`)인지
- 만든 서명이 문서의 **공개 키로 확인되는지**

세 가지를 단위 시험으로 남겼다. 환경 변수에는 PEM을 한 줄로 적어야 해서 줄바꿈을 `\n`으로 쓰는데, 시험도 그렇게 적은 키로 서명한다.

## 예산 알림

![예산 단계와 알림 기록](./images/oci-billing-budget-level.svg '80% 미만은 ok, 80%부터 near, 100%부터 over. 같은 달 같은 단계는 한 번만 알린다')

한 시간마다 요금과 예산을 다시 읽고, 예산의 **80%**를 넘으면 한 번, **100%**를 넘으면 한 번 메일을 보낸다.

```ts
export function budgetLevel(budget: Budget): 'over' | 'near' | 'ok' {
	const spent = budget.actualSpend ?? 0;
	if (budget.amount <= 0) return 'ok';
	if (spent >= budget.amount) return 'over';
	return spent >= budget.amount * 0.8 ? 'near' : 'ok';
}
```

보낸 기록은 `ResourceAlert`에 `budget-near:2026-10:월 1달러`처럼 단계·달·예산 이름으로 남겨서, 같은 달에는 같은 알림을 다시 보내지 않고 다음 달에는 새로 알린다.

## 서버 탭

종량제면 회수 위험 대신 요금 칸이 나온다. 이번 달 요금, 예산마다 쓴 금액과 한도, 막대(80%부터 노란색, 100%부터 빨간색), 이번 기간 예상 금액이다. 키가 없으면 어디서 무엇을 넣는지 알려 주고, 키가 틀리거나 권한이 없으면 Oracle이 돌려준 이유(예: `401 NotAuthenticated`)를 그대로 보여 준다.

종량제에서는 기준선이 없어서 네트워크 그래프가 가장 큰 값에 맞춰 늘어났는데, 0.9%짜리 흔들림이 큰 물결처럼 보였다. 그래프 위쪽을 최소 10%로 두어 작은 흔들림이 부풀지 않게 했다.

## 확인

- 단위 시험 `apps/api/src/resources/oci.test.ts`(151줄): "GET: 문서의 서명 문자열과 같다", "POST: 문서와 같은 머리글 순서, 본문의 SHA-256(base64)과 길이를 함께 서명한다", "Authorization: keyId는 테넌시/사용자/지문, 서명은 문서의 공개 키로 확인된다", "예산을 읽고, 이번 달 1일부터 내일 0시까지의 요금을 더한다", "거절당하면 이유를 담아 실패한다", "예산의 80%를 넘으면 near, 다 쓰면 over".
- API 통합 시험 `apps/api/test/resources.e2e.test.ts`: "요금과 예산을 서명한 요청으로 읽어 보여 준다 (회수 위험은 없다)", "예산의 80%와 100%를 넘으면 달마다 한 번씩 알린다". 이 시험은 Oracle 대신 가짜 `fetch`를 넣고, 요청에 `authorization` 머리글이 붙었는지 본다.
- 화면 E2E `apps/react/e2e/activity.spec.ts`에 서버 탭의 요금 칸을 더했다(47줄).
- 기능 커밋(`f9236560d`)은 13개 파일을 고쳤다. 서명·요금 코드 `oci.ts` 158줄, 그 시험 151줄이 가장 크다. 같은 날 `docs/deployment.md`에 예산 만들기부터 읽기 전용 사용자·정책, 키 넣기까지 단계별 설정을 적었다(`71bfd9114`, 95줄 더함).

## 남은 것·배운 것

- 진짜 계정의 키로 부르는 것은 이 글을 쓸 때 아직 해 보지 않았다. 서명은 문서의 시험 값과 맞고, 응답 모양은 공식 SDK와 맞추었지만, 키를 넣고 서버 탭에 요금이 뜨는 것을 보는 것이 마지막 확인이다.
- API 문서 페이지가 자바스크립트로 그려져 읽기 어려울 때는 공식 SDK 소스가 가장 정확한 명세였다. 주소, 버전 경로(`20190111`, `20200107`), 응답 필드 이름을 SDK 소스에서 확인해 옮겼다.
- 서명처럼 "맞으면 조용하고 틀리면 401만 돌아오는" 코드는 공개된 시험 벡터로 한 글자씩 비교하는 것이 가장 빠른 확인이다. 진짜 키를 시험에 넣지 않아도 되므로 CI에서도 돈다.
- `docs/deployment.md`에는 키를 줄 사용자를 따로 만들고 `read usage-budgets`, `read usage-report` 정책만 주도록 권했다. 그런 키로는 요금·예산을 읽을 수만 있다.

## 관련 글

- [무료 서버가 회수되기 전에](/memo/resource-monitor)
- [메뉴 막대의 배터리로 서버 자원과 방문 추이 보기](/memo/battery-server-resources)
- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](/memo/deploy-api-oracle-tunnel)

#MacFolio #백엔드 #Oracle #보안
