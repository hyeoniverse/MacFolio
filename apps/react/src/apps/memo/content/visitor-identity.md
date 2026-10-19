---
title: 이름·비밀번호 없이 쓰는 메시지와 댓글 - 방문자 쿠키로 정하는 이름
date: 2026-10-02
category: 개발기/MacFolio/백엔드
summary: 메시지와 댓글에서 이름·비밀번호 칸을 없앴다. 서버가 처음 온 브라우저에 httpOnly 쿠키를 주고 그 HMAC 해시로 "🦊 날쌘 여우" 같은 이름(720가지)을 정한다. 지우기 권한도 쿠키를 따르고, 메시지 앱은 처음으로 서버에 저장한다.
---

메시지 앱(감상·의견·피드백)과 블로그 댓글은 글을 쓸 때마다 이름과 비밀번호를 받았다. 비밀번호는 나중에 자기 글을 지울 때 쓰는 것이었다. 휴대폰에서 보니 이 두 칸이 입력창보다 더 눈에 띄었고, 여백을 아무리 다듬어도 혼자 튀었다. 한 줄 남기려는 사람에게 이름과 비밀번호까지 정하게 하는 것도 번거롭다.

![메시지 전후](./images/visitor-identity-messages.jpg '전: 이름·비밀번호 칸 / 후: 입력창 위에 자동으로 정한 이름 한 줄')

## 이름은 무엇으로 정할까

처음 떠올린 것은 IP였다. 서버는 요청마다 IP를 알고, 댓글에는 이미 IP 앞 두 자리를 보여 주고 있었다. 그런데 IP는 사람을 가리기에 맞지 않는다.

| 방법                               | 같은 이름이 유지될 때   | 문제                                                                                                                |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| IP                                 | 같은 망에 있을 때       | 휴대폰은 와이파이·LTE를 오갈 때마다 바뀐다. 카페·회사는 여러 사람이 같은 IP를 써서 남의 이름과 삭제 권한을 가져간다 |
| 브라우저 지문 (화면 크기, 글꼴 등) | 쿠키를 지워도 어느 정도 | 개인정보 문제가 있고 Safari·Firefox가 막는다                                                                        |
| 로그인                             | 어느 기기에서나         | 한 줄 남기려고 로그인해야 한다                                                                                      |
| **서버가 주는 쿠키**               | 같은 브라우저면 언제나  | 사이트 데이터를 지우거나 시크릿 창이면 새 이름                                                                      |

쿠키로 정했다. 같은 사람을 "최대한" 알아보면서도 남의 것을 가져갈 일이 없다. IP는 지금처럼 도배를 막는 데만 쓴다.

## 서버가 주는 방문자 쿠키

처음 쓰거나 이름을 물으면(`GET /visitor`) 서버가 무작위 토큰을 쿠키로 준다. 관리자 로그인 세션과 같은 설정이다.

- `httpOnly`: 페이지의 자바스크립트가 읽거나 바꿀 수 없다. 남의 토큰을 흉내 내기 어렵다
- `SameSite=Lax`: 다른 사이트에서 보낸 요청에는 붙지 않는다
- 1년. 글을 쓸 때마다 다시 늘린다

DB에는 토큰 대신 비밀 키로 HMAC한 값만 둔다. DB가 새어도 그 값으로 쿠키를 만들 수 없다. 화면에 내보내는 "같은 사람" 구분값(말풍선 묶기)도 그 해시를 한 번 더 해시한 값이라, 응답에서 저장된 값을 알아낼 수 없다.

```ts
export const hashVisitor = (token: string, secret: string) =>
	createHmac('sha256', secret).update(`visitor:${token}`).digest('hex');
```

`visitor:`라는 앞말을 붙인 것은 같은 비밀 키를 다른 용도의 해시에도 쓸 때 값이 겹치지 않게 하려는 것이다. 쿠키 값도 아무 글자나 받지 않는다. `randomToken(24)`가 만드는 모양이 아니면 없는 것으로 보고 새 토큰을 준다.

![쿠키 토큰, DB의 해시, 응답의 authorId, 이름이 만들어지는 관계](./images/visitor-identity-hash-chain.svg '토큰은 브라우저에만 있다')

