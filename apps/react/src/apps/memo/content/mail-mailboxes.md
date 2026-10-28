---
title: 방문자 쿠키 HMAC으로 필터링하는 보낸 편지함과 관리자 받은 편지함
date: 2026-10-07
category: 개발 기록/MacFolio/백엔드
summary: 메일 앱으로 보낸 메일을 서버에 1년 보관하고, 방문자 쿠키의 HMAC으로 필터링한 보낸 편지함에서만 조회되게 했다. 관리자는 받은 편지함에서 모든 메일을 조회하고 앱 안에서 답장한다. 답장은 메일 발송이 성공한 뒤에 저장한다.
---

[메일 앱이 서버로 메일을 보내게](/memo/contact-mail) 바꾼 뒤에도 두 기능이 없었다. 방문자는 보낸 메일을 다시 조회할 수 없었고, 관리자는 답장하려면 Gmail을 열어야 했다. [PR #128](https://github.com/hyeoniverse/MacFolio/pull/128)에서 메일 앱에 사서함 두 개를 추가했다.

| 사서함      | 사용자 | 표시하는 메일                                                     |
| ----------- | ------ | ----------------------------------------------------------------- |
| 보낸 편지함 | 방문자 | 이 브라우저에서 보낸 메일과, 그 메일에 관리자가 작성한 답장       |
| 받은 편지함 | 관리자 | 수신한 모든 메일. 메일을 열면 본문 아래에 답장 입력 칸이 표시된다 |

## 본인 식별 방법

| 방법                               | 장점                                 | 단점                                                                        |
| ---------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| 보낸 메일을 브라우저 저장소에 보관 | 서버 작업이 없다                     | 관리자 답장을 수신할 수 없다. 저장소를 삭제하면 기록이 사라진다             |
| 메일 주소 + 확인 링크              | 기기가 바뀌어도 조회할 수 있다       | 보낸 편지함을 열 때마다 메일을 한 번 더 확인해야 한다. 데모 사이트에 과하다 |
| **방문자 쿠키의 HMAC** (채택)      | 메시지·댓글과 같은 방식, 가입이 없다 | 쿠키를 삭제하거나 다른 브라우저를 쓰면 조회되지 않는다                      |

세 번째 방법을 채택했다. 원본 메일은 방문자의 메일함에도 발송되므로, 사이트의 보낸 편지함은 "이 브라우저에서 보낸 메일을 다시 조회하는 곳"으로 범위를 정했다.

## 접근 범위: 서버가 쿠키로 필터링한다

보낸 편지함은 **본인 메일만** 표시해야 한다. 회원 가입이 없는 사이트에서 본인을 식별하는 방법은 이미 있었다. 메시지 앱과 댓글이 사용하는 방문자 쿠키다([httpOnly 방문자 쿠키의 HMAC 해시로 이름·비밀번호 없는 메시지와 댓글 만들기](/memo/visitor-identity)). 처음 요청한 브라우저에 무작위 토큰을 쿠키([`HttpOnly`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#httponly), 유효 기간 1년)로 발급하고, DB에는 그 토큰의 HMAC[^hmac]만 저장한다.

메일을 보내는 시각에 이 HMAC을 메일과 함께 `visitorHash` 열에 저장하고, `GET /contact/mine`은 요청 쿠키의 HMAC과 같은 메일만 반환한다. 화면에서 숨기는 방식이 아니라 서버가 쿼리 조건으로 필터링하므로, 요청을 조작해도 다른 방문자의 메일은 받을 수 없다.

```ts
// apps/api/src/contact/contact.service.ts
async mine(visitor: Visitor | null): Promise<ContactMailView[]> {
	if (!visitor) return [];
	const mails = await this.prisma.contactMail.findMany({
		where: { visitorHash: visitor.hash },
		orderBy: { createdAt: 'desc' },
		include: INCLUDE,
	});
	return mails.map(toView);
}
```

경로별 동작은 다음과 같다.

| 경로                      | 권한         | 쿠키 처리                                                      |
| ------------------------- | ------------ | -------------------------------------------------------------- |
| `POST /contact`           | 누구나       | 쿠키가 없으면 새로 발급한다(`visitors.identify`)               |
| `GET /contact/mine`       | 누구나       | 읽기만 한다(`visitors.peek`). 쿠키가 없으면 빈 목록을 반환한다 |
| `GET /contact/inbox`      | `AdminGuard` | 관리자 세션을 확인한다. 최근 500통까지 반환한다                |
| `POST /contact/:id/reply` | `AdminGuard` | 관리자 세션을 확인한다                                         |

메일 한 통을 id로 조회하는 경로는 만들지 않았다. 방문자가 메일을 읽는 경로는 자기 목록 하나뿐이고, 응답에는 HMAC을 포함하지 않는다.

![방문자와 관리자가 메일을 읽고 쓰는 경로](./images/mail-mailboxes-flow.svg '방문자는 자기 HMAC의 메일만, 관리자는 모든 메일을 받는다')

프런트엔드의 발송 요청에는 [`credentials: 'include'`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials)가 필요하다. 쿠키 없이 요청하면 서버가 요청마다 새 방문자로 판단하므로 보낸 편지함이 항상 비어 있다.

## 관리자 답장

받은 편지함에서 메일을 열면 본문 아래에 "받는 사람: 민수 <minsu@example.com>"과 답장 입력 칸이 표시된다. 답장을 보내면 서버가 다음 두 단계를 순서대로 실행한다.

1. [Resend](https://resend.com/docs/api-reference/emails/send-email)로 **방문자의 주소**에 메일을 발송한다. 제목은 `Re: [MacFolio] 원래 제목`이고, 본문 아래에 수신한 메일을 `>`로 인용한다. Reply-To는 관리자 주소이므로 방문자가 메일 클라이언트에서 답장하면 관리자에게 도착한다.
2. 답장을 원래 메일에 연결해 `ContactReply`에 저장한다. 방문자가 사이트의 보낸 편지함을 열면 이 답장이 함께 표시된다.

발송이 먼저다. 발송에 실패하면 저장하지 않고 502 응답으로 실패 이유를 표시한다. 저장만 되고 메일이 발송되지 않으면 방문자는 답장이 있다는 사실을 알 수 없기 때문이다.

```ts
const { subject, text } = buildReply(mail, parsed.value.body);
const sent = await this.deliver({ to: mail.email, replyTo: this.config.contact.to!, subject, text });
if (!sent) throw new BadGatewayException('답장을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
await this.prisma.contactReply.create({ data: { mailId: id, body: parsed.value.body } });
```

![관리자 답장의 순서](./images/mail-mailboxes-reply-order.svg '보내기가 실패하면 저장하지 않고 502')

| 발송 | 저장       | 결과                                                                            |
| ---- | ---------- | ------------------------------------------------------------------------------- |
| 실패 | 실행 안 함 | 502 응답. 관리자가 다시 시도한다                                                |
| 성공 | 성공       | 방문자는 메일함과 사이트의 보낸 편지함 양쪽에서 답장을 확인한다                 |
| 성공 | 실패       | 방문자는 메일함에서만 답장을 확인한다. 사이트의 보낸 편지함에는 표시되지 않는다 |

마지막 경우는 남아 있다. 둘 중 하나만 보장할 수 있다면 메일 발송을 보장하는 쪽을 택했다.

목록의 안 읽음 표시는 사용자에 따라 기준이 다르다.

| 사용자 | 안 읽음 기준                                  | 사이드바 숫자       |
| ------ | --------------------------------------------- | ------------------- |
| 관리자 | 답장이 없는 메일(`mail.replies.length === 0`) | 답장해야 할 메일 수 |
| 방문자 | 이 브라우저에서 아직 열지 않은 메일           | 열지 않은 메일 수   |

## 보관 기간 1년

메일을 서버에 저장하게 되면서 개인정보 문서([docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md))를 수정했다. 수신한 메일과 답장은 1년이 지나면 삭제한다. 별도 예약 작업은 없고, 메일을 발송하는 시각과 관리자가 받은 편지함을 여는 시각에 기간이 지난 메일을 삭제한다(`purge()`). 방문자가 쿠키를 삭제하면 그 브라우저에서도 더는 조회되지 않는다.

DB에는 테이블 두 개(`ContactMail`, `ContactReply`)를 추가했다.

| 테이블         | 열                                                          |
| -------------- | ----------------------------------------------------------- |
| `ContactMail`  | 보낸 사람 이름·주소, 제목, 본문, `visitorHash`, `createdAt` |
| `ContactReply` | `mailId`, 본문                                              |

삭제 쿼리는 다음과 같다.

```ts
const RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
await this.prisma.contactMail.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } } });
```

`ContactReply`는 `onDelete: Cascade`로 메일에 연결되어 있어 메일과 함께 삭제된다([Prisma 참조 동작](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions)).

## 휴대폰 화면

좁은 창과 휴대폰에서는 사이드바가 숨겨지므로, 처음에는 목록 위에 받은 편지함·보낸 편지함을 선택하는 분할 버튼을 배치했다. 서버 주소가 없는 빌드에는 보낸 편지함이 없다. 이 빌드에서는 방문자의 메일 앱(`mailto:`)으로 발송하므로 사이트가 보낸 메일을 알 수 없다.

같은 PR에서 휴대폰 메일을 iOS 메일 구조로 다시 작성했다(`components/MailMobile.tsx`). 이전에는 데스크톱의 세 칸(메일상자 · 목록 · 읽기)을 한 칸씩 표시했고, 첫 화면이 받은 편지함이었으며 보낸 편지함은 상단 탭으로 선택했다. 메일 목록, 읽음 상태, 발송, 답장 로직은 데스크톱과 공유한다.

| 화면       | 구성                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 메일상자   | 첫 화면. 큰 제목, "지금 업데이트됨", 받은 편지함(안 읽은 수)과 보낸 편지함의 흰 카드 목록                                                                                                    |
| 메일 한 통 | 상단에 뒤로 가기와 ↑·↓(이전·다음 메일), 둥근 사각형 아바타, 보낸 사람, "받는 사람:", 날짜, 큰 제목, 본문. 하단에 답장 버튼과 새로운 메시지 버튼                                              |
| 답장       | 먼저 메일 동작 시트(답장, 방문자는 "읽지 않음으로 표시")가 열린다. 관리자는 답장 시트에서 바로 답장하고(제목 "Re: …", 원래 메일 인용), 방문자는 관리자에게 "Re: …" 제목의 새 메일을 작성한다 |
| 쓰기       | 하단에서 올라오는 시트. 왼쪽 위 ×, 오른쪽 위 ↑(입력을 마치면 파란색), 큰 제목은 입력한 제목을 따른다                                                                                         |

처음 렌더링한 화면에서는 메일 본문이 한 글자씩 세로로 쌓였다. 휴대폰 화면의 바깥 요소에 화면 이름을 클래스로 붙였는데(`mail-phone mail`), `mail`이 데스크톱 메일의 세 칸 그리드 클래스와 같은 이름이었기 때문이다. 화면 이름은 `data-screen` 속성으로 옮겼다(`<div className="mail-phone" data-screen={screen.kind}>`). CSS도 `.mail-phone[data-screen='mail']`처럼 속성 선택자로 지정한다.

### 화면 전환 애니메이션

| 전환                                  | 동작                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 깊은 화면으로(메일상자 → 목록 → 메일) | 오른쪽에서 밀려 들어온다(`data-direction="forward"`)                                                                                       |
| 뒤로 가기                             | 왼쪽에서 들어온다(`data-direction="back"`). 화면마다 `key`를 바꿔 다시 렌더링하므로 애니메이션이 매번 실행된다                             |
| 시트 열기                             | 하단에서 올라오고, 배경은 점점 어두워진다                                                                                                  |
| 시트 닫기                             | 내려가는 애니메이션(240ms, `useExitMotion`의 `sheet-out`)이 끝난 뒤 DOM에서 제거한다                                                       |
| 동작 줄이기 설정                      | [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)이면 애니메이션 없이 바로 닫는다 |

## 시험

서버 쪽은 커밋 하나(`60e89137c`)로 10개 파일, 513줄 추가, 27줄 삭제다. 그중 137줄이 `apps/api/test/contact.e2e.test.ts`다.

<details>
<summary>시험 항목 전체</summary>

- API 단위(`apps/api/src/contact/rules.test.ts`): 답장 검사(빈 값·길이·제어 문자), 답장 메일의 제목과 인용
- API e2e: A가 보낸 두 통은 A의 보낸 편지함에만, B의 메일은 B에게만 표시된다. 쿠키가 없으면 빈 목록, 응답에 HMAC이 없다. 받은 편지함·답장은 방문자에게 401, 관리자에게는 모든 메일을 반환한다. 답장이 방문자의 주소로 발송되고 Reply-To가 관리자 주소인지, 그 메일에 답장이 연결되는지, 없는 메일 404, 빈 답장 400
- 화면: 보낸 메일이 보낸 편지함에 추가되고 방문자에게는 답장 칸이 없다. 관리자의 답장이 보낸 편지함에 표시된다. 관리자가 앱에서 답장하면 그 메일 아래에 연결되고 안 읽음 숫자가 사라진다

</details>

## 이후 수정: 관리자 화면에서 환영 메일이 표시되지 않던 문제

10월 19일, 관리자로 로그인해 메일 앱을 열었더니 방문자에게 표시되는 환영 메일("방문해 주셔서 감사합니다!")이 어느 사서함에도 없었다. 관리자의 받은 편지함은 방문자가 보낸 실제 메일만 표시하기 때문이다. 환영 메일은 사이트 주인이 방문자에게 보낸 메일이므로, 관리자에게는 보낸 편지함 맨 아래(가장 오래된 메일)에 배치했다([PR #268](https://github.com/hyeoniverse/MacFolio/pull/268), 커밋 `b3551ae5e`).

| 사용자 | 환영 메일 위치      | 답장 칸 |
| ------ | ------------------- | ------- |
| 방문자 | 받은 편지함         | 없음    |
| 관리자 | 보낸 편지함 맨 아래 | 없음    |

`Mail.tsx`에서 관리자일 때만 보낸 편지함 목록 뒤에 환영 메일을 추가한다. `e2e/mail.spec.ts`의 "관리자: 환영 메일은 자기가 보낸 메일이라 보낸 편지함에 보인다"가 받은 편지함에는 없고 보낸 편지함에서 열리며 답장 칸이 없는지 검사한다. 같은 PR의 다른 수정은 [Finder 배경화면과 QuickTime 열기 창](/memo/finder-wallpaper-persist)에 정리했다.

## 남은 것·배운 것

- 다른 기기나 브라우저에서는 보낸 편지함이 비어 있다. "이 브라우저에서 보낸 메일만 표시됩니다" 같은 안내 문구를 추가하면 이 동작을 미리 알릴 수 있다.
- 메시지·댓글·메일이 같은 방문자 쿠키를 사용하므로, 방문자 식별 로직(`apps/api/src/visitors/`) 한 곳을 수정하면 세 기능에 함께 반영된다.
- 휴대폰 화면의 클래스 이름이 데스크톱 클래스와 충돌한 문제는 CSS 클래스에 앱별 접두어를 붙이는 규칙만으로는 막을 수 없다. 같은 앱 안에서도 충돌한다. 화면 상태는 `data-*` 속성에 저장하는 편이 안전하다.

## 직접 확인하기

```bash
pnpm --filter @macfolio/api test:e2e test/contact.e2e.test.ts   # 다른 방문자의 메일이 조회되지 않는지, 관리자 가드
cd apps/react && npx playwright test e2e/mail.spec.ts --project=desktop-chromium
```

배포된 사이트에서는 방문자로 메일을 한 통 보낸 뒤, 쿠키가 다른 브라우저에서 보낸 편지함을 열어 비어 있는지 확인한다. 개발자 도구 → Application → Cookies에서 쿠키를 삭제해도 다른 방문자로 처리된다. 메일 발송 설정은 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '연락 메일', 1년 보관은 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)의 '연락 메일'에 있다.

## 관련 글

- [Resend API와 Turnstile로 메일 앱에서 서버가 직접 메일 발송하기](/memo/contact-mail)
- [httpOnly 방문자 쿠키의 HMAC 해시로 이름·비밀번호 없는 메시지와 댓글 만들기](/memo/visitor-identity)
- [navigator.clipboard로 메일 앱의 주소를 복사하고 드래그 영역 위로 z-index 올리기](/memo/mail-copy-address)
- [휴대폰 시트 3곳의 공통 동작을 Sheet 컴포넌트로 추출](/memo/ui-sheet)
- [id 접두어 분리로 새로고침 뒤에도 유지되는 Finder 배경화면과 QuickTime Player 열기 창](/memo/finder-wallpaper-persist)

[^hmac]: HMAC(Hash-based Message Authentication Code)은 비밀 키와 입력을 함께 해시한 값이다. 키를 모르면 해시 값에서 원래 토큰을 계산할 수 없고, 같은 토큰은 항상 같은 값이 되므로 비교에 사용할 수 있다. 서버는 Node.js의 [`crypto.createHmac`](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options)으로 계산한다.

#MacFolio #백엔드 #메일
