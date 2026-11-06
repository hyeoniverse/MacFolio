---
title: httpOnly 방문자 쿠키의 HMAC 해시로 가입 없이 방문자 식별하기
date: 2026-10-02
category: 개발 기록/MacFolio/서버·API
summary: 메시지와 댓글에서 이름·비밀번호 입력 칸을 제거했다. 서버가 처음 방문한 브라우저에 httpOnly 쿠키를 발급하고, 그 HMAC 해시로 "🦊 날쌘 여우" 같은 이름(720가지)을 정한다. 삭제 권한도 쿠키를 기준으로 판단하고, 메시지 앱은 처음으로 서버에 저장한다.
---

## 배경: 가입 없는 사이트의 방문자 구분

MacFolio에는 방문자가 글을 남기는 곳이 두 군데 있다. 메시지 앱(감상·의견·피드백)과 블로그 글 아래의 댓글이다. 회원 가입이 없으므로 서버는 "이 댓글을 쓴 사람이 지금 삭제를 요청한 사람과 같은가"를 판단할 근거가 필요하다. 기존에는 글을 작성할 때마다 이름과 비밀번호를 입력받고, 삭제를 요청하면 같은 비밀번호를 다시 입력받아 비교했다.

이 방식에는 세 가지 비용이 있었다.

| 항목          | 내용                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| 화면          | 휴대폰 화면에서 이름·비밀번호 입력 칸 두 개가 본문 입력창보다 크게 표시되었다 |
| 입력 부담     | 한 줄을 남기려는 방문자가 이름과 4~20자 비밀번호를 정해야 했다                |
| 비밀번호 보관 | 비밀번호를 잊으면 삭제할 수 없고, 서버는 비밀번호 해시를 보관해야 했다        |

