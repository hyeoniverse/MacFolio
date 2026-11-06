---
title: /auth/me의 세션 만료 시각에 맞춰 화면을 로그아웃 상태로 전환하기
date: 2026-10-02
category: 개발 기록/MacFolio/구조·상태 관리
summary: 관리자 세션은 12시간 유지되는데, 계정 화면에서는 로그인 시각과 만료 시각을 확인할 수 없었다. 서버가 /auth/me로 두 시각을 반환하고, 화면은 로그인 시각과 만료 시각을 표시한다. 만료 시각이 지나면 화면도 즉시 로그아웃 상태로 전환된다.
---

MacFolio의 관리자는 GitHub 계정으로 로그인한다. 로그인에 성공하면 서버는 무작위 토큰을 만들어 브라우저에 쿠키로 저장하고, DB에는 그 토큰의 해시와 함께 **세션** 한 행을 기록한다. 세션은 "이 브라우저는 언제까지 관리자로 인정한다"는 서버 쪽 기록이다. 이후 관리자가 글을 저장할 때마다 브라우저가 쿠키를 함께 보내고, 서버는 그 쿠키로 세션 행을 찾아 유효한지 확인한다.

MacFolio의 관리자 세션은 12시간 유지된다(`SESSION_TTL_MS = 12 * 60 * 60 * 1000`). 그런데 시스템 설정의 계정 화면에는 "GitHub로 로그인됨"만 표시되어, 로그인 시각과 재로그인이 필요한 시각을 알 수 없었다.

남은 시간을 알면 긴 글을 수정하기 전에 미리 다시 로그인할 수 있다. 예를 들어 오전 9시에 로그인했다면 세션은 오후 9시에 끝난다. 오후 8시 40분에 긴 글을 쓰기 시작해 9시 5분에 저장하면, ==저장하는 시각에 세션이 만료되어 있어 401을 받고 로그인부터 다시 해야 한다==. 401은 HTTP 상태 코드 중 "인증 정보가 없거나 유효하지 않다"는 응답이다.

