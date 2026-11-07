---
title: 코드 상수였던 사이트 프로필을 행 하나짜리 테이블로 옮겨 편집하기
date: 2026-10-11
category: 개발 기록/MacFolio/서버·API
series: 사이트 편집
seriesOrder: 1
summary: 이름·이메일·GitHub 주소가 코드 상수라 이 저장소로 사이트를 배포하려면 코드를 수정해야 했다. 프로필을 행 하나짜리 테이블에 저장하고 관리자가 시스템 설정에서 편집하게 했으며, 상수를 읽던 15개 파일이 프로필 저장소를 읽도록 바꿨다.
---

## 코드 상수로 관리하던 프로필

이 사이트는 다른 사람도 저장소를 내려받아 자기 포트폴리오로 배포할 수 있게 만들었다. 그런데 사이트에 표시되는 내용은 저장소 주인의 것이었다. 이 Mac에 관하여 창의 이름, 메일 앱의 받는 사람 주소, 터미널 `whoami`의 출력, 기술 목록이 모두 `shared/profile.ts`의 상수 `PROFILE`·`SKILLS`에서 나왔다.

```ts
// 전: shared/profile.ts (일부)
export const PROFILE = {
	name: '김정현',
	nameEn: 'Kim Jeong Hyeon',
	role: 'Frontend Focused Fullstack Developer',
	github: 'https://github.com/hyeoniverse',
	// …
} as const;

export const SKILLS = {
	frontend: ['React', 'Next.js', 'TypeScript', 'JavaScript', 'TailwindCSS', 'Zustand'],
	// …
} as const;
```

상수는 빌드할 때 자바스크립트 번들에 그대로 포함된다. 그래서 다른 사람이 이 저장소로 사이트를 배포하려면 이 파일을 직접 수정하고 다시 빌드·배포해야 했다. 이메일 주소 하나를 바꾸는 데도 같은 절차가 필요했다.

