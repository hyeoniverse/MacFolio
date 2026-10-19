---
title: 시스템 설정에서 사람 확인을 켜고 끄기
date: 2026-10-10
category: 개발기/MacFolio/백엔드
summary: 메일에만 있던 Cloudflare Turnstile 사람 확인을 댓글·메시지에도 걸 수 있게 하고, macOS '개인정보 보호 및 보안' 모양 화면에서 관리자가 곳마다 켜고 끄게 했다. 설정은 서버 한 줄 표에 두고, 확인은 requireHuman 하나로 모았다.
---

메일 앱의 연락 메일에는 Cloudflare Turnstile로 사람인지 확인하는 단계가 있었다. 댓글과 메시지는 IP마다 1분에 몇 번까지만 받는 요청 제한뿐이었다. 사이트가 Cloudflare를 거쳐도, 스크립트가 API에 직접 요청을 보내는 것은 Cloudflare의 프록시가 막지 않는다. 그 요청을 막는 것은 사람 확인이다.

그렇다고 처음부터 모든 곳에 걸면 댓글을 쓸 때마다 확인 단계가 하나 늘어난다. 그래서 어디에 걸지를 **설정으로 켜고 끄게** 했다. 스팸이 오는 곳에만 켜면 된다.

어디에 그 설정을 둘지는 셋을 놓고 봤다.

| 방법                                            | 좋은 점                                           | 문제                                                                      |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| 모든 곳에 늘 건다                               | 설정이 없다                                       | 스팸이 없을 때도 방문자가 매번 기다린다                                   |
| 서버 환경 변수로 켜고 끈다                      | 코드가 짧다                                       | 바꿀 때마다 서버를 다시 띄워야 한다. 방문자는 지금 어디에 켜졌는지 모른다 |
| DB 한 줄에 두고 관리자가 화면에서 바꾼다 (고름) | 바로 적용되고, 방문자도 같은 화면에서 상태를 본다 | 표·API·화면이 하나씩 늘어난다                                             |

## 설정 화면

macOS 시스템 설정의 **개인정보 보호 및 보안**을 본떴다.

- 맨 위 칸: 손 아이콘과 설명, **더 알아보기…** (Finder에서 개인정보 처리 방침을 연다)
- **사람 확인 (Cloudflare Turnstile)** 묶음: 메일·댓글·메시지마다 색 아이콘, 언제 확인하는지, 켜기 스위치
- **이 브라우저** 묶음: 이 브라우저가 방문 분석에 들어가는지 (Global Privacy Control이나 로컬 주소면 꺼짐)

![개인정보 보호 및 보안](./images/privacy-security-settings-pane.jpg '방문자에게 보이는 화면. 서버 기본값(메일만 켜짐)을 흉내 낸 응답으로 띄웠다. 스위치는 관리자만 움직인다')

사이트 전체 설정이라 스위치는 **관리자만** 움직인다. 방문자에게는 같은 화면이 꺼진 스위치로 보여서, 지금 어디에 사람 확인이 켜져 있는지 알 수 있다. 서버에 Turnstile 키가 없으면 "켜 두어도 확인하지 않는다"고 알린다.

## 서버

설정은 한 줄짜리 표에 둔다.

```prisma
model SecuritySetting {
  id           Int     @id @default(1)
  contactHuman Boolean @default(true)
  commentHuman Boolean @default(false)
  messageHuman Boolean @default(false)
}
```

줄이 없으면 기본값(메일만)이다. 메일은 밖으로 나가는 것이라 처음부터 켜 둔다.

| 요청            | 누가   | 하는 일                                            |
| --------------- | ------ | -------------------------------------------------- |
| `GET /security` | 누구나 | 곳마다 켰는지, 키가 있는지(`available`), 사이트 키 |
| `PUT /security` | 관리자 | `{ comment: true }`처럼 바꿀 곳만                  |

쓰기마다 DB를 읽지 않게 설정은 메모리에 두고, 관리자가 바꾸면 새로 읽는다.

