---
title: 서버 저장소와 로컬 저장소가 같은 모양을 쓰게 — 메시지 도메인 옮기기
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 메시지 앱의 Thread·Message 모양과 고정 항목 id 'owner'가 서버와 화면에 따로 적혀 있었다. contracts로 옮기다 화면의 mine?: boolean과 서버의 mine: boolean이 어긋난 것을 찾았고, 서버의 요청 검사는 MessageInput = CommentInput 한 줄로 적었다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 셋째 PR([#202](https://github.com/hyeoniverse/MacFolio/pull/202))이다. [댓글](/memo/contracts-comments), [글](/memo/contracts-posts)에 이어 메시지 앱의 요청·응답 모양을 `@macfolio/contracts`로 옮겼다.

메시지 앱은 방문자가 사이트에 대한 의견을 남기는 곳이다. macOS 메시지처럼 왼쪽에 항목 목록, 오른쪽에 말풍선이 있다. 맨 위에는 사이트 주인(나)의 안내가 고정되어 있고, 누구나 거기에 답글을 달 수 있다. 쓰기 버튼으로 새 의견을 남기면 목록에 항목이 하나 생긴다. 내가 쓴 말풍선은 오른쪽, 남이 쓴 말풍선은 왼쪽에 놓인다. 이 "오른쪽에 놓을지"를 정하는 값이 이번 글에서 어긋나 있던 `mine`이다.

## 메시지 앱은 저장소가 둘이다

메시지 앱은 서버가 있으면 `/messages`에, 서버가 없으면(로컬 개발, 서버가 죽었을 때) `localStorage`에 저장한다. 둘 다 `ConversationRepository` 인터페이스를 구현하고 화면은 어느 쪽인지 모른다. 그래서 항목(`Thread`)과 말풍선(`Message`)의 모양은 **세 곳**이 맞춰야 한다. 서버가 보내는 것, 서버 저장소가 읽는 것, 로컬 저장소가 만드는 것.

지금까지는 서버 `messages.service.ts`의 `ThreadView`·`MessageView`와 화면 `conversations.ts`의 `Thread`·`Message`가 각자 적혀 있었다. 서버 쪽 주석에는 "apps/react/src/apps/messages/conversations.ts의 Message와 같은 모양"이라고 적혀 있었다. 같은 모양이라는 약속을 주석으로만 지키고 있었던 셈이다. 열어 보니 하나가 달랐다. 화면은 `mine?: boolean`(없어도 됨), 서버는 `mine: boolean`(늘 보냄). 로컬 저장소도 늘 채우고 있어서 실제로 없는 경우는 없었다. 타입만 느슨했고, 아무도 몰랐다.

느슨한 타입이 당장 문제를 일으키지는 않았다. 하지만 `mine`이 선택이면 화면 코드는 `thread.mine ?? false`처럼 없을 때를 처리하거나, 처리하지 않고 `undefined`를 거짓으로 넘긴다. 나중에 세 번째 저장소(예: 시험용 가짜 저장소)를 만들 때 `mine`을 빠뜨려도 타입 검사가 잡지 못한다. 그러면 내가 쓴 말풍선이 왼쪽에 놓이는데, 겉으로는 버그처럼 보이지 않아 오래 남을 수 있다.

저장소를 고르는 곳은 한 군데다.

```ts
// apps/react/src/apps/messages/repository/index.ts
export function getConversationRepository(): ConversationRepository {
	if (!repository) {
		repository =
			env.messagesStore === 'local'
				? createLocalConversationRepository(visitorId())
				: createApiConversationRepository(env.apiUrl);
	}
	return repository;
}
```

`ConversationRepository`는 `listThreads`·`listMessages`·`createThread`·`postMessage`·`removeMessage`·`myName` 여섯 메서드를 갖는다. 사람 구분과 `mine` 채우기는 저장소의 몫이다. 서버는 방문자 쿠키로, 로컬은 브라우저 id로 "보고 있는 사람의 글인지"를 정해 돌려준다. 화면은 받은 `mine`만 보고 말풍선을 좌우에 놓는다.

![화면은 ConversationRepository 하나만 안다. 서버 저장소와 로컬 저장소가 같은 Thread·Message 모양을 돌려준다](./images/contracts-messages-repos.svg '화면은 저장소가 어느 쪽인지 모른다. 모양만 같으면 된다')

![전: 서버·화면이 각자 적고 서버는 댓글 규칙을 빌려 씀. 후: contracts/messages.ts 하나를 서버·서버 저장소·로컬 저장소가 쓴다](./images/contracts-messages-shape.svg)

## 고른 방법

세 곳을 맞추는 방법을 놓고 견줘 봤다.

| 방법                                          | 좋은 점                         | 나쁜 점                                                         |
| --------------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| 지금처럼 각자 적고 주석으로 "같은 모양" 표시  | 바꿀 것이 없다                  | 이미 `mine` 하나가 어긋났다. 앞으로도 시험이 잡지 못한다        |
| 화면 `conversations.ts`를 서버가 import       | 한쪽만 적는다                   | 서버가 React 앱 폴더에 기댄다. 빌드 순서가 꼬인다               |
| contracts에 zod 스키마로 두고 양쪽이 가져온다 | 서버 검사·화면 타입이 같은 원본 | 패키지를 하나 거친다. 앞의 두 PR에서 이미 길을 닦아 비용이 작다 |

앞의 두 도메인에서 쓴 셋째 방법을 그대로 따랐다.

## 옮긴 것

```ts
// packages/contracts/src/messages.ts
export const PINNED_THREAD_ID = 'owner';

/** 새 피드백·답글 요청 몸통. 댓글과 같은 규칙(1~500자, 사람 확인 토큰) */
export const MessageInput = CommentInput;

export const Thread = z.object({
	id: z.string(),
	title: z.string(),
	ipPrefix: z.string().optional(),
	createdAt: z.string(),
	pinned: z.boolean().optional(),
	mine: z.boolean(),
	summary: z.string().optional(),
	lastMessage: z.object({ text: z.string(), createdAt: z.string() }).optional(),
});
export const ThreadCreated = z.object({ thread: Thread, message: Message });
```

`Message` 스키마도 같은 파일에 있다. `id`·`threadId`·`text`·`createdAt`·`authorId`·`nickname`·`fromOwner`·`mine`이 필수이고 `ipPrefix`만 선택이다. `authorId`는 같은 사람의 말풍선을 묶는 데만 쓰는 불투명한 값이다. 서버는 저장한 방문자 해시를 그대로 내보내지 않는다.

## 구현

**서버**는 `parse(MessageInput, body)`로 검사하고, `ThreadView`·`MessageView`는 contracts 타입의 별칭이 됐다. 서비스 로직은 그대로다.

```ts
// apps/api/src/messages/messages.service.ts
-import { hashIp, maskIp, parseBody } from '../comments/rules.js';
+import { hashIp, maskIp } from '../comments/rules.js';
+import { type Message, MessageInput, parse, PINNED_THREAD_ID, type Thread } from '@macfolio/contracts';

-export interface MessageView { id: string; threadId: string; … mine: boolean }
-export interface ThreadView { id: string; title: string; … mine: boolean }
+export type MessageView = Message;
+export type ThreadView = Thread;

-		const parsed = parseBody(input);
+		const parsed = parse(MessageInput, input);
```

인터페이스 두 개를 지우면서 서비스 파일은 39줄이 바뀌었다(대부분 지운 줄이다).

**화면**의 `conversations.ts`는 `Thread`·`Message` 인터페이스를 지우고 contracts에서 가져와 다시 내보낸다. 컴포넌트와 로컬 저장소의 import 경로는 그대로라 바뀐 파일이 적다. `mine`이 필수가 되면서 시험 픽스처 하나(`conversations.test.ts`)에 `mine: false`를 더했고, 그게 전부였다. 서버 저장소 `apiConversationRepository.ts`는 응답을 `as Thread[]`로 읽던 타입의 출처만 바뀌었다.

화면 쪽 `conversations.ts`에서는 인터페이스 두 개(34줄)가 빠지고 다시 내보내기 한 줄이 남았다. 주석으로 달려 있던 필드 설명(`ipPrefix`는 "IP 앞 두 자리", `mine`은 "오른쪽 말풍선" 등)은 contracts 스키마 옆으로 옮겨서 한 곳에서 읽힌다.

## 요청 몸통은 댓글과 같다

메시지도 댓글도 이름·비밀번호 없이 본문 1~500자와 사람 확인 토큰만 받는다. 서버는 원래 `comments/rules.ts`의 `parseBody`를 가져다 쓰고 있었다. 메시지 서비스가 댓글 모듈을 알아야 하는 이유가 "검사 함수가 거기 있어서"뿐이었다.

contracts에서는 `MessageInput = CommentInput` 한 줄로 적었다. 같은 규칙이라는 사실은 그대로 두되, 둘이 갈라질 때(예: 메시지는 1,000자까지) 이 줄만 스키마로 바꾸면 된다. 서버 메시지 모듈은 이제 댓글 모듈에서 IP 가리기·해시만 가져온다.

## 고정 항목 id

사이드바 맨 위의 사이트 주인 안내는 id가 `'owner'`다. 서버에는 거기 단 답글만 있고(`threadId`가 빈 글), 안내 글 자체는 화면에 있다. 이 `'owner'`가 서버 `PINNED_THREAD_ID`와 화면 `PINNED_THREAD_ID`에 각각 적혀 있었다. 한쪽이 바꾸면 안내가 사라지는 값이다. contracts에 하나만 두고 양쪽이 다시 내보낸다.

## 확인

- 단위 시험 `packages/contracts/src/messages.test.ts`에 세 개를 새로 썼다. "댓글과 같은 규칙: 다듬고, 비었거나 500자를 넘으면 이유를 알린다", "말풍선과 항목 (ipPrefix·summary·lastMessage는 없어도 된다)", "방문자 해시 같은 모르는 필드는 버린다". 마지막 것은 서버가 실수로 내부 값을 응답에 섞어도 스키마를 거치면 빠진다는 것을 확인한다.
- 화면 쪽 `localConversationRepository.test.ts`는 손대지 않았는데 통과했다. 로컬 저장소가 이미 `mine`을 늘 채우고 있었다는 뜻이다.
- E2E `apps/react/e2e/messages.spec.ts`는 그대로 통과했다. "처음에는 김정현의 안내가 열리고, 누구나 답글을 달 수 있다"가 고정 항목 `'owner'`를 지나가고, "다른 사람의 피드백에 답글을 달 수 있고, 사람마다 구분되어 보인다"가 `mine`과 `authorId`를 지나간다.
- 커밋 크기는 파일 10개, +223/−65. 글과 그림을 빼면 코드는 +113/−65다.

## 결과

| 항목                         | 전                    | 후                           |
| ---------------------------- | --------------------- | ---------------------------- |
| `Thread`·`Message`가 적힌 곳 | 2 (서버·화면)         | 1                            |
| `'owner'` 상수               | 2                     | 1                            |
| `mine` 타입                  | 서버 필수, 화면 선택  | 필수                         |
| 메시지 → 댓글 모듈 의존      | 검사 함수 + IP 도우미 | IP 도우미만                  |
| 동작 변화                    |                       | 없음 (e2e 메시지 4개 그대로) |

## 남은 것과 배운 것

`MessageInput = CommentInput`은 "지금은 같다"는 사실을 적은 것이지 "늘 같아야 한다"는 약속이 아니다. 메시지에 첨부를 받거나 글자 수를 늘리면 그때 따로 스키마를 만든다. 서버 메시지 모듈은 여전히 댓글 모듈에서 `hashIp`·`maskIp`를 가져온다. 이 둘은 방문자 식별 도우미라 나중에 공용 위치로 옮길 후보다.

배운 것은 "같은 모양"을 주석으로 약속하면 언젠가 어긋난다는 것이다. 이번에는 선택/필수 하나였지만, 스키마를 한 곳에 두고 나서야 드러났다. 저장소가 둘 이상인 기능일수록 모양을 한 원본에서 가져와야 한다.

다음은 [연락 메일](/memo/contracts-contact)·[배경화면](/memo/contracts-wallpapers)·[파일](/memo/contracts-files)·[분석](/memo/contracts-analytics) 순으로 같은 방식을 이어 갔다.

#MacFolio #리팩터링 #zod #TypeScript
