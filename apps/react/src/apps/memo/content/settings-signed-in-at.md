---
title: 언제 로그인했고 언제 끝나는지 - 시스템 설정의 계정
date: 2026-10-02
category: 개발기/MacFolio/프론트엔드
summary: 관리자 세션은 12시간 이어지는데, 계정 화면에서는 언제 로그인했고 언제 끝나는지 알 수 없었다. 서버가 /auth/me로 두 시각을 알려 주고, 화면은 로그인 시각과 만료 시각을 보여 준다. 만료 시각이 지나면 화면도 바로 로그아웃 상태로 바뀐다.
---

관리자 로그인은 12시간 동안 이어진다. 그런데 시스템 설정의 계정 화면에는 "GitHub로 로그인됨"만 있어서, 언제 로그인했는지, 언제 다시 로그인해야 하는지 알 수 없었다.

남은 시간을 알면 글을 길게 고치기 전에 미리 다시 로그인할 수 있다. 저장하는 순간 세션이 끝나 있으면 401을 받고 로그인부터 다시 해야 한다.

10월 2일 저녁, GitHub 계정 연동을 마치고 계정 화면을 보다가 로그인 시각이 없는 것이 눈에 띄어 GitHub 앱 작업과 같이 넣었다.

## 고른 방법과 버린 방법

| 방법                                        | 좋은 점              | 걸린 점                                                     |
| ------------------------------------------- | -------------------- | ----------------------------------------------------------- |
| 쿠키의 만료 시각을 화면이 읽기              | 서버를 고치지 않는다 | 세션 쿠키는 `httpOnly`라 자바스크립트가 읽을 수 없다        |
| 화면이 로그인한 때를 저장소에 적어 두기     | 서버를 고치지 않는다 | 다른 탭·기기에서 로그인했거나 서버가 세션을 지웠으면 틀린다 |
| 서버가 세션 행의 두 시각을 알려 주기 (고름) | 서버의 진짜 값이다   | `/auth/me` 응답이 두 칸 늘어난다                            |

![계정 화면 전후](./images/settings-signed-in-at.jpg '세션 줄 아래에 로그인 시각과 세션 만료 시각')

## 서버

세션 테이블(`AdminSession`)에는 처음부터 만든 때(`createdAt`)와 끝나는 때(`expiresAt`)가 있었다. 관리자를 확인할 때 두 값을 함께 꺼내고, `/auth/me`가 ISO 8601로 돌려준다.

```json
{
	"login": "hyeoniverse",
	"signedInAt": "2026-10-02T10:03:00.000Z",
	"expiresAt": "2026-10-02T22:03:00.000Z"
}
```

세션을 만들 때 `createdAt`도 로그인을 처리한 시각으로 직접 넣는다. 만료 시각과 같은 기준이라 둘의 차이가 정확히 12시간이고, 시험에서도 그대로 확인한다.

```ts
// apps/api/src/auth/auth.service.ts (관리자 확인)
return { login: session.githubLogin, signedInAt: session.createdAt, expiresAt: session.expiresAt };
```

DB의 기본값(`@default(now())`)에 맡기면 DB 시계로 찍혀, 서버가 계산한 `expiresAt`과 몇 밀리초 어긋날 수 있다. 두 값을 같은 `now`에서 만들면 `auth.service.test.ts`가 `expiresAt - now`를 정확히 `12 * 60 * 60 * 1000`으로 비교할 수 있다.

## 화면

받은 시각은 보는 사람의 시간대로 "2026년 10월 2일 오후 7:03"처럼 보여 준다. 처음에는 `Intl.DateTimeFormat('ko-KR')`을 썼는데, Node에서 돌린 단위 시험에서 "오후" 대신 "PM"이 나왔다. 한국어 출력은 ICU 버전마다 달라서, 메시지 앱처럼 숫자만 받아 문구는 직접 조립한다.

