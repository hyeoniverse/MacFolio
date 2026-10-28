---
title: UTM 출처·매체·캠페인 조합 표와 링크 생성기 (트래픽 분석 5)
date: 2026-10-18
category: 개발 기록/MacFolio/백엔드
summary: 어느 곳에 게시한 링크로 방문했는지 확인하려고 UTM 집계를 보강했다. 매체 표, 출처·매체·캠페인 조합 표와 일별 추이, term·content 열, 링크 생성기를 추가했고, 조합 키 구분자를 두 번 수정해 ' / '로 정했다.
---

이력서, LinkedIn, 커뮤니티 글, 메일에 사이트 링크를 게시한다. 어느 곳에 게시한 링크로 방문했는지 확인하고 싶었다. [sendBeacon 일괄 전송과 Global Privacy Control을 따르는 방문 이벤트 수집 (트래픽 분석 2)](/memo/analytics-collect)부터 사이트는 첫 주소의 `utm_source`·`utm_medium`·`utm_campaign`을 읽어 전송했지만, 분석 앱에는 캠페인 표와 출처 표 두 개뿐이었다. 남은 문제는 세 가지였다.

1. 매체(`medium`)는 저장만 하고 집계하지 않았다.
2. 출처·매체·캠페인 세 값을 조합해서 조회할 수 없었다.
3. UTM 링크는 수동으로 작성해야 했다.

UTM[^utm] 매개변수는 다섯 개다.

| 매개변수       | 뜻                      | 이 사이트의 예              |
| -------------- | ----------------------- | --------------------------- |
| `utm_source`   | 출처 (어느 사이트·문서) | `linkedin`, `resume`        |
| `utm_medium`   | 매체 (어떤 형태의 링크) | `profile`, `post`, `social` |
| `utm_campaign` | 캠페인 (어떤 목적·시기) | `resume-2026`               |
| `utm_term`     | 검색어 등 세부 구분     | 이 작업에서 집계 추가       |
| `utm_content`  | 같은 위치의 링크 구분   | 이 작업에서 집계 추가       |

예를 들어 이력서 PDF에 `utm_source=resume`를, LinkedIn 프로필에 `utm_source=linkedin`을 붙였다고 하자. 같은 LinkedIn이라도 프로필 링크와 글 링크는 매체(`profile`과 `post`)가 다르고, 2026년 지원용 이력서와 그 전 이력서는 캠페인이 다르다. 출처 표 하나와 캠페인 표 하나로는 "LinkedIn 글에 게시한 2026년 링크"만 필터링해 조회할 수 없었다. 링크를 수동으로 작성하다 `LinkedIn`과 `linkedin`을 섞어 쓰면 표에서 두 행으로 나뉘는 문제도 있었다.