## 해시에서 이름 만들기

해시의 앞 8자리로 꾸밈말을, 그다음 8자리로 동물을 고른다. 꾸밈말 30개와 동물 24마리라 720가지다. 같은 해시면 늘 같은 이름이다.

```ts
export function visitorName(hexHash: string): string {
	const adjective = ADJECTIVES[parseInt(hexHash.slice(0, 8), 16) % ADJECTIVES.length];
	const [emoji, animal] = ANIMALS[parseInt(hexHash.slice(8, 16), 16) % ANIMALS.length];
	return `${emoji} ${adjective} ${animal}`;
}
```

이름이 겹칠 수는 있다. 그래서 IP 앞 두 자리 표시는 그대로 둔다("🦊 날쌘 여우(211.234)"). 아바타는 이름의 첫 글자 대신 동물 이모지다. `Array.from`으로 첫 글자를 자르면 🐿️처럼 변형 선택자가 붙은 이모지가 반으로 잘려서, 이름이 목록의 이모지로 시작하면 그 이모지를 통째로 쓴다.

## 지우기는 같은 브라우저에서

비밀번호가 없으니 지우기 권한도 쿠키를 따른다. 서버는 글마다 쓴 사람의 해시를 두고, 목록을 줄 때 `mine`(보고 있는 브라우저가 쓴 글인지)을 채운다. 화면은 `mine`인 글에만 지우기 메뉴를 보이고, 서버가 다시 확인한다. 관리자는 무엇이든 지운다.

![댓글 전후](./images/visitor-identity-comments.jpg '전: 이름·비밀번호 칸, 지울 때 비밀번호 / 후: 이름 한 줄, 내 댓글에만 지우기와 확인')

비밀번호를 묻던 창은 "메시지를 삭제할까요?" 확인창(공통 AlertDialog)으로 바뀌었다. 이름·비밀번호를 받던 때의 댓글은 쓴 사람의 해시가 없어서 관리자만 지울 수 있다. DB의 CHECK 제약도 "방문자 댓글에는 비밀번호가 있어야 한다"에서 "비밀번호나 방문자 해시 중 하나가 있어야 한다"로 바꿨다.

## 메시지 앱을 서버에

메시지 앱은 지금까지 글을 브라우저(localStorage)에만 저장했다. 다른 방문자는 서로의 글을 볼 수 없었다. 저장소를 인터페이스(`ConversationRepository`)로 나눠 두었기 때문에, 서버 구현을 하나 더하고 서버 주소가 있으면 그것을 고르게 했다.

```ts
repository = env.apiUrl ? createApiConversationRepository(env.apiUrl) : createLocalConversationRepository(visitorId());
```

서버는 피드백(`MessageThread`)과 말풍선(`GuestMessage`)을 저장한다. 사이트 주인의 고정 안내 글은 프론트엔드에 그대로 두고, 서버에는 거기 단 답글만 둔다(`threadId`가 빈 글). 서버 주소가 없을 때는 예전처럼 브라우저에 저장하는데, 이때도 이름은 브라우저 id로 같은 방식으로 정한다. 그래서 이름 재료 목록이 서버와 프론트엔드 두 곳에 있다.

메시지와 댓글이 같은 쿠키를 쓰니, 메시지 앱에서 "🦊 날쌘 여우"였던 사람은 블로그 댓글에서도 "🦊 날쌘 여우"다.

## 구현 순서

서버 쪽은 한 커밋(19파일, 889줄 추가·205줄 삭제)으로 들어갔다.

1. `apps/api/src/visitors/`: 토큰 만들기·읽기, `hashVisitor`, `visitorName`(87줄)과 `GET /visitor`
2. 마이그레이션 `20261002110000_visitor_messages`: 댓글에 `visitorHash` 열, 메시지용 `MessageThread`·`GuestMessage` 표와 CHECK 제약
3. `comments/`: 이름·비밀번호 검사를 `rules.ts`에서 빼고 쿠키에서 이름과 해시를 정한다
4. `messages/`: 컨트롤러와 서비스(177줄)를 새로 만들었다
5. 화면: 이름·비밀번호 칸을 지우고, 메시지 앱 저장소를 서버 구현으로 바꿨다