```ts
// apps/react/src/shared/auth/admin.ts
export function formatSessionTime(date: Date): string {
	const hour = date.getHours();
	const minute = String(date.getMinutes()).padStart(2, '0');
	return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${minute}`;
}
```

`hour % 12 || 12`는 0시와 12시를 12로 보이게 하는 부분이다. 낮 12시 3분은 "오후 12:03", 자정 3분은 "오전 12:03"이 된다.

서버를 아직 새로 배포하지 않아 두 값이 없거나 잘못되었으면 그 줄을 그리지 않는다. 로그인 상태는 그대로 보인다. 화면이 먼저 배포되고 서버가 나중에 배포되는 사이에도 계정 화면이 깨지지 않게 하려는 것이다.

```ts
/** ISO 8601 문자열 → Date. 없거나 잘못된 값이면 null */
function toDate(value: string | undefined): Date | null {
	const date = value ? new Date(value) : null;
	return date && !Number.isNaN(date.getTime()) ? date : null;
}
```

## 만료 시각이 지나면

화면은 로그인 상태를 앱을 열 때 한 번 묻는다. 그래서 창을 켜 둔 채로 만료 시각이 지나면, 서버는 이미 관리자로 보지 않는데 화면은 계속 "로그인됨"이었다. 이제 만료 시각을 받으면 그때 다시 물어서 로그아웃된 화면으로 바꾼다.

![세션 12시간과 화면의 타이머](./images/settings-signed-in-at-timeline.svg '만료 1초 뒤에 다시 물어 로그아웃 화면으로 바꾼다')

```ts
// apps/react/src/shared/auth/adminStore.ts
clearTimeout(expiryTimer);
const left = state.expiresAt ? state.expiresAt.getTime() - Date.now() : null;
// setTimeout은 약 24.8일(2^31 ms)을 넘기면 바로 불린다. 세션은 12시간이라 넘지 않지만 막아 둔다
if (left !== null && left < 2 ** 31 - 1) expiryTimer = setTimeout(() => void refreshAdmin(), Math.max(0, left) + 1000);
```

1초를 더한 것은 서버와 브라우저의 시계가 조금 어긋나도, 다시 물을 때 서버가 확실히 만료로 보게 하려는 것이다. 바로 만료 시각에 물으면 서버 쪽에서는 아직 몇백 밀리초 남아 "로그인됨"이 돌아올 수 있다. E2E 시험에서는 처음 물은 뒤 몇 초 만에 끝나는 세션을 주고, 계정 화면이 "로그인하지 않음"으로 바뀌는지 본다.

## 확인

- API: `auth.service.test.ts`가 새 세션의 `expiresAt - now`가 12시간인지 본다. `test/auth.e2e.test.ts`는 `/auth/me` 응답의 두 시각이 1분 안쪽의 지금과 그 12시간 뒤인지 본다.
- 화면 단위: `shared/auth/admin.test.ts`가 시각 문구("2026년 10월 2일 오후 7:03")와, 예전 서버처럼 두 값이 없거나 잘못된 응답이면 그 칸을 빼는지 본다.
- E2E(`e2e/admin-login.spec.ts`): 계정 화면의 두 `<time>`에 받은 시각이 들어가는지, 값이 없으면 두 줄이 빠지는지, "세션 만료 시각이 지나면 다시 확인해 로그아웃된 화면으로 바뀐다"(몇 초 만에 끝나는 세션을 주고 15초 안에 "로그인하지 않음")

## 남은 것과 배운 것

- **세션을 늘리는 버튼은 없다.** 12시간이 지나면 다시 GitHub로 로그인한다. 남은 시간을 보여 주는 것까지가 이번 일이다.
- **401로도 로그아웃된다.** 그 뒤 공통 API 클라이언트가 생기면서, 서버가 세션을 지웠거나 쿠키가 사라져 401을 받은 경우에도 같은 함수(`refreshAdmin`)를 불러 화면을 바꾼다([fetch 33곳을 client.ts 하나로](/memo/shared-api-client)). 만료 타이머와 401, 두 길로 같은 결과에 닿는다.
- **이미 있는 칸을 먼저 본다.** `createdAt`과 `expiresAt`은 처음부터 테이블에 있었다. 새 칸을 만들지 않고 꺼내기만 했다.

관련 글: [프로필 사진이 늦게 올 때 비어 보이지 않게](/memo/settings-avatar-placeholder) · [fetch 33곳을 client.ts 하나로](/memo/shared-api-client). PR: [#78](https://github.com/hyeoniverse/MacFolio/pull/78).

#MacFolio #시스템설정 #로그인
