---
title: 서버는 켜져 있는데 "서버에 연결할 수 없음"
date: 2026-10-07
category: 개발기/MacFolio/인프라
summary: PR 미리보기 주소에서 메뉴 막대의 서버 상태가 늘 "서버에 연결할 수 없음"이었다. 서버는 멀쩡했고 그 주소를 CORS로 허용하지 않았을 뿐이다. 서버는 허용 주소에 *를 쓸 수 있게 하고, 화면은 no-cors 요청을 한 번 더 보내 막힘과 꺼짐을 가렸다.
---

메뉴 막대의 Wi-Fi 자리에는 서버 상태가 있다. 배포한 사이트에서는 "정상"인데, PR마다 만들어지는 미리보기 주소(`https://<브랜치>-macfolio.hyeoniverse.workers.dev`)에서 열면 늘 이렇게 나왔다.

```text
MacFolio API · 서버에 연결할 수 없음
```

같은 시각 배포한 사이트에서는 정상이었으니 서버는 켜져 있었다.

## 원인: 서버가 그 주소를 허용하지 않는다

미리보기도 배포와 같은 빌드 설정이라 같은 API(`macfolio-api.hyeoniverse.com`)를 부른다. 그런데 API는 CORS로 `https://macfolio.hyeoniverse.com`에서 온 요청만 허용한다. 다른 주소의 페이지가 보낸 요청에는 허용 헤더를 붙이지 않고, 브라우저는 그 응답을 페이지에 넘기지 않는다.

문제는 페이지 쪽에서 보면 이것이 **서버가 꺼진 것과 똑같다**는 점이다. 둘 다 `fetch`가 `TypeError: Failed to fetch`로 끝나고, 이유는 알려 주지 않는다(이유를 알려 주면 다른 사이트의 사정을 엿보는 데 쓰일 수 있어서 일부러 숨긴다). 그래서 상태 표시는 "연결할 수 없음"이라고만 했다.

## 두 가지를 고쳤다

방법을 견줘 보면 이렇다.

| 방법                                                       | 좋은 점                                           | 걸린 점                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| 미리보기에서는 서버 상태를 숨기기                          | 고칠 것이 적다                                    | 미리보기에서 API를 쓰는 기능을 시험할 수 없다                              |
| 서버가 모든 Origin을 허용(`*`)                             | 어디서든 된다                                     | 쿠키를 쓰는 관리자 API까지 열린다. `credentials`와 `*`는 함께 쓸 수도 없다 |
| 허용 목록에 이름 한 칸짜리 `*` + 화면이 막힘을 가림 (고름) | 미리보기만 좁게 열고, 다른 주소에서는 정확한 문구 | 서버 쪽 정규식을 직접 맞춰야 하고, 화면은 요청을 한 번 더 보낸다           |

### 1. 미리보기 주소를 허용한다 (서버)

허용 주소(`CORS_ORIGINS`)는 정확히 같은 문자열만 받았다. 미리보기 주소는 PR마다 바뀌니 하나씩 넣을 수 없다. `*`를 쓸 수 있게 했다.

```text
CORS_ORIGINS=https://macfolio.hyeoniverse.com,https://*-macfolio.hyeoniverse.workers.dev
```

`*`는 **점이 없는 이름 한 칸**(영소문자, 숫자, `-`)에만 맞는다. 점까지 맞게 두면 `https://x.evil-macfolio.hyeoniverse.workers.dev`처럼 남의 하위 도메인을 끼워 넣을 수 있다. 나머지 글자는 정규식에서 특별한 뜻이 없게 바꾼 뒤 처음부터 끝까지 맞아야 한다. 테스트에는 허용할 것(브랜치 이름, 버전 ID)과 막을 것을 함께 적었다.

- 막는 것: 다른 사이트, 점이 든 이름, 뒤에 글자를 더 붙인 주소, 경로를 끼운 주소, `http`, 앞의 이름 없이 `macfolio.hyeoniverse.workers.dev`

```ts
// apps/api/src/common/cors.ts
const escape = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

const patterns = allowed
	.filter((entry) => entry.includes('*'))
	.map((entry) => new RegExp(`^${entry.split('*').map(escape).join('[a-z0-9-]+')}$`));
```

