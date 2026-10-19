---
title: 이미 한 곳이었다, 자리만 옮겼다 — 사이트 프로필로 1단계 마무리
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 사이트 프로필은 처음부터 화면과 서버가 parseProfile 하나를 썼지만, "검사·응답 모양은 contracts, 타입·순수 규칙은 desktop-core"로 자리를 정해 옮겼다. if문 58줄을 zod로 옮기며 문구 열한 개와 순서를 시험으로 고정했고, 여덟 도메인이 모두 contracts로 갔다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 여덟째, 마지막 도메인([#207](https://github.com/hyeoniverse/MacFolio/pull/207))이다. 댓글·글·메시지·연락 메일·배경화면·파일·[분석](/memo/contracts-analytics)에 이어 사이트 프로필을 옮겼다.

## 이미 한 곳이었다

사이트 프로필(이름·직무·GitHub·기술 목록)은 관리자가 시스템 설정 › 정보에서 고치고 서버에 저장한다. 방문자는 같은 값을 "이 Mac에 관하여" 창과 시스템 설정 › 정보에서 읽기만 한다. 서버에 저장한 값이 없으면 코드에 적힌 기본값이 보인다.

![시스템 설정 › 정보 화면. 이름·직무·학교·위치, 이메일·GitHub, 기술 묶음이 보인다](./images/contracts-site-about-pane.jpg '시스템 설정 › 정보. 서버 값이 없을 때는 코드의 기본 프로필이 보인다')

화면은 `GET /site`로 `{ profile, updatedAt }`을 받고, 관리자가 저장하면 `PUT /site/profile`로 보낸다. 이 도메인은 다른 일곱과 달랐다. 검사 함수 `parseProfile`이 처음부터 `@macfolio/desktop-core/site`에 있어서, 화면은 보내기 전에, 서버는 저장하기 전에 같은 함수를 불렀다. "같은 규칙"이 주석이 아니라 코드였다.

다만 응답 모양은 따로 적혀 있었다. 서버 `site.service.ts`에 `SiteView` 인터페이스가 있었고, 화면 `profileStore.ts`는 `api<{ profile: SiteProfile | null }>('/site')`처럼 제네릭 인자에 모양을 손으로 적었다. 저장 응답은 또 `{ profile?: SiteProfile | null } | null`로 따로 적었다. 같은 응답을 세 번 다르게 적은 셈이다.

그래도 옮겼다. 일곱 도메인을 거치며 자리가 정해졌기 때문이다. **타입과 순수 규칙은 desktop-core, 요청·응답의 스키마는 contracts.** 프로필만 desktop-core에 검사가 남아 있으면 다음 사람이 "검사는 어디에 쓰지?"를 두 군데에서 찾는다.

![desktop-core의 타입·한도 → contracts의 ProfileInput·SiteView → 서버와 화면이 같은 parseProfile. 아래: desktop-core에 두지 않는 이유](./images/contracts-site-profile.svg)

## 고른 방법

| 방법                                                   | 좋은 점                 | 나쁜 점                                                                 |
| ------------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------- |
| 그대로 둔다 (검사는 desktop-core, 응답만 contracts)    | 바꿀 코드가 적다        | 검사 함수가 도메인마다 다른 패키지에 있다. 찾는 곳이 둘이 된다          |
| desktop-core 안에 zod를 들여 검사를 스키마로           | 패키지를 옮기지 않는다  | 순수 규칙만 두던 desktop-core가 zod에 기댄다. 다른 일곱과 규칙이 다르다 |
| 검사·응답은 contracts, 타입·한도는 desktop-core에 남김 | 여덟 도메인이 같은 자리 | `readProfile`까지 같이 옮겨야 한다(아래)                                |

셋째를 골랐다. 첫째는 지금 편하지만 "검사는 contracts"라는 규칙에 예외 하나를 남긴다. 예외는 다음에 또 예외를 부른다.

## 옮기면서 지킨 것

`parseProfile`은 `if`문으로 된 58줄이었다. 칸마다 "글자여야 합니다 → 입력해 주세요 → 80자까지 → 쓸 수 없는 글자" 순으로 처음 어긋난 것 하나, 기술 목록은 "목록이어야 → 항목은 글자 → 20개까지 → 40자·한 줄" 순으로 여럿. 문구 열한 개가 있고 e2e 시험이 그중 둘의 순서를 본다.

zod로 옮길 때 이 문구와 순서를 그대로 지켰다. 칸마다 `z.unknown().optional().transform((raw, ctx) => …)`로 원래 함수를 거의 그대로 넣었고, 스키마의 키 순서가 곧 이유의 순서다. 예전 desktop-core 시험 세 개를 contracts로 옮기고, e2e가 보던 `['이름을(를) 입력해 주세요.', '이메일 주소가 올바르지 않습니다.']`도 contracts 시험에 넣었다.

```ts
// packages/contracts/src/site.ts
export const ProfileInput: z.ZodType<SiteProfile, unknown> = z.object(
	{
		name: text('이름', true),
		// nameEn, role, school, location …
		github: text('GitHub 주소', true)
			.refine(
				(github) => !github || githubLogin({ github }) !== '',
				'GitHub 주소는 https://github.com/아이디 모양이어야 합니다.'
			)
			.transform((github) => github.replace(/\/$/, '')),
		email: text('이메일', true).refine((email) => !email || EMAIL.test(email), '이메일 주소가 올바르지 않습니다.'),
		skills: z.object(
			{ frontend: list('프론트엔드 기술') /* … */ },
			{ error: '기술은 묶음(frontend·backend·interaction)이어야 합니다.' }
		),
		siteStack: list('이 사이트를 만든 기술'),
	},
	{ error: '프로필을 보내 주세요.' }
);
```

`z.ZodType<SiteProfile>`로 선언해 스키마가 내는 값이 desktop-core 타입과 다르면 tsc가 막는다. [글 도메인](/memo/contracts-posts)에서 쓴 방식 그대로다.

한 가지 걸린 것. `z.unknown().transform()`을 객체 키에 그대로 쓰면 키가 없을 때 zod가 "expected nonoptional"을 낸다. `.optional()`을 끼워 "없는 키는 undefined로 받아 내가 처리한다"고 알려야 한다.

## desktop-core에 두지 않는 이유

`readProfile`(DB에 저장된 JSON을 읽을 때 규칙에 맞으면 그 값, 아니면 `null`)은 `parseProfile`을 부른다. 스키마가 contracts로 가면 `readProfile`도 따라가야 한다. desktop-core가 contracts를 부르면 순환이다 (contracts → desktop-core → contracts). 의존은 한쪽이어야 하고, 그러면 "스키마가 필요한 것"은 모두 contracts 쪽에 있어야 한다.

desktop-core에는 `SiteProfile` 타입, `PROFILE_LIMITS`, `SKILL_GROUPS`, `githubLogin`이 남는다. 화면의 입력 칸 `maxLength`와 설정 화면이 쓰는 것들이다.

## 바꾼 곳

커밋은 파일 11개, +310/−157이다. 글·그림을 빼면 +199/−157로, 지운 줄이 더한 줄에 가깝다. 대부분은 desktop-core에서 contracts로 옮긴 것이다.

1. `packages/contracts/src/site.ts`(103줄)를 새로 만들었다. `ProfileInput`, `parseProfile`, `readProfile`, `SiteView`.
2. `packages/desktop-core/src/site/profile.ts`에서 검사 코드 83줄 남짓을 지웠다. 타입·한도·`githubLogin`만 남았다.
3. 서버 `site.service.ts`는 import 한 줄과 `SiteView` 인터페이스를 다시 내보내기로 바꿨다.
4. 화면 `AboutPane.tsx`는 `parseProfile`만 contracts에서 가져온다. `PROFILE_LIMITS`는 그대로 desktop-core에서.
5. 화면 `profileStore.ts`의 손으로 적은 제네릭 두 개를 `SiteView`·`Partial<SiteView>`로 바꿨다.

```ts
// apps/react/src/shared/site/profileStore.ts
-const body = await api<{ profile: SiteProfile | null }>('/site', { fetchImpl });
+const body = await api<SiteView>('/site', { fetchImpl });
-const body = await api<{ profile?: SiteProfile | null } | null>('/site/profile', {
+const body = await api<Partial<SiteView> | null>('/site/profile', {
```

## 확인

- `packages/contracts/src/site.test.ts`의 네 시험: "앞뒤 공백·빈 항목·겹친 항목을 정리하고 모르는 필드는 버린다", "이름·이메일·GitHub 주소는 꼭 있어야 하고 모양도 맞아야 한다 (이유는 칸 순서대로)", "길이·개수·줄바꿈·타입이 틀리면 거절한다", "저장해 둔 값 읽기 (틀렸으면 null), 응답 모양".
- `packages/desktop-core/src/site/profile.test.ts`는 67줄이 바뀌었다. 검사 시험을 contracts로 옮기고 `githubLogin` 같은 남은 것만 둔다.
- E2E `apps/react/e2e/site-profile.spec.ts`는 그대로 통과했다. "서버에 저장한 프로필이 있으면 방문자에게 그 프로필이 보이고, 편집 버튼은 없다"가 응답 모양을, 관리자가 이름과 이메일을 비우고 저장하는 시험이 이유 두 개의 순서를 본다. 가짜 API(`e2e/fakeApi.ts`)는 주석 한 줄만 바뀌었다.

## 1단계 둘째 항목 끝

| 도메인    | PR                                                       | 옮긴 것                                    |
| --------- | -------------------------------------------------------- | ------------------------------------------ |
| 댓글      | [#200](https://github.com/hyeoniverse/MacFolio/pull/200) | 패키지 자체, CommentInput·Comment          |
| 글        | [#201](https://github.com/hyeoniverse/MacFolio/pull/201) | postInput(today), desktop-core 타입에 고정 |
| 메시지    | [#202](https://github.com/hyeoniverse/MacFolio/pull/202) | Thread·Message, 로컬 저장소까지 같은 모양  |
| 연락 메일 | [#203](https://github.com/hyeoniverse/MacFolio/pull/203) | 화면·서버의 다른 문구를 하나로             |
| 배경화면  | [#204](https://github.com/hyeoniverse/MacFolio/pull/204) | 세 곳의 40                                 |
| 파일      | [#205](https://github.com/hyeoniverse/MacFolio/pull/205) | "화면도 알아야 하는가"로 나누기            |
| 분석      | [#206](https://github.com/hyeoniverse/MacFolio/pull/206) | 보내는 쪽·받는 쪽·읽는 쪽                  |
| 프로필    | 이 글                                                    | 자리 정리, 문구·순서 고정                  |

프론트에서 손으로 적은 응답 타입이 없어졌다.

![여덟 도메인 PR이 옮긴 코드 줄 수. 커밋별 더한 줄과 뺀 줄](./images/contracts-site-eight-prs.svg '여덟 PR의 코드 변경량 (글·그림 파일 제외)')

## 남은 것과 배운 것

남은 1단계는 `shared/profile.ts` 나누기와 유니언·브랜드 타입이다. 프로필 도메인에서는 기본 프로필(서버 값이 없을 때 보이는 값)이 아직 화면 코드에 있다. 서버가 기본값을 모르니 `GET /site`가 `profile: null`을 주면 화면이 채운다. 지금은 이게 맞지만, 다른 화면(예: 서버가 그리는 OG 이미지)이 프로필을 쓰게 되면 기본값 자리를 다시 정해야 한다.

배운 것은 두 가지다. 하나, 이미 잘 돌아가는 코드도 "자리 규칙"을 맞추려고 옮길 가치가 있다. 여덟 중 하나만 다르면 다음 사람이 그 하나 때문에 규칙을 의심한다. 둘, 손으로 적은 `if`를 스키마로 옮길 때는 문구와 순서를 시험으로 먼저 고정하고 옮긴다. 그래야 "동작 변화 없음"을 말할 수 있다.

관련 글: [글 도메인](/memo/contracts-posts), [파일 도메인](/memo/contracts-files), [메시지 도메인](/memo/contracts-messages).

#MacFolio #리팩터링 #zod #TypeScript
