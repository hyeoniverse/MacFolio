---
title: 트래픽 분석 5 - UTM 조합 표와 링크 생성기
date: 2026-10-18
category: 개발기/MacFolio/백엔드
summary: 어디에 낸 링크로 들어왔는지 보려고 UTM 집계를 보강했다. 매체 표, 출처·매체·캠페인 조합 표와 일별 추이, term·content 열, 링크 생성기를 더하고, 조합 키 구분자를 두 번 고쳐 ' / '로 정했다.
---

이력서, LinkedIn, 커뮤니티 글, 메일에 사이트 링크를 낸다. 어디에 낸 링크로 사람이 들어왔는지 보고 싶었다. [트래픽 분석 2](/memo/analytics-collect)부터 사이트는 첫 주소의 `utm_source`·`utm_medium`·`utm_campaign`을 읽어 보냈지만, 분석 앱에는 캠페인 표와 출처 표 둘뿐이었다. 매체는 저장만 하고 세지 않았고, 셋을 함께 볼 수 없었고, 링크는 손으로 만들어야 했다.

예를 들어 이력서 PDF에 `utm_source=resume`를, LinkedIn 프로필에 `utm_source=linkedin`을 붙여 두었다고 하자. 같은 LinkedIn이라도 프로필 링크와 글 링크는 매체(`profile`과 `post`)가 다르고, 2026년 지원용 이력서와 그전 이력서는 캠페인이 다르다. 출처 표 하나와 캠페인 표 하나로는 "LinkedIn 글에 낸 2026년 링크"를 골라 볼 수 없었다. 링크를 손으로 만들다 `LinkedIn`과 `linkedin`을 섞어 쓰면 표에 두 줄로 갈라지는 것도 문제였다.

이 일은 이슈 #211로 적어 두었던 것이다.

## 무엇을 더했나

- **매체 표:** 하루치 집계(`aggregate()`)가 방문마다 세는 지표에 `medium`을 더했다
- **조합 표:** 지표 `utm`을 하나 더 두고 출처·매체·캠페인을 한 키로 묶어 센다. 셋 다 비면 세지 않는다. 표에는 `linkedin / social / resume-2026`처럼 한 줄로 보이고 빈 칸은 `-`다
- **조합별 추이:** 조합 표에서 이름을 누르면 그 조합의 일별 방문이 아래에 펼쳐진다. 요약 API에 `utm=` 파라미터를 더했고 관리자에게만 답한다
- **utm_term·utm_content:** 열 둘을 더하는 마이그레이션을 두었다. 값이 많아질 수 있어 조합 키에 붙이지 않고 `term`·`content` 지표로 따로 센다. 값이 없으면 표를 그리지 않는다
- **링크 생성기:** 유입 경로 탭 위쪽에 접히는 "UTM 링크 만들기"를 두었다. 대상 주소를 고르고 출처·매체·캠페인을 넣으면 완성된 주소가 보이고 복사 버튼으로 복사한다. 만든 링크는 저장하지 않는다

바뀐 파일은 27개(1,025줄 추가, 73줄 삭제)다. 가장 큰 것은 분석 앱의 새 컴포넌트 `apps/react/src/apps/activity/Utm.tsx`(163줄)와 화면 E2E(`e2e/activity.spec.ts` 84줄)다.

새 표는 모두 관리자 전용 묶음(`ADMIN_ONLY_BREAKDOWNS`)에 넣었다. 방문자가 받는 요약에서는 빈 목록이고, 방문자가 `utm=`을 붙여 물어도 추이를 주지 않는다.

## 조합 키의 구분자

처음에는 지표와 키를 묶을 때처럼 `\u0000`으로 출처·매체·캠페인을 묶었다. 단위 시험은 바로 깨졌다. `aggregate()`는 마지막에 `metric\u0000key`를 `split('\u0000')`으로 나누는데, 키 안에도 `\u0000`이 있으니 키가 첫 칸에서 잘렸다. 처음 나오는 구분자에서만 나누도록 고쳤다.

```ts
// apps/api/src/analytics/rules.ts: 키에 구분자가 섞여도 깨지지 않게 처음 것에서만 나눈다
const cut = id.indexOf('\u0000');
return { metric: id.slice(0, cut), key: id.slice(cut + 1), value };
```

