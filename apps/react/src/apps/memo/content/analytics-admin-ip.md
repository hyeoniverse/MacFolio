---
title: HMAC으로 IP 원문 없이 관리자 방문 식별하기
date: 2026-10-23
category: 개발 기록/MacFolio/API·데이터
series: 트래픽 분석
seriesOrder: 11
summary: 로그인하지 않은 기기에서 둘러본 관리자 방문이 집계에 섞였다. 관리자로 인증된 요청의 IP를 HMAC으로만 30일 보관해 그 IP의 방문을 제외한다. 실시간 탭은 30분에서 마스킹된 IP 보관 기간인 7일까지 넓히고 IP별 방문 표를 더했으며, 맥 Safari에서 정렬하면 이름이 사라지던 표를 고쳤다.
---

'활동 상태 보기'의 실시간 탭으로 방문을 확인하던 중 두 가지가 불편했다. 첫째, 관리자 본인의 방문이 섞였다. 서버는 **관리자 세션 쿠키가 붙은 방문**만 제외했으므로, 로그인하지 않은 휴대폰이나 다른 브라우저로 사이트를 확인하면 일반 방문으로 집계되었다. 실시간 탭의 IP에도 관리자 IP가 나타났다. 둘째, 실시간 탭은 **최근 30분**만 조회했다. 서버는 마스킹된 IP를 7일 동안 보관하는데 화면은 그중 30분만 사용해, 30분이 지난 방문은 IP와 흐름을 확인할 곳이 없었다.