확인은 `SecurityService.requireHuman(곳, 토큰, IP, 관리자)` 하나로 한다. 메일·댓글·메시지(새 피드백과 답글)의 서비스가 입력 검사 뒤에 부른다.

```ts
async requireHuman(check: HumanCheck, token: string | undefined, ip: string, admin: AdminIdentity | null = null) {
	if (admin) return;
	const keys = this.keys;
	if (!keys) return;
	const { settings } = await this.load();
	if (!settings[check]) return;
	if (!(await verifyTurnstile(keys.secret, token, ip)))
		throw new BadRequestException('사람인지 확인하지 못했습니다. 다시 시도해 주세요.');
}
```

입력 검사 뒤에 부르므로, 내용이 비었거나 너무 긴 요청은 Cloudflare까지 가지 않고 400으로 끝난다.

- 관리자이거나, 그곳이 꺼져 있거나, 서버에 키가 없으면 그냥 지나간다
- 아니면 토큰을 Cloudflare(`siteverify`)에 묻고, 사람이 아니면 400

![쓰기 요청이 입력 검사 뒤 requireHuman에서 관리자, 꺼짐, 키 없음이면 통과하고 아니면 siteverify에 묻는 흐름](./images/privacy-security-settings-flow.svg '설정 한 줄을 메모리에 두고, 쓰기마다 세 질문을 지나 Cloudflare에 묻는다')

메일 서비스 안에 있던 Turnstile 확인 코드는 `common/turnstile.ts`로 꺼내 함께 쓴다. 메일의 `GET /contact`도 이제 설정을 따른다. 메일의 사람 확인을 끄면 사이트 키를 주지 않아서, 화면에 위젯이 생기지 않는다.

## 화면

메일 앱에 있던 Turnstile 위젯을 `shared/ui/turnstile`로 옮겼다. 쓰는 곳은 `useHumanCheck('comment')` 하나로 필요한 것을 받는다.

- 위젯에 쓸 사이트 키 (확인이 필요 없으면 null: 꺼져 있거나, 키가 없거나, 관리자)
- 받은 토큰과 보낼 준비가 됐는지(`ready`)
- `reset()`: 토큰은 한 번만 쓸 수 있어서 보낸 뒤에 새로 받는다

댓글은 입력 칸 아래, 메시지는 알약 입력창 위에 위젯이 생긴다. 확인이 끝나기 전에 보내면 "사람인지 확인하는 칸이 끝날 때까지 기다려 주세요"라고 알린다. 메시지를 서버 없이 이 브라우저에만 저장할 때(`VITE_MESSAGES_STORE=local`)는 확인하지 않는다.

## 시험이 먼저 찾은 것

E2E에서는 바깥 Turnstile 스크립트 대신 가짜를 쓴다. 처음 만든 가짜는 그리자마자 '사람 확인 완료'를 보이고 50ms 뒤에 토큰을 넘겼다. 시험은 그 글자를 보고 바로 보냈는데, 토큰이 오기 전이라 앱이 "기다려 주세요"로 막았다. 앱은 맞게 동작했고, 가짜가 거짓말을 한 것이다. 가짜가 토큰을 넘긴 **뒤에** 글자를 보이게 바꿨다.

두 번째 댓글에서도 같은 일이 있었다. 토큰을 새로 받으려고 위젯을 다시 그려도, 앞 위젯의 '사람 확인 완료' 글자가 그대로 남아 있었다. 그래서 가짜의 `remove()`가 글자를 지우게 했다. 그 뒤로 6번 반복해 36개 모두 통과했다.

## 시험

기능 커밋(`971bd125f`)은 34개 파일을 고쳤다. 서버 쪽 `security/` 폴더가 새로 생겼고, 메일 서비스의 Turnstile 코드 35줄이 `common/turnstile.ts`(27줄)로 옮겨 갔다. 시험이 가장 크다. API 통합 시험 `security.e2e.test.ts`가 190줄, 화면 E2E `privacy.spec.ts`가 120줄이다.

