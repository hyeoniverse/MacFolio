---
title: 첫 요청 실패와 사용 중 연결 끊김을 구분하는 메시지 앱 오류 처리
date: 2026-10-02
category: 개발 기록/MacFolio/서버·API
summary: 서버에 연결하지 못하면 메시지 앱이 빈 목록과 "Failed to fetch"를 표시했다. 첫 불러오기가 실패하면 경고창을 표시하고 앱을 종료하며, 사용 중 연결이 끊기면 전송 실패만 알린다. 서버 없이 확인할 때는 VITE_MESSAGES_STORE=local로 저장소를 선택한다.
---

MacFolio의 메시지 앱은 macOS 메시지 앱 모양을 한 피드백 게시판이다. 방문자가 사이트에 대한 감상·의견·피드백을 말풍선으로 남기고, 다른 방문자와 관리자가 그 아래에 답글을 단다. 처음에는 글을 각 방문자 브라우저에만 저장했고, [방문자 쿠키로 이름을 정하는 작업](/memo/visitor-identity)에서 API 서버의 PostgreSQL에 저장하도록 바뀌었다.

저장 위치가 서버로 바뀐 뒤에도 서버에 연결하지 못하는 경우의 화면은 만들지 않았다. 그 결과 목록 불러오기가 실패하면 "아직 남겨진 피드백이 없어요."가 표시됐고, 글을 보내면 입력창 아래에 브라우저의 영어 오류 문구 "Failed to fetch"가 빨간색으로 표시됐다. [PR #73](https://github.com/hyeoniverse/MacFolio/pull/73)에서 실패를 두 종류로 나누어 처리하고, 개발 환경에서 저장소를 고르는 설정을 추가했다.

![데스크톱 전후](./images/messages-offline-desktop.jpg '전: 빈 목록, 보내면 Failed to fetch / 후: 열 때와 보낼 때 모두 경고창')

## 배경

### 재현 조건

API 서버를 실행하지 않고 프런트엔드만 `pnpm dev`로 실행하면 재현된다. 배포 환경에서도 API 서버는 Oracle Cloud의 메모리 1GB VM 한 대이므로, 새 버전을 배포하는 동안이나 서버가 중단된 동안에는 방문자에게 같은 화면이 표시될 수 있었다.

### 빈 목록이 문제인 이유

==빈 목록은 사실과 다른 정보다==. 실제 상태는 피드백 0건이 아니라 불러오기 실패다. 예를 들어 피드백이 30건 쌓인 상태에서 서버가 잠시 중단되면, 방문자에게는 "아무도 글을 남기지 않은 게시판"이 표시된다. 처음에는 빈 목록 화면과 입력 칸 여백을 수정하고 있었는데, 서버 없이 실행한 화면을 다시 확인하니 조회도 작성도 불가능한 상태에서 앱이 정상인 것처럼 표시되고 있었다.

서버가 없으면 읽기와 쓰기가 모두 불가능하므로 앱을 열지 않는 편이 맞다. 메모 앱이 코드 청크(지연 로딩하는 JavaScript 파일 조각)를 불러오지 못하면 경고창으로 실행을 막는 방식과 같다.

### 처리 방법 비교

| 방법                                           | 장점                                                                | 단점                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| 빈 목록을 그대로 표시 (기존)                   | 추가 작업이 없다                                                    | "피드백이 없다"는 잘못된 정보를 준다. 전송하면 영어 오류 문구 |
| 앱 안에 "연결할 수 없음" 화면과 다시 시도 버튼 | 앱을 닫지 않는다                                                    | 앱마다 오류 화면을 따로 만들어야 하고, 내용 없는 창이 남는다  |
| **경고창을 표시하고 앱을 종료** (채택)         | 메모 앱의 코드 불러오기 실패와 같은 방식. 공통 `AlertDialog` 재사용 | 다시 시도하려면 앱을 다시 열어야 한다                         |

## fetch가 실패하는 두 경우

브라우저에서 서버로 요청을 보내는 표준 함수가 [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch)다. `fetch()`는 요청 결과를 Promise로 돌려주는데, Promise가 거부(reject)되는 경우와 이행(fulfill)되는 경우의 기준이 직관과 다르다.

![fetch 실패의 두 경우](./images/messages-offline-fetch-failure.svg '서버에 닿지 못하면 Promise가 TypeError로 거부되고, 서버가 오류 코드로 응답하면 Promise는 이행된다. 두 경우를 각각 한국어 문구로 바꾼다')

| 상황                                      | `fetch()`의 결과                  | 예                        |
| ----------------------------------------- | --------------------------------- | ------------------------- |
| 서버가 꺼졌거나 네트워크가 끊김           | `TypeError`로 거부                | Chrome `Failed to fetch`  |
| 서버가 `500 Internal Server Error`로 응답 | `Response`로 이행, `ok`가 `false` | `response.status === 500` |
| 서버가 `201 Created`로 응답               | `Response`로 이행, `ok`가 `true`  | 정상                      |

MDN 문서의 설명대로 `fetch()`는 ==응답을 받기만 하면 상태 코드가 404나 500이어도 거부하지 않는다==. 거부는 응답 자체를 받지 못한 경우에만 일어난다. 이때 오류 객체의 문구는 브라우저가 정하므로 Chrome은 `Failed to fetch`, Safari는 `Load failed`로 서로 다르고, 모두 영어다. 기존 코드는 이 문구를 그대로 화면에 표시했다.

API 저장소(`apiConversationRepository.ts`)의 요청 함수 `call`에서 두 경우를 나누어 처리한다. 서버 주소가 비어 있거나 `fetch()`가 거부되면 화면용 한국어 문구로 바꾸고, 서버가 오류 상태 코드로 응답하면 기존 `failure(response)`가 응답 본문에 담긴 서버의 이유를 꺼낸다.

```ts
/** 서버에 닿지 못했을 때 (주소가 없거나, 서버가 꺼졌거나, 네트워크가 끊김) */
export const UNREACHABLE = '서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.';

const call = async (path: string, init?: RequestInit) => {
	if (!apiUrl) throw new Error(UNREACHABLE);
	return fetchImpl(`${apiUrl}/messages${path}`, {
		credentials: 'include',
		...init,
		headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
	}).catch(() => {
		// fetch는 'Failed to fetch' 같은 브라우저 문구로 실패한다. 화면에 보일 문구로 바꾼다
		throw new Error(UNREACHABLE);
	});
};
```

말풍선 목록을 불러오는 요청의 실패는 처리되지 않은 Promise 거부(unhandled rejection)로 남아 있었다. 처리되지 않은 거부란 `.catch()`나 `try … catch`로 받는 코드가 없는 거부를 말하며, 브라우저는 이때 `unhandledrejection` 이벤트를 발생시키고 개발자 도구 콘솔에 `Uncaught (in promise)` 오류를 기록한다. 이 요청에도 처리를 추가해, 실패하면 표시 중인 말풍선을 그대로 유지한다.

## 앱을 여는 시각의 서버 확인

앱을 열면 피드백 목록(`GET /messages/threads`)을 먼저 불러온다. 이 첫 요청이 실패하면 앱 내용을 렌더링하지 않고 경고창을 표시한다.

> **메시지를 열 수 없습니다**
> 지금 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요. [확인]

알림만 하는 창이므로 버튼은 [확인] 하나다. 공통 경고창 컴포넌트(`AlertDialog`)는 원래 [취소]와 [확인] 두 버튼을 2열 격자로 배치한다. `cancelLabel={null}`을 전달하면 [취소] 버튼이 빠지고, CSS 선택자 [`:has()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)로 남은 버튼이 전체 너비를 차지하게 한다. `:has()`는 "괄호 안 조건을 만족하는 자식을 가진 요소"를 고르는 선택자이므로, 아래 규칙은 "자식이 하나뿐인 버튼 영역"에만 적용된다.

```css
.ui-alert-actions:has(> :only-child) {
	grid-template-columns: 1fr;
}
```

[확인]을 누르면 앱을 종료한다. 데스크톱에서는 창이 닫히고, 휴대폰에서는 홈 화면으로 돌아간다. 다시 열면 처음부터 서버에 다시 요청한다.

![휴대폰 전후](./images/messages-offline-mobile.jpg '휴대폰도 같다. 확인을 누르면 홈 화면으로')

## 사용 중 연결이 끊긴 경우

![목록 상태](./images/messages-offline-status.svg '처음 불러오기 실패만 error가 되고, 쓰는 도중의 실패는 상태를 바꾸지 않는다')

==앱 사용 중에 서버 연결이 끊기면 앱을 닫지 않는다==. 방문자가 긴 피드백을 작성하던 중에 전송이 실패했는데 앱이 종료되면 작성한 글이 사라지기 때문이다. 그래서 첫 불러오기와 이후의 목록 새로고침을 구분했다. `useConversations.ts`의 목록 상태는 `'loading' | 'ready' | 'error'` 세 값 중 하나이고, `loading`에서만 `error`로 전환된다.

```ts
const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
// ...
.catch(() => setStatus((prev) => (prev === 'loading' ? 'error' : prev)))
```

`setStatus`에 함수를 넘기면 React가 직전 상태(`prev`)를 인자로 준다. 직전 상태가 `loading`이면 첫 불러오기의 실패이므로 `error`로 바꾸고, 이미 `ready`이면 그대로 둔다.

사용 중 전송이 실패하면 같은 경고창으로 "메시지를 보내지 못했습니다 / 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요. [확인]"을 표시한다. [확인]을 누르면 작성한 글이 입력창에 그대로 남고 포커스도 입력창으로 돌아오므로, 서버가 복구된 뒤 [보내기]만 다시 누르면 된다.

| 상황                       | 목록 상태           | 화면                                                |
| -------------------------- | ------------------- | --------------------------------------------------- |
| 첫 불러오기 실패           | `loading` → `error` | "메시지를 열 수 없습니다" 경고창, [확인] 시 앱 종료 |
| 사용 중 목록 새로고침 실패 | `ready` 유지        | 마지막으로 불러온 목록 유지                         |
| 사용 중 전송 실패          | `ready` 유지        | "메시지를 보내지 못했습니다" 경고창, 입력 내용 유지 |
| 말풍선 불러오기 실패       | `ready` 유지        | 표시 중인 말풍선 유지                               |

### 전송 실패 문구를 경고창으로 옮긴 이유

처음에는 전송 실패를 입력창 아래 빨간 글 한 줄로 표시했다(`.messages-error`). 그런데 메시지 앱의 입력창은 창 아래쪽에 붙어 있으므로, 오류 줄이 생기면 그 줄의 높이만큼 입력창이 위로 이동했다가 글을 수정해 오류 줄이 사라지면 다시 아래로 이동했다. 이처럼 사용자가 조작하지 않았는데 이미 표시된 요소의 위치가 바뀌는 현상을 레이아웃 이동(layout shift)이라고 한다. 입력하던 위치가 움직이면 누르려던 버튼을 놓치기 쉽다.

![전송 실패 문구 위치의 전후](./images/messages-offline-layout-shift.svg '왼쪽: 오류 줄이 입력창 아래에 생겨 입력창이 위로 이동한다. 오른쪽: 경고창은 화면 위에 겹쳐 표시되므로 입력창 위치가 바뀌지 않는다')

==경고창은 화면 위에 겹쳐 표시되므로 레이아웃을 바꾸지 않는다==. 두 번째 커밋(`31f2a0e31`)에서 경고창으로 옮기고 `Messages.css`의 오류 줄 스타일 10줄을 삭제했다. E2E 시험은 전송 전과 실패 후의 입력창 위치가 같은지 비교한다.

| 위치        | 변경 전                                | 변경 후                    |
| ----------- | -------------------------------------- | -------------------------- |
| 오류 표시   | 입력창 아래 빨간 글(`.messages-error`) | 공통 경고창(`AlertDialog`) |
| 입력창 위치 | 오류 줄 높이만큼 위로 이동             | 변하지 않음                |

### 공통 경고창 스타일 수정

같은 커밋에서 공통 경고창(`AlertDialog.css`)의 스타일 두 가지를 수정했다. 공통 컴포넌트이므로 메모를 삭제할 때 표시하는 확인 창에도 함께 적용된다.

| 문제                                                                                                                               | 수정                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 문구가 "시도해 주/세요"처럼 단어 중간에서 줄바꿈된다                                                                               | [`word-break: keep-all`](https://developer.mozilla.org/en-US/docs/Web/CSS/word-break) + `overflow-wrap: anywhere` |
| 경고창이 열리는 시각에 [확인]으로 포커스를 이동하는데, 브라우저 기본 포커스 테두리가 굵게(휴대폰 에뮬레이션에서는 주황색) 표시된다 | `:focus-visible`에서 `outline: none`, 강조색을 35% 섞은 3px `box-shadow` 고리                                     |

두 속성의 동작은 다음과 같다.

- **`word-break: keep-all`:** 브라우저는 기본적으로 한국어를 글자 단위로 줄바꿈한다. `keep-all`을 지정하면 한국어·중국어·일본어 문장도 띄어쓰기 위치에서만 줄을 바꾼다. 다만 띄어쓰기 없이 긴 영어 주소 같은 문자열은 칸을 넘칠 수 있으므로, `overflow-wrap: anywhere`로 그런 경우에만 아무 위치에서나 줄을 바꾸게 한다.
- **`:focus-visible`:** 키보드로 이동했을 때처럼 브라우저가 포커스 표시가 필요하다고 판단할 때만 적용되는 선택자다. 기본 테두리(`outline`)를 없애고 그 자리에 버튼 모양을 따라 둥글게 그려지는 `box-shadow` 고리를 넣어, 포커스 위치는 계속 보이게 했다.

## 개발 환경에서는 .env로 저장소 선택

서버가 없으면 앱이 열리지 않으므로, API를 실행하지 않고 화면만 수정하는 경우 메시지 앱을 확인할 수 없게 된다. 그래서 저장소를 [Vite 환경 변수](https://vite.dev/guide/env-and-mode)로 선택하게 했다.

Vite는 프로젝트의 `.env`, `.env.local` 같은 파일에서 환경 변수를 읽고, 이름이 `VITE_`로 시작하는 변수만 브라우저 코드의 `import.meta.env`에 노출한다. 비밀 값이 실수로 브라우저 번들에 들어가지 않게 하는 규칙이다. 값은 빌드 시각에 코드에 문자열로 치환되므로, 배포한 뒤에는 바꿀 수 없다.

| `VITE_MESSAGES_STORE` | 저장 위치                                                                                          | 사용 상황                     |
| --------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| `local`               | 이 브라우저 ([localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)) | 서버 없이 화면을 확인할 때    |
| 비움 또는 `server`    | 서버 (`VITE_API_URL`)                                                                              | 배포. 서버가 없으면 열지 않음 |

```bash
echo 'VITE_MESSAGES_STORE=local' >> apps/react/.env.local
```

![저장소 선택 경로](./images/messages-offline-repository.svg '.env 값은 env.ts에서 두 값 중 하나로 바뀌고, repository/index.ts가 그 값으로 저장소 구현을 고른다. 화면 코드는 같은 인터페이스만 사용한다')

값을 읽는 곳은 `shared/config/env.ts` 한 곳이다. `local`이 아니면 모두 서버로 처리하므로, `VITE_MESSAGES_STORE=lcoal`처럼 철자가 틀린 값도 서버가 된다.

```ts
messagesStore: ((globalThis.__MACFOLIO_MESSAGES_STORE__ ?? import.meta.env.VITE_MESSAGES_STORE) === 'local'
	? 'local'
	: 'server') as 'local' | 'server',
```

저장소를 생성하는 곳도 하나다. `repository/index.ts`의 `getConversationRepository`가 이 값에 따라 `localStorage` 저장소 또는 API 저장소를 생성한다. 두 저장소는 같은 `ConversationRepository` 인터페이스(`myName`, `listThreads`, `listMessages`, `createThread`, `postMessage`, `removeMessage`)를 구현하므로 화면 코드는 저장 위치를 알 필요가 없다.

배포 기본값은 서버다. 값을 비워 두면 서버에 저장하므로 배포 설정에 추가할 값이 없다. 기본값 판단 기준은 다음과 같이 바뀌었다.

| 조건                        | 변경 전 (주소 기준)                    | 변경 후 (`VITE_MESSAGES_STORE` 기준) |
| --------------------------- | -------------------------------------- | ------------------------------------ |
| `VITE_API_URL` 있음         | 서버                                   | 서버                                 |
| `VITE_API_URL` 없음         | 브라우저 저장소 (방문자마다 따로 저장) | 서버 → 앱을 열지 않고 경고창 표시    |
| `VITE_MESSAGES_STORE=local` | (없던 설정)                            | 브라우저 저장소                      |

> [!WARNING] 변경 전 기본값의 문제
> 변경 전에는 배포 설정에서 주소가 빠지면 글이 방문자마다 자기 브라우저에만 저장되는데, 화면으로는 이 상태를 알아차리기 어려웠다.

E2E 시험은 API 주소를 주입하던 전역 변수(`__MACFOLIO_API_URL__`) 옆에 `__MACFOLIO_MESSAGES_STORE__`를 추가했다. 시험은 기본으로 `local`을 사용하고, 가짜 API를 켜면 `server`로 전환된다.

## 시험

첫 커밋(`4f616edf6`)은 19개 파일을 수정했다(215줄 추가, 39줄 삭제). 주요 화면 코드는 `Messages.tsx`·`useConversations.ts`·`apiConversationRepository.ts`·`repository/index.ts`·`shared/config/env.ts`·`AlertDialog`이고, 나머지는 시험·`.env.example`·`README.md`·`docs/deployment.md` 같은 설정과 문서다.

<details>
<summary>시험 이름 전체</summary>

- `e2e/messages.spec.ts`
  - "서버 주소가 없으면 앱을 열지 않고 알린다. 확인하면 앱을 끈다"
  - "서버가 응답하지 않으면 앱을 열지 않는다"
  - "열어 둔 뒤에 서버가 끊기면 보내기 실패만 경고창으로 알리고, 쓴 글은 남는다" (전송 전과 실패 후의 입력창 위치가 같은지도 비교)
- `e2e/mobile.spec.ts`: 휴대폰에서 [확인]을 누르면 홈 화면으로 돌아가는지

</details>

## 남은 과제와 정리

- 앱을 종료한 뒤 다시 시도하려면 앱을 다시 열어야 한다. 서버 복구 여부를 자동으로 다시 확인하지는 않는다.
- 가장 중요한 변경은 저장소 기본값이다. "주소가 있으면 서버"에서 "항상 서버, `local`일 때만 브라우저"로 바뀌었다. 배포 설정이 빠졌을 때 다른 위치에 조용히 저장되는 것보다, 앱이 열리지 않아 즉시 발견되는 편이 낫다.
- 두 저장소는 이후 `packages/contracts`의 같은 `Thread`·`Message` 타입을 사용하도록 정리했다([zod 스키마로 서버 저장소와 로컬 저장소의 메시지 타입 통합하기](/memo/contracts-package#메시지-스키마와-두-저장소-구현-202)).

## 직접 확인하는 방법

```bash
# 1. 서버 없이 사이트만 실행한다 → 메시지 앱을 열면 경고창이 표시되고 앱이 열리지 않아야 한다
pnpm dev

# 2. 서버 없이 화면만 수정할 때는 저장소를 브라우저로 바꾼다 (apps/react/.env.local)
VITE_MESSAGES_STORE=local

# 3. 서버와 함께
pnpm dev:all
```

`VITE_MESSAGES_STORE`를 비우거나 `server`로 지정하면 배포 기본값(서버)이다. 변수 설명은 [apps/react/.env.example](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/.env.example), 읽는 곳은 [apps/react/src/shared/config/env.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/shared/config/env.ts)다. 화면 시험은 `cd apps/react && npx playwright test e2e/messages.spec.ts`.

## 관련 글

- [httpOnly 방문자 쿠키의 HMAC 해시로 가입 없이 방문자 식별하기](/memo/visitor-identity)
- [zod 스키마로 서버 저장소와 로컬 저장소의 메시지 타입 통합하기](/memo/contracts-package#메시지-스키마와-두-저장소-구현-202)
- [scrypt 비밀번호 해시와 IP HMAC만 저장하는 가입 없는 댓글](/memo/post-comments)

<details>
<summary>참고 문헌</summary>

- MDN, [Window: fetch() method](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch)
- MDN, [Window: unhandledrejection event](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event)
- MDN, [:has()](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)
- MDN, [word-break](https://developer.mozilla.org/en-US/docs/Web/CSS/word-break)
- MDN, [:focus-visible](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible)
- web.dev, [Cumulative Layout Shift (CLS)](https://web.dev/articles/cls)
- Vite, [Env Variables and Modes](https://vite.dev/guide/env-and-mode)
- React, [useState: Updating state based on the previous state](https://react.dev/reference/react/useState#updating-state-based-on-the-previous-state)

</details>

#MacFolio #메시지 #서버
