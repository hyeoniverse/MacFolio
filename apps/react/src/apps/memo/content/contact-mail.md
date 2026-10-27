---
title: 메일 앱에서 진짜로 메일 보내기 - Resend와 Turnstile
date: 2026-10-07
category: 개발 기록/MacFolio/백엔드
summary: mailto 링크로 동작하던 메일 앱의 보내기를 서버가 Resend API로 직접 발송하도록 바꿨다. 방문자 주소는 Reply-To에 넣고, 스팸은 Turnstile과 하루 상한으로 차단하며, 설정이 없으면 기존처럼 메일 앱을 연다. 발송 방식 비교, 요청 처리 순서, 시험, 이후 변경 사항을 정리한다.
---

메일 앱의 '새로운 메시지'는 받는 사람이 사이트 운영자로 고정된 연락 창이다. 기존에는 보내기를 누르면 서버가 아니라 **방문자의 메일 클라이언트**가 열렸다(`mailto:` 링크). 메일 클라이언트를 설정하지 않은 방문자는 그 단계에서 발송할 수 없었고, 설정한 방문자도 클라이언트에서 보내기를 한 번 더 눌러야 했다. [이슈 #25](https://github.com/hyeoniverse/MacFolio/issues/25)에 기록한 대로 서버가 직접 발송하도록 바꿨다. 첫 커밋(`2f390b725`)은 [PR #162](https://github.com/hyeoniverse/MacFolio/pull/162)로 병합됐고, 현재 `apps/api/src/contact/`는 파일 5개, 327줄이다.

![메일 보내기 흐름](./images/contact-mail-flow.svg '서버가 다시 검사하고 상한을 본 뒤 Resend로. 설정이 없으면 예전처럼 메일 앱')

## 발송 수단: Resend

서버는 Oracle Cloud의 무료 VM이다. 메일을 직접 발송하려면 SMTP(25·587번 포트)를 사용해야 하는데, 클라우드 사업자는 이 포트를 차단하는 경우가 많고 발신 IP의 스팸 평판도 직접 관리해야 한다. 그래서 **HTTPS API로 발송하는 메일 서비스**를 선택했다. Resend 무료 요금제의 한도는 월 3,000통, 하루 100통으로, 방문자 문의량에는 충분하다.

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

발송하는 메일의 각 헤더는 아래처럼 정한다([Resend 메일 발송 API](https://resend.com/docs/api-reference/emails/send-email)).

| 헤더       | 값                                                      | 이유                                                                               |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `To`       | 서버 환경 변수 `CONTACT_TO` (운영자 한 명)              | 방문자가 받는 사람을 바꿀 수 없다                                                  |
| `From`     | Resend에서 인증한 도메인 주소 `contact@hyeoniverse.com` | 방문자 주소를 `From`에 넣으면 다른 도메인을 사칭하는 메일이 된다                   |
| `Reply-To` | 방문자가 입력한 주소[^reply-to]                         | 받은 메일에서 답장을 누르면 방문자에게 발송된다                                    |
| `Subject`  | `[MacFolio]` + 방문자가 입력한 제목                     | 받은 편지함에서 사이트 문의를 구분한다. 본문 끝에는 보낸 사람 이름과 주소를 붙인다 |

![요청 한 번의 순서](./images/contact-mail-steps.svg '설정 → 입력 → 사람 확인 → 상한 → 보내기 → 저장')

## 서버에서 다시 검사한다

사이트의 쓰기 화면이 이미 이름·주소·제목·내용을 검사한다. 하지만 API는 누구나 직접 호출할 수 있으므로 서버가 **같은 규칙으로 다시** 검사한다. 서버에는 규칙을 하나 추가했다. 이름과 제목은 **한 줄**이어야 한다. 메일 헤더에 들어가는 값에 줄바꿈이 있으면 `Bcc:` 같은 헤더를 삽입하는 공격(헤더 인젝션)[^header-injection]이 가능해진다. Resend는 JSON으로 값을 받으므로 직접 삽입될 가능성은 없지만, 정상 입력에 필요 없는 값은 거절한다. 줄바꿈 외의 제어 문자도 필터링한다.

| 입력                       | 결과                                   |
| -------------------------- | -------------------------------------- |
| 제목 `문의드립니다`        | 통과                                   |
| 제목 `문의\nBcc: a@b.c`    | 400 "이름과 제목은 한 줄로 써 주세요." |
| 이름에 제어 문자(`\u0007`) | 400                                    |

## 스팸 차단: Turnstile과 하루 상한

연락 폼은 스팸 봇이 가장 먼저 노리는 경로다. 두 단계로 차단한다.

1. **Cloudflare Turnstile**(무료 CAPTCHA 대체 서비스): 쓰기 화면에 작은 위젯이 표시되고, 대부분의 방문자는 아무것도 누르지 않아도 확인이 끝난다. 확인이 끝나면 토큰이 발급되고, 서버는 이 토큰을 Cloudflare의 검증 API로 확인한 뒤에 발송한다([서버 측 검증](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)). 토큰은 한 번만 사용할 수 있으므로, 발송에 실패하면 위젯을 다시 렌더링해 새 토큰을 발급받는다.
2. **하루 상한**: IP별 5통, 사이트 전체 50통(`CONTACT_PER_IP_PER_DAY`, `CONTACT_TOTAL_PER_DAY` 기본값). AI 데모에 쓰던 하루 상한 클래스(`DailyQuota`)를 재사용한다. Resend가 발송 요청을 거절하면 차감한 횟수를 복구한다.

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

상한은 IP 원문이 아니라 HMAC 해시로 집계한다. 상한 검사를 사람 확인 뒤에 배치했으므로, 봇의 요청이 실제 방문자의 하루 한도를 소진하지 않는다.

Turnstile 사이트 키는 공개 값이므로 빌드 변수로 넣지 않고 서버가 `GET /contact` 응답으로 전달한다. 키를 바꿔도 사이트를 다시 빌드할 필요가 없다.

## 설정이 없으면 기존 방식으로

Resend API 키, 받는 주소, 보내는 주소 세 값이 모두 있어야 서버가 발송한다. 하나라도 없으면 `POST /contact`가 503을 반환하고, 사이트는 기존처럼 방문자의 메일 클라이언트를 연다. API 주소 없이 빌드한 사이트도 메일 클라이언트를 연다. 따라서 키를 설정하기 전에 배포해도 메일 앱 기능이 중단되지 않는다.

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
| 10월 10일 | 사람 확인 켜고 끄기     | 관리자가 시스템 설정에서 메일·댓글·메시지별로 Turnstile을 켜고 끈다. 꺼져 있으면 `GET /contact`의 사이트 키는 `null`이다([시스템 설정에서 사람 확인을 켜고 끄기](/memo/privacy-security-settings))                                                                                      |
| 10월 10일 | 입력 규칙을 contracts로 | 이름·주소·제목·내용 규칙과 실패 문구를 `packages/contracts`의 스키마로 옮겨 화면과 서버가 같은 정의를 사용한다([연락 메일 계약](/memo/contracts-contact))                                                                                                                               |

## 남은 과제와 배운 점

- Resend가 요청을 수락한 것과 메일이 받은 편지함에 도착한 것은 다르다. 스팸함으로 분류됐는지는 서버가 알 수 없다. 현재 할 수 있는 조치는 발신 도메인을 Resend에서 인증(SPF·DKIM)해 두는 것이다.
- 받는 사람이 항상 운영자 한 명이므로, 이 경로가 악용되어도 제3자에게 스팸을 발송하는 데 쓸 수 없다. 이것이 연락 폼을 공개하는 가장 큰 안전장치다.
- 외부 서비스를 연동하면서 "설정이 없으면 기존 방식으로"를 먼저 구현했다. 키를 넣기 전에 배포해도 기능이 중단되지 않으므로, 배포와 설정의 순서를 맞출 필요가 없었다.

## 따라 하기: 메일 발송 켜기

설정이 없으면 기존처럼 메일 클라이언트(`mailto:`)가 열리므로, 아래 단계 전에 배포해도 된다. 전체 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '연락 메일 (Resend, Turnstile)'에 있다.

1. [Resend](https://resend.com/docs)에 도메인을 추가하고, 표시되는 MX·TXT 레코드를 Cloudflare DNS에 그대로 등록한다(프록시 끔). 상태가 Verified가 되면 API 키를 발급한다.
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

되돌리는 방법: `api.env`에서 `RESEND_API_KEY`를 삭제하고 `docker compose up -d api`를 실행한다. `/contact`가 `enabled:false`를 반환하고 사이트는 다시 `mailto:` 방식으로 동작한다.

## 관련 글

- [메일 앱의 보낸 편지함과 관리자 받은 편지함](/memo/mail-mailboxes)
- [같은 뜻, 다른 문구 — 연락 메일의 검사 규칙을 하나로](/memo/contracts-contact)
- [시스템 설정에서 사람 확인을 켜고 끄기](/memo/privacy-security-settings)
- [Apple 메뉴의 '이 Mac에 관하여'에 프로필 넣기](/memo/about-this-mac)

[^reply-to]: `Reply-To`는 받은 사람이 답장할 때 사용할 주소를 지정하는 메일 헤더다([RFC 5322 3.6.2](https://www.rfc-editor.org/rfc/rfc5322#section-3.6.2)). `From`과 달리 발신 도메인 인증(SPF·DKIM)과 관계가 없다.

[^header-injection]: 메일 헤더는 줄 단위로 구분되므로, 입력값에 줄바꿈과 `Bcc: …`가 들어가면 서버가 의도하지 않은 헤더가 추가된다. 이를 이용해 폼을 스팸 발송에 악용하는 공격이다.

#MacFolio #백엔드 #메일