이 작업은 이슈 [#211](https://github.com/hyeoniverse/MacFolio/issues/211)로 등록해 두었고, [#253](https://github.com/hyeoniverse/MacFolio/pull/253)에서 구현했다.

![UTM 주소의 다섯 매개변수가 cleanUtm으로 정규화된 뒤 source·medium·campaign은 조합 키 하나로, term·content는 별도 지표로 집계되는 구조](./images/utm-analytics-keys.svg 'UTM 매개변수 다섯 개가 집계되는 위치')

## 추가한 기능

| 기능                     | 내용                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 매체 표                  | 하루치 집계(`aggregate()`)가 방문마다 집계하는 지표에 `medium`을 추가                                                                                                              |
| 조합 표                  | 지표 `utm`을 추가해 출처·매체·캠페인을 키 하나로 묶어 집계. 세 값이 모두 비어 있으면 집계하지 않는다. 표에는 `linkedin / social / resume-2026`처럼 한 행으로 표시하고 빈 값은 `-`  |
| 조합별 추이              | 조합 표에서 이름을 누르면 그 조합의 일별 방문을 아래에 펼쳐 표시. 요약 API에 `utm=` 파라미터를 추가했고, 관리자 요청에만 응답                                                      |
| `utm_term`·`utm_content` | 열 두 개를 추가하는 마이그레이션 작성. 값의 종류가 많아질 수 있어 조합 키에 포함하지 않고 `term`·`content` 지표로 별도 집계. 값이 없으면 표를 렌더링하지 않는다                    |
| 링크 생성기              | 유입 경로 탭 위쪽에 접을 수 있는 "UTM 링크 만들기" 배치. 대상 주소를 선택하고 출처·매체·캠페인을 입력하면 완성된 주소를 표시하고 복사 버튼으로 복사. 생성한 링크는 저장하지 않는다 |

![활동 상태 보기 앱의 유입 경로 탭. 위쪽 UTM 링크 만들기에 대상 주소·출처·매체·캠페인을 입력하면 완성된 주소와 복사 버튼이 표시되고, 아래에 묶어 보기·들어온 곳·출처 / 매체 / 캠페인 표가 이어진다](./images/utm-analytics-builder.jpg '유입 경로 탭의 UTM 링크 만들기. 출처 linkedin, 매체 social, 캠페인 resume-2026을 입력한 상태(시험용 가짜 데이터)')

변경한 파일은 27개(1,025줄 추가, 73줄 삭제)다. 가장 큰 파일은 분석 앱의 새 컴포넌트 `apps/react/src/apps/activity/Utm.tsx`(163줄)와 화면 E2E(`e2e/activity.spec.ts` 84줄)다.

새 표는 모두 관리자 전용 목록(`ADMIN_ONLY_BREAKDOWNS`)에 넣었다. 방문자가 수신하는 요약에서는 빈 목록이고, 방문자가 `utm=`을 붙여 요청해도 추이를 응답하지 않는다.

## 조합 키의 구분자

처음에는 지표 이름과 키를 결합할 때처럼 `\u0000`(NUL 문자)으로 출처·매체·캠페인을 결합했다. 단위 시험이 바로 실패했다. `aggregate()`는 마지막에 `metric\u0000key`를 `split('\u0000')`으로 분리하는데, 키 안에도 `\u0000`이 있어서 키가 첫 번째 값에서 잘렸다. 첫 번째 구분자에서만 분리하도록 수정했다.

```ts
// apps/api/src/analytics/rules.ts: 키에 구분자가 섞여도 깨지지 않게 처음 것에서만 나눈다
const cut = id.indexOf('\u0000');
return { metric: id.slice(0, cut), key: id.slice(cut + 1), value };
```

수정 후에는 API e2e 시험이 500을 반환했다. PostgreSQL의 문자열 열은 NUL 문자를 저장할 수 없다.[^nul] 메모리에서 결합하는 데는 문제가 없지만 `DailyStat`의 `key` 열에 저장할 수 없었다.

그래서 구분자를 `' / '`로 바꿨다. utm 값은 저장하기 전에 `cleanUtm()`으로 정규화한다. 앞뒤 공백을 제거하고, 소문자로 바꾸고, 연속된 공백은 `-` 하나로 바꾼다. 정규화한 값에는 공백이 없으므로 `' / '`가 값 안에 나타날 수 없다. 키가 화면에 표시되는 형태와 같아져서, 표의 이름과 `utm=` 파라미터도 그대로 읽을 수 있다.

| 구분자            | 메모리에서 분리               | DB 저장 | 화면 표시     | 값 안에 나타날 수 있는가                       |
| ----------------- | ----------------------------- | ------- | ------------- | ---------------------------------------------- |
| `\u0000`          | 첫 구분자에서만 분리하면 가능 | 불가    | 불가          | 아니다                                         |
| `\|` 같은 한 글자 | 가능                          | 가능    | 읽기 어렵다   | 수동으로 입력하면 나타난다                     |
| `' / '` (채택)    | 가능                          | 가능    | 그대로 읽힌다 | `cleanUtm`이 공백을 제거하므로 나타나지 않는다 |

![널 문자로 묶었다가 두 번 깨지고 ' / '로 정한 과정](./images/utm-analytics-separator.svg '조합 키 구분자를 정한 과정')

## 보내는 쪽과 받는 쪽의 같은 규칙

`cleanUtm()`은 contracts 패키지(`packages/contracts/src/analytics.ts`)에 정의했다.

```ts
export function cleanUtm(value: string | null | undefined): string | undefined {
	const cleaned = (value ?? '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, UTM_MAX);
	return cleaned || undefined;
}

export const UTM_KEY_SEPARATOR = ' / ';
export const utmKey = (source?: string | null, medium?: string | null, campaign?: string | null) =>
	[source ?? '', medium ?? '', campaign ?? ''].join(UTM_KEY_SEPARATOR);
```

같은 함수를 세 곳에서 호출한다.

1. 링크 생성기가 입력값을 정규화할 때
2. 사이트의 `utmOf()`가 첫 주소를 읽을 때
3. 서버의 `EventInput` 스키마가 이벤트를 수신할 때

생성기에 `LinkedIn`을 입력하든, 주소에 `utm_source=LinkedIn`을 직접 붙이든 표에는 `linkedin` 한 행으로 집계된다. 이벤트 스키마 전체는 [contracts의 zod 스키마로 분석 이벤트의 전송 형식·서버 검증·조회 응답 통합하기](/memo/contracts-analytics)에서 다룬다.

![링크 생성기와 사이트가 cleanUtm으로 값을 다듬고, 서버가 같은 함수로 받아 DailyStat에 조합 키로 저장한다](./images/utm-analytics-flow.svg '보내는 쪽과 받는 쪽이 같은 cleanUtm을 쓴다')

## 지난 날짜는 다시 집계하지 않는다

지난 날짜의 수치는 `DailyStat`에 날짜별로 집계해 저장했고, 그 행에는 `medium`·`utm`·`term`·`content`가 없다. 보관 중인 이벤트 행(90일)으로 다시 집계하는 일회성 작업을 만들 수도 있었다. 그러나 이미 집계한 날짜의 행을 삭제하고 다시 넣는 작업은 집계 전체에 영향을 주고, 90일보다 오래된 날짜는 어차피 채울 수 없다. 그래서 배포한 날부터만 집계하기로 하고, 표 위에 다음 안내를 표시했다.

> 이 기능을 배포한 날부터 셉니다. 그 전 날의 집계에는 없습니다.

오늘 수치는 이벤트 행에서 직접 집계하므로 배포 당일부터 바로 표시된다.

## 읽은 utm은 주소창에서 삭제한다

utm이 붙은 주소를 그대로 두면, 방문자가 주소를 복사해 다른 사람에게 보낼 때 같은 캠페인 방문이 다시 집계된다. 링크를 게시한 위치도 함께 전달된다. 그래서 사이트가 첫 주소에서 utm을 읽은 뒤 [`history.replaceState`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)로 `utm_*`만 삭제한다.

| 주소창        | 주소                                                                 |
| ------------- | -------------------------------------------------------------------- |
| 방문 시각     | `/memo/some-post?ref=a&utm_source=linkedin&utm_medium=post#comments` |
| utm을 읽은 뒤 | `/memo/some-post?ref=a#comments`                                     |

메모 글 주소의 다른 쿼리와 프래그먼트(`#…`)는 작성된 그대로 유지한다. [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)로 다시 직렬화하면 공백의 `+`와 `%20` 같은 표기가 바뀔 수 있어서, 쿼리를 `&`로 분리해 이름이 `utm_`으로 시작하는 항목만 제외했다.

```ts
// apps/react/src/shared/analytics/analytics.ts
const parts = url.search.slice(1).split('&').filter(Boolean);
const kept = parts.filter((part) => {
	const name = part.split('=')[0].replace(/\+/g, ' ');
	try {
		return !/^utm_/i.test(decodeURIComponent(name));
	} catch {
		return true; // 잘못된 % 표기는 건드리지 않는다
	}
});
if (kept.length === parts.length) return null;
```

제외할 항목이 없으면 `null`을 반환하고, 그 경우에는 `replaceState`를 호출하지 않는다. 불필요하게 방문 기록 항목을 변경하지 않기 위해서다.

사이트 내부에서 이동한 referrer는 기존과 같이 '직접'으로 처리하고, utm이 있으면 utm을 그대로 전송한다. 이 동작은 기존에도 같았지만 이번에 시험으로 고정했다.

## 분석 앱 여백

분석 앱의 간격은 이미 세 변수(`--activity-gap`·`--activity-pad`·`--activity-row`)로 통일되어 있었다. 이번에는 세 변수의 값을 공통 간격 토큰(`--space-16`·`--space-12`·`--space-6`)으로 바꾸고, 남아 있던 숫자 값도 토큰으로 옮겼다. 유입 경로 탭에서 2열 묶음이 연속될 때 세로 간격이 없어 표가 붙어 보이던 곳에는 가로 간격과 같은 값을 적용했다.

## 확인

| 범위           | 확인한 내용                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| contracts      | `cleanUtm()`의 규칙, `EventInput`이 utm 다섯 개를 정규화해 수신하는지, 새 표가 관리자 전용인지                                                             |
| 서버 단위 시험 | 매체·조합·term·content 집계, 조합 키에 term·content가 포함되지 않는지                                                                                      |
| API e2e        | 관리자 요약에 새 표와 `utmTrend`가 있고, 방문자 요약에는 utm 값이 없는지. 형식이 잘못된 `utm=`은 400                                                       |
| 화면 E2E       | 조합을 누르면 추이가 펼쳐지는지, 링크 생성기로 만든 주소를 열면 그 조합이 표에서 1 증가하는지, utm이 주소창에서 삭제되고 새로고침해도 다시 전송되지 않는지 |

마지막 항목은 `e2e/analytics.spec.ts`의 "utm\_\*는 읽은 뒤 주소창에서 지운다 (다른 쿼리·조각은 그대로). 새로 고쳐도 같은 utm이 다시 가지 않는다" 시험이다.

관리자 화면은 로그인해야 열리므로, 화면 E2E는 가짜 API(`e2e/fakeApi.ts`)가 관리자 요약을 반환하게 해서 실행한다.

## 남은 것·배운 것

- 지난 날짜의 매체·조합 집계는 비어 있다. 배포한 날부터 누적된다.
- `utm_term`·`utm_content`는 별도로 집계한다. 이 둘까지 조합 키에 포함하면 조합 수가 크게 늘어 표가 길어진다. 필요해지면 조합 추이처럼 누르면 펼치는 방식으로 추가한다.
- 보내는 쪽과 받는 쪽이 같은 규칙을 적용해야 하는 값은 한 패키지에 함수로 정의한다. 문서로 "소문자로 적는다"고 정하는 것보다 확실하다.
- 메모리에서 쓰는 구분자와 DB에 저장하는 구분자는 별도로 검토해야 한다. NUL 문자는 메모리에서는 안전하지만 PostgreSQL 문자열 열에는 저장할 수 없다.

<details>
<summary>이 기능을 만든 계기</summary>

지원서에 게시할 링크로 어디에서 방문했는지 확인하고 싶었다. 먼저 UTM 기능이 있는지 확인해 보니, 집계는 이미 출처만 집계하고 있었다. 생성기가 없어도 주소 뒤에 매개변수를 붙이기만 하면 분석이 된다는 것을 확인했고, 실제로 채용 지원에 사용할 홈 화면 링크를 `?utm_source=…&utm_medium=…&utm_campaign=…` 형식으로 만들어 열어 보니 정상적으로 집계되었다. 이때 활동 상태 앱의 여백·간격 정리도 계획에 포함했고, 이 글이 그 계획의 결과다.

</details>

## 사용 방법

1. 관리자로 활동 상태 앱 → 유입 경로 탭을 연다.
2. 위쪽 "UTM 링크 만들기"를 펼쳐 대상 주소, 출처(`linkedin`), 매체(`social`), 캠페인(`resume-2026`)을 입력한다.
3. 복사 버튼으로 주소를 복사해 사용한다.

그 링크로 들어온 방문은 조합 표에 `linkedin / social / resume-2026` 한 행으로 집계된다. 시험은 `cd apps/react && npx playwright test e2e/activity.spec.ts e2e/analytics.spec.ts`로 실행한다. 어떤 데이터를 보관하는지는 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)의 '트래픽 분석' 절에 정리했다.

