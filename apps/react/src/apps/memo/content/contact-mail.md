---
title: 메일 앱에서 진짜로 메일 보내기 - Resend와 Turnstile
date: 2026-10-07
category: 개발기/MacFolio/백엔드
summary: mailto 링크이던 메일 앱의 보내기를 서버가 Resend로 직접 보내게 했다. 방문자 주소는 Reply-To로, 스팸은 Turnstile과 하루 상한으로 막고, 설정이 없으면 예전처럼 메일 앱을 연다. 보내는 길 비교, 요청 한 번의 순서, 시험과 그 뒤 바뀐 것까지.
---

메일 앱의 '새로운 메시지'는 받는 사람이 나로 고정된 연락 창이다. 그런데 보내기를 누르면 서버가 아니라 **방문자의 메일 앱**이 열렸다(`mailto:`). 메일 앱을 쓰지 않는 사람은 거기서 멈추고, 쓰는 사람도 한 번 더 보내기를 눌러야 했다. 이슈(#25)에 적어 둔 대로 서버가 보내게 했다. 첫 커밋은 PR [#162](https://github.com/hyeoniverse/MacFolio/pull/162)로 머지됐고, 지금 `apps/api/src/contact/`는 다섯 파일 327줄이다.

![메일 보내기 흐름](./images/contact-mail-flow.svg '서버가 다시 검사하고 상한을 본 뒤 Resend로. 설정이 없으면 예전처럼 메일 앱')

## 무엇으로 보내나: Resend

서버는 Oracle의 무료 VM이다. 메일을 직접 보내려면 SMTP(25·587번 포트)를 써야 하는데, 클라우드는 이 포트를 막아 두는 경우가 많고, 스팸 평판도 직접 관리해야 한다. 그래서 **HTTPS API로 보내는 메일 서비스**를 골랐다. Resend의 무료 요금제는 월 3,000통, 하루 100통이다. 방문자 문의에는 넉넉하다.

| 길                                 | 좋은 점                           | 문제                                                          |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------------- |
| `mailto:` (전)                     | 서버가 필요 없다                  | 메일 앱이 없으면 멈춘다. 보내기를 두 번 누른다                |
| 서버에서 SMTP로 직접               | 바깥 서비스가 없다                | 클라우드가 25·587을 막는 일이 많다. 스팸 평판을 직접 관리한다 |
| Gmail 같은 개인 계정의 SMTP        | 이미 있는 계정                    | 앱 비밀번호를 서버에 둔다. 보내는 주소가 개인 주소가 된다     |
| HTTPS 메일 API, Resend (고른 방법) | 443 하나로 된다. 도메인 인증 지원 | 바깥 서비스 키를 서버에 둔다                                  |

```ts
await fetch('https://api.resend.com/emails', {
	method: 'POST',
	headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
	body: JSON.stringify({ from, to: [to], reply_to: visitor.email, subject, text }),
});
```

- **받는 사람**은 늘 나 한 명이다. 서버 환경 변수(`CONTACT_TO`)에 있고 방문자가 바꿀 수 없다
- **보내는 주소**는 Resend에서 인증한 내 도메인의 주소(`contact@hyeoniverse.com`)다. 방문자의 주소로 보내는 척할 수는 없다(다른 도메인을 사칭하는 메일이 된다)
- 그래서 방문자의 주소는 **Reply-To**에 넣는다. 받은 메일에서 답장을 누르면 방문자에게 간다
- 제목 앞에 `[MacFolio]`, 본문 끝에 보낸 사람 이름과 주소를 붙인다

![요청 한 번의 순서](./images/contact-mail-steps.svg '설정 → 입력 → 사람 확인 → 상한 → 보내기 → 저장')

## 다시 검사한다

사이트의 쓰기 화면이 이미 이름·주소·제목·내용을 검사한다. 하지만 API는 누구나 바로 부를 수 있으니 서버가 **같은 규칙으로 다시** 본다. 하나를 더했다: 이름과 제목은 **한 줄**이어야 한다. 메일 머리에 들어가는 값에 줄바꿈이 있으면 `Bcc:` 같은 머리를 끼워 넣는 공격이 될 수 있다. Resend는 JSON으로 받으니 직접 끼워질 일은 없지만, 받을 이유가 없는 값은 받지 않는다. 줄바꿈 말고 제어 문자도 거른다.

## 스팸 막기: Turnstile과 하루 상한

연락 폼은 스팸 로봇이 가장 먼저 찾는 곳이다.

- **Cloudflare Turnstile** (무료 사람 확인): 쓰기 화면에 작은 칸이 뜨고, 대부분은 아무것도 누르지 않아도 확인이 끝난다. 확인이 끝나면 토큰이 생기고, 서버가 그 토큰을 Cloudflare에 물어본 뒤에 보낸다. 토큰은 한 번만 쓸 수 있어서, 보내기에 실패하면 칸을 새로 그려 새 토큰을 받는다
- **하루 상한**: IP마다 5통, 사이트 전체 50통. AI 데모에 쓰던 하루 상한(`DailyQuota`)을 그대로 쓴다. Resend가 받지 않았으면 쓴 횟수를 돌려준다

```ts
const key = hashIp(ip, this.config.ipHashSecret);
if (!this.quota.take(key))
	throw new HttpException('오늘은 더 보낼 수 없습니다. 내일 다시 보내 주세요.', HttpStatus.TOO_MANY_REQUESTS);
const sent = await this.deliver({ to: this.config.contact.to!, replyTo: value.email, subject, text });
if (!sent) {
	this.quota.refund(key); // 보내지 못했으면 쓴 횟수를 돌려준다
	throw new BadGatewayException('메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
}
```

상한은 IP 원문이 아니라 해시로 센다. 사람 확인보다 뒤에 두어서, 로봇의 요청이 진짜 방문자의 하루 몫을 먹지 않는다.

Turnstile의 사이트 키는 공개 값이라, 빌드 변수로 넣지 않고 서버가 `GET /contact`로 알려 준다. 키를 바꿔도 사이트를 다시 빌드할 필요가 없다.

## 설정이 없으면 예전처럼

Resend 키·받는 주소·보내는 주소 셋이 다 있어야 서버가 보낸다. 없으면 `POST /contact`가 503을 주고, 사이트는 예전처럼 방문자의 메일 앱을 연다. 서버 주소가 없는 빌드도 메일 앱을 연다. 그래서 키를 넣기 전에 배포해도 메일 앱이 깨지지 않는다.

이 갈림길은 처음부터 만들어 둔 발송 인터페이스(`MailSender`) 덕분에 쉬웠다. 화면은 `send()`만 부르고, 서버로 보낼지 메일 앱을 열지는 고른 구현이 정한다. 서버 구현(`createApiSender`)이 503을 받으면 메일 앱 구현으로 넘긴다.

## 시험

- API 단위(`apps/api/src/contact/rules.test.ts`): 다듬기(공백·줄바꿈), 사이트와 같은 규칙, 한 줄이 아닌 이름·제목과 제어 문자 거절, 보낼 메일의 제목·본문
- API e2e (`apps/api/test/contact.e2e.test.ts`, Resend·Turnstile 호출만 바꿔 끼운다): 설정이 없으면 503, 사람 확인 → Resend에 받는 사람·Reply-To·제목이 맞게 가는지, 확인이 없거나 실패하면 보내지 않음, Resend가 실패하면 502와 횟수 돌려주기, 하루 상한
- 화면: 서버가 보내면 메일 앱을 열지 않고 "메일을 보냈어요", Turnstile 토큰과 함께 보내기(바깥 스크립트 대신 대역), 설정이 없으면 메일 앱으로, 거절하면 이유를 보여 주고 쓰던 글은 그대로

서버에 키를 넣는 방법은 `docs/deployment.md`의 '연락 메일'에 적었다.

## 그 뒤에 바뀐 것

- **보낸 메일을 저장한다** (같은 날): 보낸 브라우저의 '보낸 편지함'에 방문자 쿠키로 걸러 보이고, 관리자는 받은 편지함에서 보고 답장한다. 1년 보관이다([메일 앱의 편지함](/memo/mail-mailboxes)). e2e도 **보낸 메일은 보낸 브라우저의 보낸 편지함에만 보인다**, **받은 편지함과 답장은 관리자만**이 더해졌다.
- **사람 확인을 켜고 끈다** (10월 10일): Turnstile을 관리자가 시스템 설정에서 메일·댓글·메시지마다 켜고 끈다. 그래서 `GET /contact`가 주는 사이트 키는 꺼져 있으면 `null`이다([개인정보 보호 및 보안 설정](/memo/privacy-security-settings)).
- **입력 규칙을 contracts로** (10월 10일): 이름·주소·제목·내용 규칙과 실패 문구를 `packages/contracts`의 스키마로 옮겨 화면과 서버가 같은 것을 쓴다([연락 메일 계약](/memo/contracts-contact)).

## 남은 것, 배운 것

- Resend가 받았다는 것과 메일이 받은 편지함에 도착했다는 것은 다르다. 스팸함에 들어갔는지는 서버가 알 수 없다. 보내는 도메인을 Resend에서 인증해 두는 것이 지금 할 수 있는 전부다.
- 받는 사람이 늘 나 한 명이라, 이 경로가 뚫려도 다른 사람에게 스팸을 보내는 데 쓸 수는 없다. 이것이 연락 폼을 열어 두는 가장 큰 안전장치였다.
- 바깥 서비스를 붙일 때 "설정이 없으면 예전처럼"을 먼저 만들었다. 키를 넣기 전에 배포해도 깨지지 않으니, 배포와 설정의 순서를 신경 쓰지 않아도 됐다.

## 따라 하기: 메일 보내기 켜기

설정이 없으면 예전처럼 메일 앱(`mailto:`)이 열리므로, 아래를 하기 전에 배포해도 된다. 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '연락 메일 (Resend, Turnstile)'이다.

1. [Resend](https://resend.com/docs)에 도메인을 더하고, 나오는 MX·TXT 레코드를 Cloudflare DNS에 그대로 넣는다(프록시 끔). Verified가 되면 API 키를 만든다
2. (선택) [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)에 위젯을 만들고 사이트 키와 비밀 키를 받는다
3. 서버 `~/deploy/api.env`에 넣고 api만 다시 띄운다

```bash
# api.env에 더할 것: RESEND_API_KEY, CONTACT_TO, CONTACT_FROM, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY
cd ~/deploy && docker compose up -d api
curl -s https://macfolio-api.hyeoniverse.com/contact; echo
# {"enabled":true,"turnstileSiteKey":"…"}
```

사이트의 메일 앱에서 한 통 보내고, `CONTACT_TO`로 오는지, 받은 메일에서 답장하면 방문자 주소로 가는지 본다. 로컬에서는 키 없이 시험한다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/contact.e2e.test.ts
```

되돌리는 법: `api.env`에서 `RESEND_API_KEY`를 지우고 `docker compose up -d api`. `/contact`가 `enabled:false`를 돌려주고 사이트는 다시 `mailto:`로 돌아간다.

관련 글: [메일 앱의 편지함](/memo/mail-mailboxes), [연락 메일 계약](/memo/contracts-contact), [개인정보 보호 및 보안 설정](/memo/privacy-security-settings), [이 Mac에 관하여](/memo/about-this-mac)

#MacFolio #백엔드 #메일
