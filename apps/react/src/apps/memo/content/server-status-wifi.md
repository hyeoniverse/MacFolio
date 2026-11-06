---
title: /health 응답 시간을 막대 수로 환산하고 no-cors 요청으로 CORS 차단을 구분하는 서버 상태 표시
date: 2026-10-07
category: 개발 기록/MacFolio/서버·API
series: 메뉴 막대
seriesOrder: 2
summary: 메뉴 막대의 Wi-Fi 아이콘이 /health를 30초마다 호출해 응답 시간과 DB 상태를 막대 수로 표시한다. PR 미리보기에서 항상 연결 불가로 표시되던 원인인 CORS 차단은 허용 목록의 * 규칙과 no-cors 재요청으로 서버 중지와 구분했다. 메뉴 잘림과 음량 창 위치도 수정했다.
---

메뉴 막대 오른쪽의 Wi-Fi 아이콘은 macOS 외형을 재현하기 위한 장식이었다. 서버를 배포한 뒤에는 서버 동작 여부를 확인하려면 `/health`를 직접 열어야 했다. 그래서 Wi-Fi 막대가 **이 사이트 서버(API)의 상태**를 표시하게 했다([#90](https://github.com/hyeoniverse/MacFolio/pull/90)). 이틀 뒤에는 PR 미리보기 주소에서 서버가 정상인데도 "서버에 연결할 수 없음"으로 표시되는 문제를 CORS 차단 상태로 구분했다([CORS 차단과 서버 중지 구분](#no-cors-요청으로-cors-차단과-서버-중지-구분)).

## 채택한 방법과 제외한 방법

| 방법                                        | 장점                                    | 단점                                                              |
| ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| 외부 상태 페이지(업타임 서비스)로 링크      | 기록과 그래프가 이미 있다               | 방문자가 사이트를 떠나야 하고, 현재 브라우저 기준의 상태가 아니다 |
| 앱마다 실패 시에만 "서버 오류" 표시         | 추가 요청이 없다                        | 사용하기 전에는 서버 상태를 알 수 없다                            |
| 메뉴 막대에서 `/health`를 주기적으로 (채택) | 사이트 어디서든 보이고, macOS 외형 유지 | 30초마다 요청이 하나씩 발생한다                                   |

`/health`는 이미 있었다. 서버가 DB에 `SELECT 1`을 실행해 성공하면 `status`·`database`·`version`을, 실패하면 [503](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503)과 "DB에 연결할 수 없습니다."를 반환한다. 프론트엔드 로딩 화면이 서버를 미리 기동(웜업)하는 데 쓰던 경로라, 같은 경로를 주기적으로 호출하기만 하면 됐다.

```ts
// apps/api/src/health/health.controller.ts
async check(): Promise<HealthResponse> {
	try {
		await this.prisma.$queryRaw`SELECT 1`;
	} catch {
		throw new ServiceUnavailableException('DB에 연결할 수 없습니다.');
	}
	return { status: 'ok', database: 'up', version: this.config.version };
}
```

## 막대 수의 의미

| 막대        | 상태                     | 기준                                                        |
| ----------- | ------------------------ | ----------------------------------------------------------- |
| 셋          | 정상                     | 300ms보다 빠르게 응답                                       |
| 둘          | 정상                     | 1초 안에 응답                                               |
| 하나        | 응답 느림                | 1초보다 오래 걸림                                           |
| 하나 (주황) | DB 연결 안 됨            | 서버는 응답하지만 `/health`가 503과 DB 메시지를 돌려줌      |
| 없음 + 사선 | 서버에 연결할 수 없음    | 응답이 없거나 다른 오류 (터널이 서버에 닿지 못하면 502·530) |
| 없음        | 이 주소에서는 쓸 수 없음 | 서버는 실행 중이지만 CORS가 이 페이지 주소를 허용하지 않음  |

![Wi-Fi 막대 수와 색으로 나타내는 서버 상태 다섯 가지와 확인 주기](./images/server-status-wifi-bars.svg '막대 수는 응답 시간, 주황은 DB, 사선은 연결할 수 없음')

막대를 누르면 macOS Wi-Fi 메뉴처럼 상태, 응답 시간, 마지막 확인 시각, 서버 주소가 표시되고, '지금 확인'과 'API 문서 열기' 항목이 있다.

![정상, DB 연결 안 됨, 서버에 연결할 수 없음의 세 메뉴](./images/server-status-wifi-menus.jpg '가짜 API로 세 상태를 만들어 찍었다. 막대 색과 사선, 메뉴 폭이 다르다')

막대 수는 작은 순수 함수가 결정한다.

```ts
// apps/react/src/shared/server/serverStatus.ts
export const SLOW_MS = 1000;
export const FAST_MS = 300;

export function barsOf({ state, latency }: Pick<ServerStatus, 'state' | 'latency'>): number {
	if (state === 'online') return latency !== null && latency < FAST_MS ? 3 : 2;
	if (state === 'slow' || state === 'database') return 1;
	return 0;
}
```

## 확인 주기

| 시점                                                                                                                                                                                                                        | 동작                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 상태를 표시하는 동안 30초마다                                                                                                                                                                                               | 확인. 탭이 숨겨져 있으면 건너뜀                  |
| 탭이 다시 보일 때([`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)), 인터넷 복구 시([`online`](https://developer.mozilla.org/en-US/docs/Web/API/Window/online_event)) | 즉시 확인                                        |
| 인터넷 끊김(`offline`)                                                                                                                                                                                                      | 서버에 요청하지 않고 '인터넷 연결 없음'으로 전환 |
| 메뉴를 열 때                                                                                                                                                                                                                | 한 번 더 확인해 최신 상태 표시                   |

- 요청은 한 번에 하나만 보낸다. 확인 중에 다시 호출하면 진행 중인 요청의 결과를 함께 기다린다.
- 6초(`TIMEOUT_MS`) 안에 응답이 없으면 요청을 중단한다.

메뉴 막대와 휴대폰 상태 표시줄이 같은 상태를 구독한다. ==구독하는 화면이 몇 개든 타이머는 하나만 동작한다==. 구독자 수를 집계해 첫 구독자가 생길 때 타이머를 등록하고, 마지막 구독자가 사라질 때 해제한다.

![감시하는 화면 수와 관계없이 타이머는 하나](./images/server-status-wifi-polling.svg 'watchers 집계가 0에서 1이 될 때만 타이머와 이벤트를 등록하고, checkServer는 진행 중인 요청을 공유한다')

결과를 상태로 분류하는 부분은 순수 함수로 분리해 단위 시험으로 확인했다. 화면 시험은 가짜 API의 `/health`를 정상 → DB 오류 → 연결 끊김 → 복구로 바꿔 가며 막대 수와 메뉴 텍스트를 확인한다.

## no-cors 요청으로 CORS 차단과 서버 중지 구분

배포한 사이트에서는 "정상"인데, PR마다 생성되는 미리보기 주소(`https://<브랜치>-macfolio.hyeoniverse.workers.dev`)에서 열면 항상 다음과 같이 표시됐다.

```text
MacFolio API · 서버에 연결할 수 없음
```

같은 시각 배포한 사이트에서는 정상이었으므로 서버는 실행 중이었다.

### 원인: 서버가 미리보기 주소를 허용하지 않는다

미리보기도 배포와 같은 빌드 설정이라 같은 API(`macfolio-api.hyeoniverse.com`)를 호출한다. 그런데 API는 [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)[^cors]로 `https://macfolio.hyeoniverse.com`에서 온 요청만 허용한다. 다른 주소의 페이지가 보낸 요청에는 `Access-Control-Allow-Origin` 헤더를 붙이지 않고, 브라우저는 그 응답을 페이지에 전달하지 않는다.

문제는 페이지 입장에서 이 상황이 **서버가 중지된 경우와 구분되지 않는다**는 점이다. 두 경우 모두 `fetch`가 `TypeError: Failed to fetch`로 실패하고, 원인은 알려 주지 않는다. 브라우저는 원인을 알려 주면 다른 사이트의 내부 정보를 추정하는 데 악용될 수 있어 ==의도적으로 숨긴다==. 그래서 상태 표시는 "연결할 수 없음"만 출력했다.

| 상황                      | 첫 요청(`cors`) 결과         | 페이지가 아는 것  |
| ------------------------- | ---------------------------- | ----------------- |
| 서버 중지                 | `TypeError: Failed to fetch` | 실패했다는 사실만 |
| 서버 실행 중, 주소 미허용 | `TypeError: Failed to fetch` | 실패했다는 사실만 |

검토한 방법은 다음과 같다.

| 방법                                                           | 장점                                                  | 단점                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| 미리보기에서는 서버 상태를 숨기기                              | 수정 범위가 작다                                      | 미리보기에서 API를 쓰는 기능을 시험할 수 없다                              |
| 서버가 모든 Origin을 허용(`*`)                                 | 모든 주소에서 동작한다                                | 쿠키를 쓰는 관리자 API까지 열린다. `credentials`와 `*`는 함께 쓸 수도 없다 |
| 허용 목록에 이름 한 칸짜리 `*` + 화면이 차단을 구분 (**채택**) | 미리보기만 좁게 허용하고, 다른 주소에서는 정확한 문구 | 서버 쪽 정규식을 직접 작성해야 하고, 화면은 요청을 한 번 더 보낸다         |

### 서버: 허용 목록의 `*`는 이름 한 칸에만 일치

허용 주소(`CORS_ORIGINS`)는 정확히 일치하는 문자열만 허용했다. 미리보기 주소는 PR마다 바뀌므로 하나씩 추가할 수 없다. 그래서 `*`를 쓸 수 있게 했다.

```text
CORS_ORIGINS=https://macfolio.hyeoniverse.com,https://*-macfolio.hyeoniverse.workers.dev
```

`*`는 **점이 없는 이름 한 칸**(영소문자, 숫자, `-`)에만 일치한다. 점까지 일치하게 두면 `https://x.evil-macfolio.hyeoniverse.workers.dev`처럼 다른 사람의 하위 도메인을 끼워 넣을 수 있다. 나머지 문자는 정규식 메타 문자로 해석되지 않게 이스케이프한 뒤, 문자열 전체가 일치해야 한다. 시험에는 허용할 주소(브랜치 이름, 버전 ID)와 차단할 주소를 함께 적었다.

- 차단하는 주소: 다른 사이트, 점이 포함된 이름, 뒤에 문자를 더 붙인 주소, 경로를 끼운 주소, `http`, 앞의 이름이 없는 `macfolio.hyeoniverse.workers.dev`

```ts
// apps/api/src/common/cors.ts
const escape = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

const patterns = allowed
	.filter((entry) => entry.includes('*'))
	.map((entry) => new RegExp(`^${entry.split('*').map(escape).join('[a-z0-9-]+')}$`));
```

`*`를 기준으로 분할해 각 조각의 메타 문자를 이스케이프하고, 그 사이에만 `[a-z0-9-]+`를 삽입한다. `^`와 `$`로 문자열 전체가 일치해야 한다. `-`를 허용한 이유는 브랜치 이름(`feat-app-menus`)에 `-`가 들어가기 때문이다.

![*가 맞는 주소와 막는 주소](./images/server-status-blocked-origin-patterns.svg '이름 한 칸에만 맞고, 점·경로·http는 막는다')

로그인 후 이동할 주소(`FRONTEND_URL`)는 별도로 지정하지 않으면 허용 주소의 첫 번째를 사용했다. 그 주소가 `*`를 포함하면 이동할 수 없으므로, `*`가 없는 첫 주소를 사용하도록 바꿨다.

### 화면: 실패하면 no-cors 요청을 한 번 더 보낸다

로컬 개발이나 허용하지 않은 다른 주소에서는 여전히 차단된다. 이때 "연결할 수 없음"은 사실과 다른 문구다. 그래서 요청이 실패하면 한 번 더 보낸다.

```ts
reachable = await fetch(`${apiUrl}/health`, { mode: 'no-cors', … }).then(
	() => true,
	() => false
);
```

[`no-cors` 요청](https://developer.mozilla.org/en-US/docs/Web/API/Request/mode)은 응답 내용을 페이지에 제공하지 않는 대신 CORS 검사를 하지 않는다. 실제 코드는 `shared/server/serverStatus.ts`의 `checkServer()`에 있고, 결과를 상태로 분류하는 작업은 순수 함수 `classify()`가 담당한다.

```ts
export function classify(result: {
	network: boolean;
	status: number | null;
	databaseDown: boolean;
	latency: number;
	reachable?: boolean;
}): ServerState {
	if (!result.network) return 'no-network';
	if (result.status === null) return result.reachable ? 'blocked' : 'offline';
	if (result.status === 503 && result.databaseDown) return 'database';
	if (result.status < 200 || result.status >= 300) return 'offline';
	return result.latency > SLOW_MS ? 'slow' : 'online';
}
```

서버가 응답하면 (내용은 읽을 수 없어도) 요청은 성공하고, 서버가 중지됐으면 마찬가지로 실패한다. 그래서 ==두 요청의 결과를 조합해 판정한다==.

| 첫 요청(`cors`) | 두 번째 요청(`no-cors`) | 판정                                        | 메뉴 문구                    |
| --------------- | ----------------------- | ------------------------------------------- | ---------------------------- |
| 성공            | 보내지 않음             | 정상 (응답 시간에 따라 `online`/`slow`)     | 정상                         |
| 실패            | 성공                    | `blocked`: 서버는 실행 중, 이 주소는 미허용 | **이 주소에서는 쓸 수 없음** |
| 실패            | 실패                    | `offline`                                   | **서버에 연결할 수 없음**    |

![CORS 요청이 실패하면 no-cors로 다시 보내 막힘과 꺼짐을 가리는 흐름](./images/server-status-blocked-origin-check.svg '두 번째 요청이 닿으면 서버는 켜져 있다')

![메뉴 막대의 서버 상태 메뉴. MacFolio API · 이 주소에서는 쓸 수 없음, 서버는 켜져 있지만 이 주소는 허용하지 않습니다](./images/server-status-blocked-origin-menu.jpg '가짜 API가 다른 주소만 허용하도록 응답한 E2E 환경에서 캡처한 차단 상태 메뉴. 신호 아이콘에 사선이 없다')

메뉴에는 "서버는 켜져 있지만 이 주소(…)는 허용하지 않습니다"를 한 줄 더 표시하고, 신호 아이콘에도 서버 중지 상태의 사선을 표시하지 않는다. 응답 시간은 읽을 수 없으므로 막대는 비운다.

두 번째 요청은 첫 요청이 실패한 경우에만 보낸다. 정상 상태에서는 30초마다 한 번으로 그대로이고, 차단된 주소에서만 두 번이 된다.

### 가짜 API로 차단 상태를 재현하기

화면 시험의 가짜 API에 '차단' 상태를 추가하면서, 허용 헤더를 빼고 응답하면 된다고 예상했다. 그러나 결과는 "정상"이었다. ==Playwright는 가로챈 요청에 응답을 생성할 때 허용 헤더가 없으면 자동으로 추가한다==. 그래서 헤더를 빼는 대신 **다른 주소만 허용한다고** 응답하게 했다. 브라우저는 그 응답을 차단하고, `no-cors` 요청만 성공한다. 실제 서버와 같은 결과다.

### 배포 서버의 환경 변수 반영

> [!WARNING] 환경 변수는 자동 배포되지 않는다
> 코드는 병합하면 자동 배포되지만, 환경 변수는 자동으로 바뀌지 않는다. 서버의 `~/deploy/api.env`에서 `CORS_ORIGINS`에 미리보기 주소를 추가하고 API 컨테이너만 재시작한다.

```bash
cd ~/deploy && docker compose up -d api
```

### 로컬과 배포의 환경 변수 파일 분리

배포 서버를 수정한 뒤 로컬(`pnpm dev:all`)에서 확인하자, 이번에는 로컬에서 연결에 실패했다. 로컬 API는 실행 중이었고 DB도 정상이었다. 허용 주소를 확인하니 `http://localhost:5173`은 없고 `https://macfolio.hyeoniverse.com`만 있었다. 서버에 넣을 값을 준비하는 과정에서 로컬 `apps/api/.env`의 `CORS_ORIGINS`가 배포 값으로 바뀌어 있었다.

로컬 API는 `.env` 하나만 읽고, 배포 서버는 서버의 `~/deploy/api.env`만 읽는다. 파일은 이미 분리되어 있었지만, 배포용 값을 기록할 위치가 따로 없어서 로컬 파일에 섞였다. 그래서 파일별 용도를 정했다.

| 파일                       | 용도                                                        | 커밋 여부                      |
| -------------------------- | ----------------------------------------------------------- | ------------------------------ |
| `apps/api/.env`            | 로컬 개발용 값만 보관                                       | 제외                           |
| `apps/api/.env.production` | 배포용 값을 개발 컴퓨터에 보관. API는 이 파일을 읽지 않는다 | 제외 (`.gitignore`의 `.env.*`) |
| 서버의 `~/deploy/api.env`  | 배포 서버가 읽는 값                                         | 저장소 밖                      |

그래도 다시 섞일 수 있으므로 API가 시작 시각에 알리게 했다. 개발 모드에서 `CORS_ORIGINS`가 로컬 프론트엔드를 허용하지 않으면 터미널에 한 줄 경고를 출력한다. 판정은 위의 `*` 규칙과 같은 함수로 한다.

```text
MacFolio API: http://localhost:4100 (문서: /docs)
⚠️ CORS_ORIGINS가 로컬 프론트엔드(http://localhost:5173)를 허용하지 않습니다: https://macfolio.hyeoniverse.com. …
```

### 이후 변경: 미리보기 주소에는 읽기만 허용

미리보기 주소를 허용한 뒤 문제가 하나 남았다. 미리보기는 저장소에 브랜치를 올릴 수 있는 사람이면 누구나 생성할 수 있는 주소인데, CORS 설정의 `credentials: true`가 모든 허용 주소에 일괄 적용되어 그 주소에도 쿠키 송수신을 허용하고 있었다. 그래서 사흘 뒤([#182](https://github.com/hyeoniverse/MacFolio/pull/182)) 허용 범위를 둘로 나눴다.

```ts
/** 허용 목록에 어떻게 맞았는지. exact: 그대로 적은 주소, pattern: *가 든 항목에 맞은 주소 */
export type OriginMatch = 'exact' | 'pattern' | null;

export function cookiesAllowedFrom(classify: (origin: string | undefined) => OriginMatch) {
	return (origin: string | undefined) => origin === undefined || classify(origin) === 'exact';
}
```

`*`로 일치한 주소는 읽기 요청만 허용하고 쿠키를 주지 않으며, 관리자 API는 그 Origin을 403으로 거절한다([PR 미리보기 origin에는 credentials 없는 CORS로 읽기만 허용하기](/memo/preview-cors-read-only)). 서버 상태 표시는 `/health`만 호출하므로 계속 "정상"으로 표시된다.

## 메뉴가 화면 끝에서 잘린 문제

Wi-Fi 메뉴는 화면 오른쪽 끝에서 열린다. 메뉴는 열 때 크기를 측정해 화면 안쪽으로 위치를 보정하는데, 이 메뉴는 열면서 서버를 다시 확인한다. '정상'이던 텍스트가 '서버에 연결할 수 없음'으로 길어지면, ==이미 정한 위치에서 폭이 줄어 텍스트가 줄바꿈되고 끝이 잘렸다==. 처음 측정한 폭은 188px, 전체 폭은 252px였다.

공통 메뉴가 [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)로 자기 크기를 감시하다가 커지면 위치를 다시 보정하게 했다.

```ts
// apps/react/src/shared/ui/menu/Menu.tsx
const resize = new ResizeObserver(place);
resize.observe(menu);
return () => resize.disconnect();
```

위 캡처의 세 메뉴도 폭이 다르다. 오른쪽의 '서버에 연결할 수 없음'이 가장 넓다. 크기는 [`getBoundingClientRect`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) 대신 [`offsetWidth`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth)로 측정한다.

| API                       | `transform: scale()` 반영      | 소수점                |
| ------------------------- | ------------------------------ | --------------------- |
| `getBoundingClientRect()` | 반영 (애니메이션 중 작게 측정) | 유지                  |
| `offsetWidth`             | 미반영 (레이아웃 크기)         | 반올림 (252.25 → 252) |

메뉴 등장 애니메이션(scale) 중에 측정하면 실제보다 작게 측정되므로 `offsetWidth`를 쓰고, 반올림으로 잘리는 폭을 보완하기 위해 1px를 더한다. Apple 메뉴, 컨텍스트 메뉴처럼 같은 메뉴 컴포넌트를 쓰는 곳이 모두 함께 수정됐다.

## 음량 창 위치가 어긋난 문제

Wi-Fi 위치의 아이콘을 바꾸자 음량 창이 음량 아이콘에서 벗어난 위치에 열렸다. 음량 창의 위치가 CSS에 `right: 8.5rem`으로 고정되어 있어서, 오른쪽 아이콘의 폭이 바뀌면 어긋나는 구조였다. 처음에는 클릭 시 아이콘 위치를 측정해 전달하도록 수정했는데, ==고정 숫자 대신 측정값을 넣었을 뿐 구조는 그대로였다==.

| 기존 구조                                                 | 문제                                   |
| --------------------------------------------------------- | -------------------------------------- |
| 메뉴 막대(StatusBar)가 음량 창의 열림 상태를 보유         | 메뉴 막대가 음량 창의 세부 사항에 의존 |
| 음량 아이콘이 버튼이 아닌 `<i onClick>`                   | 키보드로 열 수 없음                    |
| 바깥 클릭 시 닫기 위해 화면 전체를 투명한 오버레이로 덮음 | 다른 요소의 클릭을 가로챔              |

메뉴 막대는 넘치는 영역을 잘라 내므로(`overflow: hidden`) 음량 창을 아이콘 안에 두고 CSS만으로 표시할 수 없다. 그래서 Apple 메뉴·서버 상태처럼 **버튼과 팝오버를 함께 가진 메뉴 막대 항목**(`VolumeMenu`)으로 바꿨다. 팝오버는 body에 렌더링하고, 위치는 다른 팝오버와 같은 공통 함수(`placeBelow`)로, 닫기는 공통 `useDismiss`(바깥 클릭, Esc)로 처리한다. 메뉴 막대는 이제 `<VolumeMenu />` 한 줄만 포함한다.

같은 PR에서 메뉴 막대 글자 굵기도 macOS에 맞췄다. 막대 전체가 굵게(700) 지정되어 있던 것을 보통 굵기로 바꾸고, 맨 앞 앱 이름(Finder)만 굵게 유지한다.

## macOS에서만 실패하던 타입 검사

작업 중 타입 검사가 macOS에서만 실패했다. GitHub 앱이 `GithubActivity.tsx`(화면)와 `githubActivity.ts`(데이터)를 함께 사용하는데, 두 파일 이름이 대소문자만 다르다.

| 환경              | 파일 시스템     | `'@/apps/github/GithubActivity'` 해석 결과 |
| ----------------- | --------------- | ------------------------------------------ |
| Linux (CI)        | 대소문자 구분   | `GithubActivity.tsx` (의도한 화면 파일)    |
| macOS (기본 APFS) | 대소문자 비구분 | `githubActivity.ts` (`.ts`를 먼저 탐색)    |

화면 파일 이름을 `GithubContributions.tsx`로 바꿔 해결했다.

## 시험

| 시험                                        | 확인 내용                                                                                                                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/server/serverStatus.test.ts` (단위) | 응답 코드·응답 시간·DB 상태로 상태 분류, 막대 수, `checkServer`가 `/health` 응답을 상태로 저장하는지, `classify()`에 차단과 중지를 입력해 상태 판정                                                                          |
| `e2e/server-status.spec.ts`                 | 정상이면 막대가 채워지고 메뉴에 상태·응답 시간·주소가 표시되는지, 'API 문서 열기'가 사이트 안의 API 문서 앱으로 열리는지, 가짜 API의 `/health`를 DB 오류 → 연결 끊김 → 복구 → `'blocked'`로 바꿔 가며 막대와 문구가 바뀌는지 |
| `apps/api/src/common/cors.test.ts` (서버)   | `*` 그림의 허용·차단 주소를 그대로 검사                                                                                                                                                                                      |

위 캡처는 미리보기 빌드에 가짜 API를 연결해 각 상태를 차례로 만들어 캡처했다.

## 진단 방법

메뉴 막대에 "서버에 연결할 수 없음"이 표시되면 먼저 서버가 실제로 중지됐는지, 주소가 차단됐는지를 구분한다.

```bash
curl -s https://macfolio-api.hyeoniverse.com/health; echo            # 서버 자체
curl -s -o /dev/null -w '%{http_code}\n' -H "Origin: <사이트 주소>" \
  https://macfolio-api.hyeoniverse.com/health                          # 그 주소를 허용하는지
```

첫 줄이 `{"status":"ok",…}`인데 화면에 연결할 수 없다고 표시되면 CORS 문제다. 서버 `api.env`의 `CORS_ORIGINS`에 그 주소를 추가하고 `docker compose up -d api`를 실행한다. 로컬이면 `apps/api/.env`의 `CORS_ORIGINS`에 `http://localhost:5173`이 있는지 확인한다. 판정 코드는 [apps/react/src/shared/server/serverStatus.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/shared/server/serverStatus.ts), 시험은 `cd apps/react && npx playwright test e2e/server-status.spec.ts`.

참고 문서: [MDN CORS 오류](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors).

## 남은 것과 배운 것

- **현재 브라우저 기준의 상태다.** 방문자의 네트워크가 느리면 서버가 정상이어도 '응답 느림'으로 표시된다. 서버 중단 알림은 별도의 업타임 모니터링이 담당한다([GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs)).
- **브라우저는 실패 원인을 숨긴다.** CORS 실패와 연결 실패는 페이지에서 같은 `TypeError`다. 다른 모드(`no-cors`)로 한 번 더 요청해야 둘을 구분할 수 있었다.
- **`*`는 가장 좁게 일치시킨다.** 이름 한 칸, 영소문자·숫자·`-`만, 문자열 전체 일치. 범위가 넓은 정규식은 다른 사람의 하위 도메인까지 허용한다.
- **로컬과 배포의 값은 파일로 분리한다.** 값이 섞인 원인은 배포용 값을 기록할 위치가 없었기 때문이다. 위치를 정하고, 값이 섞이면 API가 시작 시각에 경고를 출력하게 해 같은 문제를 즉시 발견할 수 있다.
- **고정 위치는 인접 요소가 바뀌면 어긋난다.** 음량 창의 `right: 8.5rem`처럼 인접 요소의 폭에 의존하는 숫자는, 인접 요소가 바뀌는 시각에 버그가 된다. 팝오버는 기준 요소를 측정해 배치하는 공통 함수 하나로 통합하는 편이 낫다.
- **대소문자만 다른 파일 이름은 만들지 않는다.** CI(Linux)에서는 통과하고 macOS에서만 실패한다.

## 관련 글

- [Always Free 유휴 회수 기준을 충전량으로 환산한 메뉴 막대 배터리](/memo/battery-server-resources): 같은 메뉴 막대의 서버 자원 표시
- [GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs): 브라우저 밖에서 서버 중단을 감지하는 감시
- [PR 미리보기 origin에는 credentials 없는 CORS로 읽기만 허용하기](/memo/preview-cors-read-only): 미리보기 주소의 쿠키 송수신 차단
- [placement·useDismiss·Menu 세 모듈로 중복된 메뉴 구현 합치기](/memo/shared-menu): 음량 창이 사용하는 공통 팝오버 모듈
- [공통 API 클라이언트 api()·apiFetch()로 fetch 호출과 401 처리 통합하기](/memo/shared-modules#서버-호출-apiapifetch): 서버 호출 공통 함수
- [Semgrep·pnpm audit·osv-scanner로 코드와 의존성 취약점 점검하기](/memo/security-scan): 같은 시기의 보안 점검

[^cors]: Cross-Origin Resource Sharing. 브라우저가 다른 출처(origin)로 보낸 요청의 응답을 페이지에 넘겨도 되는지, 서버의 `Access-Control-Allow-Origin` 응답 헤더로 판단하는 규칙.

#MacFolio #데스크톱 #메뉴막대 #서버 #CORS