변경은 [#337](https://github.com/hyeoniverse/MacFolio/pull/337)(관리자 IP 제외)과 [#333](https://github.com/hyeoniverse/MacFolio/pull/333)(실시간 7일, IP 표, Safari 정렬 문제)이다.

## 관리자 IP를 HMAC으로 기록하고 그 IP의 방문을 제외

관리자로 인증된 요청이 오면 그 IP를 HMAC으로 변환해 `AdminIp` 표에 기록한다. 방문 이벤트를 받으면 관리자 세션이 있거나, 세션이 없어도 요청 IP가 `AdminIp`에 있으면 저장하지 않는다.

![관리자로 인증된 요청(로그인 콜백, AdminGuard 통과, 세션 쿠키가 붙은 방문 이벤트)이 remember(ip)로 HMAC을 AdminIp 표에 기록하고, 방문 이벤트는 관리자 세션 또는 AdminIp에 있는 IP면 저장하지 않는다](./images/analytics-admin-ip-flow.svg '관리자 IP 기록과 판정 (도식)')

| 위치                                   | 변경                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `prisma/schema.prisma`                 | `AdminIp` 표: `ipHash` 기본 키, `lastSeenAt` 인덱스                       |
| 마이그레이션 `20261023130000_admin_ip` | 새 표만 만든다. 배포가 이미지를 되돌려도 이전 코드는 이 표를 쓰지 않는다  |
| `auth/admin-ip.service.ts` (신규)      | `remember(ip)`로 기록, `isAdminIp(ip)`로 판정                             |
| `auth/admin.guard.ts`                  | 관리자 인증을 통과한 요청의 IP를 기록 (관리자가 사이트를 열면 `/auth/me`) |
| `auth/auth.controller.ts`              | GitHub 로그인 콜백에서 세션을 발급한 직후 IP를 기록                       |
| `analytics/analytics.controller.ts`    | 방문 이벤트에 관리자 세션이 있으면 IP를 기록, 없으면 `isAdminIp`로 판정   |

방문 이벤트 처리 코드는 아래와 같다. `admin`이 참이면 `AnalyticsRecorderService.record`는 아무것도 저장하지 않고 204를 응답한다.

```ts
const ip = request.ip ?? '';
// 관리자 세션이 있거나, 로그인하지 않았어도 관리자가 쓰는 IP면 세지 않는다
const admin = await this.auth.findAdmin(request.cookies?.[SESSION_COOKIE]);
if (admin) await this.adminIps.remember(ip);
await this.recorder.record(body, {
	ip,
	userAgent: request.headers['user-agent'],
	country: request.headers['cf-ipcountry'],
	admin: !!admin || (await this.adminIps.isAdminIp(ip)),
});
```

### 쓰기와 읽기 횟수

`AdminGuard`는 관리자 경로마다 실행되고, 방문 이벤트는 5초마다 도착한다. 매번 DB를 조회하지 않도록 두 값을 메모리에 보관한다.

| 상수            | 값   | 동작                                                                         |
| --------------- | ---- | ---------------------------------------------------------------------------- |
| `TOUCH_MS`      | 10분 | 같은 IP의 `upsert`는 10분에 한 번. 마지막 기록 시각을 `Map`에 보관           |
| `CACHE_MS`      | 1분  | `isAdminIp`는 메모리 `Set`으로 판정하고 1분이 지나면 DB에서 목록을 다시 조회 |
| `ADMIN_IP_DAYS` | 30일 | 다시 조회하기 전에 `lastSeenAt`이 30일 지난 행을 삭제                        |

`remember`는 DB에 쓴 직후 메모리 `Set`에도 해시를 추가한다. 그래서 관리자가 로그인한 직후의 방문도 1분을 기다리지 않고 제외된다.

### 개인정보: IP 원문은 저장하지 않는다

```ts
createHmac('sha256', this.config.ipHashSecret).update(`admin-ip:${ip}`).digest('hex');
```

- **HMAC만 저장한다.** IPv4 주소는 약 43억 개라, 키 없는 SHA-256 해시는 모든 주소를 대입해 원문을 복원할 수 있다. 서버만 아는 `IP_HASH_SECRET`을 키로 쓰는 HMAC은 키 없이는 대입이 불가능하다. API e2e 시험이 `AdminIp`에 64자 16진수만 있고 IP 원문은 없는지 확인한다.
- **용도별 접두어.** 댓글·메시지의 요청 제한용 IP 해시와 같은 키를 쓰지만 `admin-ip:` 접두어를 붙인다. 같은 IP라도 표마다 해시 값이 달라 두 표를 IP로 연결할 수 없다.
- **보관 기간은 마지막 관리자 요청 후 30일.** 관리자가 쓰던 IP가 바뀌거나 그 IP를 다른 사람이 받게 되어도 30일 뒤에는 다시 집계된다.
- **방문 기록 쪽은 그대로다.** `AnalyticsEvent`에는 마지막 자리를 마스킹한 IP(`203.0.113.x`)만 7일 보관하고, 7일이 지나면 `null`로 바꾼다([쿠키 없이 하루 해시로 순방문자를 집계하는 분석 API](/memo/analytics-api)).

규칙은 [개인정보 문서](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)의 '집계에서 제외하는 방문'과 '보관 기간'에도 추가했다.

### 한계

- **같은 공유기 뒤의 다른 방문자도 30일 동안 제외된다.** 서버가 보는 IP는 공유기의 공인 IP 하나다. 개인 포트폴리오 사이트라 이 손실을 받아들인다.
- **IP가 자주 바뀌는 망은 한 번 인증해야 제외된다.** 휴대폰 데이터처럼 IP가 바뀌면, 새 IP에서 관리자 요청(로그인한 상태로 사이트 열기 등)이 한 번은 있어야 `AdminIp`에 기록된다.
- **과거 방문은 소급해서 제외할 수 없다.** 저장된 방문에는 IP 원문이 없고 마스킹된 IP는 `/24` 대역이라, `AdminIp`의 HMAC과 대조할 값이 없다. 이 변경 이전의 관리자 방문은 집계에 남는다.

## 실시간 탭을 7일까지

실시간 탭에도 다른 탭과 같은 위치에 `기간` 선택을 추가했다. 30분, 3시간, 24시간, 7일이다. 7일은 서버가 마스킹된 IP를 보관하는 기간(`IP_RETENTION_DAYS = 7`)과 같다. 그보다 오래된 방문은 IP가 이미 삭제되어 IP별로 묶을 수 없다.

![활동 상태 보기의 실시간 탭. 기간 선택 없이 '최근 30분 · 1개 방문' 목록 하나와 그 방문의 흐름 4단계](./images/analytics-admin-ip-live-before.jpg '전: 최근 30분, 방문 목록만 (가짜 데이터, 문서용 IP 대역)')

![기간 7일을 고른 실시간 탭. 위에 IP 표(203.0.113.x 2회 67%, 198.51.100.x 1회 33%), 아래에 '최근 7일 · 3개 방문' 목록](./images/analytics-admin-ip-live-after-7d.jpg '후: 기간 7일, IP 표와 방문 목록 (가짜 데이터)')

- **IP 표**: 고른 기간의 방문을 마스킹된 IP별로 집계한다(`model.ts`의 `visitsByIp`). 많은 순이고 다른 표처럼 정렬을 바꿀 수 있다. IP가 삭제된 방문은 `알 수 없음`으로 묶는다.
- **IP로 필터링**: IP를 누르면 아래 방문 목록이 그 IP의 방문만 남고 제목이 `203.0.113.x · 2개 방문`으로 바뀐다. 다시 누르면 전체로 돌아간다.
- **흐름**: 방문을 누르면 들어옴 → 앱 열기 → 글 조회 → 링크 클릭이 시각 순으로 펼쳐진다.
- **날짜**: 오늘이 아닌 방문은 시각 앞에 날짜를 붙인다(`10/5 20:04:00`). 시각 칸 너비를 70px에서 100px로(휴대폰 64px → 96px) 늘려 날짜가 잘리지 않게 했다.

![IP 203.0.113.x를 눌러 방문 목록이 2개로 필터링되고, 그중 10/5 20:04:00 방문의 흐름(들어옴, 메모 › post-editor 보기)이 펼쳐진 화면](./images/analytics-admin-ip-live-after-ip.jpg '후: IP를 눌러 필터링한 방문과 펼친 흐름 (가짜 데이터)')

휴대폰에서는 방문 목록의 IP 칸을 숨기므로 IP 표가 IP를 확인하는 유일한 위치다.

![휴대폰 화면의 실시간 탭. 탭 줄 아래 기간 7일, IP 표, 203.0.113.x로 필터링한 방문 2개와 펼친 흐름](./images/analytics-admin-ip-live-after-mobile.jpg '후 (휴대폰): IP 표, 필터링한 목록, 펼친 흐름 (가짜 데이터)')

### API: `GET /analytics/live?minutes=`

| 항목           | 전                       | 후                                                       |
| -------------- | ------------------------ | -------------------------------------------------------- |
| `minutes` 최대 | 1440 (24시간)            | **10080 (7일)**. 더 큰 값은 7일로 제한                   |
| 조회 순서      | `createdAt asc`, 5,000개 | **`createdAt desc, id desc`**, 20,000개 → 뒤집어 시간 순 |
| 응답 형식      | 변경 없음                | 변경 없음                                                |

조회 순서를 바꾼 이유는 상한에 도달했을 때 잘리는 쪽이다. 오래된 것부터 읽으면 기간을 늘린 순간 상한을 넘는 쪽, 즉 가장 최근 방문이 빠진다. 최대 24시간에서는 이벤트가 5,000개에 도달하지 않아 드러나지 않았다. 최근 것부터 읽으면 상한을 넘어도 가장 오래된 쪽이 잘린다.

![전 방식으로 7일을 읽으면 오래된 5,000개만 읽고 최근 3,000개가 잘린다. 후에는 최근 것부터 20,000개까지 읽어 8,000개를 모두 읽는다](./images/analytics-admin-ip-live-read.svg '7일 이벤트 8,000개를 읽는 순서 (도식)')

```ts
const minutes = Math.min(Math.max(Number(minutesInput) || 30, 1), LIVE_MAX_MINUTES);
// 많으면 최근 것부터 자른다
const events = (
	await this.prisma.analyticsEvent.findMany({
		where: { createdAt: { gte: new Date(now.getTime() - minutes * 60_000) } },
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		take: LIVE_EVENT_LIMIT,
	})
).reverse();
```

`LIVE_MAX_MINUTES`는 `IP_RETENTION_DAYS * 24 * 60`으로 계산해 보관 기간과 함께 바뀐다. 응답 형식이 같아 API와 사이트 중 어느 쪽이 먼저 배포되어도 동작한다. 사이트만 먼저 배포되면 7일을 골라도 이전 서버가 24시간으로 제한하고, API만 먼저 배포되면 이전 화면이 30분을 조회한다. DB 마이그레이션은 없다.

### 갱신 간격

실시간 탭은 [visibilityState와 지수 백오프로 보이는 동안만 폴링하는 usePolling 훅과 같은 요청 묶기](/memo/activity-live-refresh)의 `usePolling`으로 갱신한다. 7일치 이벤트를 10초마다 다시 조회하지 않도록 기간에 따라 간격을 나눴다.

```ts
intervalMs: liveMinutes > 30 ? LIVE_SLOW_POLL_MS : LIVE_POLL_MS, // 60초 : 10초
resetKey: String(liveMinutes),
```

| 기간       | 간격 | 1시간당 요청 |
| ---------- | ---- | ------------ |
| 30분       | 10초 | 360          |
| 3시간 이상 | 60초 | 60           |

기간을 바꾸면 `resetKey`가 바뀌어 진행 중인 응답을 버리고 바로 다시 조회한다.

## 맥 Safari에서 정렬하면 이름이 사라지던 표

### 증상

유입 경로 탭의 `출처 / 매체 / 캠페인` 표에서 머리(이름·방문)를 눌러 정렬을 바꾸면, 숫자와 비율 막대는 보이는데 **이름 칸만 빈칸**이 되었다. 같은 탭의 다른 표(묶어 보기, 들어온 곳, 캠페인·출처·매체)는 정렬을 바꿔도 이름이 보였다.

### 원인 (추정)

맥 Safari에서만 발생했다. Chromium, Playwright WebKit, 휴대폰 화면에서는 가짜 데이터로 여러 차례 시도해도 재현되지 않았다. 그래서 아래 원인은 **추정**이다.

다른 표와의 차이는 하나다. 이 표만 이름 칸이 **버튼**이다(누르면 그 조합의 일별 방문을 펼친다). 그리고 `StatTable`은 정렬이 바뀌면 `tbody`의 `key`를 바꿔 새로 만들고, 새 `tbody`에 `.motion-swap`(`animation: fade-in`, opacity 0 → 1)을 건다.

| 조건                                 | 결과          |
| ------------------------------------ | ------------- |
| 처음 렌더링 (페이드 없음)            | 이름이 보인다 |
| 정렬 변경, 이름이 글자인 표 + 페이드 | 이름이 보인다 |
| 정렬 변경, 이름이 버튼인 표 + 페이드 | **빈칸**      |

이름 버튼에는 말줄임을 위한 `overflow: hidden`과 `text-overflow: ellipsis`가 적용되어 있다. 세 조건을 비교하면 '새로 만든 버튼 + 부모의 opacity 애니메이션' 조합에서 Safari가 버튼 안의 글자를 그리지 않는 것으로 판단했다.

### 고친 방법

이름이 버튼인 표(`onSelect`가 있는 표)는 정렬할 때 `tbody`를 다시 만들지 않고 페이드도 걸지 않는다. 줄 순서만 바뀐다. 다른 표는 이전과 같이 페이드가 걸린다. CSS와 버튼의 말줄임은 바꾸지 않았다(`apps/activity/StatTable.tsx`).

```tsx
{/* 정렬을 바꾸면 줄이 서서히 다시 놓인다. 이름이 버튼인 표는 빼는데, 맥 Safari에서 다시 그린 줄의
    버튼 글자가 그려지지 않고 사라진다 */}
<tbody
	key={onSelect ? undefined : `${sort.key}-${sort.descending}`}
	className={onSelect ? undefined : 'motion-swap'}
>
```

![전: 정렬 변경 → tbody key 변경 → tbody 재생성과 페이드 → 버튼 글자가 그려지지 않음. 후: onSelect가 있는 표는 tbody를 유지하고 줄 순서만 바꿔 글자가 보임](./images/analytics-admin-ip-sort-fade.svg 'StatTable 정렬 전후 (도식)')

## 확인

- **API e2e** (`analytics`·`routes`·`errors`·`write-throttle`, 27개)
  - 관리자로 `/auth/me`를 호출하면 그 IP가 64자 16진수 HMAC으로만 기록된다(IP 원문 없음).
  - 같은 IP에서 쿠키 없이 보낸 방문은 저장되지 않는다.
  - 마지막 기록이 30일을 넘기면 행이 삭제되고 다시 집계된다.
  - 기존 시험은 모두 같은 IP(`127.0.0.1`)에서 요청하므로, 시험마다 기록된 관리자 IP를 비운다(`AdminIpService.reset()`과 표 삭제).
  - `minutes` 기본값은 30분이고, 3일 전 방문은 `minutes`를 늘리면 조회되며, 7일보다 큰 값은 7일로 제한된다.
- **단위 시험**: `visitsByIp`가 IP별 방문 수를 많은 순으로 반환하고, IP가 삭제된 방문은 빈 키로 묶는다.
- **E2E** (`activity.spec.ts`, 15개를 4회 반복해 60개 통과): 기간을 7일로 바꾸면 `?minutes=10080`으로 조회 → 3개 방문 → IP 표 순서 → IP를 눌러 2개로 필터링 → 흐름 펼침 → 다시 눌러 전체.
- **휴대폰 E2E**: 날짜가 붙은 시각 칸이 잘리지 않는다(위 휴대폰 캡처).

## 남은 것

- Safari 정렬 문제는 자동 시험 브라우저에서 재현되지 않아 회귀 시험이 없다. 같은 표의 구조(이름 버튼, `tbody` 재생성, 페이드)를 바꿀 때는 맥 Safari에서 직접 확인해야 한다.
- 관리자 IP 제외는 이 변경 이후의 방문에만 적용된다. 이전 기간의 방문 수에는 관리자 방문이 섞여 있다.
- 실시간 조회는 이벤트 20,000개가 상한이다. 7일 이벤트가 이를 넘으면 가장 오래된 방문이 화면에서 빠진다. 방문이 그 수준으로 늘면 IP 표를 서버에서 집계하는 경로가 필요하다.

## 관련 글

- [쿠키 없이 하루 해시로 순방문자를 집계하는 분석 API](/memo/analytics-api): 마스킹된 IP와 일별 해시, 보관 기간
- [차트 라이브러리 없이 SVG 하나로 그리는 지표 그래프](/memo/analytics-activity-monitor): 실시간 탭과 StatTable을 만든 글
- [출처·매체·캠페인 조합 키로 집계하는 UTM 분석](/memo/utm-analytics): 이름이 버튼인 `출처 / 매체 / 캠페인` 표를 만든 글
- [visibilityState와 지수 백오프로 보이는 동안만 폴링하는 usePolling 훅과 같은 요청 묶기](/memo/activity-live-refresh): 실시간 탭의 usePolling
- [no-cors 요청인 sendBeacon에도 적용되는 Cross-Origin-Resource-Policy](/memo/analytics-beacon-corp): 같은 주의 Safari 전용 문제
- [macOS Safari와 iOS Safari의 렌더링 차이 — 브라우저별로 주의할 점](/memo/safari-macos-ios-rendering): Safari 렌더링 차이 정리

#MacFolio #트래픽분석 #개인정보 #HMAC #Safari #NestJS
