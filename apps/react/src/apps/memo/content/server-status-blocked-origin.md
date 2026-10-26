---
title: 서버는 켜져 있는데 "서버에 연결할 수 없음"
date: 2026-10-07
category: 개발 기록/MacFolio/배포·운영
summary: PR 미리보기 주소에서 메뉴 막대의 서버 상태가 항상 "서버에 연결할 수 없음"이었다. 서버는 정상이었고 그 주소를 CORS로 허용하지 않은 것이 원인이었다. 서버는 허용 주소에 *를 쓸 수 있게 하고, 화면은 no-cors 요청을 한 번 더 보내 차단과 중지를 구분했다.
---

메뉴 막대의 Wi-Fi 위치에는 서버 상태 표시가 있다([메뉴 막대의 Wi-Fi 자리에 서버 상태 띄우기](/memo/server-status-wifi)). 배포한 사이트에서는 "정상"인데, PR마다 생성되는 미리보기 주소(`https://<브랜치>-macfolio.hyeoniverse.workers.dev`)에서 열면 항상 다음과 같이 표시됐다.

```text
MacFolio API · 서버에 연결할 수 없음
```

같은 시각 배포한 사이트에서는 정상이었으므로 서버는 실행 중이었다.

## 원인: 서버가 그 주소를 허용하지 않는다

미리보기도 배포와 같은 빌드 설정이라 같은 API(`macfolio-api.hyeoniverse.com`)를 호출한다. 그런데 API는 [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)[^cors]로 `https://macfolio.hyeoniverse.com`에서 온 요청만 허용한다. 다른 주소의 페이지가 보낸 요청에는 `Access-Control-Allow-Origin` 헤더를 붙이지 않고, 브라우저는 그 응답을 페이지에 전달하지 않는다.

문제는 페이지 입장에서 이 상황이 **서버가 중지된 경우와 구분되지 않는다**는 점이다. 두 경우 모두 `fetch`가 `TypeError: Failed to fetch`로 실패하고, 원인은 알려 주지 않는다. 브라우저는 원인을 알려 주면 다른 사이트의 내부 정보를 추정하는 데 악용될 수 있어 의도적으로 숨긴다. 그래서 상태 표시는 "연결할 수 없음"만 출력했다.

| 상황                      | 첫 요청(`cors`) 결과         | 페이지가 아는 것  |
| ------------------------- | ---------------------------- | ----------------- |
| 서버 중지                 | `TypeError: Failed to fetch` | 실패했다는 사실만 |
| 서버 실행 중, 주소 미허용 | `TypeError: Failed to fetch` | 실패했다는 사실만 |

## 두 가지 수정

검토한 방법은 다음과 같다.

| 방법                                                           | 장점                                                  | 단점                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| 미리보기에서는 서버 상태를 숨기기                              | 수정 범위가 작다                                      | 미리보기에서 API를 쓰는 기능을 시험할 수 없다                              |
| 서버가 모든 Origin을 허용(`*`)                                 | 모든 주소에서 동작한다                                | 쿠키를 쓰는 관리자 API까지 열린다. `credentials`와 `*`는 함께 쓸 수도 없다 |
| 허용 목록에 이름 한 칸짜리 `*` + 화면이 차단을 구분 (**채택**) | 미리보기만 좁게 허용하고, 다른 주소에서는 정확한 문구 | 서버 쪽 정규식을 직접 작성해야 하고, 화면은 요청을 한 번 더 보낸다         |

### 1. 미리보기 주소를 허용한다 (서버)

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

### 2. 차단과 서버 중지를 구분한다 (프론트엔드)

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

서버가 응답하면 (내용은 읽을 수 없어도) 요청은 성공하고, 서버가 중지됐으면 마찬가지로 실패한다. 그래서 두 요청의 결과를 조합해 판정한다.

| 첫 요청(`cors`) | 두 번째 요청(`no-cors`) | 판정                                        | 메뉴 문구                    |
| --------------- | ----------------------- | ------------------------------------------- | ---------------------------- |
| 성공            | 보내지 않음             | 정상 (응답 시간에 따라 `online`/`slow`)     | 정상                         |
| 실패            | 성공                    | `blocked`: 서버는 실행 중, 이 주소는 미허용 | **이 주소에서는 쓸 수 없음** |
| 실패            | 실패                    | `offline`                                   | **서버에 연결할 수 없음**    |

![CORS 요청이 실패하면 no-cors로 다시 보내 막힘과 꺼짐을 가리는 흐름](./images/server-status-blocked-origin-check.svg '두 번째 요청이 닿으면 서버는 켜져 있다')

![메뉴 막대의 서버 상태 메뉴. MacFolio API · 이 주소에서는 쓸 수 없음, 서버는 켜져 있지만 이 주소는 허용하지 않습니다](./images/server-status-blocked-origin-menu.jpg '가짜 API가 다른 주소만 허용하도록 응답한 E2E 환경에서 캡처한 차단 상태 메뉴. 신호 아이콘에 사선이 없다')

메뉴에는 "서버는 켜져 있지만 이 주소(…)는 허용하지 않습니다"를 한 줄 더 표시하고, 신호 아이콘에도 서버 중지 상태의 사선을 표시하지 않는다. 응답 시간은 읽을 수 없으므로 막대는 비운다.

두 번째 요청은 첫 요청이 실패한 경우에만 보낸다. 정상 상태에서는 30초마다 한 번으로 그대로이고, 차단된 주소에서만 두 번이 된다.