고치고 나니 API e2e 시험이 500을 냈다. PostgreSQL의 글자 열은 `\u0000`을 받지 않는다. 메모리에서 묶는 데는 문제가 없지만 `DailyStat`의 `key` 열에 저장할 수 없었다.

그래서 구분자를 `' / '`로 바꿨다. utm 값은 저장하기 전에 `cleanUtm()`으로 다듬는다. 앞뒤 공백을 빼고 소문자로 바꾸고 이어진 공백은 `-` 하나로 바꾼다. 다듬은 값에는 공백이 없으므로 `' / '`가 값 안에 나올 수 없다. 키가 화면에 보이는 모양과 같아져서, 표의 이름과 `utm=` 파라미터도 읽기 쉬워졌다.

| 구분자            | 메모리에서 나누기       | DB 저장 | 화면에 그대로 보이기 | 값 안에 나올 수 있나               |
| ----------------- | ----------------------- | ------- | -------------------- | ---------------------------------- |
| `\u0000`          | 처음 것에서만 나누면 됨 | 안 됨   | 안 됨                | 아니다                             |
| `\|` 같은 한 글자 | 됨                      | 됨      | 어색하다             | 누가 손으로 넣으면 나온다          |
| `' / '`           | 됨                      | 됨      | 그대로 읽힌다        | `cleanUtm`이 공백을 없애 못 나온다 |

![널 문자로 묶었다가 두 번 깨지고 ' / '로 정한 과정](./images/utm-analytics-separator.svg '조합 키 구분자를 정한 과정')

## 받는 쪽과 같은 규칙

`cleanUtm()`은 contracts 패키지(`packages/contracts/src/analytics.ts`)에 두었다.

```ts
export function cleanUtm(value: string | null | undefined): string | undefined {
	const cleaned = (value ?? '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, UTM_MAX);
	return cleaned || undefined;
}

export const UTM_KEY_SEPARATOR = ' / ';
export const utmKey = (source?: string | null, medium?: string | null, campaign?: string | null) =>
	[source ?? '', medium ?? '', campaign ?? ''].join(UTM_KEY_SEPARATOR);
```

링크 생성기가 이것으로 값을 다듬고, 사이트의 `utmOf()`가 주소를 읽을 때도, 서버의 `EventInput` 스키마가 이벤트를 받을 때도 같은 함수를 쓴다. 생성기에 `LinkedIn`을 넣든, 누가 손으로 `utm_source=LinkedIn`을 붙이든 표에는 `linkedin` 한 줄로 모인다.

![링크 생성기와 사이트가 cleanUtm으로 값을 다듬고, 서버가 같은 함수로 받아 DailyStat에 조합 키로 저장한다](./images/utm-analytics-flow.svg '보내는 쪽과 받는 쪽이 같은 cleanUtm을 쓴다')

## 지난 날은 다시 모으지 않는다

지난 날의 숫자는 `DailyStat`에 날마다 모아 두었고, 거기에는 `medium`·`utm`·`term`·`content`가 없다. 남아 있는 이벤트 행(90일)으로 다시 모으는 한 번짜리 작업을 둘 수도 있었다. 하지만 이미 모은 날의 행을 지우고 다시 넣는 일은 집계 전체를 건드리고, 90일보다 오래된 날은 어차피 채울 수 없다. 배포한 날부터만 센다고 정하고, 표 위에 "이 기능을 배포한 날부터 셉니다"라고 적었다. 오늘 것은 이벤트에서 바로 세므로 배포한 날부터 바로 보인다.

## 읽은 utm은 주소창에서 지운다

utm이 붙은 주소를 그대로 두면 방문자가 주소를 복사해 다른 사람에게 보낼 때 같은 캠페인 방문이 다시 세진다. 링크를 낸 곳도 함께 전해진다. 그래서 사이트가 첫 주소에서 utm을 읽은 뒤 `history.replaceState`로 `utm_*`만 지운다. 메모 글 주소의 다른 쿼리와 조각은 쓴 그대로 둔다. `URLSearchParams`로 다시 쓰면 `+`와 `%20` 같은 표기가 바뀔 수 있어서, 쿼리를 `&`로 나누어 이름이 `utm_`으로 시작하는 조각만 뺐다.

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

뺄 것이 없으면 `null`을 돌려주고, 그때는 `replaceState`를 부르지 않는다. 쓸데없이 기록을 바꾸지 않으려는 것이다.

