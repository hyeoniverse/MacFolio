---
title: 같은 뜻, 다른 문구 — 연락 메일의 검사 규칙을 하나로
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 연락 메일의 검사 규칙을 화면과 서버가 각자 적어 문구가 달랐고, 서버만 보는 규칙도 있었다. contracts에 칸마다 [검사, 문구] 목록을 두고 처음 어긋난 문구 하나만 내게 했다. 화면은 칸 아래에, 서버는 400 배열로 같은 문구를 쓴다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 넷째 PR [#203](https://github.com/hyeoniverse/MacFolio/pull/203). [댓글](/memo/contracts-comments), [글](/memo/contracts-posts), [메시지](/memo/contracts-messages)에 이어 메일 앱의 연락 메일을 옮겼다. 이번에는 응답 모양보다 **입력 검사**가 주인공이다.

## 규칙은 같고 문구가 달랐다

연락 메일의 네 칸(이름·이메일·제목·내용)은 화면 `contact.ts`의 `validateContact`가 칸마다 문구를 돌려주고, 서버 `contact/rules.ts`의 `parseContact`가 같은 규칙으로 다시 본다. 주석에도 "서버도 같은 규칙을 쓴다"고 적혀 있었다. 열어 보니 상한(30·100·2,000자)은 같은데 문구가 달랐다.

| 경우           | 화면                                | 서버                             |
| -------------- | ----------------------------------- | -------------------------------- |
| 이름 30자 초과 | 이름은 30자까지 입력할 수 있습니다. | 이름은 30자까지입니다.           |
| 이메일 비움    | 답장받을 이메일을 입력해주세요.     | 이메일 형식을 확인해주세요.      |
| 제목에 줄바꿈  | (안 본다)                           | 이름과 제목은 한 줄로 써 주세요. |
| 제어 문자      | (안 본다)                           | 읽을 수 없는 글자가 있습니다.    |

화면이 먼저 거르니 사용자가 서버 문구를 볼 일은 거의 없다. 그래서 아무도 몰랐다. 하지만 "같은 규칙"이라는 말은 사람의 기억이었지 코드가 아니었다.

![규칙을 한 곳에](./images/contracts-contact-rules.svg '전: 화면과 서버가 같은 규칙을 각자, 문구는 다르게. 후: contracts/contact.ts의 칸마다 규칙 목록을 화면은 칸 아래 문구로, 서버는 400 배열로')

## 칸마다 규칙 목록, 처음 어긋난 것 하나

댓글·글에서는 zod의 `.min()`·`.max()`를 그대로 썼다. 연락 메일은 칸 하나에 규칙이 서너 개(비었나, 길이, 한 줄, 제어 문자)라 조금 다르게 했다. 규칙을 `[검사, 문구]` 목록으로 적고 처음 어긋난 것 하나만 issue로 낸다.

```ts
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

"하나만"이 중요하다. 화면은 칸 아래에 문구 한 줄을 보이는 자리라 두 개를 받으면 곤란하고, 빈 이름에 "30자까지" 문구까지 붙으면 이상하다. zod의 refine을 여러 개 이어 붙이면 앞의 것이 실패해도 뒤의 것이 다 돈다. 그래서 `superRefine` 하나 안에서 `find`로 끝낸다.

![처음 어긋난 것 하나](./images/contracts-contact-first-issue.svg '규칙은 위에서부터 보고, 걸리면 거기서 멈춘다')

| 방법                                         | 문구 수          | 문제                                                                  |
| -------------------------------------------- | ---------------- | --------------------------------------------------------------------- |
| `.min().max().refine().refine()` 이어 붙이기 | 실패한 만큼 여럿 | 빈 이름에 "30자까지"는 안 붙지만, 한 줄·제어 문자 문구가 겹칠 수 있다 |
| 칸마다 `if`문 (전의 화면 코드)               | 하나             | 서버와 같은 규칙인지 사람이 맞춘다                                    |
| `[검사, 문구]` 목록 + `find` (고른 방법)     | 하나             | 규칙의 순서가 곧 우선순위다 (순서를 정해야 한다)                      |

## 같은 issue를 둘이 다르게 쓴다

**화면**의 `validateContact`는 `safeParse` 결과의 issue를 `path[0]`(칸 이름)으로 묶어 칸마다 첫 문구를 고른다. 돌려주는 모양 `{ value, errors: ContactErrors }`는 그대로라 `ComposeView`는 한 글자도 안 바뀌었다. 화면이 서버만 보던 규칙(한 줄, 제어 문자)도 같이 보게 됐다.

**서버**의 `parseContact`는 `parse(ContactInput, input)` 한 줄. 돌려주는 `{ errors: string[] }`가 400의 `message`가 된다. 문구는 화면 것으로 맞췄다. 사용자가 보는 글이니 화면 쪽이 더 친절했다.

관리자 답장(`ReplyInput`)과 응답 모양(`ContactMail`·`ContactSent`·`ContactStatus`)도 함께 옮겼다. 서버 `ContactMailView`, 화면 `ContactMail`·`ContactStatus` 인터페이스는 contracts 타입의 별칭이 됐다.

## 결과

| 항목                     | 전                      | 후                                              |
| ------------------------ | ----------------------- | ----------------------------------------------- |
| 연락 메일 규칙이 적힌 곳 | 2 (화면·서버)           | 1                                               |
| 문구가 다른 경우         | 2                       | 0                                               |
| 화면이 보는 규칙         | 4                       | 6 (한 줄·제어 문자 추가)                        |
| 서버 `rules.ts`          | 검사 60줄 + 메일 만들기 | 메일 만들기만                                   |
| 동작 변화                |                         | 400 문구가 화면 것으로 (e2e는 상태 코드만 본다) |

다음은 배경화면·파일·분석 순으로 같은 방식.

바뀐 줄로 보면, 화면과 서버의 검사 코드에서 159줄이 빠지고(`rules.ts` 53, `rules.test.ts` 38, 화면 `contact.ts` 34 등) contracts에 스키마 92줄과 시험 79줄이 생겼다.

## 확인

- `packages/contracts/src/contact.test.ts`(5개): **칸마다 처음 어긋난 규칙 하나를, 칸 순서대로 알린다**, **이름·제목은 한 줄, 제어 문자는 받지 않는다 (메일 머리에 끼워 넣기 막기). 같은 문구는 한 번만** 등
- 화면 E2E(`e2e/mail.spec.ts`)의 **네 칸이 모두 차야 보내기를 누를 수 있고, 형식이 틀리면 경고창으로 알린다**와 **서버가 거절하면 이유를 보여 주고 쓰던 글은 그대로**는 고치지 않고 통과했다.
- 서버 e2e(`apps/api/test/contact.e2e.test.ts`)도 상태 코드만 보므로 그대로 통과했다. 문구가 바뀐 것을 시험이 잡지 못한다는 뜻이기도 하다.

## 남은 것, 배운 것

- 서버 e2e가 400의 문구를 보지 않는다. 이번에는 문구를 일부러 바꿨으니 문제가 없었지만, 실수로 바뀌어도 모른다. 문구는 contracts 시험이 지키고, e2e는 상태 코드를 지키는 것으로 나눴다.
- "화면이 먼저 거르니 서버 문구는 아무도 안 본다"는 생각이 두 문구를 어긋난 채 두게 했다. 그러나 API는 누구나 부를 수 있고, 사이트 밖 클라이언트가 보는 문구는 서버 문구다.
- 화면이 서버만 보던 규칙(한 줄, 제어 문자)을 같이 보게 된 것이 덤이었다. 규칙을 한 곳에 두면 "어느 쪽이 더 엄격한가"를 따질 일이 없어진다.

## 따라 해 보기

계약을 바꿀 때는 `packages/contracts`를 먼저 고치고, 서버와 화면이 둘 다 따라오는지 본다.

```bash
pnpm --filter @macfolio/contracts test          # 스키마 시험
pnpm --filter @macfolio/contracts build         # 서버는 빌드된 JS를 읽는다
pnpm typecheck                                  # 화면·서버가 새 모양을 따르는지
pnpm --filter @macfolio/api test:e2e test/contact.e2e.test.ts
cd apps/react && npx playwright test e2e/mail.spec.ts --project=desktop-chromium
```

필드 이름을 하나 바꿔 보면 `pnpm typecheck`가 서버와 화면에서 같이 깨진다. 이게 이 작업으로 얻은 것이다. 확인한 뒤 되돌린다. 스키마는 [Zod](https://zod.dev/)로 쓰고, 패키지를 나눈 까닭은 [댓글 계약](/memo/contracts-comments)에 있다.

관련 글: [메일 앱에서 진짜로 메일 보내기](/memo/contact-mail), [댓글 계약](/memo/contracts-comments), [분석 계약](/memo/contracts-analytics), [메일 앱의 편지함](/memo/mail-mailboxes)

#MacFolio #리팩터링 #zod #TypeScript
