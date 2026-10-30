---
title: node:crypto로 SDK 없이 Oracle API 요청 서명 만들고 문서 시험 값으로 검증하기
date: 2026-10-10
category: 개발 기록/MacFolio/배포·운영
series: 서버 운영
seriesOrder: 5
summary: 종량제 Oracle 계정의 이번 달 요금과 예산을 서버 탭에 표시하고 80%·100%에서 메일로 알리게 했다. 요청 서명은 SDK 없이 node:crypto로 직접 생성하고, 실제 키 없이 Oracle 문서의 시험 값과 문자 단위로 비교해 검증했다.
---

[Oracle Always Free 회수를 막는 /proc 사용률 측정과 위험 메일 알림](/memo/resource-monitor)에서 사용률을 측정하고 회수 위험을 알리게 했다. 계정을 종량제(Pay As You Go)로 전환하면 회수 위험은 없어지지만 요금이 발생할 수 있다. [Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) 한도 안에서는 0원이지만, 한도 밖의 자원을 실수로 생성하면 청구된다. 그래서 종량제 계정에서는 이번 달 요금과 예산 한도를 표시하고, 예산에 가까워지면 메일로 알리게 했다([PR #153](https://github.com/hyeoniverse/MacFolio/pull/153), 이슈 [#10](https://github.com/hyeoniverse/MacFolio/issues/10)).

## 배경

API 서버는 Oracle Cloud의 Always Free `VM.Standard.E2.1.Micro`(메모리 1GB) 한 대다. 무료 계정은 7일 동안 사용률이 낮으면 회수될 수 있으므로, 종량제로 전환하는 것이 회수를 피하는 가장 확실한 방법이다. 대신 종량제에서는 무료 한도 밖의 자원을 실수로 생성하면 즉시 과금된다. 요금을 콘솔에서만 조회할 수 있으면 이런 실수는 다음 달 청구서를 받는 시각에야 발견된다.

Oracle 콘솔에도 예산 알림 기능이 있다. 하지만 이 사이트는 이미 [서버 자원 감시](/memo/resource-monitor)에서 Resend로 경고 메일을 보내고 활동 상태 보기 앱의 서버 탭에 상태를 표시하고 있었다. 요금도 같은 화면과 같은 메일 경로로 확인하도록 구성했다.

## 사용하는 API 두 개

엔드포인트 주소와 응답 구조는 Oracle의 공식 [Python SDK 소스](https://github.com/oracle/oci-python-sdk)에서 확인했다. API 문서 페이지는 JavaScript로 렌더링되어 텍스트로 추출하기 어려웠다.

| 대상         | 요청                                                                | 사용하는 필드                              |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| 예산         | `GET https://usage.{region}.oci.oraclecloud.com/20190111/budgets`   | `amount`, `actualSpend`, `forecastedSpend` |
| 이번 달 요금 | `POST https://usageapi.{region}.oci.oraclecloud.com/20200107/usage` | `items[].computedAmount`, `currency`       |

요금은 일 단위(`DAILY`)로 조회하며, 이때 시작 시각과 종료 시각이 모두 0시여야 한다. 이번 달 1일 0시부터 내일 0시까지(UTC)를 조회해 `computedAmount`를 합산한다. 예를 들어 10월 10일 05:00(UTC)에 조회하면 `timeUsageStarted`는 `2026-10-01T00:00:00.000Z`, `timeUsageEnded`는 `2026-10-11T00:00:00.000Z`다.

## 요청 서명

Oracle API는 요청마다 `Authorization` 헤더에 RSA-SHA256 서명[^httpsig]을 포함해야 한다. 구현 방법은 세 가지였다.

| 방법                                        | 장점                                  | 단점                                                                    |
| ------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| 공식 SDK(`oci-sdk`)                         | 서명·재시도·응답 타입을 모두 제공한다 | API 두 개를 호출하려고 큰 의존성을 추가한다. 1GB 서버의 이미지가 커진다 |
| 서버에 OCI CLI를 설치해 호출                | 코드가 거의 없다                      | 컨테이너에 Python과 CLI가 추가된다. 출력 파싱이 필요하다                |
| **`node:crypto`로 서명을 직접 생성** (채택) | 의존성이 없다. `oci.ts` 158줄         | 서명이 올바른지 직접 검증해야 한다                                      |

서명 대상 문자열(signing string)은 다음과 같다.

```
date: Thu, 05 Jan 2014 21:31:40 GMT
(request-target): get /20160918/instances?availabilityDomain=...
host: iaas.us-phoenix-1.oraclecloud.com
```

POST에는 `content-length`, `content-type`, `x-content-sha256`(본문 SHA-256의 base64 인코딩)이 추가된다. 이 문자열을 개인 키로 서명하고, 서명한 헤더 이름과 순서(`headers`)를 함께 전송한다.

| 메서드         | 서명하는 헤더 (순서대로)                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- |
| GET            | `date`, `(request-target)`, `host`                                                       |
| POST·PUT·PATCH | `date`, `(request-target)`, `host`, `content-length`, `content-type`, `x-content-sha256` |

```
Signature version="1",keyId="<테넌시>/<사용자>/<지문>",algorithm="rsa-sha256",headers="date (request-target) host",signature="..."
```

구현은 다음과 같다(`apps/api/src/resources/oci.ts`).

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

`content-length`는 `body.length`가 아니라 [`Buffer.byteLength`](https://nodejs.org/api/buffer.html#static-method-bufferbytelengthstring-encoding)로 계산한다. 본문에 한글(예산 이름)이 있으면 문자 수와 UTF-8 바이트 수가 다르기 때문이다. 예를 들어 `"예산"`은 `length`가 2지만 바이트 수는 6이다.

![요청 서명과 예산 알림 단계](./images/oci-billing-signing.svg '서명 문자열을 개인 키로 서명해 Authorization 머리글에 담는다')

## 실제 키 없이 서명 검증하기

개발 시점에는 실제 계정 키로 호출할 수 없었으므로, [Oracle 요청 서명 문서](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/signingrequests.htm)의 시험 값으로 검증했다. 문서에는 시험용 개인 키·공개 키와, GET·POST 요청별 서명 대상 문자열이 그대로 실려 있다.

| 검증 항목       | 방법                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET 서명 문자열 | 문서 예시의 주소와 날짜를 입력해 생성한 문자열이 문서와 **문자 단위로 일치**하는지                                                                     |
| POST 헤더       | 문서와 같은 헤더 순서인지, 빈 본문의 SHA-256이 알려진 값(`47DEQpj8...`)인지                                                                            |
| 서명 값         | 생성한 서명이 문서의 **공개 키로 검증되는지**([`crypto.verify`](https://nodejs.org/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback)) |

세 항목을 단위 시험으로 작성했다. 환경 변수에는 PEM을 한 줄로 입력해야 하므로 줄바꿈을 `\n`으로 표기하는데, 시험도 같은 형식의 키로 서명한다.

## 예산 알림

![예산 단계와 알림 기록](./images/oci-billing-budget-level.svg '80% 미만은 ok, 80%부터 near, 100%부터 over. 같은 달 같은 단계는 한 번만 알린다')

한 시간마다 요금과 예산을 다시 조회하고, 예산의 **80%**를 넘으면 한 번, **100%**를 넘으면 한 번 메일을 발송한다.

```ts
export function budgetLevel(budget: Budget): 'over' | 'near' | 'ok' {
	const spent = budget.actualSpend ?? 0;
	if (budget.amount <= 0) return 'ok';
	if (spent >= budget.amount) return 'over';
	return spent >= budget.amount * 0.8 ? 'near' : 'ok';
}
```

발송 기록은 `ResourceAlert` 테이블에 `budget-near:2026-10:월 1달러`처럼 `단계:연월:예산 이름` 형식의 키로 저장한다. 같은 달에는 같은 키가 이미 있으므로 다시 발송하지 않고, 다음 달에는 키가 달라져 새로 발송한다.

| 사용 비율 (`actualSpend / amount`) | 단계   | 메일         | 서버 탭 막대 색 |
| ---------------------------------- | ------ | ------------ | --------------- |
| 80% 미만                           | `ok`   | 없음         | 기본            |
| 80% 이상 100% 미만                 | `near` | 달마다 한 번 | 노란색          |
| 100% 이상                          | `over` | 달마다 한 번 | 빨간색          |

## 서버 탭

종량제 계정이면 회수 위험 대신 요금 영역이 표시된다. 표시 항목은 이번 달 요금, 예산별 사용 금액과 한도, 진행 막대, 이번 기간 예상 금액(`forecastedSpend`)이다.

| 상태                      | 표시                                                    |
| ------------------------- | ------------------------------------------------------- |
| 키 다섯 개가 모두 설정됨  | 요금과 예산                                             |
| 키가 없음                 | 설정 위치와 필요한 값 안내                              |
| 키가 틀리거나 권한이 없음 | Oracle이 반환한 오류 그대로(예: `401 NotAuthenticated`) |

종량제에서는 회수 기준선이 없어 네트워크 그래프의 세로축이 최댓값에 맞춰 확대됐고, 0.9% 수준의 작은 변동이 큰 파형처럼 표시됐다. 기준선이 없는 그래프는 세로축 상한을 최소 10%로 고정해 작은 변동이 과장되지 않게 했다.

## 시험

기능 커밋(`f9236560d`)은 13개 파일을 수정했다(833줄 추가, 9줄 삭제). 서명·요금 코드 `oci.ts` 158줄과 그 시험 151줄이 가장 크다. 같은 날 `docs/deployment.md`에 예산 생성, 읽기 전용 사용자·정책, 키 입력까지 단계별 설정을 추가했다(`71bfd9114`, 95줄 추가).

| 범위     | 파일                                  | 시험 수  |
| -------- | ------------------------------------- | -------- |
| 단위     | `apps/api/src/resources/oci.test.ts`  | 6        |
| API 통합 | `apps/api/test/resources.e2e.test.ts` | 2        |
| 화면 E2E | `apps/react/e2e/activity.spec.ts`     | 1 (47줄) |

<details>
<summary>시험 이름 전체</summary>

- 단위 `oci.test.ts`
  - "GET: 문서의 서명 문자열과 같다"
  - "POST: 문서와 같은 머리글 순서, 본문의 SHA-256(base64)과 길이를 함께 서명한다"
  - "Authorization: keyId는 테넌시/사용자/지문, 서명은 문서의 공개 키로 확인된다"
  - "예산을 읽고, 이번 달 1일부터 내일 0시까지의 요금을 더한다"
  - "거절당하면 이유를 담아 실패한다"
  - "예산의 80%를 넘으면 near, 다 쓰면 over"
- API 통합 `resources.e2e.test.ts`: Oracle 대신 가짜 `fetch`를 주입하고, 요청에 `authorization` 헤더가 포함됐는지 확인한다
  - "요금과 예산을 서명한 요청으로 읽어 보여 준다 (회수 위험은 없다)"
  - "예산의 80%와 100%를 넘으면 달마다 한 번씩 알린다"
- 화면 E2E `activity.spec.ts`: 서버 탭의 요금 영역

</details>

## 남은 것·배운 것

- 이 글을 작성한 시각에는 실제 계정 키로 호출하지 않았다. 서명은 문서의 시험 값과 일치하고 응답 구조는 공식 SDK에 맞췄지만, 키를 설정한 뒤 서버 탭에 요금이 표시되는지 확인하는 단계가 남아 있다.
- API 문서 페이지가 JavaScript로 렌더링되어 읽기 어려운 경우, 공식 SDK 소스가 가장 정확한 명세였다. 주소, 버전 경로(`20190111`, `20200107`), 응답 필드 이름을 SDK 소스에서 확인했다.
- 서명처럼 "맞으면 응답이 정상이고 틀리면 401만 반환되는" 코드는 공개된 시험 벡터와 문자 단위로 비교하는 방법이 가장 빠르다. 실제 키가 시험에 필요 없으므로 CI에서도 실행된다.
- `docs/deployment.md`에서는 키 전용 사용자를 별도로 만들고 `read usage-budgets`, `read usage-report` 정책만 부여하도록 안내한다. 이 키로는 요금·예산 조회만 가능하다([OCI 정책 문서](https://docs.oracle.com/en-us/iaas/Content/Identity/policieshow/how-policies-work.htm)).

## 따라 하는 방법

서버 탭에 요금을 표시하려면 Oracle 계정에 읽기 전용 API 키를 생성하고 서버의 `api.env`에 입력한다. 절차는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '종량제 요금·예산 보기 (OCI API 키)'에 있다. 입력하는 값은 다섯 개이고, 하나라도 비어 있으면 기능이 꺼진다.

```bash
# ~/deploy/api.env
OCI_TENANCY_OCID=ocid1.tenancy.oc1..…
OCI_USER_OCID=ocid1.user.oc1..…
OCI_FINGERPRINT=aa:bb:cc:…
OCI_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----"
OCI_REGION=ap-chuncheon-1
```

```bash
cd ~/deploy && docker compose up -d api      # 바뀐 api.env를 읽도록 컨테이너를 다시 생성한다
docker compose logs --tail 50 api            # 서명 오류가 없는지
```

관리자로 로그인해 활동 상태 앱의 서버 탭에서 이번 달 요금과 예산이 표시되는지 확인한다. 값을 비워 두면 요금 영역만 숨겨진다. 되돌릴 때는 다섯 줄을 삭제하고 같은 명령으로 컨테이너를 다시 생성한 뒤, Oracle 콘솔에서 해당 API 키를 삭제한다. 서명 코드와 시험은 [apps/api/src/resources/oci.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/resources/oci.ts), [apps/api/src/resources/oci.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/resources/oci.test.ts).

참고 문서: [OCI 요청 서명](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/signingrequests.htm), [OCI API 키 만들기](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm), [OCI 예산](https://docs.oracle.com/en-us/iaas/Content/Billing/Concepts/budgetsoverview.htm).

## 관련 글

- [무료 서버가 회수되기 전에 - 사용률을 측정하고 위험하면 메일로](/memo/resource-monitor)
- [Always Free 유휴 회수 기준을 충전량으로 환산한 메뉴 막대 배터리](/memo/battery-server-resources)
- [Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)

[^httpsig]: Oracle API는 IETF 초안 "HTTP Signatures"(draft-cavage-http-signatures)의 방식을 사용한다. 지정한 헤더 값을 정해진 순서로 이어 붙인 문자열에 개인 키로 서명하고, 서버는 등록된 공개 키로 같은 문자열을 재구성해 검증한다. 본문이나 헤더가 전송 중에 바뀌면 검증에 실패한다.

#MacFolio #백엔드 #Oracle #보안