GitHub 계정 연동을 마치고 계정 화면을 확인하다가 로그인 시각이 없는 것을 발견해, GitHub 앱 작업과 함께 추가했다([#78](https://github.com/hyeoniverse/MacFolio/pull/78)).

## 채택한 방법과 제외한 방법

| 방법                                        | 장점               | 단점                                                                                                              |
| ------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 쿠키의 만료 시각을 화면이 읽기              | 서버 수정이 없다   | 세션 쿠키는 [`HttpOnly`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)라 자바스크립트가 읽을 수 없다 |
| 화면이 로그인 시각을 브라우저 저장소에 기록 | 서버 수정이 없다   | 다른 탭·기기에서 로그인했거나 서버가 세션을 삭제했으면 부정확하다                                                 |
| 서버가 세션 행의 두 시각을 반환 (채택)      | 서버의 실제 값이다 | `/auth/me` 응답 필드가 두 개 늘어난다                                                                             |

첫 번째 방법이 막힌 이유는 쿠키의 `HttpOnly` 속성이다. 서버가 `Set-Cookie: macfolio_session=…; HttpOnly; SameSite=Lax`처럼 `HttpOnly`를 붙여 저장한 쿠키는 브라우저가 요청에 자동으로 실어 보내지만, 페이지의 자바스크립트는 `document.cookie`로 읽을 수 없다. 악성 스크립트가 페이지에 삽입되더라도 세션 토큰을 빼내지 못하게 하는 장치이므로 해제할 수 없다.

두 번째 방법은 화면이 로그인 버튼을 누른 시각을 `localStorage`에 적어 두는 방식이다. 노트북에서 로그인한 뒤 휴대폰에서 다시 로그인하면 휴대폰에는 기록이 없고, 서버가 만료된 세션을 정리해도 브라우저 기록은 남는다. 실제 세션 상태를 아는 곳은 서버뿐이다.

![계정 화면 전후](./images/settings-signed-in-at.jpg '세션 줄 아래에 로그인 시각과 세션 만료 시각')

## 서버

세션 테이블(`AdminSession`)에는 처음부터 생성 시각(`createdAt`)과 만료 시각(`expiresAt`)이 있었다. 관리자를 확인하면서 두 값을 함께 조회하고, `/auth/me`가 ISO 8601 문자열([`toISOString`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString) 형식)로 반환한다. `/auth/me`는 화면이 "지금 이 브라우저는 누구로 로그인되어 있는가"를 묻는 API다.

```json
{
	"login": "hyeoniverse",
	"signedInAt": "2026-10-02T10:03:00.000Z",
	"expiresAt": "2026-10-02T22:03:00.000Z"
}
```

ISO 8601은 날짜와 시각을 `연-월-일T시:분:초` 순서로 적는 국제 표준 형식이다. 끝의 `Z`는 협정 세계시(UTC) 기준이라는 표시다. 서버는 항상 UTC로 보내고, 사용자 시간대로 바꾸는 일은 브라우저가 맡는다. 위 응답의 `10:03Z`는 한국 시간(UTC+9)으로 오후 7시 3분이다.

세션을 생성하면서 `createdAt`도 로그인을 처리한 시각으로 직접 지정한다. 만료 시각과 같은 기준이라 둘의 차이가 정확히 12시간이고, 시험에서도 그대로 확인한다.

```ts
// apps/api/src/auth/auth.service.ts (관리자 확인)
return { login: session.githubLogin, signedInAt: session.createdAt, expiresAt: session.expiresAt };
```

DB 기본값([`@default(now())`](https://www.prisma.io/docs/orm/reference/prisma-schema-reference))을 사용하면 DB 서버 시계 기준으로 기록되어, API 서버가 계산한 `expiresAt`과 ==몇 밀리초 차이가 날 수 있다==. API 서버가 `now`를 구한 뒤 DB에 행을 넣기까지 네트워크 왕복과 쿼리 처리 시간이 걸리고, 그 사이 DB 쪽 `now()`는 이미 몇 밀리초 뒤의 값이기 때문이다.

| `createdAt` 기록 방식   | 기준 시계          | `expiresAt - createdAt` |
| ----------------------- | ------------------ | ----------------------- |
| `@default(now())`       | DB 서버            | 12시간 ± 수 밀리초      |
| API가 같은 `now`로 지정 | API 서버 (동일 값) | 정확히 12시간           |

두 값을 같은 `now`에서 생성하면 `auth.service.test.ts`가 `expiresAt - now`를 정확히 `12 * 60 * 60 * 1000`(43,200,000밀리초)으로 비교할 수 있다.

## 화면

받은 시각은 사용자의 시간대로 "2026년 10월 2일 오후 7:03"처럼 표시한다.

![ISO 8601 문자열에서 화면 문구까지](./images/settings-signed-in-at-iso-time.svg 'UTC 22시 3분은 한국 시간으로 다음 날 오전 7시 3분이다. Date 객체의 get 함수는 사용자 시간대 기준 값을 반환한다')

처음에는 [`Intl.DateTimeFormat('ko-KR')`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)을 사용했는데, ==Node에서 실행한 단위 시험에서 "오후" 대신 "PM"이 출력됐다==. 한국어 출력은 런타임에 포함된 ICU[^icu] 데이터에 따라 달라지므로, 메시지 앱처럼 숫자만 가져와 문구를 직접 조합한다.

```ts
// apps/react/src/shared/auth/admin.ts
export function formatSessionTime(date: Date): string {
	const hour = date.getHours();
	const minute = String(date.getMinutes()).padStart(2, '0');
	return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${minute}`;
}
```

`getMonth()`는 1월을 0으로 반환하므로 1을 더하고, `padStart(2, '0')`는 3분을 `'03'`으로 바꾼다. `hour % 12 || 12`는 0시와 12시를 12로 표시하는 부분이다. `%`는 나머지 연산이고, `||`는 왼쪽 값이 0이면 오른쪽 값을 사용한다.

| `getHours()` | `hour % 12 \|\| 12` | 표시       |
| ------------ | ------------------- | ---------- |
| 0 (자정)     | 12                  | 오전 12:03 |
| 9            | 9                   | 오전 9:03  |
| 12 (정오)    | 12                  | 오후 12:03 |
| 19           | 7                   | 오후 7:03  |

서버가 아직 새로 배포되지 않아 두 값이 없거나 잘못되었으면 해당 행을 렌더링하지 않는다. 로그인 상태는 그대로 표시된다. 프론트엔드와 API 서버는 따로 배포되므로, 새 화면이 먼저 배포되고 서버가 나중에 배포되는 구간이 생긴다. 그 구간에도 계정 화면이 깨지지 않게 하기 위해서다.

```ts
/** ISO 8601 문자열 → Date. 없거나 잘못된 값이면 null */
function toDate(value: string | undefined): Date | null {
	const date = value ? new Date(value) : null;
	return date && !Number.isNaN(date.getTime()) ? date : null;
}
```

| 입력 `value`                 | `new Date(value).getTime()` | `toDate` 결과 | 화면                |
| ---------------------------- | --------------------------- | ------------- | ------------------- |
| `'2026-10-02T10:03:00.000Z'` | `1790935380000`             | `Date`        | 로그인 시각 행 표시 |
| `undefined` (이전 서버)      | (호출하지 않음)             | `null`        | 행 생략             |
| `'abc'`                      | `NaN`                       | `null`        | 행 생략             |

## 만료 시각 이후 처리

화면은 로그인 상태를 앱을 열면서 한 번 조회한다. 그래서 창을 열어 둔 채로 만료 시각이 지나면, ==서버는 이미 관리자로 인정하지 않는데 화면은 계속 "로그인됨"이었다==. 이제 만료 시각을 받으면 그 시각에 다시 조회해 로그아웃 화면으로 전환한다.

![세션 12시간과 화면의 타이머](./images/settings-signed-in-at-timeline.svg '만료 1초 뒤에 다시 물어 로그아웃 화면으로 바꾼다')

```ts
// apps/react/src/shared/auth/adminStore.ts
clearTimeout(expiryTimer);
const left = state.expiresAt ? state.expiresAt.getTime() - Date.now() : null;
// setTimeout은 약 24.8일(2^31 ms)을 넘기면 바로 불린다. 세션은 12시간이라 넘지 않지만 막아 둔다
if (left !== null && left < 2 ** 31 - 1) expiryTimer = setTimeout(() => void refreshAdmin(), Math.max(0, left) + 1000);
```

`clearTimeout`을 먼저 호출하는 이유는 다시 로그인해 새 만료 시각을 받은 경우 이전 타이머를 취소하기 위해서다. 이전 타이머가 남아 있으면 새 세션이 유효한데도 이전 만료 시각에 한 번 더 조회한다.

1초를 더한 이유는 서버와 브라우저의 시계가 약간 어긋나도, 재조회 시각에 서버가 확실히 만료로 판단하게 하기 위해서다. 정확히 만료 시각에 조회하면 서버 기준으로는 아직 몇백 밀리초가 남아 "로그인됨"이 반환될 수 있다.

![시계 차이와 1초 여유](./images/settings-signed-in-at-clock-skew.svg '브라우저 시계가 0.4초 빠르면, 여유 없는 타이머는 서버 기준 만료 0.4초 전에 실행된다. 1초를 더하면 서버 기준 0.6초 뒤에 실행된다')

> [!WARNING] setTimeout의 최대 지연
> [`setTimeout`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)의 최대 지연은 2^31 − 1밀리초(약 24.8일)이고 이를 넘으면 즉시 실행되므로, 그보다 긴 값은 타이머를 등록하지 않는다.

브라우저는 지연 값을 부호 있는 32비트 정수로 저장한다. 예를 들어 30일(2,592,000,000밀리초)을 지정하면 32비트 최댓값 2,147,483,647을 넘어 정수 오버플로가 발생하고, 타이머가 즉시 실행된다. 현재 세션은 12시간(43,200,000밀리초)이라 해당하지 않지만, 나중에 세션 기간을 늘려도 즉시 재조회가 반복되지 않도록 조건을 두었다.

E2E 시험에서는 첫 조회 후 몇 초 만에 만료되는 세션을 반환하고, 계정 화면이 "로그인하지 않음"으로 바뀌는지 확인한다.

## 확인

| 구분 | 파일                        | 확인 항목                                                                                                                                                                            |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API  | `auth.service.test.ts`      | 새 세션의 `expiresAt - now`가 12시간인지                                                                                                                                             |
| API  | `test/auth.e2e.test.ts`     | `/auth/me` 응답의 두 시각이 현재 시각(오차 1분 이내)과 그 12시간 뒤인지                                                                                                              |
| 화면 | `shared/auth/admin.test.ts` | 시각 문구("2026년 10월 2일 오후 7:03")와, 이전 서버처럼 두 값이 없거나 잘못된 응답이면 해당 필드를 제외하는지                                                                        |
| E2E  | `e2e/admin-login.spec.ts`   | 계정 화면의 두 `<time>`에 받은 시각이 들어가는지, 값이 없으면 두 행이 제외되는지, "세션 만료 시각이 지나면 다시 확인해 로그아웃된 화면으로 바뀐다"(15초 안에 "로그인하지 않음" 표시) |

## 남은 것과 배운 것

- **세션 연장 기능은 없다.** 12시간이 지나면 다시 GitHub로 로그인한다. 남은 시간을 표시하는 것까지가 이번 범위다.
- **401 응답으로도 로그아웃된다.** 이후 공통 API 클라이언트가 추가되면서, 서버가 세션을 삭제했거나 쿠키가 사라져 401을 받은 경우에도 같은 함수(`refreshAdmin`)를 호출해 화면을 전환한다([공통 API 클라이언트 api()·apiFetch()로 fetch 호출과 401 처리 통합하기](/memo/shared-modules#서버-호출-apiapifetch)). 만료 타이머와 401, 두 경로가 같은 결과로 이어진다.
- **기존 필드를 먼저 확인한다.** `createdAt`과 `expiresAt`은 처음부터 테이블에 있었다. 새 필드를 추가하지 않고 조회만 했다.

## 관련 글

- [img 로드 전까지 대체 아이콘을 깔아 두는 외부 프로필 사진 표시](/memo/settings-avatar-placeholder)
- [공통 API 클라이언트 api()·apiFetch()로 fetch 호출과 401 처리 통합하기](/memo/shared-modules#서버-호출-apiapifetch)
- [GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기](/memo/admin-login-github-oauth)

<details><summary>참고 문헌</summary>

- MDN, [Using HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- MDN, [401 Unauthorized](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401)
- MDN, [Date.prototype.toISOString()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString)
- MDN, [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- MDN, [Window: setTimeout() method, Maximum delay value](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#maximum_delay_value)
- Prisma, [Prisma schema reference: @default](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
- Node.js, [Internationalization support](https://nodejs.org/api/intl.html)

</details>

[^icu]: ICU(International Components for Unicode)는 날짜·숫자·언어별 형식을 제공하는 라이브러리다. 브라우저와 Node.js의 `Intl` API가 내부적으로 사용하며, 포함된 ICU 데이터 버전에 따라 같은 로케일의 출력이 달라질 수 있다.

#MacFolio #시스템설정 #로그인