그래서 프로필을 서버에 저장하고, 관리자가 **시스템 설정 › 정보**에서 편집하게 했다([#180](https://github.com/hyeoniverse/MacFolio/pull/180)). 저장한 값이 없으면 코드의 상수를 기본값으로 사용한다.

## 고른 방법과 버린 방법

| 방법                                    | 장점                                              | 단점                                                                         |
| --------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| 빌드 시 환경 변수로 주입                | 서버가 필요 없다                                  | 수정할 때마다 다시 빌드·배포해야 한다. 기술 목록 같은 배열을 표현하기 어렵다 |
| 저장소에 JSON 설정 파일 보관            | 코드와 내용이 분리된다                            | 여전히 커밋과 배포가 필요하다                                                |
| 서버 DB에 저장하고 화면에서 편집 (채택) | 배포 없이 즉시 반영된다, 관리자 화면을 재사용한다 | 서버에 연결할 수 없는 경우를 별도로 처리해야 한다(기본값)                    |

Vite의 환경 변수(`VITE_*`)는 빌드 시각에 문자열로 치환되므로, 첫 번째 방법은 상수를 다른 위치로 옮길 뿐 "바꾸려면 다시 빌드"라는 조건은 같다. 이 사이트에는 이미 관리자 로그인(GitHub OAuth)과 DB가 있다. 그래서 세 번째를 선택했고, 서버에 연결할 수 없거나 저장한 값이 없으면 이전과 같이 코드의 상수를 기본값으로 사용한다.

## 서버: 행 하나짜리 테이블

```prisma
model SiteContent {
  id        Int      @id @default(1)
  profile   Json?
  updatedAt DateTime @updatedAt
  updatedBy String?
}
```

일반적인 테이블은 글이나 댓글처럼 같은 종류의 데이터를 여러 행으로 저장한다. 사이트 프로필은 사이트마다 하나뿐이므로, `id`가 항상 1인 행 하나만 두는 테이블로 만들었다. 이런 테이블을 싱글턴(singleton) 테이블이라고도 한다. 모든 조회와 저장이 `where: { id: 1 }`(코드의 `ROW_ID`)을 쓰므로 행이 둘 이상 생기지 않는다.

`profile`은 [Prisma의 Json 필드](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields)로, PostgreSQL에서는 [`jsonb`](https://www.postgresql.org/docs/current/datatype-json.html) 열이 된다. `jsonb`는 JSON 문서를 분해된 이진 형식으로 저장하는 PostgreSQL 자료형이다. 이름·이메일 같은 한 줄 값과 기술 목록 같은 배열을 열 하나에 객체째 보관할 수 있어서, 프로필 항목이 늘어도 마이그레이션 없이 저장 형식만 바꾸면 된다.

![SiteContent 테이블에 id가 1인 행 하나가 있고 profile 열에 jsonb 객체가 들어 있는 모습](./images/site-profile-editing-row.svg '행이 없거나 profile이 null이면 화면은 코드의 기본 프로필을 쓴다')

다음 단계에서 Safari의 프로젝트 내용도 이 테이블에 저장할 계획이라 이름을 `SiteProfile`이 아니라 `SiteContent`로 정했다.

| 요청                   | 권한   | 동작                                                      |
| ---------------------- | ------ | --------------------------------------------------------- |
| `GET /site`            | 누구나 | `{ profile, updatedAt }` 응답 (저장한 값이 없으면 `null`) |
| `PUT /site/profile`    | 관리자 | 검사 후 저장. 실패하면 400과 이유 목록 전체               |
| `DELETE /site/profile` | 관리자 | 저장한 값을 삭제 (코드의 기본값으로 복귀)                 |

저장은 Prisma의 `upsert`로 한다. 행이 있으면 갱신하고 없으면 생성하는 연산이라, 처음 저장하는 요청과 다시 저장하는 요청을 같은 코드로 처리한다.

### Promise를 캐시한 조회

방문자가 사이트를 열 때마다 `GET /site`가 호출된다. 조회 요청마다 DB를 조회하지 않도록, 서비스가 결과를 메모리에 캐시하고 저장·삭제 시 캐시를 비운다.

```ts
// apps/api/src/site/site.service.ts
view(): Promise<SiteView> {
	this.cache ??= this.prisma.siteContent.findUnique({ where: { id: ROW_ID } }).then((row) => ({
		profile: readProfile(row?.profile),
		// ...
	}));
	this.cache.catch(() => (this.cache = null)); // 실패한 조회는 캐시하지 않는다
	return this.cache;
}
```

`??=`는 왼쪽 값이 `null`이나 `undefined`일 때만 오른쪽 값을 대입하는 연산자다. 캐시가 비어 있으면 DB 조회를 시작하고, 차 있으면 기존 값을 그대로 반환한다.

> [!IMPORTANT]
> 핵심은 결과 값이 아니라 [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)를 캐시한다는 점이다.

Promise는 아직 끝나지 않은 비동기 작업의 결과를 나타내는 객체다. DB 조회를 시작하는 즉시 생기고, 조회가 끝나면 그 결과로 완료된다. 결과 값을 캐시하면 DB 응답이 도착하기 전까지 캐시가 비어 있으므로, 그 사이에 도착한 요청은 모두 각자 DB를 조회한다. Promise를 캐시하면 첫 요청이 만든 Promise가 즉시 캐시에 들어가고, 뒤따르는 요청은 같은 Promise의 완료를 기다린다.

![동시에 도착한 요청 다섯 개가 결과 값 캐시에서는 DB를 다섯 번, Promise 캐시에서는 한 번 조회하는 비교](./images/site-profile-editing-promise-cache.svg '첫 응답 전에 도착한 요청 수만큼 DB 조회가 줄어든다')

| 상황                                   | 결과 값을 캐시하는 경우                | Promise를 캐시하는 경우 (채택)                |
| -------------------------------------- | -------------------------------------- | --------------------------------------------- |
| 서버 시작 직후 요청 10개가 동시에 도착 | 첫 응답 전까지 요청마다 DB 조회 (10회) | 첫 요청이 만든 Promise를 공유, DB 조회 1회    |
| DB 조회 실패                           | 해당 없음                              | `catch`에서 캐시를 비워 다음 요청이 다시 조회 |

실패한 Promise를 캐시에 남겨 두면 DB가 복구된 뒤에도 모든 요청이 같은 실패를 받으므로, `catch`에서 캐시를 비운다.

`readProfile`은 DB에 저장된 값이 규칙에 맞지 않으면(예: DB에서 직접 수정한 행) `null`을 반환하고, 화면은 코드의 기본값을 사용한다.

## 검사는 한 곳에서

검사 규칙은 `parseProfile()` 하나로 정의하고 서버와 화면이 함께 호출한다. 이 시점에는 `desktop-core`에 있었고, 이후 [#207](https://github.com/hyeoniverse/MacFolio/pull/207)에서 `@macfolio/contracts`의 zod 스키마로 옮겼다([사이트 프로필로 1단계 마무리](/memo/contracts-validation#사이트-프로필-배치-규칙에-맞춰-desktop-core에서-옮기기-207)).

| 항목                           | 규칙                                                                    |
| ------------------------------ | ----------------------------------------------------------------------- |
| 이름·이메일·GitHub 주소        | 필수                                                                    |
| 나머지 한 줄 값(학교, 위치 등) | 비워도 된다                                                             |
| 이메일                         | `a@b.c` 형식                                                            |
| GitHub 주소                    | `https://github.com/아이디` 형식, 끝의 `/`는 제거                       |
| 한 줄 값 전체                  | 80자 이하, 줄바꿈·제어 문자 거절 (메일 헤더와 터미널 출력에 삽입되므로) |
| 기술 목록                      | 20개 이하, 항목마다 40자 이하. 앞뒤 공백 제거, 빈 항목·중복 항목 제외   |
| 정의되지 않은 필드             | 무시                                                                    |

검사 함수는 값을 거절하기만 하지 않고 정규화도 한다. 예를 들어 다음 입력은 오른쪽 값으로 저장된다.

| 입력                                      | 저장되는 값                  |
| ----------------------------------------- | ---------------------------- |
| GitHub 주소 `https://github.com/gildong/` | `https://github.com/gildong` |
| 프론트엔드 기술 `" Vue ,  , Svelte, Vue"` | `["Vue", "Svelte"]`          |

줄바꿈을 거절하는 이유는 프로필 값이 메일 헤더에도 들어가기 때문이다. 이름에 줄바꿈이 섞이면 `To: 홍길동\r\nBcc: …`처럼 헤더 한 줄이 추가될 수 있다(헤더 주입).

규칙을 여러 개 위반하면 첫 번째 이유만이 아니라 **모든** 이유를 수집해 반환한다. 화면은 저장하기 전에 같은 함수로 먼저 검사하므로, 규칙에 맞지 않는 값은 서버로 전송하지 않는다. ==서버는 그래도 다시 검사한다.== 화면을 거치지 않고 `curl`로 `PUT /site/profile`을 보내는 요청도 있을 수 있기 때문이다.

## 서버에 하드코딩된 이름

서버에도 `'김정현'`이 하드코딩되어 있었다. 관리자가 작성한 댓글의 작성자 이름과 메시지 앱 고정 항목의 제목이다. 이 둘은 이제 `SiteService.ownerName()`을 사용한다. 저장한 프로필의 이름을 반환하고, 없으면 기존 상수를 반환한다. API e2e 시험으로 저장 전에는 `김정현`, 저장 후에는 새 이름, 기본값으로 되돌린 뒤에는 다시 `김정현`이 나오는지 확인했다.

![SiteContent 표에서 SiteService, 프로필 저장소를 거쳐 useProfile과 getProfile로 읽는 흐름](./images/site-profile-editing-flow.svg '프로필이 서버에서 화면까지 전달되는 경로')

## 화면: 상수를 읽던 15개 파일

프로필 상수를 읽던 곳은 15개 파일이었다.

- 이 Mac에 관하여, 시스템 설정
- 메일: 환영 메일, 받는 사람, 주소 복사, 메일 앱으로 넘기기
- 메모 댓글: 작성자 이름·사진
- 터미널: `whoami`, `contact`
- 휴대폰 홈 위젯과 제어 센터, 관리자 계정 카드, Safari 프로젝트의 크레딧

메시지 앱은 상수를 읽지 않고 `'김정현'`을 별도로 하드코딩하고 있었다(고정 안내의 제목과 첫인사).

### 모듈 평가 시각에 고정되는 값

자바스크립트 모듈은 처음 `import`되는 시각에 한 번 평가(실행)되고, 그때 최상위에서 계산한 값은 이후 바뀌지 않는다. 문제는 ==모듈을 평가하는 시각에 한 번 계산되는 값==이었다.

```ts
// 전: 앱을 열기 전에 이미 값이 정해진다
export const OWNER_ADDRESS = `${PROFILE.name} <${PROFILE.email}>`;
const ADMIN_LOGIN = PROFILE.github.split('/').at(-1) ?? '';
export const PINNED_MESSAGES = [{ text: '안녕하세요, 김정현입니다 👋', ... }];
```

페이지를 열면 번들의 모듈들이 먼저 평가되고, `GET /site` 응답은 그 뒤에 도착한다. 예를 들어 관리자가 이름을 "홍길동"으로 저장했어도 `OWNER_ADDRESS`는 이미 `김정현 <…>`으로 계산된 뒤라서, 메일 앱의 받는 사람 칸은 페이지를 새로고침할 때까지 옛 이름으로 남는다.

![모듈 상수, getProfile, useProfile이 프로필을 읽는 시점 비교](./images/site-profile-editing-timing.svg '모듈 상수는 GET /site 응답보다 먼저 값이 고정된다')

### 저장소와 읽는 방법 두 가지

그래서 프로필을 `createStore`로 만든 저장소에 보관하고, 읽는 방법을 둘로 나눴다. `createStore`는 `desktop-core`의 작은 상태 저장소로, 현재 값을 반환하는 `getState`, 값을 바꾸는 `setState`, 값이 바뀌면 호출할 함수를 등록하는 `subscribe`를 제공한다.

- 컴포넌트는 `useProfile()`을 사용한다. 내부에서 React의 [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)로 저장소를 구독한다. 이 훅은 React 바깥에 있는 저장소의 값이 바뀌면 그 값을 읽는 컴포넌트를 다시 렌더링하므로, 저장하면 새로고침 없이 즉시 화면이 바뀐다.
- 컴포넌트 밖(메일 보내기, 터미널 명령, 메시지 저장소)은 `getProfile()`을 사용한다. 상수 대신 **사용하는 시각에** 읽는다. 터미널에서 `whoami`를 입력하는 시각에 저장소의 현재 이름을 읽는 식이다.

상수는 함수로 바꿨다.

| 전 (모듈 상수)    | 후 (함수)               |
| ----------------- | ----------------------- |
| `OWNER_ADDRESS`   | `ownerAddress(profile)` |
| `PINNED_MESSAGES` | `pinnedMessages()`      |
| `INBOX`           | `inboxOf(profile)`      |

메일 목록의 "받는 사람" 칸에는 원래 `김정현 <…>` 문자열을 저장하고, 그 문자열과 일치할 때 주소 복사 버튼을 렌더링했다. 이름이 바뀌면 문자열 비교가 실패하므로, 받는 사람 칸에는 `TO_OWNER`라는 표식만 저장하고 렌더링 시 현재 프로필의 이름과 주소로 치환한다.

메시지 앱은 목록을 한 번 읽어 캐시하므로, 프로필의 이름이 바뀌면 목록을 다시 읽게 했다. 앱을 연 뒤에 서버의 프로필이 도착해도 고정 항목에 현재 이름이 표시된다.

## 편집 화면

관리자로 로그인하면 시스템 설정 › 정보의 헤더 오른쪽에 **편집** 버튼이 나타난다. GitHub 항목의 편집 버튼과 같은 파란 글자 버튼이다.

- 조회 화면과 같은 둥근 목록에서 값 자리가 입력 칸으로 바뀐다. macOS 설정처럼 테두리 없이 오른쪽 정렬이고, 포커스된 칸에만 파란 테두리가 표시된다.
- 기술 목록은 쉼표로 구분해 한 줄로 입력한다(예: `React, TypeScript, Vite`).
- **완료**를 누르면 검사 후 저장한다. 실패하면 입력 칸 위에 모든 이유를 빨간 상자로 표시한다.
- 저장한 값이 있을 때만 **기본값으로 되돌리기**가 표시되고, 실행 전에 확인 대화상자를 표시한다.
- 비워 둔 값(학교, 인터랙션 기술 등)은 이 Mac에 관하여와 정보 화면에서 해당 행 전체가 생략된다.

![방문자가 보는 시스템 설정 › 정보. 저장한 값이 없으면 코드의 기본 프로필이 보인다](./images/site-profile-editing-info.jpg '시스템 설정 › 정보 (방문자 화면. 관리자에게는 헤더 오른쪽에 편집 버튼이 표시된다)')

아래는 관리자 편집 상태에서 이름을 비우고 이메일에 `gildong`을 입력한 뒤 **완료**를 누른 화면이다. 서버로 요청을 보내기 전에 화면의 `parseProfile`이 두 위반 사항을 모두 수집해 표시한다.

![편집 상태의 시스템 설정 › 정보. 이름 칸이 비어 있고 이메일이 gildong이라, 위쪽 빨간 상자에 '이름을(를) 입력해 주세요.'와 '이메일 주소가 올바르지 않습니다.'가 함께 표시된다](./images/site-profile-editing-errors.jpg '규칙 위반 두 개가 한 번에 표시된다. 이 상태에서는 PUT 요청을 보내지 않는다 (e2e/fakeApi.ts로 캡처)')

## 확인

| 종류    | 확인한 내용                                                                                                                                                                                                   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위    | `parseProfile`(값 정규화, 모든 이유 수집, 형식 검사), `readProfile`(DB 값이 규칙에 맞지 않으면 `null`)                                                                                                        |
| API e2e | 401·400과 이유 목록, 저장 후 관리자 댓글 이름·메시지 고정 항목 제목·주인 답장 이름 변경, 기본값 복귀. [경로 표 시험](/memo/api-route-table-test)에 세 경로의 권한 추가                                        |
| E2E     | 서버에 저장한 프로필이 방문자의 이 Mac에 관하여·정보·메일·메시지에 표시됨. 관리자 편집 시 규칙에 맞지 않는 값은 전송하지 않고 이유를 표시, 저장한 값은 정규화됨, 열려 있는 다른 창이 즉시 갱신됨. 기본값 복귀 |

변경 규모는 42개 파일, 1,467줄 추가와 213줄 삭제였다. 중심은 검사 규칙 `packages/desktop-core/src/site/profile.ts`(116줄)와 그 시험(71줄)이다.

## 남은 것·배운 것

- 화면은 처음에 코드의 기본값으로 렌더링한 뒤 서버의 프로필이 도착하면 갱신한다. 저장한 값이 기본값과 다르면 첫 렌더링 시각에 기본 이름이 잠시 표시될 수 있다.
- 모듈 평가 시각에 계산하는 상수는 편하지만, 나중에 바뀔 수 있는 값과 섞이면 원인을 찾기 어려운 버그가 된다. ==바뀔 수 있는 값은 상수 대신 함수로 정의하고 사용하는 시각에 읽는다.==
- 서버와 화면이 같은 검사 함수를 사용하므로, 화면은 전송 전에 서버와 같은 이유를 표시하고 서버는 같은 이유로 거절한다. 두 쪽의 규칙이 어긋나지 않는다.
- 테이블 이름을 `SiteContent`로 넓게 정한 결정은 바로 다음 작업에서 쓰였다. 프로젝트 내용도 같은 테이블에 저장했다([코드 기본값 위에 서버의 덮어쓸 값만 합치는 프로젝트 편집](/memo/site-projects-editing)).

## 따라 하는 방법

이 저장소로 사이트를 배포하는 사람이 자기 프로필로 바꾸는 절차다.

1. 서버를 실행하고(`pnpm dev:all` 또는 배포 서버), 자기 GitHub 숫자 ID를 API 환경 변수 `ADMIN_GITHUB_ID`에 설정한다. 로컬은 `apps/api/.env`, 배포 서버는 `~/deploy/api.env`다([docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)). 기본값은 저장소 주인의 ID다.
2. 메뉴 막대에서 GitHub로 로그인한다.
3. 시스템 설정 › 정보에서 이름·이메일·GitHub 주소를 수정하고 저장한다.

<details>
<summary>GitHub 숫자 ID 확인 방법</summary>

GitHub 숫자 ID는 로그인 이름과 달리 바뀌지 않는 값이다. [REST API의 사용자 조회](https://docs.github.com/en/rest/users/users#get-a-user)로 확인한다.

```bash
curl -s https://api.github.com/users/<로그인 이름> | grep '"id"'
```

</details>

저장하면 화면의 15개 파일이 서버 값을 사용한다. 서버를 쓰지 않으면 코드의 기본값([packages/desktop-core/src/site/profile.ts](https://github.com/hyeoniverse/MacFolio/blob/main/packages/desktop-core/src/site/profile.ts))이 그대로 쓰인다. 시험은 `cd apps/react && npx playwright test e2e/site-profile.spec.ts`로 실행한다.

## 관련 글

- [코드 기본값 위에 서버의 덮어쓸 값만 합치는 프로젝트 편집](/memo/site-projects-editing)
- [parseProfile의 if문 검증을 zod 스키마로 옮기기](/memo/contracts-validation#사이트-프로필-배치-규칙에-맞춰-desktop-core에서-옮기기-207)
- [index.ts 재내보내기로 import 경로를 유지하며 큰 모듈을 폴더로 나누기](/memo/module-splitting#import-경로를-유지하는-indexts-재내보내기-sharedprofile)
- [API 서버에서 GitHub API 응답을 캐시해 프로필을 실시간 조회하기](/memo/github-live-profile)

<details>
<summary>참고 문헌</summary>

- Prisma 문서, [Working with Json fields](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields)
- Prisma 문서, [Prisma Client API reference: upsert](https://www.prisma.io/docs/orm/reference/prisma-client-reference#upsert)
- PostgreSQL 문서, [JSON Types](https://www.postgresql.org/docs/current/datatype-json.html)
- MDN, [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- MDN, [Nullish coalescing assignment (??=)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_assignment)
- MDN, [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- React 문서, [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- Vite 문서, [Env Variables and Modes](https://vite.dev/guide/env-and-mode)
- OWASP, [CRLF Injection](https://owasp.org/www-community/vulnerabilities/CRLF_Injection)

</details>

#MacFolio #백엔드 #프론트엔드 #NestJS #Prisma #상태관리