사이트 안에서 온 referrer는 지금처럼 '직접'으로 두고, utm이 있으면 utm을 그대로 보낸다. 이 동작은 원래도 그랬지만 시험으로 고정했다.

## 분석 앱 여백

분석 앱의 간격은 이미 세 값(`--activity-gap`·`--activity-pad`·`--activity-row`)으로 맞춰 두었다. 이번에는 그 셋을 공통 간격 토큰(`--space-16`·`--space-12`·`--space-6`)으로 바꾸고, 남아 있던 몇 군데의 숫자도 토큰으로 옮겼다. 유입 경로 탭에서 두 단 묶음이 이어질 때 세로 간격이 없어 표가 붙어 보이던 곳은 가로 간격과 같은 값을 두었다.

## 확인

- contracts: `cleanUtm()`의 규칙, `EventInput`이 utm 다섯 칸을 다듬어 받는지, 새 표가 관리자 전용인지
- 서버 단위 시험: 매체·조합·term·content를 세고, 조합 키에 term·content가 붙지 않는지
- API e2e: 관리자의 요약에 새 표와 `utmTrend`가 있고, 방문자에게는 utm 값이 어디에도 없는지. 틀린 `utm=`은 400
- 화면 E2E: 조합을 누르면 추이가 펼쳐지는지, 링크 생성기로 만든 주소를 열면 그 조합이 표에 1 늘어나는지, utm이 주소창에서 지워지고 새로 고쳐도 다시 가지 않는지. 마지막 것은 `e2e/analytics.spec.ts`의 "utm\_\*는 읽은 뒤 주소창에서 지운다 (다른 쿼리·조각은 그대로). 새로 고쳐도 같은 utm이 다시 가지 않는다" 시험이다.

관리자 화면은 로그인이 있어야 열리므로, 화면 E2E는 가짜 API(`e2e/fakeApi.ts`)가 관리자 요약을 돌려주게 해서 돌린다.

## 남은 것·배운 것

- 지난 날의 매체·조합은 비어 있다. 배포한 날부터 쌓인다.
- `utm_term`·`utm_content`는 따로 센다. 이 둘까지 조합 키에 붙이면 조합 수가 크게 늘어 표가 길어진다. 필요해지면 조합 추이처럼 누르면 펼치는 방식으로 더한다.
- 보내는 쪽과 받는 쪽이 같은 규칙을 써야 하는 값은 한 패키지에 함수로 둔다. 문서로 "소문자로 적자"고 약속하는 것보다 확실하다.
- 메모리에서 쓰는 구분자와 DB에 저장하는 구분자는 다르게 볼 것. 널 문자는 메모리에서는 안전하지만 PostgreSQL 글자 열에는 들어가지 않는다.

## 이 기능을 만들게 된 일

지원서에 낼 링크로 어디서 들어왔는지 보고 싶었다. 먼저 UTM 기능이 있는지 확인해 보니, 집계는 이미 출처만 세고 있었다. 생성기가 없어도 주소 뒤에 붙이기만 하면 분석은 된다는 것을 확인했고, 실제로 채용 지원에 낼 홈 화면 링크를 `?utm_source=…&utm_medium=…&utm_campaign=…` 꼴로 만들어 열어 보니 잘 잡혔다. 그 김에 활동 상태 앱의 여백·간격 손질까지 계획에 넣었고, 이 글이 그 계획의 결과다.

## 쓰는 방법

1. 관리자로 활동 상태 앱 → 유입 경로 탭을 연다
2. 위쪽 "UTM 링크 만들기"를 펼쳐 대상 주소, 출처(`linkedin`), 매체(`social`), 캠페인(`resume-2026`)을 넣는다
3. 복사 버튼으로 주소를 복사해 쓴다

그 링크로 들어온 방문은 조합 표에 `linkedin / social / resume-2026` 한 줄로 잡힌다. 시험은 `cd apps/react && npx playwright test e2e/activity.spec.ts e2e/analytics.spec.ts`. 무엇을 남기는지는 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)의 '트래픽 분석'.

참고 문서: [Google Analytics UTM 매개변수](https://support.google.com/analytics/answer/10917952).

## 관련 글

- 사이트가 utm을 처음 읽어 보낸 일: /memo/analytics-collect
- 집계 API를 만든 일: /memo/analytics-api
- 분석 앱 화면: /memo/analytics-activity-monitor
- PR: https://github.com/hyeoniverse/MacFolio/pull/253

#MacFolio #트래픽분석 #UTM
