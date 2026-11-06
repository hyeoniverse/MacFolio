---
title: Resend API와 Turnstile로 서버에서 메일 발송하고 스팸 차단하기
date: 2026-10-07
category: 개발 기록/MacFolio/서버·API
series: 메일 앱
seriesOrder: 1
summary: mailto 링크로 동작하던 메일 앱의 보내기를 서버가 Resend API로 직접 발송하도록 바꿨다. 방문자 주소는 Reply-To에 넣고, 스팸은 Turnstile과 하루 상한으로 차단하며, 설정이 없으면 기존처럼 메일 앱을 연다. 발송 방식 비교, 요청 처리 순서, 시험, 이후 변경 사항을 정리한다.
---

메일 앱의 '새로운 메시지'는 받는 사람이 사이트 운영자로 고정된 연락 창이다. 기존에는 보내기를 누르면 서버가 아니라 **방문자의 메일 클라이언트**가 열렸다(`mailto:` 링크). 메일 클라이언트를 설정하지 않은 방문자는 그 단계에서 발송할 수 없었고, 설정한 방문자도 클라이언트에서 보내기를 한 번 더 눌러야 했다. [이슈 #25](https://github.com/hyeoniverse/MacFolio/issues/25)에 기록한 대로 서버가 직접 발송하도록 바꿨다. 첫 커밋(`2f390b725`)은 [PR #162](https://github.com/hyeoniverse/MacFolio/pull/162)로 병합됐고, 현재 `apps/api/src/contact/`는 파일 5개, 327줄이다.

![메일 보내기 흐름](./images/contact-mail-flow.svg '서버가 다시 검사하고 상한을 본 뒤 Resend로. 설정이 없으면 예전처럼 메일 앱')

## 배경: 웹 페이지에서 메일을 보내는 두 가지 방법

### mailto 링크

`mailto:`는 메일 주소를 여는 URL 형식이다. `<a href="mailto:운영자주소?subject=문의&body=안녕하세요">`를 누르면 브라우저가 운영체제에 등록된 메일 클라이언트(macOS의 Mail, Outlook 등)를 열고, 받는 사람·제목·본문 칸을 채운다. 실제 발송은 그 클라이언트가 방문자 계정으로 한다. 서버가 필요 없지만, 메일 클라이언트에 계정을 등록하지 않은 방문자(웹 메일만 쓰는 경우)는 빈 설정 화면만 보게 된다.

### 서버가 직접 발송

서버가 발송하면 방문자는 사이트 안에서 보내기를 한 번만 누르면 된다. 대신 서버가 세 가지를 해결해야 한다.

| 해결할 문제 | 내용                                                                            | 이 글의 해당 절                                                      |
| ----------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 발송 수단   | 메일을 받는 서버가 스팸으로 분류하지 않도록, 인증된 도메인에서 발송해야 한다    | [발송 수단: Resend](#발송-수단-resend)                               |
| 입력 검증   | 방문자가 입력한 값이 메일 헤더에 들어가므로, 헤더를 조작하는 입력을 막아야 한다 | [서버에서 다시 검사한다](#서버에서-다시-검사한다)                    |
| 스팸 차단   | 공개된 발송 경로는 봇이 자동으로 대량 요청하는 대상이 된다                      | [스팸 차단: Turnstile과 하루 상한](#스팸-차단-turnstile과-하루-상한) |

## 발송 수단: Resend

### SMTP와 발신 도메인 인증

메일 서버끼리는 SMTP(Simple Mail Transfer Protocol)로 메일을 주고받는다. 서버 사이 전달에는 25번 포트를, 메일 프로그램이 발신 서버에 메일을 제출할 때는 587번 포트를 주로 쓴다. 받는 쪽 메일 서버는 도착한 메일이 정말 `From` 주소의 도메인에서 보낸 것인지 세 가지 기록으로 확인한다.

| 검사  | 확인 내용                                                                                |
| ----- | ---------------------------------------------------------------------------------------- |
| SPF   | 보낸 서버의 IP가 그 도메인의 DNS에 "발송 허용 서버"로 등록되어 있는가                    |
| DKIM  | 메일 헤더의 전자 서명이 그 도메인이 DNS에 공개한 공개 키로 검증되는가                    |
| DMARC | SPF·DKIM으로 인증된 도메인이 `From` 주소의 도메인과 일치하는가, 실패하면 어떻게 처리할까 |

이 서버는 Oracle Cloud의 무료 VM이다. 메일을 직접 발송하려면 SMTP(25·587번 포트)를 사용해야 하는데, 클라우드 사업자는 이 포트를 차단하는 경우가 많고, 발신 IP의 스팸 평판과 SPF·DKIM 설정도 직접 관리해야 한다. 그래서 **HTTPS API로 발송하는 메일 서비스**를 선택했다. 서버는 443번 포트로 JSON 요청만 보내고, SMTP 발송과 DKIM 서명은 메일 서비스가 처리한다. Resend 무료 요금제의 한도는 월 3,000통, 하루 100통으로, 방문자 문의량에는 충분하다.

| 방식                          | 장점                                | 단점                                                              |
| ----------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| `mailto:` (기존)              | 서버가 필요 없다                    | 메일 클라이언트가 없으면 발송 불가. 보내기를 두 번 누른다         |
| 서버에서 SMTP로 직접 발송     | 외부 서비스 의존이 없다             | 클라우드가 25·587번을 차단하는 경우가 많다. 스팸 평판을 직접 관리 |
| Gmail 같은 개인 계정의 SMTP   | 기존 계정을 사용                    | 앱 비밀번호를 서버에 보관해야 한다. 발신 주소가 개인 주소가 된다  |
| HTTPS 메일 API, Resend (선택) | 443번 포트만 사용. 도메인 인증 지원 | 외부 서비스의 API 키를 서버에 보관해야 한다                       |

```ts
await fetch('https://api.resend.com/emails', {
	method: 'POST',
	headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
	body: JSON.stringify({ from, to: [to], reply_to: visitor.email, subject, text }),
});
```

### 헤더 구성: From은 사이트, Reply-To는 방문자

발송하는 메일의 각 헤더는 아래처럼 정한다([Resend 메일 발송 API](https://resend.com/docs/api-reference/emails/send-email)).

| 헤더       | 값                                                      | 이유                                                                               |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `To`       | 서버 환경 변수 `CONTACT_TO` (운영자 한 명)              | 방문자가 받는 사람을 바꿀 수 없다                                                  |
| `From`     | Resend에서 인증한 도메인 주소 `contact@hyeoniverse.com` | 방문자 주소를 `From`에 넣으면 다른 도메인을 사칭하는 메일이 된다                   |
| `Reply-To` | 방문자가 입력한 주소[^reply-to]                         | 받은 메일에서 답장을 누르면 방문자에게 발송된다                                    |
| `Subject`  | `[MacFolio]` + 방문자가 입력한 제목                     | 받은 편지함에서 사이트 문의를 구분한다. 본문 끝에는 보낸 사람 이름과 주소를 붙인다 |

예를 들어 방문자 홍길동이 `visitor@example.com` 주소로 "문의드립니다"를 보내면, 운영자는 아래 형태의 메일을 받는다(`buildEmail`이 제목과 본문을 만든다).

![운영자가 받는 메일의 헤더와 본문 예시. From은 contact@hyeoniverse.com, Reply-To는 visitor@example.com이고, 답장 버튼을 누르면 받는 사람 칸에 방문자 주소가 들어간다. 아래에는 From에 방문자 주소를 넣으면 DMARC 검사에 실패하는 이유를 적었다](./images/contact-mail-headers.svg '답장 대상은 From이 아니라 Reply-To가 정한다. 그래서 From을 사이트 도메인으로 고정해도 답장은 방문자에게 간다')

`From`에 방문자 주소를 넣으면 `example.com`의 SPF·DKIM으로 인증되지 않은 메일이 되고, 받는 서버의 DMARC 검사에서 `From` 도메인과 인증된 도메인(`hyeoniverse.com`)이 일치하지 않는다. `Reply-To`는 이 인증 검사의 대상이 아니므로 방문자 주소를 넣어도 된다.

![POST /contact 요청 한 번의 처리 순서](./images/contact-mail-steps.svg '설정 → 입력 → 사람 확인 → 상한 → 보내기 → 저장')

## 서버에서 다시 검사한다

사이트의 쓰기 화면이 이미 이름·주소·제목·내용을 검사한다. 하지만 API는 누구나 직접 호출할 수 있으므로 서버가 **같은 규칙으로 다시** 검사한다. 서버에는 규칙을 하나 추가했다. 이름과 제목은 **한 줄**이어야 한다.

메일 헤더는 `이름: 값` 형식의 줄이 모여 있고, 줄 끝은 CRLF(`\r\n`)로 구분한다. 헤더 값에 줄바꿈이 들어가면 그 뒤의 문자열이 새 헤더가 된다. 이를 이용해 `Bcc:`(숨은 참조) 같은 헤더를 끼워 넣는 공격을 헤더 인젝션[^header-injection]이라고 한다.

![제목 칸에 줄바꿈과 Bcc 헤더를 넣은 입력이, 헤더를 문자열로 잇는 서버에서는 숨은 참조 헤더를 추가하고, MacFolio에서는 400으로 거절되는 비교](./images/contact-mail-header-injection.svg '왼쪽은 입력값이 헤더 한 줄을 더 만드는 경우, 오른쪽은 한 줄 규칙으로 거절하는 경우')

Resend는 JSON의 `subject` 필드로 값을 받으므로 직접 삽입될 가능성은 없지만, 정상 입력에 필요 없는 값은 거절한다. 줄바꿈 외의 제어 문자(벨 문자 `\u0007` 등 화면에 표시되지 않는 문자)도 필터링한다.

| 입력                       | 결과                                   |
| -------------------------- | -------------------------------------- |
| 제목 `문의드립니다`        | 통과                                   |
| 제목 `문의\nBcc: a@b.c`    | 400 "이름과 제목은 한 줄로 써 주세요." |
| 이름에 제어 문자(`\u0007`) | 400                                    |

## 스팸 차단: Turnstile과 하루 상한

연락 폼은 스팸 봇이 가장 먼저 노리는 경로다. 두 단계로 차단한다.

### 1. Cloudflare Turnstile

Turnstile은 Cloudflare가 무료로 제공하는 CAPTCHA 대체 서비스다. CAPTCHA는 "사람만 풀 수 있는 문제"(일그러진 글자 읽기, 신호등 사진 고르기)로 봇을 구분하는 방식인데, Turnstile은 문제를 내지 않고 브라우저 환경을 검사해 대부분의 방문자를 아무것도 누르지 않은 상태로 통과시킨다.

![Cloudflare 문서의 Turnstile 동작도. 페이지가 사이트 키로 위젯을 렌더링하면 challenges.cloudflare.com iframe이 검사를 실행하고 토큰을 발급한다. 방문자가 폼을 제출하면 서버가 비밀 키와 토큰을 Siteverify API로 보내 검증한다](./images/contact-mail-turnstile-flow.jpg '사이트 키로 위젯이 토큰을 받고(위), 서버가 비밀 키와 토큰을 Siteverify API로 검증한다(아래). Cloudflare Docs, Turnstile')

동작은 두 단계로 나뉜다.

1. 쓰기 화면에 작은 위젯이 표시되고, 검사가 끝나면 토큰이 발급된다. 사이트는 이 토큰을 `turnstileToken` 필드에 담아 `POST /contact`로 보낸다.
2. 서버는 이 토큰과 비밀 키를 Cloudflare의 Siteverify API로 보내 확인한 뒤에 발송한다([서버 측 검증](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)).

```ts
// apps/api/src/common/turnstile.ts (요약)
const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ secret, response: token, remoteip: ip || undefined }),
	signal: AbortSignal.timeout(10_000),
});
const result = (await response.json()) as { success?: boolean };
return result.success === true;
```

| Siteverify 응답 예                                         | 서버 처리       |
| ---------------------------------------------------------- | --------------- |
| `{"success":true,"hostname":"macfolio.hyeoniverse.com",…}` | 다음 단계로     |
| `{"success":false,"error-codes":["timeout-or-duplicate"]}` | 400, 발송 안 함 |
| 10초 안에 응답 없음                                        | 400, 발송 안 함 |

토큰은 발급 후 300초(5분) 동안만 유효하고, ==한 번 검증하면 다시 쓸 수 없다==. 같은 토큰을 두 번 보내면 `timeout-or-duplicate` 오류가 난다. 그래서 발송에 실패하면 위젯을 다시 렌더링해 새 토큰을 발급받는다.

### 2. 하루 상한

IP별 5통, 사이트 전체 50통(`CONTACT_PER_IP_PER_DAY`, `CONTACT_TOTAL_PER_DAY` 기본값)으로 제한한다. AI 데모에 쓰던 하루 상한 클래스(`DailyQuota`)를 재사용한다. Resend가 발송 요청을 거절하면 차감한 횟수를 복구한다.

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

| 같은 IP의 하루 요청 | 결과                                       |
| ------------------- | ------------------------------------------ |
| 1~5번째             | 발송 (Resend 실패 시 502, 횟수는 돌려받음) |
| 6번째               | 429 "오늘은 더 보낼 수 없습니다. …"        |
| 사이트 전체 51번째  | IP와 관계없이 429                          |

상한은 IP 원문이 아니라 HMAC 해시로 집계한다. 상한 검사를 사람 확인 뒤에 배치했으므로, ==봇의 요청이 실제 방문자의 하루 한도를 소진하지 않는다==. Turnstile을 통과하지 못한 요청은 상한에 도달하기 전에 400으로 끝나기 때문이다.

> [!NOTE]
> Turnstile 사이트 키는 공개 값이므로 빌드 변수로 넣지 않고 서버가 `GET /contact` 응답으로 전달한다. 키를 바꿔도 사이트를 다시 빌드할 필요가 없다.

## 설정이 없으면 기존 방식으로

Resend API 키, 받는 주소, 보내는 주소 세 값이 모두 있어야 서버가 발송한다. 하나라도 없으면 `POST /contact`가 503을 반환하고, 사이트는 기존처럼 방문자의 메일 클라이언트를 연다. API 주소 없이 빌드한 사이트도 메일 클라이언트를 연다. 따라서 ==키를 설정하기 전에 배포해도 메일 앱 기능이 중단되지 않는다==.

| 상황                | `POST /contact` | 화면 동작                        |
| ------------------- | --------------- | -------------------------------- |
| 세 설정값 모두 있음 | 200             | "메일을 보냈어요" 표시           |
| 설정값 누락         | 503             | `mailto:`로 메일 클라이언트 실행 |
| API 주소 없이 빌드  | (호출 안 함)    | `mailto:`로 메일 클라이언트 실행 |
| Resend 발송 실패    | 502             | 오류 문구 표시, 작성 내용 유지   |

이 분기는 처음부터 만든 발송 인터페이스(`MailSender`)로 구현했다. 화면은 `send()`만 호출하고, 서버로 보낼지 메일 클라이언트를 열지는 선택된 구현이 결정한다. 서버 구현(`createApiSender`)은 503을 받으면 메일 클라이언트 구현으로 넘긴다.

## 시험

<details>
<summary>시험 항목 전체 (API 단위·e2e, 화면)</summary>

- API 단위(`apps/api/src/contact/rules.test.ts`): 공백·줄바꿈 정리, 사이트와 같은 규칙, 한 줄이 아닌 이름·제목과 제어 문자 거절, 발송할 메일의 제목·본문
- API e2e(`apps/api/test/contact.e2e.test.ts`, Resend·Turnstile 호출만 대역으로 교체): 설정이 없으면 503, 사람 확인 후 Resend에 받는 사람·Reply-To·제목이 올바르게 전달되는지, 확인이 없거나 실패하면 발송하지 않음, Resend가 실패하면 502와 횟수 복구, 하루 상한
- 화면: 서버가 발송하면 메일 클라이언트를 열지 않고 "메일을 보냈어요" 표시, Turnstile 토큰과 함께 발송(외부 스크립트 대신 대역 사용), 설정이 없으면 메일 클라이언트로 전환, 거절되면 이유를 표시하고 작성 중인 내용은 유지

</details>

서버에 키를 설정하는 방법은 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '연락 메일' 절에 정리했다.

## 이후 변경 사항

| 날짜      | 변경                    | 내용                                                                                                                                                                                                                                                                                    |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10월 7일  | 보낸 메일 저장          | 발송한 브라우저의 '보낸 편지함'에 방문자 쿠키 기준으로 필터링해 표시하고, 관리자는 받은 편지함에서 조회·답장한다. 보관 기간은 1년이다([메일 앱의 편지함](/memo/mail-mailboxes)). e2e에 "보낸 메일은 보낸 브라우저의 보낸 편지함에만 보인다", "받은 편지함과 답장은 관리자만"이 추가됐다 |
| 10월 10일 | 사람 확인 켜고 끄기     | 관리자가 시스템 설정에서 메일·댓글·메시지별로 Turnstile을 켜고 끈다. 꺼져 있으면 `GET /contact`의 사이트 키는 `null`이다([Turnstile 사람 확인을 requireHuman 하나로 묶고 설정 테이블로 켜고 끄기](/memo/privacy-security-settings))                                                     |
| 10월 10일 | 입력 규칙을 contracts로 | 이름·주소·제목·내용 규칙과 실패 문구를 `packages/contracts`의 스키마로 옮겨 화면과 서버가 같은 정의를 사용한다([연락 메일 계약](/memo/contracts-validation#연락-메일-칸마다-첫-실패-문구-하나-203))                                                                                     |

## 남은 과제와 배운 점

- Resend가 요청을 수락한 것과 메일이 받은 편지함에 도착한 것은 다르다. 스팸함으로 분류됐는지는 서버가 알 수 없다. 현재 할 수 있는 조치는 발신 도메인을 Resend에서 인증(SPF·DKIM)해 두는 것이다.
- 받는 사람이 항상 운영자 한 명이므로, ==이 경로가 악용되어도 제3자에게 스팸을 발송하는 데 쓸 수 없다==. 이것이 연락 폼을 공개하는 가장 큰 안전장치다.
- 외부 서비스를 연동하면서 "설정이 없으면 기존 방식으로"를 먼저 구현했다. 키를 넣기 전에 배포해도 기능이 중단되지 않으므로, 배포와 설정의 순서를 맞출 필요가 없었다.

## 따라 하기: 메일 발송 켜기

설정이 없으면 기존처럼 메일 클라이언트(`mailto:`)가 열리므로, 아래 단계 전에 배포해도 된다. 전체 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '연락 메일 (Resend, Turnstile)'에 있다.

1. [Resend](https://resend.com/docs)에 도메인을 추가하고, 표시되는 MX·TXT 레코드를 Cloudflare DNS에 그대로 등록한다(프록시 끔). TXT 레코드가 SPF와 DKIM 공개 키다. 상태가 Verified가 되면 API 키를 발급한다.
2. (선택) [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)에서 위젯을 만들고 사이트 키와 비밀 키를 발급받는다.
3. 서버의 `~/deploy/api.env`에 값을 추가하고 api 컨테이너만 다시 실행한다.

```bash
# api.env에 더할 것: RESEND_API_KEY, CONTACT_TO, CONTACT_FROM, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY
cd ~/deploy && docker compose up -d api
curl -s https://macfolio-api.hyeoniverse.com/contact; echo
# {"enabled":true,"turnstileSiteKey":"…"}
```

사이트의 메일 앱에서 한 통 발송한 뒤, `CONTACT_TO` 주소로 수신되는지, 받은 메일에서 답장하면 방문자 주소로 발송되는지 확인한다.

<details>
<summary>로컬에서 키 없이 시험하기</summary>

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/contact.e2e.test.ts
```

</details>

> [!TIP] 되돌리는 방법
> `api.env`에서 `RESEND_API_KEY`를 삭제하고 `docker compose up -d api`를 실행한다. `/contact`가 `enabled:false`를 반환하고 사이트는 다시 `mailto:` 방식으로 동작한다.

## 관련 글

- [방문자 쿠키의 HMAC으로 서버가 메일 조회 범위를 필터링하기](/memo/mail-mailboxes)
- [zod superRefine으로 첫 실패 문구만 반환하는 화면·서버 공통 검사](/memo/contracts-validation#연락-메일-칸마다-첫-실패-문구-하나-203)
- [Turnstile 사람 확인을 requireHuman 하나로 묶고 설정 테이블로 켜고 끄기](/memo/privacy-security-settings)
- [앱 목록에 등록하지 않고 데스크톱이 직접 렌더링하는 시스템 창](/memo/about-this-mac)

<details>
<summary>참고 문헌</summary>

- Resend, [Send Email API](https://resend.com/docs/api-reference/emails/send-email)
- Cloudflare Docs, [Turnstile](https://developers.cloudflare.com/turnstile/), [Validate the token (Server-side validation)](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- MDN, [mailto 링크](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a#linking_to_an_email_address)
- RFC 5321, [Simple Mail Transfer Protocol](https://www.rfc-editor.org/rfc/rfc5321)
- RFC 6409, [Message Submission for Mail](https://www.rfc-editor.org/rfc/rfc6409)
- RFC 5322, [Internet Message Format](https://www.rfc-editor.org/rfc/rfc5322) (헤더 형식, 3.6.2 Reply-To)
- RFC 7208, [Sender Policy Framework (SPF)](https://www.rfc-editor.org/rfc/rfc7208)
- RFC 6376, [DomainKeys Identified Mail (DKIM) Signatures](https://www.rfc-editor.org/rfc/rfc6376)
- RFC 7489, [Domain-based Message Authentication, Reporting, and Conformance (DMARC)](https://www.rfc-editor.org/rfc/rfc7489)
- OWASP, [Testing for IMAP SMTP Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/10-Testing_for_IMAP_SMTP_Injection)

</details>

<details>
<summary>사진 출처</summary>

- Turnstile 동작도: Cloudflare Docs, [Turnstile overview](https://developers.cloudflare.com/turnstile/), CC BY 4.0

</details>

[^reply-to]: `Reply-To`는 받은 사람이 답장할 때 사용할 주소를 지정하는 메일 헤더다([RFC 5322 3.6.2](https://www.rfc-editor.org/rfc/rfc5322#section-3.6.2)). `From`과 달리 발신 도메인 인증(SPF·DKIM)과 관계가 없다.

[^header-injection]: 메일 헤더는 줄 단위로 구분되므로, 입력값에 줄바꿈과 `Bcc: …`가 들어가면 서버가 의도하지 않은 헤더가 추가된다. 이를 이용해 폼을 스팸 발송에 악용하는 공격이다.

#MacFolio #백엔드 #메일