댓글의 CHECK 제약은 이렇게 바뀌었다. 예전 댓글(비밀번호가 있는 것)도, 새 댓글(방문자 해시가 있는 것)도, 관리자 댓글도 모두 통과한다.

```sql
CHECK (
  length(btrim("name")) BETWEEN 1 AND 20
  AND length(btrim("body")) BETWEEN 1 AND 500
  AND ("isAdmin" OR "passwordHash" IS NOT NULL OR "visitorHash" IS NOT NULL)
)
```

## 확인

- 단위 시험 `apps/api/src/visitors/visitor.test.ts` 4개: "같은 토큰이면 늘 같은 이름, 키가 다르면 다른 해시", "이름은 \"이모지 꾸밈말 동물\" 모양이고, 해시에 따라 골고루 나온다", "토큰 모양: randomToken(24)만 받는다", "밖으로 내보내는 글쓴이 값은 저장한 해시와 다르다"
- API e2e `apps/api/test/messages.e2e.test.ts`(새로 169줄): 쿠키로 이름이 정해지는지, 같은 사람의 말풍선이 같은 `authorId`로 묶이는지, "같은 브라우저에서 쓴 글만 지우고, 관리자는 김정현으로 쓰고 무엇이든 지운다", 피드백을 지우면 답글도 함께 지워지는지
- API e2e `comments.e2e.test.ts`: 이름·비밀번호 없이 쓰고, 다른 쿠키로는 지우지 못하는지

## 남은 것·배운 것

- 쿠키를 지우면 새 이름이 되고, 예전 글은 더 이상 지울 수 없다. 그때는 관리자에게 부탁해야 한다. 한 줄 남기는 곳에서는 받아들일 만한 값이라고 봤다.
- 이름 재료 목록이 서버(`visitors/visitor.ts`)와 화면(`apps/messages/conversations.ts`) 두 곳에 있다. 서버 없이 돌 때도 같은 방식으로 이름을 정하려는 것인데, 한쪽만 고치면 이름이 어긋난다. 나중에 contracts 패키지로 옮길 후보다.
- "누구인지 알아보기"와 "권한 주기"를 같은 값으로 하면 그 값이 쉽게 바뀌지 않아야 한다. IP는 알아보기에는 그럭저럭이지만 권한에는 맞지 않았다.
- 입력 칸 하나를 없애는 일이 화면만의 일이 아니었다. 권한 모델, DB 제약, 저장 위치까지 함께 바뀌었다.

## 바꾸게 된 일

메시지 앱의 이름·비밀번호 입력칸이 다른 화면과 너무 달라 보였다. 다음 날 메모에 댓글을 써 보려 하니 "이름을 입력해주세요", "비밀번호는 4~20자로" 오류만 나오고 입력칸은 보이지 않았다. 화면은 이름 칸을 지웠는데 서버는 아직 받으려 했던 것이다. 그래서 서버까지 같은 방식(방문자 쿠키)으로 맞췄다.

## 직접 확인하는 방법

```bash
pnpm dev:all
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
```

브라우저 두 개(또는 일반 창과 시크릿 창)로 같은 글에 댓글을 단다. 같은 창에서는 이름이 그대로이고 자기 댓글만 지울 수 있어야 하며, 다른 창에서는 다른 이름이 나와야 한다. 개발자 도구 Application → Cookies에서 방문자 쿠키가 `HttpOnly`인지 본다. 코드는 [apps/api/src/visitors/visitor.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/visitors/visitor.ts), 시험은 [apps/api/test/messages.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/messages.e2e.test.ts).

참고 문서: [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie), [Node.js crypto.createHmac](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options).

## 관련 글

- 블로그 댓글을 처음 만든 일: /memo/post-comments
- 메시지 규칙을 contracts로 옮긴 일: /memo/contracts-messages
- 서버 없이도 메시지를 쓰는 일: /memo/messages-offline
- PR: https://github.com/hyeoniverse/MacFolio/pull/69

#MacFolio #백엔드 #메시지 #댓글