`*`를 기준으로 잘라 각 조각의 메타 문자를 이스케이프하고, 그 사이에만 `[a-z0-9-]+`를 끼운다. `^`와 `$`로 처음부터 끝까지 맞아야 한다. `-`를 넣은 것은 브랜치 이름(`feat-app-menus`)에 `-`가 들어가기 때문이다.

![*가 맞는 주소와 막는 주소](./images/server-status-blocked-origin-patterns.svg '이름 한 칸에만 맞고, 점·경로·http는 막는다')

로그인 후 돌아갈 주소(`FRONTEND_URL`)는 따로 주지 않으면 허용 주소의 첫 번째를 썼는데, 그것이 `*`가 든 주소일 수는 없으니 `*`가 없는 첫 주소로 바꿨다.

### 2. 막힌 것과 꺼진 것을 가린다 (프론트엔드)

로컬 개발이나 허용하지 않은 다른 주소는 여전히 막힌다. 이때 "연결할 수 없음"은 틀린 말이다. 그래서 요청이 실패하면 한 번 더 보낸다.

```ts
reachable = await fetch(`${apiUrl}/health`, { mode: 'no-cors', … }).then(
	() => true,
	() => false
);
```

`no-cors` 요청은 응답을 페이지에 보여 주지 않는 대신 CORS 검사를 하지 않는다. 실제 코드는 `shared/server/serverStatus.ts`의 `checkServer()`에 있고, 결과를 상태로 나누는 일은 순수 함수 `classify()`가 한다.

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

서버가 응답하면 (내용은 못 읽어도) 성공하고, 서버가 꺼졌으면 똑같이 실패한다. 그래서

- 처음 요청 실패 + `no-cors` 성공 → 서버는 켜져 있는데 이 주소를 허용하지 않는다: **이 주소에서는 쓸 수 없음**
- 둘 다 실패 → **서버에 연결할 수 없음**

![CORS 요청이 실패하면 no-cors로 다시 보내 막힘과 꺼짐을 가리는 흐름](./images/server-status-blocked-origin-check.svg '두 번째 요청이 닿으면 서버는 켜져 있다')

메뉴에는 "서버는 켜져 있지만 이 주소(…)는 허용하지 않습니다"를 한 줄 더 보여 주고, 신호 그림에도 꺼졌을 때의 사선을 긋지 않는다. 응답 시간은 읽을 수 없으니 막대는 비운다.

두 번째 요청은 첫 요청이 실패했을 때만 보낸다. 정상일 때는 30초마다 한 번 그대로이고, 막힌 주소에서만 두 번이 된다.

## 테스트에서 막힌 것

화면 테스트의 가짜 API에 '막힘' 상태를 더하면서, 허용 헤더를 빼고 응답하면 될 줄 알았다. 그런데 결과는 "정상"이었다. Playwright는 가로챈 요청에 응답을 지어 줄 때 허용 헤더가 없으면 알아서 붙여 준다. 그래서 헤더를 빼는 대신 **다른 주소만 허용한다고** 답하게 했다. 브라우저는 그 응답을 막고, `no-cors` 요청만 닿는다. 실제 서버와 같은 결과다.

단위 시험(`serverStatus.test.ts`)은 `classify()`에 막힘과 꺼짐을 넣어 상태를 보고, 화면 E2E(`e2e/server-status.spec.ts`)는 가짜 API의 `health`를 `'blocked'`로 바꿔 메뉴 글자와 막대를 본다. 서버 쪽은 `common/cors.test.ts`가 위 그림의 주소들을 그대로 확인한다.

## 서버에서 할 일

코드는 머지하면 자동 배포되지만, 환경 변수는 자동으로 바뀌지 않는다. 서버의 `~/deploy/api.env`에서 `CORS_ORIGINS`에 미리보기 주소를 더하고 API만 다시 띄운다.

```bash
cd ~/deploy && docker compose up -d api
```

## 로컬에서도 "연결할 수 없음"

배포 서버를 고친 뒤 로컬(`pnpm dev:all`)에서 보려니, 이번엔 로컬에서 연결이 안 됐다. 로컬 API는 켜져 있었고 DB도 정상이었다. 어떤 주소를 허용하는지 물어보니 `http://localhost:5173`은 없고 `https://macfolio.hyeoniverse.com`만 허용했다. 서버에 넣을 값을 준비하면서 로컬 `apps/api/.env`의 `CORS_ORIGINS`가 배포 값으로 바뀌어 있었다.