[#69](https://github.com/hyeoniverse/MacFolio/pull/69)에서 두 입력 칸을 제거하고, 서버가 브라우저마다 발급하는 **방문자 쿠키**로 작성자를 구분하게 했다. 이 방식을 이해하는 데 필요한 용어는 다음 세 가지다.

- **쿠키**: 서버가 응답 헤더 `Set-Cookie`로 브라우저에 저장시키는 작은 이름=값 쌍이다. 브라우저는 이후 같은 사이트로 보내는 요청마다 `Cookie` 헤더에 그 값을 자동으로 붙인다. 예를 들어 서버가 `Set-Cookie: theme=dark`를 보내면, 다음 요청부터 `Cookie: theme=dark`가 함께 전송된다.
- **해시 함수**: 임의 길이의 입력을 고정 길이의 값으로 변환하는 함수다. SHA-256은 어떤 입력이든 256비트(16진수 64자) 값을 만들고, 같은 입력에는 항상 같은 값을, 입력이 한 글자만 달라도 전혀 다른 값을 낸다. 결과에서 입력을 거꾸로 계산할 수 없다.
- **HMAC**: 해시 함수에 비밀 키를 섞어 계산하는 방식이다([RFC 2104](https://www.rfc-editor.org/rfc/rfc2104)). 같은 입력이라도 키를 모르면 같은 결과를 만들 수 없다. 서버만 아는 키로 계산하면, 결과 값을 가진 제삼자가 입력을 추측해 대조하는 공격도 막을 수 있다.

![메시지 전후](./images/visitor-identity-messages.jpg '전: 이름·비밀번호 칸 / 후: 입력창 위에 자동으로 정한 이름 한 줄')

## 방문자를 구분하는 기준

처음 검토한 기준은 IP 주소였다. 서버는 요청마다 IP를 알고, 댓글에는 이미 IP 앞 두 자리를 표시하고 있었다. 그러나 IP는 사람이 아니라 네트워크 연결에 붙는 주소다. 같은 사람의 IP가 바뀌고, 다른 사람이 같은 IP를 쓰는 경우가 흔하다.

- 휴대폰은 Wi-Fi에서 LTE로 전환하면 IP가 바뀐다. 집에서 쓴 댓글을 지하철에서 삭제하려 하면 다른 사람으로 판단된다.
- 카페·회사·학교는 공유기 하나 뒤의 여러 기기가 공인 IP 하나를 함께 쓴다. 이 방식을 NAT[^nat]라 한다. 같은 카페의 다른 손님이 내 댓글의 삭제 권한을 얻는다.

| 방법                                             | 같은 이름이 유지되는 조건 | 문제                                                                                                                                     |
| ------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| IP                                               | 같은 네트워크에 있는 동안 | 휴대폰은 Wi-Fi와 LTE를 전환할 때마다 IP가 바뀐다. 카페·회사는 여러 사람이 같은 공인 IP를 쓰므로 다른 사람의 이름과 삭제 권한을 얻게 된다 |
| 브라우저 지문[^fingerprint] (화면 크기, 글꼴 등) | 쿠키를 삭제해도 일부 유지 | 개인정보 침해 소지가 있고 Safari·Firefox가 지문 수집을 차단한다                                                                          |
| 로그인                                           | 어느 기기에서나           | 한 줄을 남기려고 로그인해야 한다                                                                                                         |
| **서버가 발급하는 쿠키** (채택)                  | 같은 브라우저라면 항상    | 사이트 데이터를 삭제하거나 시크릿 창을 쓰면 새 이름이 된다                                                                               |

쿠키를 선택했다. 같은 브라우저는 계속 같은 방문자로 인식하고, 다른 브라우저가 그 값을 우연히 갖게 되는 경우가 없다. ==IP는 기존처럼 도배 방지(요청 횟수 제한)에만 사용==한다.

## 서버가 발급하는 방문자 쿠키

처음 글을 작성하거나 이름을 조회하면(`GET /visitor`) 서버가 무작위 토큰을 만들어 `macfolio_visitor` 쿠키로 발급한다. 토큰은 `randomToken(24)`가 만든 24바이트 난수를 base64url[^b64]로 인코딩한 32자 문자열이다. 목록 조회처럼 읽기만 하는 요청에서는 쿠키를 새로 발급하지 않고, 있는 쿠키만 확인한다.

![첫 요청에 쿠키가 없으면 Set-Cookie로 토큰을 받고, 이후 요청마다 Cookie 헤더로 토큰을 보낸다](./images/visitor-identity-cookie-flow.svg '① 쿠키 없는 첫 요청 → ② Set-Cookie로 토큰 발급 → ③ 이후 요청마다 Cookie 헤더로 토큰 전송 → ④ 서버가 해시로 이름을 정해 응답')

쿠키 속성은 관리자 로그인 세션 쿠키와 같다.

| 속성       | 값                 | 의미                                                                                                                                                       |
| ---------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HttpOnly` | 켜짐               | 페이지의 JavaScript(`document.cookie`)가 쿠키를 읽거나 변경할 수 없다. 공격자가 페이지에 스크립트를 삽입하는 XSS[^xss] 공격을 해도 토큰을 읽어 가지 못한다 |
| `SameSite` | `Lax`              | 다른 사이트에서 시작한 하위 요청(이미지, fetch 등)에는 쿠키를 붙이지 않는다                                                                                |
| `Secure`   | 운영 환경에서 켜짐 | HTTPS 연결에서만 전송한다                                                                                                                                  |
| `Max-Age`  | 1년                | 글을 작성할 때마다 다시 1년으로 연장한다                                                                                                                   |

예를 들어 쿠키 없이 로컬 API 서버에 `GET /visitor`를 보내면 응답에 다음 헤더가 붙는다. 운영 환경에서는 `HttpOnly` 뒤에 `Secure`가 더해진다.

```http
Set-Cookie: macfolio_visitor=ZyOZlgfpHpLzJz3AKmK2ewBxAvwBZPck; Max-Age=31536000; Path=/; Expires=Sat, 06 Nov 2027 17:15:07 GMT; HttpOnly; SameSite=Lax
```

`Max-Age`는 초 단위라 1년은 `365 × 24 × 60 × 60 = 31,536,000`이다. Express의 `res.cookie()`는 `maxAge` 옵션을 받으면 같은 만료 시각을 `Expires`(절대 시각)로도 함께 보낸다. 두 속성이 모두 있으면 브라우저는 `Max-Age`를 우선한다. 쿠키 값의 형식도 검사한다. 정규식 `/^[\w-]{32}$/`(영문·숫자·`_`·`-` 32자)와 맞지 않으면 쿠키가 없는 것으로 처리하고 새 토큰을 발급한다. 개발자 도구에서 쿠키 값을 임의 문자열로 바꾼 뒤 글을 작성하면 새 이름이 된다.

## DB에는 토큰 대신 HMAC

DB에는 토큰 원문을 저장하지 않는다. 서버만 아는 비밀 키로 계산한 [HMAC](https://developer.mozilla.org/en-US/docs/Glossary/HMAC) 값(`visitorHash`)만 저장한다. ==DB가 유출되어도 그 값으로 쿠키를 만들 수 없다.== 쿠키에 넣어야 하는 값은 토큰 원문이고, 해시에서 토큰을 역산할 수 없기 때문이다.

```ts
export const hashVisitor = (token: string, secret: string) =>
	createHmac('sha256', secret).update(`visitor:${token}`).digest('hex');
```

![HMAC 계산 구조: 키를 i_pad·o_pad와 XOR한 뒤 메시지와 함께 두 번 해시한다](./images/visitor-identity-hmac-structure.svg 'HMAC의 내부 구조(그림은 SHA-1 기준). 키를 내부·외부 패드와 XOR해 두 번 해시하므로, 키를 모르면 같은 출력을 만들 수 없다. SHA-256도 블록 64바이트로 구조가 같고 출력만 32바이트다')

[RFC 2104](https://www.rfc-editor.org/rfc/rfc2104)가 정의한 HMAC은 위 그림처럼 해시를 두 번 계산한다. 키를 내부 패드(`0x36` 반복)와 XOR한 값 뒤에 메시지를 이어 붙여 한 번 해시하고, 키를 외부 패드(`0x5c` 반복)와 XOR한 값 뒤에 첫 결과를 이어 붙여 다시 해시한다. 키가 두 단계 모두에 들어가므로, 키 없이 해시 함수만으로는 같은 결과를 만들 수 없다.

`visitor:` 접두사는 같은 비밀 키(`IP_HASH_SECRET`)를 쓰는 다른 해시와 결과가 겹치지 않게 하는 구분자다. 같은 키로 IP(`hashIp`), 관리자 IP(`admin-ip:`), 방문 통계(`analytics:`)도 해시한다. 접두사가 없으면 우연히 IP 문자열과 같은 토큰이 있으면 두 해시가 같아진다.

화면에 내보내는 "같은 작성자" 구분값(말풍선 묶기에 사용하는 `authorId`)도 `visitorHash`를 SHA-256으로 한 번 더 해시해 앞 16자만 쓴다. 응답을 모두 수집해도 DB에 저장된 값을 알아낼 수 없다.

![쿠키 토큰, DB의 해시, 응답의 authorId, 이름이 만들어지는 관계](./images/visitor-identity-hash-chain.svg '토큰은 브라우저에만 있다')

| 값            | 저장 위치           | 외부 노출         | 역할                          | 예시 (앞부분)              |
| ------------- | ------------------- | ----------------- | ----------------------------- | -------------------------- |
| 토큰          | 브라우저 쿠키       | 없음 (`HttpOnly`) | 방문자 식별의 원본            | `k3Jp9xQ2vL8mN4bR…` (32자) |
| `visitorHash` | DB (댓글·메시지 행) | 없음              | 작성자 확인, 삭제 권한 판단   | `0ce1f996aa01ac52…` (64자) |
| `authorId`    | API 응답            | 있음              | 같은 작성자의 말풍선 묶기     | `82eabf3f4fbc9bc0` (16자)  |
| 이름          | API 응답, 화면      | 있음              | "🦊 날쌘 여우" 같은 표시 이름 | `🐰 다정한 토끼`           |

표의 예시는 토큰 `k3Jp9xQ2vL8mN4bR7tY1wE6uI0oA5sDf`와 비밀 키 `example-secret`으로 실제 계산한 값이다. 비밀 키만 `other-secret`으로 바꾸면 `visitorHash`는 `214269f57d75…`로 완전히 달라진다.

## 해시에서 이름 만들기

해시의 앞 8자리로 수식어를, 그다음 8자리로 동물을 선택한다. 수식어 30개와 동물 24개라 조합은 720가지다. 해시가 같으면 이름도 항상 같다.

```ts
export function visitorName(hexHash: string): string {
	const adjective = ADJECTIVES[parseInt(hexHash.slice(0, 8), 16) % ADJECTIVES.length];
	const [emoji, animal] = ANIMALS[parseInt(hexHash.slice(8, 16), 16) % ANIMALS.length];
	return `${emoji} ${adjective} ${animal}`;
}
```

16진수 8자리는 0부터 4,294,967,295(2³²−1)까지의 정수다. 이 값을 목록 길이로 나눈 나머지가 목록의 위치(인덱스)가 된다. 위 표의 해시로 계산하면 다음과 같다.

![해시 앞 8자리 0ce1f996은 216,136,086이고 30으로 나눈 나머지 6이 '다정한', 다음 8자리 aa01ac52는 2,852,236,370이고 24로 나눈 나머지 2가 '🐰 토끼'](./images/visitor-identity-name-pick.svg '해시 16자리에서 이름 하나를 고르는 계산. 해시가 바뀌지 않으면 이름도 바뀌지 않는다')

2³²은 30이나 24로 나누어떨어지지 않으므로 나머지 분포가 완전히 균등하지는 않다. 2³²을 30으로 나누면 몫이 143,165,576이고 나머지가 16이라, 수식어 16개가 다른 14개보다 한 번씩 더 선택될 수 있다. 차이는 약 1억 4천만 분의 1이라 이름 선택에는 영향이 없다.

이름은 겹칠 수 있다(720가지). 방문자가 32명만 되어도 이름이 같은 두 사람이 있을 확률이 50%를 넘는다[^birthday]. 그래서 IP 앞 두 자리 표시는 유지한다(예: "🦊 날쌘 여우(IP 앞 두 자리)"). 아바타는 이름의 첫 글자 대신 동물 이모지를 사용한다. [`Array.from`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from)으로 첫 글자를 자르면 🐿️처럼 변형 선택자[^vs]가 붙은 이모지가 둘로 잘린다. 실제로 `Array.from('🐿️')`의 결과는 `['🐿', '️']` 두 원소다. 그래서 이름이 동물 목록의 이모지로 시작하면 그 이모지 전체를 사용한다.

## 같은 브라우저에서만 삭제

비밀번호가 없으므로 삭제 권한도 쿠키를 기준으로 판단한다.

1. 서버는 글마다 작성자의 `visitorHash`를 저장한다.
2. 목록을 응답하면서 `mine`(요청한 브라우저가 작성한 글인지)을 채운다.
3. 화면은 `mine`인 글에만 삭제 메뉴를 표시한다.
4. 삭제 요청을 받으면 서버가 쿠키의 해시와 글의 `visitorHash`를 다시 비교한다. 관리자는 모든 글을 삭제할 수 있다.

3번만으로는 부족하다. 화면의 메뉴를 숨겨도 누구나 `DELETE /comments/:id` 요청을 직접 보낼 수 있으므로, 권한 판단은 4번의 서버 비교가 담당한다.

![댓글 전후](./images/visitor-identity-comments.jpg#float-right '전: 이름·비밀번호 칸, 삭제 시 비밀번호 입력 / 후: 이름 한 줄, 내 댓글에만 삭제 메뉴와 확인창')

비밀번호를 입력받던 창은 "메시지를 삭제할까요?" 확인창(공통 `AlertDialog`)으로 바뀌었다. 이름·비밀번호 방식으로 작성된 기존 댓글은 작성자 해시가 없어서 관리자만 삭제할 수 있다.

다른 브라우저에서 같은 댓글에 삭제를 요청하면 쿠키의 해시가 다르므로 서버가 거부한다. 이 동작은 API e2e 시험("다른 쿠키로는 삭제되지 않는다")으로 확인한다.

## 메시지 앱의 서버 저장

메시지 앱은 이전까지 글을 브라우저의 localStorage(사이트별로 브라우저 안에 문자열을 보관하는 저장 공간)에만 저장했다. 다른 방문자는 서로의 글을 볼 수 없었다. 저장소를 인터페이스(`ConversationRepository`)로 분리해 두었기 때문에, 서버 구현을 하나 추가하고 서버 주소가 설정되어 있으면 서버 구현을 선택하게 했다.

```ts
repository = env.apiUrl ? createApiConversationRepository(env.apiUrl) : createLocalConversationRepository(visitorId());
```

> [!NOTE]
> 이 선택 방식은 이후 `VITE_MESSAGES_STORE` 환경 변수로 바뀌었다([첫 요청 실패와 사용 중 연결 끊김을 구분하는 메시지 앱 오류 처리](/memo/messages-offline)).

서버는 피드백(`MessageThread`)과 말풍선(`GuestMessage`)을 저장한다. 사이트 주인의 고정 안내 글은 프론트엔드 코드에 그대로 두고, 서버에는 그 글에 단 답글만 저장한다(`threadId`가 빈 글). 서버를 사용하지 않으면 이전처럼 브라우저에 저장하는데, 이 경우에도 브라우저 id로 같은 방식의 이름을 정한다. 그래서 이름 재료 목록이 서버와 프론트엔드 두 곳에 있다.

메시지와 댓글이 같은 쿠키를 사용하므로, 메시지 앱에서 "🦊 날쌘 여우"였던 방문자는 블로그 댓글에서도 "🦊 날쌘 여우"다.

## 구현 순서

서버 쪽 변경은 커밋 하나(19개 파일, 889줄 추가·205줄 삭제)였다.

1. `apps/api/src/visitors/`: 토큰 발급·조회, `hashVisitor`, `visitorName`(87줄)과 `GET /visitor`
2. 마이그레이션 `20261002110000_visitor_messages`: 댓글에 `visitorHash` 열 추가, 메시지용 `MessageThread`·`GuestMessage` 테이블과 CHECK 제약
3. `comments/`: 이름·비밀번호 검사를 `rules.ts`에서 제거하고, 쿠키에서 이름과 해시를 결정
4. `messages/`: 컨트롤러와 서비스(177줄) 신규 작성
5. 화면: 이름·비밀번호 입력 칸을 제거하고, 메시지 앱 저장소를 서버 구현으로 교체

[CHECK 제약](https://www.postgresql.org/docs/current/ddl-constraints.html)은 행을 저장하기 전에 DB가 검사하는 조건식이다. 조건이 거짓인 행은 애플리케이션 코드에 결함이 있어도 저장되지 않는다. 댓글 테이블의 CHECK 제약은 "방문자 댓글에는 비밀번호가 있어야 한다"에서 "비밀번호나 방문자 해시 중 하나가 있어야 한다"로 바뀌었다.

```sql
CHECK (
  length(btrim("name")) BETWEEN 1 AND 20
  AND length(btrim("body")) BETWEEN 1 AND 500
  AND ("isAdmin" OR "passwordHash" IS NOT NULL OR "visitorHash" IS NOT NULL)
)
```

| 행 종류                          | `isAdmin` | `passwordHash` | `visitorHash` | 통과 |
| -------------------------------- | --------- | -------------- | ------------- | ---- |
| 기존 방문자 댓글 (비밀번호 방식) | false     | 있음           | 없음          | 통과 |
| 새 방문자 댓글 (쿠키 방식)       | false     | 없음           | 있음          | 통과 |
| 관리자 댓글                      | true      | 없음           | 없음          | 통과 |
| 작성자 정보가 없는 방문자 댓글   | false     | 없음           | 없음          | 거부 |

## 확인

| 종류    | 파일                                                  | 확인한 내용                                                                                                                                                                                                               |
| ------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위    | `apps/api/src/visitors/visitor.test.ts` (4개)         | 같은 토큰이면 항상 같은 이름이고 키가 다르면 다른 해시, 이름은 "이모지 수식어 동물" 형식이고 해시에 따라 고르게 분포, 토큰은 `randomToken(24)` 형식만 허용, 외부에 내보내는 작성자 값은 저장한 해시와 다름                |
| API e2e | `apps/api/test/messages.e2e.test.ts` (새 파일, 169줄) | 쿠키로 이름이 결정되는지, 같은 작성자의 말풍선이 같은 `authorId`로 묶이는지, 같은 브라우저에서 작성한 글만 삭제되고 관리자는 사이트 주인 이름으로 작성하고 모든 글을 삭제하는지, 피드백을 삭제하면 답글도 함께 삭제되는지 |
| API e2e | `apps/api/test/comments.e2e.test.ts`                  | 이름·비밀번호 없이 작성되는지, 다른 쿠키로는 삭제되지 않는지                                                                                                                                                              |

직접 확인하려면 API와 화면을 함께 실행한다.

```bash
pnpm dev:all
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
```

1. 브라우저 두 개(또는 일반 창과 시크릿 창)로 같은 글에 댓글을 작성한다.
2. 같은 창에서는 이름이 유지되고 자기 댓글만 삭제할 수 있어야 한다. 다른 창에서는 다른 이름이 표시되어야 한다.
3. 개발자 도구 Application → Cookies([Chrome DevTools 문서](https://developer.chrome.com/docs/devtools/application/cookies))에서 `macfolio_visitor` 쿠키의 HttpOnly 열에 체크 표시가 있는지 확인한다. 콘솔에서 `document.cookie`를 실행해도 이 쿠키는 나오지 않는다.

코드는 [apps/api/src/visitors/visitor.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/visitors/visitor.ts), 시험은 [apps/api/test/messages.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/messages.e2e.test.ts)에 있다.

<details>
<summary>변경하게 된 계기</summary>

메시지 앱의 이름·비밀번호 입력 칸이 다른 화면과 형태가 맞지 않았다. 다음 날 메모 글에 댓글을 작성하려 하니 "이름을 입력해주세요", "비밀번호는 4~20자로" 오류만 표시되고 입력 칸은 보이지 않았다. 화면에서는 이름 칸을 제거했는데 서버는 여전히 이름과 비밀번호를 요구했기 때문이다. 그래서 서버까지 같은 방식(방문자 쿠키)으로 맞췄다.

</details>

## 남은 과제

- 쿠키를 삭제하면 새 이름이 되고, 이전 글은 더 이상 삭제할 수 없다. 그 경우에는 관리자에게 요청해야 한다. 한 줄을 남기는 기능에서는 받아들일 수 있는 제약이라고 판단했다.
- 이름 재료 목록이 서버(`visitors/visitor.ts`)와 화면(`apps/messages/conversations.ts`) 두 곳에 있다. 서버 없이 실행해도 같은 방식으로 이름을 정하기 위한 구성인데, 한쪽만 수정하면 이름이 달라진다. 2026-10-23 기준으로도 두 곳에 있으며, contracts 패키지로 옮길 후보다.

> [!IMPORTANT]
> 방문자 식별과 권한 부여를 같은 값으로 하면, 그 값은 같은 사람에게 계속 유지되고 다른 사람에게는 넘어가지 않아야 한다. ==IP는 식별에는 어느 정도 쓸 수 있지만 권한 판단에는 적합하지 않았다.== 또 입력 칸 하나를 제거하는 작업이 권한 모델, DB 제약, 저장 위치까지 함께 바꾸었다.

## 관련 글

- [scrypt 비밀번호 해시와 IP HMAC만 저장하는 가입 없는 댓글](/memo/post-comments)
- [zod 스키마로 서버 저장소와 로컬 저장소의 메시지 타입 통합하기](/memo/contracts-package#메시지-스키마와-두-저장소-구현-202)
- [첫 요청 실패와 사용 중 연결 끊김을 구분하는 메시지 앱 오류 처리](/memo/messages-offline)

PR: [#69](https://github.com/hyeoniverse/MacFolio/pull/69)

[^nat]: NAT(Network Address Translation)는 공유기가 내부 기기들의 사설 IP(예: 192.168.0.x)를 공인 IP 하나로 바꿔 인터넷에 내보내는 기술이다. 외부 서버에서는 같은 공유기 뒤의 기기들이 모두 같은 IP로 보인다.

[^fingerprint]: 쿠키 없이 브라우저의 설정값(화면 크기, 설치된 글꼴, 시간대 등)을 조합해 방문자를 식별하는 기법. [MDN Fingerprinting](https://developer.mozilla.org/en-US/docs/Glossary/Fingerprinting) 참고.

[^b64]: base64url은 바이트를 영문 대소문자·숫자·`-`·`_` 64개 문자로 표현하는 인코딩이다. 3바이트가 4글자가 되므로 24바이트는 32글자다. 일반 base64의 `+`·`/` 대신 `-`·`_`를 써서 URL과 쿠키에 그대로 넣을 수 있다.

[^xss]: XSS(Cross-Site Scripting)는 공격자가 게시물 같은 입력에 스크립트를 끼워 넣어 다른 방문자의 브라우저에서 실행되게 하는 공격이다. 실행된 스크립트는 그 페이지의 JavaScript가 접근할 수 있는 값을 모두 읽을 수 있다.

[^birthday]: 생일 문제와 같은 계산이다. n명이 모두 다른 이름일 확률은 (720/720)×(719/720)×…×((720−n+1)/720)이고, n = 32에서 약 0.50 아래로 내려간다.

[^vs]: 앞 글자를 이모지 형태로 표시하라고 지정하는 보이지 않는 문자(U+FE0F). 🐿️는 다람쥐 문자(U+1F43F)와 U+FE0F 두 코드 포인트로 이루어지므로, 코드 포인트 하나만 자르면 변형 선택자가 빠진다.

<details>
<summary>참고 문헌</summary>

- MDN, [HTTP 쿠키 사용하기](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- MDN, [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- MDN, [HMAC](https://developer.mozilla.org/en-US/docs/Glossary/HMAC)
- IETF, [RFC 2104: HMAC: Keyed-Hashing for Message Authentication](https://www.rfc-editor.org/rfc/rfc2104)
- IETF, [RFC 4648 §5: Base 64 Encoding with URL and Filename Safe Alphabet](https://www.rfc-editor.org/rfc/rfc4648#section-5)
- Express, [res.cookie()](https://expressjs.com/en/api.html#res.cookie)
- Node.js, [crypto.createHmac](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options)
- MDN, [Fingerprinting](https://developer.mozilla.org/en-US/docs/Glossary/Fingerprinting)
- PostgreSQL, [Constraints: Check Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- Chrome for Developers, [View, add, edit, and delete cookies](https://developer.chrome.com/docs/devtools/application/cookies)

</details>

<details>
<summary>사진 출처</summary>

- HMAC 구조 그림: Gdrooid, Wikimedia Commons, [File:SHAhmac.svg](https://commons.wikimedia.org/wiki/File:SHAhmac.svg), CC0 (흰 바탕과 viewBox만 추가)

</details>

#MacFolio #백엔드 #메시지 #댓글