참고 문서: [Google Analytics UTM 매개변수](https://support.google.com/analytics/answer/10917952), [MDN History.replaceState()](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState), [PostgreSQL 문자 자료형](https://www.postgresql.org/docs/current/datatype-character.html).

## 관련 글

- [쿠키 없이 하루 해시로 순방문자를 집계하는 분석 API (트래픽 분석 1)](/memo/analytics-api)
- [sendBeacon 일괄 전송과 Global Privacy Control을 따르는 방문 이벤트 수집 (트래픽 분석 2)](/memo/analytics-collect)
- [라이브러리 없는 SVG 그래프와 컨테이너 쿼리로 만든 '활동 상태 보기' 앱 (트래픽 분석 3)](/memo/analytics-activity-monitor)
- [서버가 세션을 확인해 방문자와 관리자에게 범위를 나누는 분석 요약 응답 (트래픽 분석 4)](/memo/analytics-public)
- [contracts의 zod 스키마로 분석 이벤트의 전송 형식·서버 검증·조회 응답 통합하기](/memo/contracts-analytics)

PR: [#253](https://github.com/hyeoniverse/MacFolio/pull/253) · 이슈: [#211](https://github.com/hyeoniverse/MacFolio/issues/211)

[^utm]: Urchin Tracking Module. 링크 주소 뒤에 붙이는 쿼리 매개변수로, 방문자가 어느 링크로 들어왔는지 분석 도구가 구분할 수 있게 한다. Google Analytics가 정한 이름이지만 다른 분석 도구도 같은 이름을 사용한다.

[^nul]: PostgreSQL 문서는 문자 자료형에 대해 "문자 집합과 관계없이 코드 0인 문자(NUL)는 저장할 수 없다"고 명시한다. [Character Types](https://www.postgresql.org/docs/current/datatype-character.html) 참고.

#MacFolio #트래픽분석 #UTM
