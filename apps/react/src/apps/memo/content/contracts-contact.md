---
title: contracts 스키마 4 - zod superRefine으로 첫 실패 문구만 반환하는 화면·서버 공통 검사
date: 2026-10-11
category: 개발 기록/MacFolio/백엔드
summary: 연락 메일의 검사 규칙을 화면과 서버가 각자 적어 문구가 달랐고, 서버만 검사하는 규칙도 있었다. contracts에 칸마다 [검사, 문구] 목록을 두고 처음 어긋난 문구 하나만 반환하게 했다. 화면은 칸 아래에, 서버는 400 배열로 같은 문구를 쓴다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 넷째 PR [#203](https://github.com/hyeoniverse/MacFolio/pull/203)이다. [댓글](/memo/contracts-comments), [글](/memo/contracts-posts), [메시지](/memo/contracts-messages)에 이어 메일 앱의 연락 메일을 `@macfolio/contracts`로 옮겼다. 앞의 세 PR은 응답 모양을 한곳에 모으는 작업이 중심이었고, 이번 PR은 **입력 검사**가 중심이다.

## 규칙은 같고 문구가 달랐다

연락 메일의 네 칸(이름·이메일·제목·내용)은 두 곳에서 검사했다.

- 화면: `contact.ts`의 `validateContact`가 칸마다 오류 문구를 반환한다.
- 서버: `contact/rules.ts`의 `parseContact`가 같은 규칙으로 다시 검사한다.

화면 코드 주석에는 "서버도 같은 규칙을 쓴다"고 적혀 있었다. 두 파일을 비교한 결과, 길이 상한(이름 30자·제목 100자·내용 2,000자)은 같았지만 문구가 달랐고 서버만 검사하는 규칙이 두 개 있었다.

| 경우           | 화면                                | 서버                             |
| -------------- | ----------------------------------- | -------------------------------- |
| 이름 30자 초과 | 이름은 30자까지 입력할 수 있습니다. | 이름은 30자까지입니다.           |
| 이메일 비움    | 답장받을 이메일을 입력해주세요.     | 이메일 형식을 확인해주세요.      |
| 제목에 줄바꿈  | (검사하지 않음)                     | 이름과 제목은 한 줄로 써 주세요. |
| 제어 문자[^cc] | (검사하지 않음)                     | 읽을 수 없는 글자가 있습니다.    |

화면이 먼저 필터링하므로 사이트에서 메일을 보내는 사용자가 서버 문구를 볼 일은 거의 없다. 그래서 차이가 드러나지 않았다. "같은 규칙"은 주석에 적힌 약속이었을 뿐 코드로 강제되지 않았다.

![전: 화면 validateContact와 서버 parseContact가 같은 규칙을 다른 문구로 적었다. 후: contracts/contact.ts 하나를 화면과 서버가 함께 쓴다](./images/contracts-contact-rules.svg '전: 화면과 서버가 같은 규칙을 각자, 문구는 다르게. 후: contracts/contact.ts의 칸마다 규칙 목록을 화면은 칸 아래 문구로, 서버는 400 배열로')

## 칸마다 규칙 목록, 처음 어긋난 것 하나

댓글·글 도메인에서는 zod의 `.min()`·`.max()`를 그대로 썼다. 연락 메일은 칸 하나에 규칙이 최대 네 개(빈 값, 길이, 한 줄, 제어 문자)라 방식을 바꿨다. 규칙을 `[검사, 문구]` 목록으로 적고, 처음 어긋난 규칙 하나만 issue[^issue]로 기록한다.

```ts
// packages/contracts/src/contact.ts
const field = (rules: [test: (value: string) => boolean, message: string][]) =>
	z.preprocess(contactText, z.string()).superRefine((value, ctx) => {
		const failed = rules.find(([test]) => !test(value));
		if (failed) ctx.addIssue({ code: 'custom', message: failed[1] });
	});

export const ContactInput = requestBody({
	name: field([
		[nonEmpty, '이름을 입력해주세요.'],
		[(v) => v.length <= CONTACT_LIMITS.name, `이름은 ${CONTACT_LIMITS.name}자까지 입력할 수 있습니다.`],
		[oneLine, '이름과 제목은 한 줄로 써 주세요.'],
		[readable, '읽을 수 없는 글자가 있습니다.'],
	]),
	// email, subject, body …
});
```

<details>
<summary>네 칸의 규칙 전체 (packages/contracts/src/contact.ts)</summary>

| 칸        | 순서대로 검사하는 규칙                             | 문구                                                                                      |
| --------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `name`    | 빈 값 → 30자 이하 → 한 줄 → 제어 문자 없음         | 이름을 입력해주세요. / 이름은 30자까지 입력할 수 있습니다. / 한 줄로 / 읽을 수 없는 글자  |
| `email`   | 빈 값 → 형식(`a@b.cc`)과 254자 이하                | 답장받을 이메일을 입력해주세요. / 이메일 형식을 확인해주세요.                             |
| `subject` | 빈 값 → 100자 이하 → 한 줄 → 제어 문자 없음        | 제목을 입력해주세요. / 제목은 100자까지 입력할 수 있습니다. / 한 줄로 / 읽을 수 없는 글자 |
| `body`    | 빈 값 → 2,000자 이하 → 제어 문자 없음(줄바꿈 허용) | 내용을 입력해주세요. / 내용은 2000자까지 입력할 수 있습니다. / 읽을 수 없는 글자          |

모든 칸은 검사 전에 `contactText`를 거친다. 문자열이 아니면 빈 문자열로 바꾸고, `\r\n`·`\r`을 `\n`으로 통일하고, 앞뒤 공백을 제거한다. 관리자 답장(`ReplyInput.body`)도 같은 `field`로 만들며 상한은 5,000자다.

</details>

핵심은 **문구를 하나만 반환한다**는 점이다. 화면은 칸 아래에 문구 한 줄을 표시하므로 문구가 둘이면 표시할 자리가 없다. 또 빈 이름에 "30자까지" 문구가 함께 붙으면 사용자는 무엇을 고쳐야 하는지 알 수 없다. zod의 `.refine()`을 여러 개 이어 붙이면 앞의 검사가 실패해도 뒤의 검사가 모두 실행되어 issue가 여럿 쌓인다. 그래서 [`superRefine`](https://zod.dev/api#superrefine) 하나 안에서 [`Array.prototype.find`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find)로 첫 실패에서 멈춘다.

![이름 칸의 규칙 네 개를 위에서부터 검사하고, 빈 값은 첫 규칙에서, 줄바꿈이 있는 값은 셋째 규칙에서 멈춘다](./images/contracts-contact-first-issue.svg '규칙은 위에서부터 검사하고, 어긋나면 그 자리에서 멈춘다')

| 방법                                         | 문구 수          | 문제                                                                         |
| -------------------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| `.min().max().refine().refine()` 이어 붙이기 | 실패한 만큼 여럿 | 빈 이름에 "30자까지"는 붙지 않지만, 한 줄·제어 문자 문구가 함께 나올 수 있다 |
| 칸마다 `if`문 (이전 화면 코드)               | 하나             | 서버와 같은 규칙인지 사람이 직접 맞춰야 한다                                 |
| `[검사, 문구]` 목록 + `find` (선택한 방법)   | 하나             | 규칙의 순서가 곧 우선순위이므로 순서를 정해야 한다                           |

## 같은 issue를 화면과 서버가 다르게 사용한다

**화면**의 `validateContact`는 [`safeParse`](https://zod.dev/basics) 결과의 issue를 `path[0]`(칸 이름)으로 묶어 칸마다 첫 문구를 고른다. 반환 모양 `{ value, errors: ContactErrors }`는 이전과 같아서 `ComposeView`는 수정하지 않았다. 화면도 이제 서버만 검사하던 규칙(한 줄, 제어 문자)을 함께 검사한다.

**서버**의 `parseContact`는 `parse(ContactInput, input)` 한 줄이다. 반환하는 `{ errors: string[] }`가 [400 Bad Request](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/400) 응답의 `message`가 된다. 문구는 화면 쪽에 맞췄다. 예를 들어 이메일이 비었을 때 서버는 "이메일 형식을 확인해주세요."라고만 했지만, 화면 문구 "답장받을 이메일을 입력해주세요."는 무엇을 입력해야 하는지까지 알려 준다.

관리자 답장(`ReplyInput`)과 응답 모양(`ContactMail`·`ContactSent`·`ContactStatus`)도 함께 옮겼다. 서버의 `ContactMailView`, 화면의 `ContactMail`·`ContactStatus` 인터페이스는 contracts 타입의 별칭으로 바뀌었다.

## 결과

| 항목                     | 전                    | 후                                                   |
| ------------------------ | --------------------- | ---------------------------------------------------- |
| 연락 메일 규칙이 적힌 곳 | 2 (화면·서버)         | 1 (`packages/contracts/src/contact.ts`)              |
| 문구가 다른 경우         | 2                     | 0                                                    |
| 화면이 검사하는 규칙     | 4                     | 6 (한 줄·제어 문자 추가)                             |
| 서버 `rules.ts`          | 검사 60줄 + 메일 작성 | 메일 작성만                                          |
| 동작 변화                | 없음                  | 400 문구가 화면 문구로 바뀜 (e2e는 상태 코드만 검사) |

변경 줄 수로 보면 화면과 서버의 검사 코드에서 159줄이 삭제되었고(`rules.ts` 53줄, `rules.test.ts` 38줄, 화면 `contact.ts` 34줄 등), contracts에 스키마 92줄과 시험 79줄이 추가되었다.

이후 [배경화면](/memo/contracts-wallpapers), [파일](/memo/contracts-files), [분석](/memo/contracts-analytics), [사이트 프로필](/memo/contracts-site) 도메인을 같은 방식으로 옮겼다.

## 확인

- `packages/contracts/src/contact.test.ts`(시험 5개): **칸마다 처음 어긋난 규칙 하나를, 칸 순서대로 알린다**, **이름·제목은 한 줄, 제어 문자는 받지 않는다 (메일 머리에 끼워 넣기 막기). 같은 문구는 한 번만** 등
- 화면 E2E(`e2e/mail.spec.ts`)의 **네 칸이 모두 차야 보내기를 누를 수 있고, 형식이 틀리면 경고창으로 알린다**와 **서버가 거절하면 이유를 보여 주고 쓰던 글은 그대로**는 시험 코드를 수정하지 않고 통과했다.
- 서버 e2e(`apps/api/test/contact.e2e.test.ts`)도 상태 코드만 검사하므로 그대로 통과했다. 반대로 말하면 문구가 바뀐 것을 이 시험은 감지하지 못한다.

## 남은 것, 배운 것

- 서버 e2e는 400 응답의 문구를 검사하지 않는다. 이번에는 문구를 의도적으로 바꿨으므로 문제가 없었지만, 실수로 바뀌어도 감지하지 못한다. 역할을 나눠 문구는 contracts 시험이, 상태 코드는 e2e가 검증한다.
- "화면이 먼저 필터링하므로 서버 문구는 아무도 보지 않는다"는 전제 때문에 두 문구가 어긋난 채 유지되었다. 그러나 API는 누구나 직접 호출할 수 있고, 사이트 밖 클라이언트가 받는 문구는 서버 문구다.
- 화면이 서버만 검사하던 규칙(한 줄, 제어 문자)을 함께 검사하게 된 것은 추가로 얻은 결과다. 규칙이 한 곳에 있으면 "어느 쪽이 더 엄격한가"를 비교할 필요가 없다.

## 따라 해 보기

계약을 바꿀 때는 `packages/contracts`를 먼저 수정하고, 서버와 화면이 모두 새 모양을 따르는지 확인한다.

```bash
pnpm --filter @macfolio/contracts test          # 스키마 시험
pnpm --filter @macfolio/contracts build         # 서버는 빌드된 JS를 읽는다
pnpm typecheck                                  # 화면·서버가 새 모양을 따르는지
pnpm --filter @macfolio/api test:e2e test/contact.e2e.test.ts
cd apps/react && npx playwright test e2e/mail.spec.ts --project=desktop-chromium
```

`ContactInput`의 필드 이름을 하나 바꿔 보면 `pnpm typecheck`가 서버와 화면에서 동시에 실패한다. 계약 하나를 바꾸면 양쪽에서 컴파일 오류로 드러나는 것이 이 작업의 효과다. 확인한 뒤에는 변경을 되돌린다. 스키마는 [Zod](https://zod.dev/)로 작성하고, 패키지를 나눈 이유는 [댓글 계약 글](/memo/contracts-comments)에 있다.

## 관련 글

- [메일 앱 1 - Resend API와 Turnstile로 서버에서 메일 발송하고 스팸 차단하기](/memo/contact-mail)
- [메일 앱 2 - 방문자 쿠키의 HMAC으로 서버가 메일 조회 범위를 필터링하기](/memo/mail-mailboxes)
- [contracts 스키마 1 - zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-comments)
- [트래픽 분석 5 - zod 스키마 하나로 분석 이벤트의 전송 형식과 서버 검증 통합하기](/memo/contracts-analytics)

[^cc]: 제어 문자(control character)는 화면에 표시되지 않는 문자(U+0000–U+001F, U+007F 등)다. 제목은 메일의 Subject 헤더(`[MacFolio] 제목`)에, 이름은 본문 끝의 "보낸 사람: 이름 <이메일>" 줄에 들어간다(`apps/api/src/contact/rules.ts`의 `buildEmail`). 헤더 값에 줄바꿈이 섞이면 헤더를 추가로 끼워 넣는 [메일 헤더 인젝션](https://en.wikipedia.org/wiki/Email_injection)에 쓰일 수 있다. 그래서 이름·제목은 한 줄만 허용하고, 모든 칸에서 줄바꿈·탭을 제외한 제어 문자를 거부한다.

[^issue]: zod가 검사 실패를 기록하는 단위. 실패한 위치(`path`), 종류(`code`), 문구(`message`)를 담는다. `safeParse`는 실패 시 issue 목록을 반환하고, `parse`는 issue를 담은 오류를 던진다. 자세한 내용은 [Zod 오류 사용자 지정 문서](https://zod.dev/error-customization)에 있다.

#MacFolio #리팩터링 #zod #TypeScript
