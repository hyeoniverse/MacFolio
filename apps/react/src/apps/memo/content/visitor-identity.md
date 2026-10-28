---
title: httpOnly 방문자 쿠키의 HMAC 해시로 이름·비밀번호 없는 메시지와 댓글 만들기
date: 2026-10-02
category: 개발 기록/MacFolio/백엔드
summary: 메시지와 댓글에서 이름·비밀번호 입력 칸을 제거했다. 서버가 처음 방문한 브라우저에 httpOnly 쿠키를 발급하고, 그 HMAC 해시로 "🦊 날쌘 여우" 같은 이름(720가지)을 정한다. 삭제 권한도 쿠키를 기준으로 판단하고, 메시지 앱은 처음으로 서버에 저장한다.
---

메시지 앱(감상·의견·피드백)과 블로그 댓글은 글을 작성할 때마다 이름과 비밀번호를 입력받았다. 비밀번호는 나중에 자기 글을 삭제할 때 사용하는 값이었다. 휴대폰 화면에서는 이 두 입력 칸이 본문 입력창보다 더 크게 보였고, 여백을 조정해도 다른 화면과 형태가 맞지 않았다. 한 줄을 남기려는 방문자에게 이름과 비밀번호까지 정하게 하는 것도 입력 부담이 컸다.