로컬 API는 `.env` 하나만 읽고, 배포 서버는 서버의 `~/deploy/api.env`만 읽는다. 파일은 이미 나뉘어 있었는데, 배포용 값을 적어 둘 곳이 따로 없어서 로컬 파일에 섞였다. 그래서 자리를 정했다.

- `apps/api/.env`: 로컬 개발용 값만
- `apps/api/.env.production`: 배포용 값을 내 컴퓨터에 적어 두는 곳. `.gitignore`의 `.env.*`에 걸려 커밋되지 않고, API는 이 파일을 읽지 않는다

그래도 섞일 수 있으니 API가 뜰 때 알리게 했다. 개발 모드인데 `CORS_ORIGINS`가 로컬 프론트엔드를 허용하지 않으면 터미널에 한 줄 경고를 찍는다. 확인은 위의 `*` 규칙과 같은 함수로 한다.

```text
MacFolio API: http://localhost:4100 (문서: /docs)
⚠️ CORS_ORIGINS가 로컬 프론트엔드(http://localhost:5173)를 허용하지 않습니다: https://macfolio.hyeoniverse.com. …
```

## 그 뒤: 미리보기 주소에는 읽기만

미리보기 주소를 열고 나서 하나가 걸렸다. 미리보기는 저장소에 브랜치를 올릴 수 있는 사람이면 누구나 만들 수 있는 주소인데, CORS에 `credentials: true`가 한 번에 걸려 있어 그 주소에도 쿠키를 주고받을 수 있다고 답하고 있었다. 그래서 사흘 뒤([#182](https://github.com/hyeoniverse/MacFolio/pull/182)) 허용을 둘로 나눴다.

```ts
/** 허용 목록에 어떻게 맞았는지. exact: 그대로 적은 주소, pattern: *가 든 항목에 맞은 주소 */
export type OriginMatch = 'exact' | 'pattern' | null;

export function cookiesAllowedFrom(classify: (origin: string | undefined) => OriginMatch) {
	return (origin: string | undefined) => origin === undefined || classify(origin) === 'exact';
}
```

`*`로 맞은 주소는 읽기 요청만 받고 쿠키를 주지 않으며, 관리자 API는 그 Origin을 403으로 거절한다([PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기](/memo/preview-cors-read-only)). 서버 상태 표시는 `/health`만 부르므로 그대로 "정상"이다.

## 따라 하는 방법

메뉴 막대가 "서버에 연결할 수 없음"을 띄우면 먼저 서버가 정말 꺼졌는지, 주소가 막혔는지를 가른다.

```bash
curl -s https://macfolio-api.hyeoniverse.com/health; echo            # 서버 자체
curl -s -o /dev/null -w '%{http_code}\n' -H "Origin: <사이트 주소>" \
  https://macfolio-api.hyeoniverse.com/health                          # 그 주소를 허용하는지
```

첫 줄이 `{"status":"ok",…}`인데 화면이 연결할 수 없다고 하면 CORS다. 서버 `api.env`의 `CORS_ORIGINS`에 그 주소를 더하고 `docker compose up -d api`. 로컬이면 `apps/api/.env`의 `CORS_ORIGINS`에 `http://localhost:5173`이 있는지 본다. 판정 코드는 [apps/react/src/shared/server/serverStatus.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/shared/server/serverStatus.ts), 시험은 `cd apps/react && npx playwright test e2e/server-status.spec.ts`.

참고 문서: [MDN CORS 오류](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors).

## 배운 것

- **브라우저는 이유를 숨긴다.** CORS 실패와 연결 실패는 페이지에서 같은 `TypeError`다. 다른 길(no-cors)로 한 번 더 물어야 둘을 가를 수 있었다.
- **`*`는 가장 좁게.** 이름 한 칸, 영소문자·숫자·`-`만, 처음부터 끝까지. 넓게 맞추는 정규식은 남의 하위 도메인을 받아들인다.
- **로컬과 배포의 값은 파일로 나눈다.** 섞인 것은 값을 적어 둘 자리가 없어서였다. 자리를 정하고, 섞였을 때 API가 뜨면서 알리게 하니, 다시 섞여도 바로 안다.

관련 글: [메뉴 막대의 Wi-Fi 자리에 서버 상태 띄우기](/memo/server-status-wifi) · [PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기](/memo/preview-cors-read-only) · [fetch 33곳을 client.ts 하나로](/memo/shared-api-client).

#MacFolio #서버 #CORS #트러블슈팅