- 단위: 설정 입력(켜고 끌 곳만, true/false만, 빈 몸통 거절)
- API e2e: 처음에는 메일만 켜짐, 방문자는 401, 잘못된 값 400 / 댓글에 켜면 토큰이 없거나 사람이 아니면 400, 사람이면 쓰고, 관리자는 확인하지 않음, 끄면 다시 그냥 / 메시지의 새 피드백과 답글 / 메일을 끄면 사이트 키를 주지 않음 / 키가 없으면 켜도 확인하지 않음
- 경로 표: `GET /security`(공개), `PUT /security`(관리자)
- E2E: 방문자에게는 꺼진 스위치와 안내, 더 알아보기는 개인정보 처리 방침 / 관리자가 켜고 끄면 서버에 저장 / 키가 없을 때 안내 / 댓글·메시지에 켜면 위젯이 생기고 토큰과 함께 보냄(댓글마다 새 토큰) / 꺼져 있으면 위젯이 없음

API 시험 이름은 "처음에는 메일만 확인한다. 누구나 읽고, 바꾸기는 관리자만", "댓글: 켜면 토큰이 없거나 사람이 아니면 400, 사람이면 쓴다. 관리자는 확인하지 않는다. 끄면 다시 그냥", "메일: 끄면 사이트 키를 주지 않고, 토큰 없이도 사람 확인을 건너뛴다"처럼 위 목록과 하나씩 맞는다.

## 남은 것·배운 것

- 서버에 Turnstile 키가 없으면 켜 두어도 확인하지 않는다. 쓰기는 막히지 않지만 사람 확인도 없는 상태라, 화면이 "켜 두어도 확인하지 않는다"고 알리는 문구를 놓치지 않아야 한다.
- 설정은 메모리에 두고 관리자가 바꿀 때만 새로 읽는다. API 서버가 한 대라 가능한 방식이다. 여러 대가 되면 다른 서버의 메모리는 바뀌지 않는다.
- 가짜 Turnstile이 "확인 완료"를 토큰보다 먼저 보인 일처럼, 시험용 가짜도 진짜와 같은 순서를 지켜야 시험이 믿을 만하다. 가짜가 거짓말을 하면 앱이 맞게 막아도 시험이 실패한다.
- 쓰기를 막는 장치는 사람 확인 말고도 요청 제한이 있다. 둘은 같이 쓴다([쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)).

## 따라 하는 방법

1. Cloudflare 대시보드 → Turnstile에서 위젯을 하나 만들고 사이트 주소를 넣는다. 사이트 키와 비밀 키가 나온다
2. 서버 `~/deploy/api.env`에 `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`를 넣고 `docker compose up -d api`
3. 관리자로 시스템 설정 → 개인정보 보호 및 보안에서 메일·댓글·메시지마다 켠다

확인은 로그아웃한 창에서 댓글을 써 보는 것이다. 입력 칸 아래에 사람 확인 위젯이 보이고, 확인이 끝나기 전에 보내면 기다려 달라는 안내가 나와야 한다. 되돌리려면 설정에서 끄거나, 두 키를 비우면 서버가 확인 자체를 하지 않는다. 서버 쪽은 [apps/api/src/common/turnstile.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/common/turnstile.ts), 시험은 `cd apps/react && npx playwright test e2e/privacy.spec.ts`와 [apps/api/test/security.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/security.e2e.test.ts). 무엇을 모으는지는 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)에 있다.

참고 문서: [Cloudflare Turnstile 시작하기](https://developers.cloudflare.com/turnstile/get-started/), [서버 쪽 검증](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## 관련 글

- [쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)
- [댓글에 남기지 않은 것들](/memo/post-comments)
- [서버가 없으면 메시지 앱을 열지 않기](/memo/messages-offline)

#MacFolio #백엔드 #보안 #Cloudflare #개인정보