## 시험 작성 중 발견한 문제

화면 시험의 가짜 API에 '차단' 상태를 추가하면서, 허용 헤더를 빼고 응답하면 된다고 예상했다. 그러나 결과는 "정상"이었다. Playwright는 가로챈 요청에 응답을 생성할 때 허용 헤더가 없으면 자동으로 추가한다. 그래서 헤더를 빼는 대신 **다른 주소만 허용한다고** 응답하게 했다. 브라우저는 그 응답을 차단하고, `no-cors` 요청만 성공한다. 실제 서버와 같은 결과다.

| 시험                          | 확인 내용                                                      |
| ----------------------------- | -------------------------------------------------------------- |
| `serverStatus.test.ts` (단위) | `classify()`에 차단과 중지를 입력해 상태 판정                  |
| `e2e/server-status.spec.ts`   | 가짜 API의 `health`를 `'blocked'`로 바꿔 메뉴 문구와 막대 확인 |
| `common/cors.test.ts` (서버)  | 위 그림의 허용·차단 주소를 그대로 검사                         |

## 서버 작업

코드는 병합하면 자동 배포되지만, 환경 변수는 자동으로 바뀌지 않는다. 서버의 `~/deploy/api.env`에서 `CORS_ORIGINS`에 미리보기 주소를 추가하고 API 컨테이너만 재시작한다.

```bash
cd ~/deploy && docker compose up -d api
```

## 로컬에서도 "연결할 수 없음"

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

## 이후 변경: 미리보기 주소에는 읽기만 허용

미리보기 주소를 허용한 뒤 문제가 하나 남았다. 미리보기는 저장소에 브랜치를 올릴 수 있는 사람이면 누구나 생성할 수 있는 주소인데, CORS 설정의 `credentials: true`가 모든 허용 주소에 일괄 적용되어 그 주소에도 쿠키 송수신을 허용하고 있었다. 그래서 사흘 뒤([#182](https://github.com/hyeoniverse/MacFolio/pull/182)) 허용 범위를 둘로 나눴다.

```ts
/** 허용 목록에 어떻게 맞았는지. exact: 그대로 적은 주소, pattern: *가 든 항목에 맞은 주소 */
export type OriginMatch = 'exact' | 'pattern' | null;

export function cookiesAllowedFrom(classify: (origin: string | undefined) => OriginMatch) {
	return (origin: string | undefined) => origin === undefined || classify(origin) === 'exact';
}
```

`*`로 일치한 주소는 읽기 요청만 허용하고 쿠키를 주지 않으며, 관리자 API는 그 Origin을 403으로 거절한다([PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기](/memo/preview-cors-read-only)). 서버 상태 표시는 `/health`만 호출하므로 계속 "정상"으로 표시된다.

## 진단 방법

메뉴 막대에 "서버에 연결할 수 없음"이 표시되면 먼저 서버가 실제로 중지됐는지, 주소가 차단됐는지를 구분한다.

```bash
curl -s https://macfolio-api.hyeoniverse.com/health; echo            # 서버 자체
curl -s -o /dev/null -w '%{http_code}\n' -H "Origin: <사이트 주소>" \
  https://macfolio-api.hyeoniverse.com/health                          # 그 주소를 허용하는지
```

첫 줄이 `{"status":"ok",…}`인데 화면에 연결할 수 없다고 표시되면 CORS 문제다. 서버 `api.env`의 `CORS_ORIGINS`에 그 주소를 추가하고 `docker compose up -d api`를 실행한다. 로컬이면 `apps/api/.env`의 `CORS_ORIGINS`에 `http://localhost:5173`이 있는지 확인한다. 판정 코드는 [apps/react/src/shared/server/serverStatus.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/shared/server/serverStatus.ts), 시험은 `cd apps/react && npx playwright test e2e/server-status.spec.ts`.

참고 문서: [MDN CORS 오류](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors).

## 정리

- **브라우저는 실패 원인을 숨긴다.** CORS 실패와 연결 실패는 페이지에서 같은 `TypeError`다. 다른 모드(`no-cors`)로 한 번 더 요청해야 둘을 구분할 수 있었다.
- **`*`는 가장 좁게 일치시킨다.** 이름 한 칸, 영소문자·숫자·`-`만, 문자열 전체 일치. 범위가 넓은 정규식은 다른 사람의 하위 도메인까지 허용한다.
- **로컬과 배포의 값은 파일로 분리한다.** 값이 섞인 원인은 배포용 값을 기록할 위치가 없었기 때문이다. 위치를 정하고, 값이 섞이면 API가 시작 시각에 경고를 출력하게 해 같은 문제를 즉시 발견할 수 있다.

## 관련 글

- [메뉴 막대의 Wi-Fi 자리에 서버 상태 띄우기](/memo/server-status-wifi)
- [PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기](/memo/preview-cors-read-only)
- [fetch 33곳을 client.ts 하나로](/memo/shared-api-client)
- [Semgrep과 SCA 도구로 MacFolio 점검하기](/memo/security-scan)

[^cors]: Cross-Origin Resource Sharing. 브라우저가 다른 출처(origin)로 보낸 요청의 응답을 페이지에 넘겨도 되는지, 서버의 `Access-Control-Allow-Origin` 응답 헤더로 판단하는 규칙.

#MacFolio #서버 #CORS #트러블슈팅