이 글은 두 입력 칸을 서버가 발급하는 방문자 쿠키로 대체한 [#69](https://github.com/hyeoniverse/MacFolio/pull/69)를 정리한다.

![메시지 전후](./images/visitor-identity-messages.jpg '전: 이름·비밀번호 칸 / 후: 입력창 위에 자동으로 정한 이름 한 줄')

## 방문자를 구분하는 기준

처음 검토한 것은 IP였다. 서버는 요청마다 IP를 알고, 댓글에는 이미 IP 앞 두 자리를 표시하고 있었다. 그러나 IP는 방문자를 구분하는 기준으로 적합하지 않다.

| 방법                                             | 같은 이름이 유지되는 조건 | 문제                                                                                                                                     |
| ------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| IP                                               | 같은 네트워크에 있는 동안 | 휴대폰은 Wi-Fi와 LTE를 전환할 때마다 IP가 바뀐다. 카페·회사는 여러 사람이 같은 공인 IP를 쓰므로 다른 사람의 이름과 삭제 권한을 얻게 된다 |
| 브라우저 지문[^fingerprint] (화면 크기, 글꼴 등) | 쿠키를 삭제해도 일부 유지 | 개인정보 침해 소지가 있고 Safari·Firefox가 지문 수집을 차단한다                                                                          |
| 로그인                                           | 어느 기기에서나           | 한 줄을 남기려고 로그인해야 한다                                                                                                         |
| **서버가 발급하는 쿠키** (채택)                  | 같은 브라우저라면 항상    | 사이트 데이터를 삭제하거나 시크릿 창을 쓰면 새 이름이 된다                                                                               |

쿠키를 선택했다. 같은 브라우저는 계속 같은 방문자로 인식하면서, 다른 사람의 이름이나 삭제 권한을 얻는 경우가 없다. IP는 기존처럼 도배 방지(요청 횟수 제한)에만 사용한다.

## 서버가 발급하는 방문자 쿠키

처음 글을 작성하거나 이름을 조회하면(`GET /visitor`) 서버가 무작위 토큰을 쿠키로 발급한다. 설정은 관리자 로그인 세션 쿠키와 같다.

| 속성       | 값                 | 의미                                                                             |
| ---------- | ------------------ | -------------------------------------------------------------------------------- |
| `HttpOnly` | 켜짐               | 페이지의 JavaScript가 쿠키를 읽거나 변경할 수 없다. XSS로 토큰을 탈취하기 어렵다 |
| `SameSite` | `Lax`              | 다른 사이트에서 시작한 하위 요청(이미지, fetch 등)에는 쿠키를 붙이지 않는다      |
| `Secure`   | 운영 환경에서 켜짐 | HTTPS 연결에서만 전송한다                                                        |
| `Max-Age`  | 1년                | 글을 작성할 때마다 다시 1년으로 연장한다                                         |

각 속성의 정의는 [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)에 정리되어 있다.

DB에는 토큰 대신 비밀 키로 [HMAC](https://developer.mozilla.org/en-US/docs/Glossary/HMAC)한 값만 저장한다. DB가 유출되어도 그 값으로 쿠키를 만들 수 없다. 화면에 내보내는 "같은 작성자" 구분값(말풍선 묶기에 사용하는 `authorId`)도 그 해시를 한 번 더 해시한 값이라, 응답에서 DB에 저장된 값을 알아낼 수 없다.

```ts
export const hashVisitor = (token: string, secret: string) =>
	createHmac('sha256', secret).update(`visitor:${token}`).digest('hex');
```

`visitor:` 접두사는 같은 비밀 키를 다른 용도의 해시에도 사용할 때 결과 값이 겹치지 않게 하기 위한 것이다. 쿠키 값의 형식도 검사한다. `randomToken(24)`가 만드는 형식이 아니면 쿠키가 없는 것으로 처리하고 새 토큰을 발급한다.

![쿠키 토큰, DB의 해시, 응답의 authorId, 이름이 만들어지는 관계](./images/visitor-identity-hash-chain.svg '토큰은 브라우저에만 있다')

| 값            | 저장 위치           | 외부 노출         | 역할                          |
| ------------- | ------------------- | ----------------- | ----------------------------- |
| 토큰          | 브라우저 쿠키       | 없음 (`HttpOnly`) | 방문자 식별의 원본            |
| `visitorHash` | DB (댓글·메시지 행) | 없음              | 작성자 확인, 삭제 권한 판단   |
| `authorId`    | API 응답            | 있음              | 같은 작성자의 말풍선 묶기     |
| 이름          | API 응답, 화면      | 있음              | "🦊 날쌘 여우" 같은 표시 이름 |

## 해시에서 이름 만들기

해시의 앞 8자리로 수식어를, 그다음 8자리로 동물을 선택한다. 수식어 30개와 동물 24개라 조합은 720가지다. 해시가 같으면 이름도 항상 같다.

```ts
export function visitorName(hexHash: string): string {
	const adjective = ADJECTIVES[parseInt(hexHash.slice(0, 8), 16) % ADJECTIVES.length];
	const [emoji, animal] = ANIMALS[parseInt(hexHash.slice(8, 16), 16) % ANIMALS.length];
	return `${emoji} ${adjective} ${animal}`;
}
```

이름은 겹칠 수 있다(720가지). 그래서 IP 앞 두 자리 표시는 유지한다(예: "🦊 날쌘 여우(IP 앞 두 자리)"). 아바타는 이름의 첫 글자 대신 동물 이모지를 사용한다. [`Array.from`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from)으로 첫 글자를 자르면 🐿️처럼 변형 선택자[^vs]가 붙은 이모지가 둘로 잘리므로, 이름이 동물 목록의 이모지로 시작하면 그 이모지 전체를 사용한다.

## 같은 브라우저에서만 삭제

비밀번호가 없으므로 삭제 권한도 쿠키를 기준으로 판단한다.

1. 서버는 글마다 작성자의 `visitorHash`를 저장한다.
2. 목록을 응답할 때 `mine`(요청한 브라우저가 작성한 글인지)을 채운다.
3. 화면은 `mine`인 글에만 삭제 메뉴를 표시한다.
4. 삭제 요청을 받으면 서버가 쿠키의 해시와 글의 `visitorHash`를 다시 비교한다. 관리자는 모든 글을 삭제할 수 있다.

![댓글 전후](./images/visitor-identity-comments.jpg '전: 이름·비밀번호 칸, 삭제 시 비밀번호 입력 / 후: 이름 한 줄, 내 댓글에만 삭제 메뉴와 확인창')

비밀번호를 입력받던 창은 "메시지를 삭제할까요?" 확인창(공통 `AlertDialog`)으로 바뀌었다. 이름·비밀번호 방식으로 작성된 기존 댓글은 작성자 해시가 없어서 관리자만 삭제할 수 있다.

## 메시지 앱의 서버 저장

메시지 앱은 이전까지 글을 브라우저(localStorage)에만 저장했다. 다른 방문자는 서로의 글을 볼 수 없었다. 저장소를 인터페이스(`ConversationRepository`)로 분리해 두었기 때문에, 서버 구현을 하나 추가하고 서버 주소가 설정되어 있으면 서버 구현을 선택하게 했다.

```ts
repository = env.apiUrl ? createApiConversationRepository(env.apiUrl) : createLocalConversationRepository(visitorId());
```

이 선택 방식은 이후 `VITE_MESSAGES_STORE` 환경 변수로 바뀌었다([서버 연결에 실패하면 메시지 앱을 닫는 경고창과 VITE_MESSAGES_STORE로 저장소 고르기](/memo/messages-offline)).

서버는 피드백(`MessageThread`)과 말풍선(`GuestMessage`)을 저장한다. 사이트 주인의 고정 안내 글은 프론트엔드 코드에 그대로 두고, 서버에는 그 글에 단 답글만 저장한다(`threadId`가 빈 글). 서버를 사용하지 않을 때는 이전처럼 브라우저에 저장하는데, 이때도 브라우저 id로 같은 방식의 이름을 정한다. 그래서 이름 재료 목록이 서버와 프론트엔드 두 곳에 있다.

메시지와 댓글이 같은 쿠키를 사용하므로, 메시지 앱에서 "🦊 날쌘 여우"였던 방문자는 블로그 댓글에서도 "🦊 날쌘 여우"다.

## 구현 순서

서버 쪽 변경은 커밋 하나(19개 파일, 889줄 추가·205줄 삭제)였다.

1. `apps/api/src/visitors/`: 토큰 발급·조회, `hashVisitor`, `visitorName`(87줄)과 `GET /visitor`
2. 마이그레이션 `20261002110000_visitor_messages`: 댓글에 `visitorHash` 열 추가, 메시지용 `MessageThread`·`GuestMessage` 테이블과 CHECK 제약
3. `comments/`: 이름·비밀번호 검사를 `rules.ts`에서 제거하고, 쿠키에서 이름과 해시를 결정
4. `messages/`: 컨트롤러와 서비스(177줄) 신규 작성
5. 화면: 이름·비밀번호 입력 칸을 제거하고, 메시지 앱 저장소를 서버 구현으로 교체

댓글 테이블의 [CHECK 제약](https://www.postgresql.org/docs/current/ddl-constraints.html)은 "방문자 댓글에는 비밀번호가 있어야 한다"에서 "비밀번호나 방문자 해시 중 하나가 있어야 한다"로 바뀌었다. 기존 댓글(비밀번호가 있는 행), 새 댓글(방문자 해시가 있는 행), 관리자 댓글이 모두 통과한다.

```sql
CHECK (
  length(btrim("name")) BETWEEN 1 AND 20
  AND length(btrim("body")) BETWEEN 1 AND 500
  AND ("isAdmin" OR "passwordHash" IS NOT NULL OR "visitorHash" IS NOT NULL)
)
```

## 확인

| 종류    | 파일                                                  | 확인한 내용                                                                                                                                                                                                               |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위    | `apps/api/src/visitors/visitor.test.ts` (4개)         | 같은 토큰이면 항상 같은 이름이고 키가 다르면 다른 해시, 이름은 "이모지 수식어 동물" 형식이고 해시에 따라 고르게 분포, 토큰은 `randomToken(24)` 형식만 허용, 외부에 내보내는 작성자 값은 저장한 해시와 다름                |
| API e2e | `apps/api/test/messages.e2e.test.ts` (새 파일, 169줄) | 쿠키로 이름이 결정되는지, 같은 작성자의 말풍선이 같은 `authorId`로 묶이는지, 같은 브라우저에서 작성한 글만 삭제되고 관리자는 사이트 주인 이름으로 작성하고 모든 글을 삭제하는지, 피드백을 삭제하면 답글도 함께 삭제되는지 |
| API e2e | `apps/api/test/comments.e2e.test.ts`                  | 이름·비밀번호 없이 작성되는지, 다른 쿠키로는 삭제되지 않는지                                                                                                                                                              |

## 남은 것·배운 것

- 쿠키를 삭제하면 새 이름이 되고, 이전 글은 더 이상 삭제할 수 없다. 그 경우에는 관리자에게 요청해야 한다. 한 줄을 남기는 기능에서는 받아들일 수 있는 제약이라고 판단했다.
- 이름 재료 목록이 서버(`visitors/visitor.ts`)와 화면(`apps/messages/conversations.ts`) 두 곳에 있다. 서버 없이 실행할 때도 같은 방식으로 이름을 정하기 위한 것인데, 한쪽만 수정하면 이름이 달라진다. 2026-10-23 기준으로도 두 곳에 있으며, contracts 패키지로 옮길 후보다.
- 방문자 식별과 권한 부여를 같은 값으로 하면, 그 값은 쉽게 바뀌지 않아야 한다. IP는 식별에는 어느 정도 쓸 수 있지만 권한 판단에는 적합하지 않았다.
- 입력 칸 하나를 제거하는 작업이 화면만의 변경이 아니었다. 권한 모델, DB 제약, 저장 위치까지 함께 바뀌었다.

<details>
<summary>변경하게 된 계기</summary>

메시지 앱의 이름·비밀번호 입력 칸이 다른 화면과 형태가 맞지 않았다. 다음 날 메모 글에 댓글을 작성하려 하니 "이름을 입력해주세요", "비밀번호는 4~20자로" 오류만 표시되고 입력 칸은 보이지 않았다. 화면에서는 이름 칸을 제거했는데 서버는 여전히 이름과 비밀번호를 요구했던 것이다. 그래서 서버까지 같은 방식(방문자 쿠키)으로 맞췄다.

</details>

## 직접 확인하는 방법

```bash
pnpm dev:all
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
```

1. 브라우저 두 개(또는 일반 창과 시크릿 창)로 같은 글에 댓글을 작성한다.
2. 같은 창에서는 이름이 유지되고 자기 댓글만 삭제할 수 있어야 한다. 다른 창에서는 다른 이름이 표시되어야 한다.
3. 개발자 도구 Application → Cookies([Chrome DevTools 문서](https://developer.chrome.com/docs/devtools/application/cookies))에서 방문자 쿠키에 `HttpOnly`가 표시되는지 확인한다.

코드는 [apps/api/src/visitors/visitor.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/visitors/visitor.ts), 시험은 [apps/api/test/messages.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/messages.e2e.test.ts)에 있다.

참고 문서: [MDN HTTP 쿠키](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies), [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie), [Node.js crypto.createHmac](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options).

## 관련 글

- [scrypt 비밀번호 해시와 IP HMAC으로 저장하는 가입 없는 블로그 댓글](/memo/post-comments)
- [contracts의 zod 스키마로 메시지 앱의 서버 저장소와 로컬 저장소 타입 통합하기](/memo/contracts-messages)
- [서버 연결에 실패하면 메시지 앱을 닫는 경고창과 VITE_MESSAGES_STORE로 저장소 고르기](/memo/messages-offline)

PR: [#69](https://github.com/hyeoniverse/MacFolio/pull/69)

[^fingerprint]: 쿠키 없이 브라우저의 설정값(화면 크기, 설치된 글꼴, 시간대 등)을 조합해 방문자를 식별하는 기법. [MDN Fingerprinting](https://developer.mozilla.org/en-US/docs/Glossary/Fingerprinting) 참고.

[^vs]: 앞 글자를 이모지 형태로 표시하라고 지정하는 보이지 않는 문자(U+FE0F). 🐿️는 다람쥐 문자와 U+FE0F 두 코드 포인트로 이루어지므로, 코드 포인트 하나만 자르면 변형 선택자가 빠진다.

#MacFolio #백엔드 #메시지 #댓글
