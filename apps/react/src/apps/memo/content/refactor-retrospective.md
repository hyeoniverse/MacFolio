---
title: zod 계약 패키지·공통 기반 코드·디자인 토큰·보안 설정 통일로 진행한 일곱 단계 리팩터링
date: 2026-10-18
category: 개발 기록/MacFolio/회고
summary: 열흘간 기능 추가로 쌓인 중복 코드를 PR 52개, 일곱 단계(타입, 구조, 기반 코드, 컴포넌트, 스타일, 서버, 보안)로 정리한 리팩터링 계획(#150)의 회고. 단계별 목표, 전후 수치, 설계 판단, 검증 방법, 남긴 항목을 기록했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 목적은 두 가지였다. 다음 기능을 추가할 때 수정할 곳이 한 군데가 되게 하는 것, 그리고 기능마다 따로 적용한 보안 설정을 하나의 기준으로 통일하는 것이다. PR마다의 세부 내용은 각 절에서 링크한 글에 적었다.

## 왜 계획이 필요했나

9월 말부터 열흘 남짓 기능 추가 속도가 빨랐다. 메모 편집기, 관리자 API, 트래픽 분석, 휴대폰 화면, 프로젝트 앱을 차례로 추가하면서 같은 역할의 코드를 앱마다 중복으로 만들었다. 증상은 다음과 같았다.

- 서버가 응답에 필드를 추가해도 화면의 타입은 그대로라 컴파일러가 검출하지 못했다.
- 관리자 세션이 만료되어 요청이 401로 실패해도, 그 요청을 보낸 화면 외에는 만료 사실을 알 수 없었다.
- 새 팝업의 `z-index`를 정하려면 CSS 파일 네 개를 열어 값을 비교해야 했다.
- 프로젝트 iframe 안의 링크 하나로 MacFolio 창 전체가 다른 주소로 바뀔 수 있었다.

각각은 작은 문제지만, 다음 기능을 추가할 때마다 수정할 곳이 여러 군데라는 공통점이 있었다. 리팩터링은 10월 1일 버튼 구조를 도식으로 정리하다가 공통 컴포넌트가 없다는 것을 확인하면서 시작했고, 10월 10일에 이슈 #150을 열어 타입·구조체 정리부터 공통 컴포넌트, 스타일, 보안까지 영역별 작업 목록을 작성했다.

## 계획을 나눈 방법

계획은 주제별로 일곱 단계로 나누고, 모든 단계에 적용할 규칙을 정했다.

| 규칙                                  | 이유                                                               |
| ------------------------------------- | ------------------------------------------------------------------ |
| 1~6단계는 동작을 변경하지 않는다      | "동작이 같다"를 자동으로 검증할 수 있어야 PR을 빨리 머지할 수 있다 |
| 동작이 변경되는 보안 작업은 별도 PR로 | 거부되는 요청이 생기면 원인 PR을 바로 특정해야 한다                |
| PR 하나에 주제 하나                   | 검토할 diff가 작고, 되돌리는 경우 PR 하나만 되돌리면 된다          |

다른 방식도 검토했다.

| 방식                               | 장점                                    | 선택하지 않은 이유                                               |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| 앱 단위로 전체 정리                | 앱 하나를 마치면 그 앱은 정리가 끝난다  | 같은 문제(요청, 저장소, 버튼)를 앱마다 반복해서 해결해야 한다    |
| 큰 브랜치 하나에 모아 한 번에 머지 | 중간 상태가 main에 남지 않는다          | 다른 기능 PR과 충돌이 누적되고, 문제를 일으킨 변경을 찾기 어렵다 |
| 주제별 단계 + 작은 PR (선택)       | 같은 문제를 한 번에 해결하고, 매번 머지 | 단계 사이에 이전 방식과 새 방식이 일시적으로 공존한다            |

## 실제 진행 순서

단계 번호는 주제 순서이고, 실제 진행 순서는 달랐다. 10월 10일 2단계를 시작하며 의존 관계를 다시 검토하니, 타입을 옮기려면 그 타입이 들어갈 폴더 구조가 먼저 있어야 했다. 그래서 2 → 3 → 1 순서로 진행했다. 2단계의 폴더 분리 방법은 두 안이 있었는데, 작업 규모나 복잡도가 아니라 코드 품질만 기준으로 선택했다.

보안 점검을 가장 먼저 시작해 10월 9일부터 11일까지 진행했고, 1~3단계는 11일 하루에 몰아서 했다. 공통 컴포넌트는 12일부터 18일까지로 가장 오래 걸렸고, 스타일과 서버는 17~18일에 진행했다.

![일곱 단계의 머지 날짜](./images/refactor-retrospective-timeline.svg '보안이 먼저 시작됐고, 1~3단계는 하루, 4단계가 가장 길었다')

1~3단계가 하루에 끝난 것은 ==PR을 작게 나눈 효과==가 컸다. 1단계 PR 열 개는 네 시간 사이에 머지했고, 도메인 PR 하나의 diff는 수백 줄 이내였다. 4단계가 길었던 것은 PR마다 컴포넌트를 만들고, 사용처 수십 곳을 교체하고, 화면이 같은지 E2E로 비교하는 작업이 필요했기 때문이다.

## 전후

| 영역          | 계획 수립 시점                                                                                     | 완료 시점                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 타입          | 화면이 응답 타입을 직접 다시 정의, DTO 없이 서비스마다 입력 검증                                   | 여덟 도메인과 설정·데모 입력 검증이 contracts의 zod 스키마로 통일                                            |
| 서버 요청     | 12개 파일이 각자 `fetch` 호출, `credentials: 'include'` 26곳                                       | `shared/api/client.ts` 하나, 401 처리도 한 곳                                                                |
| 데이터        | `shared/profile.ts` 1,629줄                                                                        | 프로젝트마다 한 파일                                                                                         |
| 큰 파일       | `CreativeDemos.tsx` 1,861줄, `CreativeCms.tsx` 970줄 등                                            | 데모·도식마다 한 파일                                                                                        |
| 의존          | `Mail.tsx` ↔ `MailMobile.tsx` 순환                                                                 | 순환 0, CI가 차단                                                                                            |
| 공통 UI       | `<button>` 사용 앱 파일 53개 중 공통 버튼 사용 15개, 시트·모달은 앱마다 구현                       | 버튼 75곳 교체, `Sheet`·`Modal`·`SearchField`                                                                |
| 스타일        | `z-index` 23가지, `Memo.css` 4,166줄                                                               | 토큰 여섯 종류(`--z-*`·`--radius-*`·`--text-*`·`--space-*`·`--shadow-*`·`--color-*`), `Memo.css`는 15개 파일 |
| 반응형·저장소 | `matchMedia`·`innerWidth` 직접 사용 25곳, `localStorage` 직접 사용 11개 파일                       | `media.ts`·`useViewport`, `storage.ts`                                                                       |
| 린트          | ESLint 경고 185개                                                                                  | 0개, `--max-warnings 0`                                                                                      |
| 보안          | 사이트 헤더 없음, iframe sandbox 없음, 요청 제한 방식 세 종류, 취약점 6건(high 3), Dependabot 없음 | CSP와 헤더, sandbox, `@RateLimit` 단일 방식, 취약점 6건 수정, Dependabot·gitleaks·액션 SHA 고정              |

마무리 단계에서 ESLint 경고 185개를 정리하고 네 패키지 모두 `--max-warnings 0`을 적용했다(#144).

## 1단계: 타입과 데이터 구조

목표는 "같은 데이터 구조를 두 번 정의하지 않기"였다. 계획을 작성한 시각에 화면은 API 응답 타입을 직접 다시 정의했고(예: `commentsApi.ts`의 `Comment`), API는 전역 [`ValidationPipe`](https://docs.nestjs.com/techniques/validation)(whitelist)를 활성화했지만 DTO 클래스가 없어 실제로 필터링되는 값이 없었다. 서비스마다 직접 검사했고, `shared/profile.ts` 한 파일 1,629줄에 프로필·기술·`PROJECTS`·타입이 함께 있었다.

댓글을 예로 들면, 화면은 댓글 구조를 인터페이스로 다시 정의했고 서버는 내용 길이를 if문으로 검사했다.

```ts
// 서버 (apps/api/src/comments/rules.ts, #200 전)
export const LIMITS = { body: { min: 1, max: 500 } } as const;
export function parseBody(input: unknown) {
	const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
	const body = typeof raw.body === 'string' ? raw.body.trim() : '';
	if (body.length < LIMITS.body.min) return { errors: ['내용을 입력해주세요.'] };
	if (body.length > LIMITS.body.max) return { errors: [`내용은 ${LIMITS.body.max}자까지 입력할 수 있습니다.`] };
	return { value: { body } };
}
```

서버가 응답 필드를 추가하거나 이름을 바꿔도 화면의 타입은 그대로라 컴파일러가 감지하지 못하고, 상한 500자도 양쪽에 따로 정의되어 있었다. 이런 중복 정의가 도메인마다 있었다.

### 공유 zod 스키마를 선택한 이유

| 방법                                  | 장점                                                          | 단점                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| NestJS DTO 클래스 + `class-validator` | 이미 활성화한 `ValidationPipe`가 바로 사용한다                | 데코레이터 클래스라 화면(React)에서 재사용하기 어렵다. 타입과 검사 규칙이 서버 쪽에만 생긴다         |
| OpenAPI 문서에서 화면 타입을 생성     | Swagger 문서가 이미 있다                                      | 생성한 파일을 커밋하거나 빌드 단계에 추가해야 한다. 문서가 실제 검사와 같다는 보장이 별도로 필요하다 |
| 공유 패키지에 zod 스키마 (채택)       | 스키마 하나에서 검사(`parse`)와 타입(`z.infer`)을 함께 얻는다 | 패키지가 하나 늘고, 서버 Dockerfile과 CI가 이 패키지를 먼저 빌드해야 한다                            |

[zod](https://zod.dev)를 채택한 이유는 화면도 같은 규칙을 "실행"해야 했기 때문이다. 글 편집기와 메일 앱은 전송 전에 같은 상한으로 입력을 차단한다. 전역 `ValidationPipe`는 이후 DTO를 쓰는 경로가 생겨도 같은 설정이 적용되도록 유지했다.

방식은 하나로 정했다. 요청·응답 구조는 `@macfolio/contracts`에 zod 스키마로 정의하고, 서버는 `parse()`로 검증하고, 화면은 `import type`으로 타입만 가져오며, 순수 규칙(글 길이·날짜 등)은 `desktop-core`에 유지한다. 첫 PR([#200](https://github.com/hyeoniverse/MacFolio/pull/200))에서 만든 헬퍼 두 개를 이후 도메인 PR이 모두 사용했다.

```ts
// packages/contracts/src/parse.ts
export type Parsed<T> = { value: T } | { errors: string[] };

export function parse<S extends z.ZodType>(schema: S, input: unknown): Parsed<z.output<S>> {
	const result = schema.safeParse(input);
	if (result.success) return { value: result.data };
	return { errors: [...new Set(result.error.issues.map((issue) => issue.message))] };
}
```

`parse()`의 반환 형태 `{ value } | { errors }`는 기존 수동 검사 함수의 형태와 같아서 컨트롤러와 화면은 수정할 필요가 없었고, 댓글 검사는 `parse(CommentInput, input)` 한 줄이 됐다. `requestBody()`는 본문이 `null`이나 문자열일 때 zod의 영어 기본 메시지 대신 필드별 한국어 메시지를 출력하게 한다. 글 도메인은 타입이 이미 `desktop-core`에 있었으므로 스키마에 그 타입(`z.ZodType<PostContentShape, unknown>`)을 지정해 둘이 어긋나면 `tsc`가 실패하게 했다. 글 주소와 폴더 경로에는 [#209](https://github.com/hyeoniverse/MacFolio/pull/209)에서 브랜드 타입[^brand] `PostSlug`·`FolderPath`를 적용해, 외부 값(주소창, 서버 응답, 브라우저 저장소)이 `postSlug()`·`folderPath()`를 거치지 않으면 컴파일 오류가 나게 했다.

![desktop-core, contracts, api, react의 관계와 contracts 밖에 남긴 것](./images/refactor-step1-types-contracts.svg '1단계가 끝난 뒤 요청·응답 모양이 흐르는 길')

### 도메인 여덟 개의 이전 순서

작은 도메인부터 진행했다. 댓글·좋아요(#200)에서 패키지 기본 구조와 Dockerfile·CI의 빌드 순서를 맞추고, 글·메시지·연락 메일·배경화면·파일·분석·사이트 프로필을 하나씩 이전했다. 세부 내용은 [zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-package#댓글좋아요-스키마-200)를 비롯한 도메인별 글([글](/memo/contracts-package#블로그-글-스키마를-desktop-core-타입에-고정하기-201), [메시지](/memo/contracts-package#메시지-스키마와-두-저장소-구현-202), [연락 메일](/memo/contracts-validation#연락-메일-칸마다-첫-실패-문구-하나-203), [배경화면](/memo/contracts-validation#배경화면-이름-한도-40과-정리-함수-204), [파일](/memo/contracts-validation#업로드-파일-화면이-알아야-하는-값만-contracts로-205), [분석](/memo/contracts-package#분석-이벤트의-전송수신조회-형식-206), [사이트 프로필](/memo/contracts-validation#사이트-프로필-배치-규칙에-맞춰-desktop-core에서-옮기기-207))과 [index.ts 재내보내기로 import 경로를 유지하며 큰 모듈을 폴더로 나누기](/memo/module-splitting#import-경로를-유지하는-indexts-재내보내기-sharedprofile)(#208), [PostSlug·FolderPath 브랜드 타입](/memo/branded-ids)(#209)에 있다.

10월 11일, 네 시간 사이에 PR 열 개를 머지했다. 도메인 PR은 글과 그림까지 합쳐 300줄 안팎이었고, `profile.ts` 분리(#208)만 파일 이동 때문에 1,775줄을 추가하고 1,630줄을 삭제했다.

![1단계 PR 열 개의 더한 줄과 지운 줄](./images/refactor-step1-types-prs.svg 'profile.ts 나누기를 빼면 PR마다 300줄 안팎이다')

| 항목                | 전                    | 후                                                               |
| ------------------- | --------------------- | ---------------------------------------------------------------- |
| 응답 타입           | 화면·서버가 각각 정의 | 여덟 도메인이 contracts 한 곳                                    |
| `shared/profile.ts` | 1,629줄 한 파일       | 프로젝트마다 한 파일, 외부 import 27곳은 변경 없음               |
| `any`               | —                     | 0건                                                              |
| 글 주소·폴더 경로   | `string`              | `PostSlug`·`FolderPath`, `postSlug()`·`folderPath()`를 거쳐야 함 |

글 PR에서는 서버의 if문 21줄이 스키마 하나로 바뀌었고, 사이트 프로필에서는 if문 58줄을 zod로 이전하며 메시지 11개와 순서를 시험으로 고정했다. 오류 메시지는 필드 순서(제목 → 날짜 → 폴더 → 요약 → 본문)대로 수집하므로, 메시지와 순서를 비교하는 기존 단위 시험을 수정하지 않고 통과해야 이전 완료로 판단했다. 이후 `apps/react/src`와 `apps/api/src`에서 `@macfolio/contracts`를 import하는 파일은 67개, contracts의 시험 파일은 13개가 됐다.

남긴 것은 세 가지다. 배경화면 업로드는 multipart 요청이라 스키마가 없다. 매직 바이트[^magic] 확인·EXIF 삭제처럼 서버만 수행하는 처리는 "화면도 알아야 하는 규칙인가"라는 기준에 따라 contracts로 옮기지 않았다. 관리자 설정과 데모의 요청 검사는 [6단계](#6단계-서버)에서 같은 방식으로 이전했다.

## 2단계: 폴더 구조와 의존

목표는 파일의 위치와 import 관계 정리였다. `Mail.tsx`와 `MailMobile.tsx`가 서로를 import했고, `CreativeDemos.tsx` 1,861줄, `CreativeCms.tsx` 970줄, `Memo.tsx` 830줄, `FolderSidebar.tsx` 675줄, `PhotosMobile.tsx` 662줄 같은 큰 파일이 있었다. 서버를 호출하는 파일도 `githubActivity.ts`, `captions.ts`, `attachments.ts`처럼 이름만으로는 화면 컴포넌트인지 서버 호출인지 구분할 수 없었다.

순환 의존[^cycle]은 당장 오류를 내지 않았지만, 모듈 평가 순서에 따라 한쪽 값이 `undefined`로 읽힐 수 있고 지연 로딩([`lazy`](https://react.dev/reference/react/lazy)) 청크가 서로를 끌어와 첫 화면 번들이 커질 수 있다. 실제로 `registry.ts`의 주석에는 "Finder가 이 목록을 다시 읽으므로 지연 로딩이어야 한다"는 조건이 적혀 있었다. 순환을 유지하려고 다른 곳에 제약을 거는 구조였다. 1,861줄 데모 파일 하나에는 데모 열 가지가 들어 있어 음성 데모 하나를 수정해도 리뷰에서 다른 데모 코드까지 확인해야 했다.

### 순환 해소와 파일 배치의 설계 판단

| 문제      | 제외한 방법                                           | 채택한 방법                                                                        |
| --------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 순환 의존 | 한쪽 import를 동적 `import()`로 바꿔 순환을 숨기기    | 공통 부분을 세 번째 파일로 분리해 단방향으로                                       |
| 재발 방지 | ESLint `import/no-cycle` 규칙                         | [madge](https://github.com/pahen/madge)를 `pnpm cycles`로 두고 CI의 `check`에 추가 |
| 파일 배치 | 앱마다 `api/`·`hooks/`·`components/` 폴더를 일괄 생성 | 이름 규칙(`*Api.ts`, `model.ts`, `use*.ts`) + 세 개 이상이면 폴더                  |

동적 `import()`는 madge 검출만 피할 뿐 순환은 그대로 남는다. `import/no-cycle`은 파일마다 의존 그래프를 다시 계산해 느리고 플러그인이 하나 더 필요하지만, madge는 한 번 실행으로 네 패키지를 모두 검사한다. 앱 대부분은 파일이 열 개 이하라 폴더를 일괄 생성하면 파일 하나짜리 폴더가 다수 생긴다.

순환은 두 개였다. 메일은 두 파일이 공유하는 타입(`ListMail`)과 편지함 이름만 `mail/model.ts`로 옮겼다. registry↔Finder 순환은 React에 의존하지 않는 `manifest.ts`에 `WINDOW_APP_NAMES`를 정의하고 Finder가 그것을 읽게 해 해소했다. 이때 `registry.ts`가 컴포넌트 없는 앱을 오류 없이 제외하던 동작을 즉시 오류를 던지도록 바꿨다.

```ts
// apps/react/src/apps/registry.ts (#188)
-export const WINDOW_APPS = APP_NAMES.flatMap((name) => {
+export const WINDOW_APPS = WINDOW_APP_NAMES.map((name) => {
 	const Component = APP_COMPONENTS[name];
-	return Component ? [{ name, Component }] : [];
+	if (!Component) throw new Error(`창으로 여는 앱인데 컴포넌트가 없다: ${name} (apps/registry.ts)`);
+	return { name, Component };
 });
```

이전에는 컴포넌트 연결을 누락하면 ==Dock에 아이콘만 있고 창이 열리지 않는 상태로 배포될 수 있었다==. 루트 `package.json`의 `cycles` 스크립트는 처음에 react·api·desktop-core 세 패키지를 검사했고, 1단계에서 생긴 contracts까지 현재 네 패키지를 검사한다. 세부 내용은 [madge로 찾은 순환 import를 셋째 파일로 끊고 CI에서 막기](/memo/break-import-cycles)(#188)에 있다.

![두 순환 의존을 셋째 파일로 푼 모양과 파일 이름 규칙 네 가지](./images/refactor-step2-structure-cycles.svg '서로 import하던 짝은 공통 부분을 셋째 파일로 꺼내 한 방향으로 만들었다')

### 큰 파일 분할과 이름 규칙

분할 기준은 "한 파일에 화면 하나"였다. 데모와 CMS 도식은 하나씩 별도 파일로, 공유 코드(색 계산 `color.ts`, 뷰포트 진입 감지 `useInView.ts`, 데모 프레임 `Demo.tsx`)는 독립 파일로 분리했다. 사이드바와 휴대폰 사진 앱은 행 단위 컴포넌트(`FolderRow.tsx`, `PhotoGrid.tsx`), 크게 보기(`PhoneViewer.tsx`), 순수 계산(`folderSidebar.model.ts`, `photosMobile.model.ts`)으로 나눴다. [`git diff -M`](https://git-scm.com/docs/git-diff)에서 대부분 "이동"으로 검출되도록 함수 본문은 수정하지 않았고, 분리된 순수 함수에만 단위 시험(`creative/color.test.ts` 7개)을 추가했다. 세부 내용은 [둘 이상이 쓰는 코드만 공유 모듈로 추출해 큰 데모 파일 분리하기](/memo/module-splitting#둘-이상이-쓰는-코드만-공유-모듈로-creativedemos)(#189·#193), [import를 계산하는 분리 스크립트와 model 파일로 순환 없이 컴포넌트 나누기](/memo/module-splitting#서로-쓰는-타입은-model-파일로-폴더-사이드바와-사진-앱)(#190)에 있다.

![나누기 전 파일과 나눈 뒤 가장 큰 조각의 줄 수](./images/refactor-step2-structure-sizes.svg '가장 큰 조각도 400줄 안쪽이 됐다')

#191에서는 규칙과 어긋난 파일 아홉 개의 이름을 바꿨다([폴더 대신 _Api.ts·model.ts·use_.ts 파일 이름으로 앱 안의 파일 종류 구분하기](/memo/app-file-naming)). 서버 호출은 `*Api.ts`, 순수 계산·타입은 `model.ts`, 훅은 `use*.ts`, 화면 컴포넌트는 `PascalCase.tsx`이고, 같은 종류가 세 개 이상이면 폴더로 묶는다. 예를 들어 `github/githubActivity.ts`는 `githubActivityApi.ts`로, `memo/admin.ts`는 훅이므로 `useCanEditMemo.ts`로, 계산과 서버 호출이 섞인 `memo/writer/attachments.ts`는 서버 호출만 `attachmentsApi.ts`로 분리했다. `githubActivity.ts`는 대소문자만 다른 `GithubActivity.tsx`와 macOS의 대소문자 비구분 파일 시스템에서 충돌한 적이 있다([/health 응답 시간을 막대 수로 환산하고 no-cors 요청으로 CORS 차단을 구분하는 서버 상태 표시](/memo/server-status-wifi) 끝 부분).

| 항목                    | 전      | 후                                 |
| ----------------------- | ------- | ---------------------------------- |
| 순환 의존               | 2개     | 0개, CI가 차단                     |
| `CreativeDemos.tsx`     | 1,861줄 | `creative/`에 데모마다 한 파일     |
| `CreativeCms.tsx`       | 970줄   | `creative/cms/`에 도식마다 한 파일 |
| 이름 규칙에 어긋난 파일 | 9개     | 0개                                |

분할 PR(#189·#190·#193)은 E2E 파일을 하나도 수정하지 않았다. 데모 PR은 1,861줄을 삭제하고 새 파일 16개에 2,007줄을 추가했는데, 증가분은 파일마다 추가된 import와 머리 주석이다. 줄 수는 병합 커밋에서 `wc -l`로 측정했고, 계획 시점(`FolderSidebar.tsx` 675줄)과 PR 직전(697줄)이 달라 PR을 올리는 시각에 다시 측정했다.

`Memo.tsx`(830줄)는 이미 `useMemoLibrary`·`useNoteView`·`useNoteDrag`·`useTrash` 같은 훅으로 분리되어 있어 수정하지 않았다. 이후 2단계 기준을 적용해 [#281](https://github.com/hyeoniverse/MacFolio/pull/281)에서 3,307줄이던 `settings/ProjectsPane.tsx`를 `settings/projects/` 폴더의 파일 열한 개로 분할했고, 현재 `ProjectsPane.tsx`는 281줄이다.

## 3단계: 공통 기반 코드

목표는 앱마다 반복하던 기반 코드 세 가지의 통합이었다.

- 서버 요청: 12개 파일이 각자 [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)를 호출하고 [`credentials: 'include'`](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials)가 26곳. 오류와 401 처리가 파일마다 다름
- 저장소: `localStorage`를 직접 사용하는 파일 11개
- 화면 크기: `useIsMobile`·`useViewport`가 있는데도 [`matchMedia`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)·`innerWidth`를 직접 사용하는 곳 25곳

사용자에게 보이는 증상도 있었다. 관리자 상태는 세션 만료 시각에 맞춘 타이머로만 로그아웃 상태로 바뀌어서, 서버에서 세션을 삭제했거나 쿠키가 사라지면 저장이 401로 실패한 뒤에도 관리자 메뉴가 그대로 표시됐다. 분석 이벤트의 기기 구분은 `innerWidth < 768`로 별도 정의되어, 가로 방향 휴대폰은 화면은 휴대폰 레이아웃인데 통계에는 데스크톱으로 집계됐다. 사진 캡션 저장 함수 하나에도 기본 주소, 쿠키, JSON 헤더, 시간 제한([`AbortSignal.timeout`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)), 오류 본문 파싱이 모두 반복되어 있었고, 다른 파일은 시간 제한을 누락하거나 오류 본문 배열의 첫 항목만 읽었다.

### fetch 위의 얇은 함수를 선택한 이유

| 방법                                                                     | 장점                                        | 단점                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------- |
| axios·ky 같은 HTTP 라이브러리                                            | 인터셉터, 재시도, 시간 제한이 내장되어 있다 | 의존성이 하나 늘고, 사용하는 기능은 일부다. 응답·오류 형태를 다시 맞춰야 한다 |
| [TanStack Query](https://tanstack.com/query/latest)로 요청과 캐시를 함께 | 재요청, 캐시, 로딩 상태                     | 요청 방식이 아니라 상태 관리를 바꾸는 큰 작업이라 3단계 범위를 넘는다         |
| `fetch` 위의 얇은 함수 하나 (채택)                                       | 기존 코드와 같은 `fetch`, 변경량이 적다     | 재시도·캐시는 없다. 필요한 곳이 생기면 호출하는 쪽에서 구현한다               |

이 사이트의 요청은 대부분 한 번 호출하고 끝나므로 기존 파일들이 공통으로 수행하던 처리만 함수 하나로 통합했다. `apiFetch()`는 `Response`를 그대로 반환해 상태 코드로 분기해야 하는 곳에서 쓰고, `api()`는 파싱한 JSON을 반환하며 실패 시 `ApiError`를 던진다.

![api() 한 번이 거치는 길](./images/refactor-step3-foundation-api.svg '닿지 못함, 401, 그 밖의 실패, 성공을 한 곳에서 나눈다')

`ApiError`의 `status`가 0이면 서버에 연결하지 못한 경우로, 주소 누락·서버 중단·네트워크 단절을 하나의 메시지로 안내한다. 오류 본문의 `message`는 문자열과 배열을 모두 읽고, NestJS의 영어 기본 메시지(`Unauthorized`, `ThrottlerException` 등)는 필터링한다. 캡션 저장 코드는 다음과 같이 줄었다.

```ts
// apps/react/src/apps/photos/captionsApi.ts (#196 뒤)
const map = await api<Record<string, string>>('/photos/captions', {
	method: 'PUT',
	json: { src, caption },
	fallback: '캡션을 저장하지 못했습니다.',
});
```

401 응답을 받으면 `onUnauthorized()`에 등록한 함수를 호출한다. 등록된 관리자 상태(`shared/auth/adminStore.ts`)가 `/auth/me`를 다시 조회해 메뉴 막대와 모든 앱이 함께 로그아웃 상태로 전환된다. 외부 서비스(날씨, 효과음)는 쿠키를 전송하면 안 되고 오류 형태도 달라 이 함수를 거치지 않는다. 세부 내용은 [공통 API 클라이언트 api()·apiFetch()로 fetch 호출과 401 처리 통합하기](/memo/shared-modules#서버-호출-apiapifetch)(#196)에 있다.

### 저장소와 미디어 쿼리 모듈

`storage.ts`는 키 이름을 `STORAGE_KEYS` 한 곳에 정의하고 읽기·쓰기 예외를 내부에서 처리한다. 사생활 보호 창이나 저장 공간 부족으로 `localStorage`가 예외를 던져도 화면은 이번 방문 동안 메모리 값으로 동작한다. 모든 키에 `macfolio:` 접두어를 붙여 같은 출처의 라이브러리 키와 충돌하지 않게 했고, 휴지통의 '내 브라우저 데이터'도 이 목록을 기준으로 표시하고 삭제한다([readJson·writeJson으로 브라우저 저장소 예외 처리를 한 곳에 모으기](/memo/shared-modules#브라우저-저장소-readjsonwritejson), #198).

`media.ts`는 동작 줄이기·다크 모드·터치 입력 세 가지를 통합하고, `matchMedia`가 없는 환경에서는 모두 `false`를 반환한다. 이전에는 옵셔널 체이닝으로 방어한 곳과 방어하지 않은 곳이 섞여, 같은 환경에서 한쪽은 `false`, 다른 쪽은 예외였다. 화면 크기는 `getViewport()` 하나로 조회하고 휴대폰 여부는 셸과 같은 `isMobileViewport`로 판단해, 가로 방향 휴대폰이 통계에서도 휴대폰으로 집계된다([matchMedia·innerWidth 직접 조회를 media.ts와 getViewport()로 모으기](/memo/shared-modules#화면-조건-조회-mediats와-getviewport), #199).

| 항목                                | 전                                      | 후                                        |
| ----------------------------------- | --------------------------------------- | ----------------------------------------- |
| 서버 요청 코드                      | 346줄                                   | 179줄, 사용처 19곳이 `api()`·`apiFetch()` |
| 저장소 코드                         | 134줄                                   | 53줄, 사용처 7곳                          |
| `matchMedia`·`innerWidth` 직접 사용 | 25곳, 네 가지 표기, 모바일 기준 두 가지 | 25곳 모두 `media.ts`·`getViewport()` 사용 |

![서버 요청 코드와 저장소 코드의 줄 수 전후 막대 그래프](./images/refactor-step3-foundation-lines.svg '기반 코드는 절반 아래로 줄고, 사용처는 한 함수를 부른다')

검증은 새 모듈의 단위 시험(`client.test.ts` 10개, `storage.test.ts` 6개, `media.test.ts` 3개)과 수정하지 않은 E2E로 했다. 가짜 API(`page.route`)가 반환하는 오류 본문이 같으므로 화면의 거절 메시지가 같으면 교체가 올바르다고 판단했다. 현재 `client.ts`는 111줄, `storage.ts`는 85줄, `media.ts`는 38줄이다.

재시도와 캐시는 추가하지 않았다. 주기적으로 조회하는 서버 상태 표시는 자체 주기를 갖고 있고, ==쓰기 요청을 함수가 자동으로 재전송하면 같은 댓글이 두 번 등록될 수 있다==. 읽은 값의 형태 검사도 사용하는 쪽에 유지했다. 이 단계의 증상은 모두 같은 처리를 두 곳에서 다르게 구현해서 생겼고, `api()`가 기존 처리 외의 기능을 추가하지 않아 교체 PR이 기계적인 치환 작업이 되었다.

## 4단계: 공통 컴포넌트

PR 수가 가장 많았던 단계다. `shared/ui`에 button·dialog·menu·popover·reorder가 있었지만 `<button>`을 사용하는 앱 파일 53개 중 공통 버튼을 사용하는 파일은 15개였고, 시트와 모달은 메일·메시지·음악·설정·휴지통이 각자 구현했다.

| 증상                                                   | 원인                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| Launchpad가 Esc로 닫히지 않음                          | 모달 다섯 개가 Esc·바깥 클릭·포커스·닫기 애니메이션을 각자 구현 |
| 배경화면 이름 변경 중 포커스가 입력 칸 밖이면 Esc 무시 | 같은 원인                                                       |
| 아이콘 버튼에 접근성 이름 누락 가능                    | `label`이 선택 값이었고 검사하는 시험도 없음                    |
| 공통 버튼 CSS 수정이 일부 버튼에만 반영                | 앱이 `<button>`을 직접 사용                                     |

### 후보 아홉 개를 재집계한 결과

| 방법                                                   | 장점                                 | 단점                                                                          |
| ------------------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------- |
| 계획의 후보 아홉 개를 모두 컴포넌트로 만들기           | 계획대로 한 번에 끝난다              | 집계해 보니 여섯 개는 앱마다 모양이나 의미가 달라, 컴포넌트 옵션이 과도해진다 |
| Radix·React Aria 같은 헤드리스 라이브러리              | 접근성과 키보드 동작이 검증되어 있다 | 기존 `shared/ui`의 메뉴·팝오버와 겹치고, 모든 사용처를 다시 구현해야 한다     |
| 기존 컴포넌트를 확장하고, 반복되는 세 개만 추가 (채택) | 교체할 때 모양을 그대로 유지한다     | 남은 후보 여섯 개는 앱마다 개별 구현으로 남는다                               |

[#210](https://github.com/hyeoniverse/MacFolio/pull/210)에서 `docs/ui.md`에 컴포넌트 15개의 props와 사용처를 기록하고, `<button>`을 직접 사용하는 295곳을 "공통 버튼으로 교체 가능 / 앱 고유 / Safari 데모"로 분류했다. 교체 가능한 곳은 93곳이었다. 후보 아홉 개(`Sheet`, `Modal`, `ListRow`, `SegmentedControl`, `SearchField`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`) 중 같은 의미로 반복되는 것은 `Sheet`·`Modal`·`SearchField` 세 개였다([공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-modal#공통-부품-집계)).

- `Modal`·`Sheet`·`SearchField`: [#212](https://github.com/hyeoniverse/MacFolio/pull/212)·[#220](https://github.com/hyeoniverse/MacFolio/pull/220)·[#223](https://github.com/hyeoniverse/MacFolio/pull/223), [모달 다이얼로그 5개를 Modal로](/memo/ui-modal), [휴대폰 시트 3곳을 Sheet로](/memo/ui-sheet)
- CSS 레이어 순서 고정: [#221](https://github.com/hyeoniverse/MacFolio/pull/221), [CSS 파일 로드 순서와 무관하게 @layer 순서를 index.html에서 먼저 선언하기](/memo/css-layer-order-fix)
- 접근성 이름 시험: [#243](https://github.com/hyeoniverse/MacFolio/pull/243), [IconButton props 유니언 타입으로 아이콘 버튼의 접근 가능한 이름 강제하기](/memo/ui-a11y-names)
- 아이콘 버튼 45곳, 텍스트 버튼 30곳: [#245](https://github.com/hyeoniverse/MacFolio/pull/245)·[#246](https://github.com/hyeoniverse/MacFolio/pull/246), [IconButton으로](/memo/icon-button-migrate)
- 시트·모달 재조사, 메뉴 variant: [#247](https://github.com/hyeoniverse/MacFolio/pull/247)·[#250](https://github.com/hyeoniverse/MacFolio/pull/250), [메뉴 모양을 variant로 고르기](/memo/ui-variant-pairs)

![4단계 PR 열한 개의 날짜와 크기](./images/refactor-step4-components-timeline.svg '부품을 먼저 만들고, 사용처를 옮기는 PR은 마지막 날에 몰았다')

### 접근성 이름과 계산된 스타일 비교

아이콘만 있는 버튼은 스크린 리더가 읽을 텍스트가 없으므로 `label`이 없으면 컴파일되지 않게 했다.

```ts
// apps/react/src/shared/ui/button/IconButton.tsx
export type IconButtonProps = IconButtonBase &
	(
		| { label: string; children?: ReactNode } // 이름이 있거나
		| { label?: undefined; children: ReactNode } // 보이는 글자가 있거나
	);
```

`label`은 [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label)과 `title`에 함께 적용되고, 아이콘 `<i>`에는 `aria-hidden="true"`, 버튼에는 기본값 `type="button"`을 붙인다. `shared/ui/a11y.test.ts`가 버튼·대화상자·시트·검색 칸·날짜 선택기를 HTML 문자열로 렌더링해 이름과 역할을 검사한다.

교체 과정에서는 모양을 바꾸지 않았다. E2E를 실행하며 공통 클래스를 제거한 상태(교체 전의 `<button>`)와 적용한 상태(교체 후)의 계산된 스타일([`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle))을 비교해, 같으면 교체해도 화면이 같다고 판단했다. 비교는 시험이 통과하는 화면(데스크톱·휴대폰, 켜짐·꺼짐, 비활성, 호버)마다 기록된다. 차이가 난 값은 공통 CSS가 추가하는 값이었고, 앱마다 명시도[^specificity]가 0인 규칙([`:where()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:where)) 하나로 원래 값을 복원해 ==75곳 모두 최종 차이가 없었다==.

교체 중 공통 버튼의 여백이 사라진 문제도 있었다. `@layer reset, components;`를 선언했지만 빌드한 `index.html`에서 components 레이어가 reset보다 먼저 등장해 `* { padding: 0 }`이 우선했다. 브라우저는 레이어 이름이 문서에 처음 등장한 순서로 [레이어 순서](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)를 정하므로, 선언을 `index.html`의 인라인 `<style>` 맨 앞으로 옮겼다(#221). 마지막 #250에서는 macOS·iOS 모양을 고르는 곳을 조사했고, `variant` prop이 적합한 곳은 Menu 하나였다(`className="touch"` → `variant="ios"`). 사진 보기, 메일 목록 같은 다른 짝은 DOM 구조 자체가 달랐다.

| 항목               | 전          | 후                                                                          |
| ------------------ | ----------- | --------------------------------------------------------------------------- |
| 직접 쓴 `<button>` | 295곳       | 265곳 (집계 기준을 정해 재집계: Safari 데모 91, 앱 고유 172, 의도적 유지 2) |
| 시트·모달          | 앱마다 구현 | `Sheet`·`Modal`                                                             |
| 접근성 이름        | 규칙 없음   | 시험 10개, 아이콘만 있는 `IconButton`은 `label` 없이 타입 오류              |

![직접 쓴 button 265곳의 구성 막대](./images/refactor-step4-components-buttons.svg '남은 버튼은 대부분 일부러 다르게 그린 Safari 데모와 앱 고유의 버튼이다')

후보 여섯 개(`ListRow`, `SegmentedControl`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`)는 사용처가 많아도 모양이나 의미가 달라 보류했다. 남은 시트와 가운데 창은 동작이 달라 유지했고, Safari 데모의 버튼 91곳은 페이지마다 의도적으로 다르게 디자인한 것이라 교체하지 않았다.

## 5단계: 스타일

CSS 값은 하나도 바꾸지 않고 이름을 붙이고, 분할하고, 삭제하는 단계였다.

| 항목               | 계획 시각의 상태        |
| ------------------ | ----------------------- |
| CSS 전체           | 26,464줄                |
| 직접 작성한 hex 색 | 650곳                   |
| CSS 변수           | 309종                   |
| `border-radius`    | 6·8·10·14·999px 등 혼재 |
| `z-index` 값       | 23가지                  |
| `Memo.css`         | 4,166줄 한 파일         |

새 팝업의 `z-index`를 정하려면 `Dock.css`, `StatusBar.css`, `Menu.css`, `LoadingScreen.css`를 차례로 열어 숫자를 비교해야 했다. 모서리는 6px·8px·10px이 같은 용도로 혼용됐고, 다크 모드 색은 파일마다 별도로 정의되어 있었다. `Memo.css`는 휴대폰 규칙과 데스크톱 규칙이 수천 줄 사이에 섞여 편집기를 수정하는 PR마다 diff가 커졌다.

### 값을 유지하고 이름만 붙인 이유

| 방법                               | 장점                                 | 단점                                                                                  |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| Tailwind 같은 유틸리티 CSS로 전환  | 토큰이 클래스 이름이 되어 강제된다   | 26,000줄 넘는 CSS와 컴포넌트를 다시 작성해야 하고, 화면이 같다는 것을 증명하기 어렵다 |
| 가까운 값끼리 통합                 | 토큰 수가 줄어 체계가 단순해진다     | 1~2px씩 이동하는 화면이 생겨, 동작을 바꾸지 않는다는 이번 규칙에 어긋난다             |
| 값은 유지하고 이름만 붙이기 (채택) | 화면이 같으므로 자동 비교가 가능하다 | 비슷한 값이 각자 이름 없이 남는다                                                     |

토큰은 모두 `src/styles/theme.css`의 `:root`에 정의했다. 레이어는 `--z-dock: 1000`, `--z-alert: 2500`, `--z-menu: 10000`, `--z-login: 20000`처럼 숫자 대신 의미로 읽히고, 모서리는 `--radius-xs`(4px)~`--radius-full`(999px) 여섯 단계다. 글자 크기는 Apple 텍스트 스타일 이름(`caption2`~`title2`) 여덟 개를 따랐고, 간격은 2px 단위로 열 단계가 촘촘해 `--space-8`처럼 px 값을 이름에 넣었다. 교체 기준은 "문자열까지 같은 값만"이었다. 간격은 선언의 값이 모두 열 단계 값일 때만 교체했고, `0`이나 `auto`가 섞인 단축 속성 표기는 유지했다.

```css
/* apps/react/src/apps/memo/styles/note.css */
.memo-format-panel .memo-revision-list button {
	gap: 1px; /* 열 값에 없어 그대로 */
	padding: var(--space-6) var(--space-10); /* 6px 10px */
	border-radius: var(--radius-md); /* 8px */
}
```

토큰별 세부 내용은 [흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/design-tokens#z-index-층-흩어진-숫자를---z--변수로-모으기-231)(#231), [자주 쓰는 border-radius 여섯 값을 --radius-* 디자인 토큰으로 바꾸기](/memo/design-tokens#모서리-반경---radius--여섯-값-232)(#232), [Apple HIG 글자 스타일 이름으로 font-size 디자인 토큰 만들기](/memo/design-tokens#글자-크기-apple-hig-스타일-이름의---text--234)(#234), [그림자와 간격 값을 집계해 CSS 변수 디자인 토큰으로 이름 붙이기](/memo/design-tokens#그림자와-간격---shadow---space--248)(#248), [직접 쓴 hex 색을 --color-* 디자인 토큰과 Apple 시스템 색 이름으로 바꾸기](/memo/design-tokens#색---color--토큰과-apple-시스템-색-이름-249)(#249)에 있다.

### 파일 분할, 중복 삭제와 동일성 검증

`Memo.css`는 도구 막대·사이드바·목록·본문·편집기·휴대폰 화면 같은 구역 경계에서 잘라 `memo/styles/` 열다섯 파일로 분할하고, 원래 파일에는 순서대로 import하는 목록만 남겼다. 규칙 순서가 바뀌면 명시도가 같은 규칙끼리 우선순위가 바뀌므로 순서는 변경하지 않았다([@import 순서를 유지한 CSS 파일 분할과 빌드 결과 md5 비교 검증](/memo/css-cleanup-tools#memocss-분할-선언-순서-유지), #238). Safari 페이지의 중복 규칙은 [getComputedStyle 비교로 동일성을 확인하며 중복 CSS 규칙 지우기](/memo/css-cleanup-tools#중복-규칙-삭제-creativepartscss와-hyeoniversepagecss)(#241)에서 삭제했다.

| 작업            | 비교 대상                                                     |
| --------------- | ------------------------------------------------------------- |
| 토큰 이름 부여  | 요소마다 계산된 스타일 (값을 유지했으므로 차이 0이어야 함)    |
| `Memo.css` 분할 | 빌드한 CSS의 바이트 (md5)                                     |
| 중복 제거       | 요소마다 계산된 스타일, 라이트·다크 × 데스크톱·휴대폰 네 조합 |

![이름 붙이기, 파일 나누기, 중복 지우기를 확인한 세 방법](./images/refactor-step5-styles-checks.svg '세 방법 모두 다르면 실패하는 기계 비교다')

사용하지 않는 선택자(#242)는 세 단계로 찾았다([2,761개 중 정말 안 쓰는 것은 9개](/memo/css-cleanup-tools#사용하지-않는-css-클래스-삭제)).

1. CSS의 클래스 이름 2,761개 중 코드 어디에도 문자열이 없는 150개를 추출했다.
2. `이름-${…}`처럼 코드가 조합하는 이름과 라이브러리(highlight.js, ProseMirror)가 붙이는 이름을 제외해 9개를 남겼다.
3. 9개는 하나씩 코드를 읽어 확인한 뒤 규칙 24개를 삭제했다.

[Stylelint](https://stylelint.io/)는 CSS만 읽어 클래스가 코드에서 사용되는지 알 수 없으므로 이 검출에 쓰지 않았다.

| 항목                  | 전                       | 후                                                     |
| --------------------- | ------------------------ | ------------------------------------------------------ |
| `z-index`             | 13개 파일에 숫자         | 20곳이 `--z-*` 15개                                    |
| 모서리                | 576곳, 마흔 가지 넘는 값 | 239곳이 `--radius-xs`~`--radius-full`                  |
| 글자 크기             | 958곳                    | 645곳이 `--text-caption2`~`--text-title2` 여덟 이름    |
| 간격·그림자           | 직접 작성한 값           | 간격 1,543곳이 `--space-*`, 그림자 19곳이 `--shadow-*` |
| 앱 CSS의 hex 색       | 513곳                    | 288곳을 `--color-*`로, 225곳 유지                      |
| `Memo.css`            | 4,600줄 한 파일          | `memo/styles/` 열다섯 파일                             |
| `HyeoniversePage.css` | 1,444줄                  | 735줄                                                  |
| 사용하지 않는 클래스  | 9개                      | 0개 (규칙 24개와 이미지 한 장 삭제)                    |

![모서리, 글자 크기, hex 색이 토큰 이름으로 바뀐 비율 막대 그래프](./images/refactor-step5-styles-coverage.svg '값은 그대로 두고 이름만 바꿨다. 남은 곳은 일부러 다른 값이다')

프로젝트 소개 페이지의 브랜드 색과 `rgb()`·`rgba()` 425곳은 범위에서 제외했다. 같은 의미의 `z-index` 값 통합은 렌더링 순서가 바뀔 수 있어 보류했고, 메모의 `late.css`는 위치를 옮기면 적용 순서가 바뀌어 유지했다. 5단계를 마친 시각에는 토큰을 쓰지 않은 새 값을 차단하는 장치가 없었고, 이후 다음 PR로 보완했다.

- [#280](https://github.com/hyeoniverse/MacFolio/pull/280)(10월 20일): Stylelint 규칙 추가. 이름이 있는 `font-size`·`border-radius`·`z-index`·간격 값을 숫자로 작성하면 `pnpm lint`가 실패한다. 이름이 없는 값만 허용하므로 예외 목록이 필요 없다
- [#286](https://github.com/hyeoniverse/MacFolio/pull/286)(10월 20일): 토큰을 원시(`primitives.css`)·의미(`semantic.css`)·컴포넌트(`components.css`) 세 층으로 분리. 위 코드의 `--radius-md` 같은 크기 이름은 `--radius-8` 같은 값 이름으로 바뀌었다
- [#294](https://github.com/hyeoniverse/MacFolio/pull/294)(10월 20일): `Settings.css` 분할과 그림자 토큰 묶기 반영

규칙 강제 과정은 [Stylelint declaration-property-value-allowed-list로 디자인 토큰 강제하기](/memo/off-scale-values)에 있다.

## 6단계: 서버

대상은 API 서버였고, 외부에서 관찰되는 경로·응답·거절 문구는 바꾸지 않았다. 서버는 NestJS 모듈[^module]마다 서비스 하나를 배치하는 구조였지만 트래픽 분석은 예외였다. 341줄 `AnalyticsService` 하나가 역할 세 가지를 맡았고 역할마다 사용하는 상태가 달랐다.

| 역할 | 메서드                                      | 그 역할만 사용하는 상태           |
| ---- | ------------------------------------------- | --------------------------------- |
| 저장 | `record`                                    | IP별 1분 단위 요청 수 (요청 제한) |
| 집계 | `maintain`, 한 시간마다 실행되는 타이머     | 마지막 집계 시각                  |
| 조회 | `todayVisitors`, `summary`, `views`, `live` | 오늘 방문자 수, 1분 캐시          |

`summary`를 수정하려 해도 요청 제한 맵과 타이머 코드까지 읽어야 했고, 집계만 시험하려 해도 클래스 전체를 생성해야 했다. 입력 검사는 [1단계](#1단계-타입과-데이터-구조)에서 여덟 도메인을 contracts[^contracts]로 옮겼지만, 관리자 설정(사진 캡션, 사람 확인, GitHub 앱 저장소)과 AI 데모(커버, 번역, 요약, 음성)는 서버의 if문으로 남았고 화면에는 같은 상한(200자, 6개, 80자)이 별도 상수로 중복돼 있었다. 네 데모 모두 "공백 정리 → 빈 글 → 긴 글 → 제어 문자 → 차단 단어" 검사를 같은 순서로 각자 구현했다.

### 상태 경계로 나눈 서비스 세 개

| 방법                                     | 장점                                              | 단점                                                                     |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| 집계를 별도 작업(cron 컨테이너, 큐)으로  | API 요청과 집계가 완전히 분리된다                 | 서버 한 대(RAM 1GB)에 컨테이너가 추가되고, 배포·모니터링 대상이 늘어난다 |
| 메서드를 파일로만 나누고 클래스는 하나로 | 변경량이 적다                                     | 상태를 공유하는 구조가 남아 시험이 쉬워지지 않는다                       |
| 역할마다 서비스 하나, 생성자 주입 (선택) | 상태가 역할별로 분리된다. NestJS 기본 방식 그대로 | 클래스가 셋이 되어 모듈의 `providers`가 늘어난다                         |
| 검사: NestJS DTO + `class-validator`     | 컨트롤러에 데코레이터만 추가하면 된다             | 화면이 같은 규칙을 재사용할 수 없다. 1단계에서 제외한 방법이다           |

저장(`AnalyticsRecorder`), 집계(`AnalyticsRollup`), 조회(`AnalyticsStats`)로 분리했다. 분리 경계는 메서드 수나 줄 수가 아니라 ==어떤 필드를 어느 메서드가 사용하는지==로 정했다.

![AnalyticsService 341줄이 Recorder, Rollup, Stats로 나뉜 도식](./images/refactor-step6-server-split.svg '역할마다 클래스 하나. 조회 클래스가 가장 크다')

![이벤트가 Recorder, Rollup, Stats를 거쳐 숫자가 되는 흐름](./images/refactor-step6-server-flow.svg '지난 날짜는 집계 테이블에서, 오늘은 이벤트 테이블에서 조회한다')

서버가 한 대이므로 집계는 서버 프로세스 안의 `setInterval` 타이머로 유지했다. 모듈 초기화 시점에 한 시간 주기 타이머를 등록하고(`unref()`), 요약을 조회하는 시각에 집계가 5분 이상 밀렸거나 날짜가 바뀌었으면 `maintainIfStale()`이 한 번 더 실행한다. 기간 내 행을 반환하는 `rowsBetween`은 "지난 날짜는 집계 테이블, 오늘은 이벤트 테이블" 규칙이 집계 실행 시점을 아는 클래스의 책임이므로 집계 클래스에 배치했다. `analytics.service.ts`는 `analytics-stats.service.ts`로 이동해 git이 파일 이름 변경으로 인식하게 하고, 저장과 집계만 새 파일로 분리했다. 세부 내용은 [상태 기준으로 AnalyticsService를 저장·집계·조회 서비스로 나누기](/memo/analytics-service-split)(#233)에 있다.

### 설정·데모 검사를 공유 스키마로

검사는 1단계의 방식(zod[^zod] 스키마를 contracts에 정의하고 서버는 `parse()`로 검사)을 따랐다. 설정 세 본문은 `packages/contracts/src/settings.ts`(#235)로, 데모 네 본문은 `packages/contracts/src/demos.ts`(#236)로 옮겼고, 데모의 "텍스트 필드 하나" 규칙은 `demoText({ max, empty, refused, tooLong, lines })` 함수 하나로 정의해 데모마다 상한과 문구만 인자로 전달한다. 음성 데모의 서버 검사는 한 줄로 줄었다.

```ts
// apps/api/src/speech/rules.ts (#236 뒤)
export const parseSpeechRequest = (body: unknown): SpeechRequest => demoInput(parse(SpeechInput, body));
```

`demoInput()`은 `parse()`가 거절 이유를 반환하면 첫 번째 이유로 `DemoInputError`를 던지고, 서비스가 이를 400(`BadRequestException`)으로 변환한다. 음성 데모에만 있던 `SpeechInputError`는 이 오류 하나로 통합됐다. 화면의 데모(`creative/Voice.tsx` 등)는 `MAX_SPEECH_CHARS`와 `SPEECH_PROVIDERS`를 같은 패키지에서 가져온다. 세부 내용은 [서버 if 문 검사와 화면 상한을 zod 스키마 하나로 합치기](/memo/contracts-validation#관리자-설정과-ai-데모의-if-문-일곱-개-235236)에 있다.

| 항목                         | 전                      | 후                                      |
| ---------------------------- | ----------------------- | --------------------------------------- |
| `AnalyticsService`           | 341줄                   | Recorder 68줄, Rollup 80줄, Stats 203줄 |
| 설정 상한(200자, 6개)·정규식 | 서버 if문과 화면에 중복 | contracts 한 곳                         |
| 데모 상한(60·200·800·80자)   | 서버 함수와 화면에 중복 | contracts 한 곳                         |
| API e2e                      | —                       | 124개 통과                              |

검증 결과는 PR마다 다음과 같았다.

- [#233](https://github.com/hyeoniverse/MacFolio/pull/233): 시험에서 집계를 직접 호출하던 한 줄(`AnalyticsService` → `AnalyticsRollup`)만 수정하고 API e2e 124개 통과
- [#235](https://github.com/hyeoniverse/MacFolio/pull/235): API 단위 157개, contracts 37개. 알 수 없는 키만 보낸 경우 "바꿀 설정이 없습니다."가 추가되던 동작은 zod의 `when` 옵션으로 유지
- [#236](https://github.com/hyeoniverse/MacFolio/pull/236): `demos.test.ts`에 시험 5개 추가. `speech/rules.test.ts`는 기대 오류 클래스만 `DemoInputError`로 바꾸고 문구("80자")는 변경 없이 통과

개인정보 처리 안내(`docs/privacy.md`)에 적힌 집계 코드 경로도 새 파일로 수정했다. 조회 서비스는 이후 기능이 추가되어 2026-10-23 기준 246줄이고, 다시 분리한다면 요약과 실시간 조회를 먼저 나눈다. 데모의 일일 상한(`DailyQuota`)은 서버만 사용하는 값이라 "화면도 이 값을 알아야 하는가"라는 1단계 기준에 따라 contracts로 옮기지 않았다.

## 7단계: 보안

기능마다 개별로 관리하던 보안 설정을 하나의 기준으로 통일하는 단계였다. 동작이 바뀔 수 있으므로 리팩터링 PR과 분리하고, 바뀌는 동작마다 실패하는 시험을 먼저 작성했다. API에는 helmet, `httpOnly`·`SameSite=Lax`·`Secure` 쿠키, 해시로 저장한 세션 토큰이 이미 적용되어 있었지만 취약 지점이 남아 있었다.

- 프로젝트 앱의 iframe 안 페이지에서 `<a target="_top">` 링크를 클릭하면 MacFolio 창 전체가 그 주소로 이동했다.
- 글 작성, 폴더 정리, 설정, 파일 업로드, 분석 이벤트에는 1분 요청 제한이 없었다. `AdminGuard`는 요청마다 DB에서 세션을 조회하므로, 쿠키 없는 `POST /posts`를 초당 수백 회 보내면 모두 401로 끝나도 그 횟수만큼 DB 조회가 발생한다.
- `pnpm audit --prod`로 prisma·milkdown·Scalar의 하위 의존성 취약점 6건(high 3)을 찾았다.
- 워크플로의 액션은 `@v4` 같은 태그로 지정되어, 액션 저장소가 침해되면 다음 실행부터 다른 코드가 실행될 수 있었다.

### 코드에서 생성하는 보안 설정

| 문제               | 제외한 방법                                       | 선택한 방법                                                     |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------------- |
| 사이트 헤더        | Cloudflare 대시보드의 Transform Rules에 수동 입력 | 빌드가 `dist/_headers`를 생성한다. 출처 목록은 코드에서 생성    |
| CSP 출처 목록      | `_headers`에 수동 기록                            | `PROJECTS`와 `VITE_API_URL`에서 생성하고, E2E가 같은 CSP로 실행 |
| 요청 제한          | 전역 `ThrottlerGuard` 하나로 모든 경로            | 이름 7개, 쓰기 경로마다 `@RateLimit('이름')` 하나               |
| 하위 의존성 취약점 | 상위 패키지의 수정을 기다리기                     | `pnpm-workspace.yaml`의 `overrides`로 수정 버전을 강제          |
| 액션 버전          | 태그(`@v4`) 유지                                  | 커밋 SHA로 고정, 업데이트는 Dependabot이 PR로 제안              |

대시보드 설정은 저장소에 기록되지 않아 변경 내용과 시각을 추적할 수 없다. 전역 요청 제한 하나는 분석 이벤트(5초마다 전송)와 댓글(도배 차단)처럼 성격이 다른 경로에 같은 횟수를 적용한다.

- 프론트엔드: [보안 헤더와 CSP](/memo/security-headers)(#156), [iframe sandbox](/memo/iframe-sandbox)(#157), [Markdown 렌더링 XSS 시험](/memo/markdown-xss-tests)(#159)
- API: [경로 표와 `AdminGuard` 시험](/memo/api-route-table-test)(#160), [요청 제한 한 방식](/memo/rate-limit-all-writes)(#162), [업로드 EXIF 삭제](/memo/upload-strip-exif)(#163), [로그 마스킹](/memo/error-log-masking)(#167), [미리보기 CORS 읽기 전용](/memo/preview-cors-read-only)(#182)
- 의존성·CI·서버: [취약점 6건과 `pnpm audit`](/memo/supply-chain-security#하위-의존성-취약점과-pnpm-overrides)(#152), [액션 SHA 고정·Dependabot](/memo/supply-chain-security#github-actions-커밋-sha-고정과-dependabot)(#169), [gitleaks 비밀 값 스캔](/memo/supply-chain-security#gitleaks로-저장소-기록-전체의-비밀-값-검사)(#170), [서버 하드닝 `audit.sh`](/memo/server-hardening-audit)(#183)

![사이트, API, 서버, CI의 계층마다 적용한 보안 설정과 PR 번호](./images/refactor-step7-security-layers.svg '한 계층이 놓쳐도 다음 계층이 차단하도록 계층마다 별도로 적용했다')

### 요청 제한, sandbox, overrides

`@RateLimit('이름')`은 지정한 이름 하나만 집계하고 나머지 이름은 제외하며, 횟수는 IP별·경로별로 집계한다.

```ts
// apps/api/src/common/rate-limit.ts
export const RATE_LIMIT_NAMES = ['login', 'comment', 'like', 'write', 'upload', 'demo', 'events'] as const;

export function RateLimit(name: RateLimitName) {
	const skip = Object.fromEntries(RATE_LIMIT_NAMES.filter((other) => other !== name).map((other) => [other, true]));
	return applyDecorators(SetMetadata(RATE_LIMIT_KEY, name), SkipThrottle(skip), UseGuards(ThrottlerGuard));
}
```

> [!WARNING] 데코레이터 위치
> 관리자 경로에서는 `@UseGuards(AdminGuard)` **아래**에 적는다. 데코레이터는 아래부터 적용되므로 이 위치여야 요청 제한이 세션 조회보다 먼저 실행되고, 이 순서는 경로 표 시험(`test/routes.e2e.test.ts`)이 검사한다.

![이름 7개의 1분당 기본 횟수](./images/refactor-step7-security-limits.svg '성격이 다른 경로는 다른 이름으로 집계한다')

iframe의 `sandbox`는 스크립트·같은 출처·폼·새 탭만 허용하고 `allow-top-navigation`을 제외했다(`WebFrame.tsx`의 `FRAME_SANDBOX`).

> [!WARNING] 실패하지 않는 시험
> 처음 작성한 시험은 iframe 안의 스크립트로 최상위 창을 이동시켰는데 `sandbox` 없이도 통과했다. Chrome은 사용자 클릭 없이 다른 출처 iframe이 최상위 창을 이동시키는 것을 기본으로 차단하고, 차단되지 않는 경우는 사용자가 `<a target="_top">`을 클릭한 경우였다. 시험을 이 경우로 바꾸자 `sandbox`가 없으면 실패했다.

취약점은 `pnpm-workspace.yaml`의 `overrides`로 수정했다(예: prisma > @prisma/config의 `deepmerge-ts: '^8.0.0'`, milkdown > vue 컴파일러의 `source-map-js: '^1.2.2'`). 줄마다 어느 상위 패키지 때문인지 주석으로 기록해, 상위 패키지가 수정 버전을 의존하게 되면 그 줄을 삭제한다. CI는 `pnpm audit --prod --audit-level=high`로 high 이상 취약점이 다시 생기면 실패한다.

| 항목               | 전           | 후                                                                                    |
| ------------------ | ------------ | ------------------------------------------------------------------------------------- |
| 사이트 보안 헤더   | 없음         | CSP·`X-Content-Type-Options`·`Referrer-Policy`·`Permissions-Policy`·`frame-ancestors` |
| 프로젝트 iframe    | 제한 없음    | `sandbox`, 누락하면 시험 실패                                                         |
| 요청 제한          | 세 가지 방식 | 이름 7개, 쓰기 경로 33개에 `@RateLimit`                                               |
| 관리자 경로        | 시험 없음    | 경로 64개 표, 관리자 경로 29개가 로그인 없이 401                                      |
| 운영 의존성 취약점 | 6건 (high 3) | overrides로 수정, CI가 high 이상을 차단                                               |
| GitHub Actions     | 태그         | 9종 17곳을 커밋 SHA로                                                                 |
| 비밀 값            | 검사 없음    | 커밋 791개를 gitleaks로 검사, PR·main·매주 월요일 실행                                |

CSP는 E2E가 배포와 같은 CSP로 실행되고, 모든 시험에 적용되는 fixture가 콘솔의 CSP 위반을 하나라도 감지하면 실패한다. 경로가 늘어 현재 API 코드에는 `@RateLimit(`이 46곳 있다. gitleaks는 커밋 791개·392MB를 약 15초에 검사했고 검출 항목은 Oracle 문서의 시험용 키 4건뿐이었다.

<details>
<summary>직접 확인하는 명령</summary>

```bash
# 사이트 헤더: 미리보기 서버에 붙는지
cd apps/react && pnpm build && npx vite preview --port 4173 &
curl -sI http://localhost:4173/ | grep -iE 'content-security-policy|x-frame-options|referrer-policy'

# 프로젝트 앱 iframe sandbox
npx playwright test e2e/project-apps.spec.ts

# 서버 하드닝 (서버에서)
~/macfolio/ops/audit.sh      # 모두 OK

# 6단계 서버 리팩터링: 외부 응답이 바뀌지 않았는지
pnpm --filter @macfolio/api typecheck
pnpm --filter @macfolio/api test
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
```

</details>

`localStorage` 값은 휴지통의 '내 브라우저 데이터'에 전체 목록이 이미 표시되고 민감한 값이 없어 변경하지 않았다. 저장소 설정의 Secret scanning·Push protection과 Ruleset 필수 검사는 코드로 설정할 수 없어 CONTRIBUTING.md에 버튼 위치까지 기록하고 수동으로 활성화한다. 이후 Semgrep과 SCA 도구로 다시 점검했고, 도구가 보고한 7건 중 실제 취약점은 없었다([Semgrep·pnpm audit·osv-scanner로 코드와 의존성 취약점 점검하기](/memo/security-scan)).

## 검증 방법

| 단계        | 검증 방법                                                                                |
| ----------- | ---------------------------------------------------------------------------------------- |
| 1 타입      | 기존 단위 시험이 오류 문구와 순서를 그대로 비교. 시험을 수정하지 않고 통과해야 함        |
| 2 구조      | `pnpm cycles`(madge) 순환 0, 분리 PR은 E2E 파일을 수정하지 않음                          |
| 3 기반 코드 | `client.test.ts` 10개 등 새 모듈 시험, 사용처는 기존 E2E                                 |
| 4 컴포넌트  | 공통 클래스 적용 전후의 계산된 스타일 비교, 접근성 이름 시험                             |
| 5 스타일    | 계산된 스타일 전후 비교, 빌드 CSS의 md5 비교                                             |
| 6 서버      | API e2e 124개, 단위 157개, contracts 시험                                                |
| 7 보안      | 변경되는 동작마다 실패하는 시험을 먼저 작성: CSP 위반 fixture, sandbox E2E, 경로 64개 표 |

## 돌아보며

- 공통 컴포넌트 후보 아홉 개는 실제 사용처를 조사해 보니 세 개였고, 사용하지 않는 CSS 클래스는 처음 추정한 150개에서 9개로 줄었다. 계획에 적은 수치를 그대로 믿지 않고 다시 측정한 덕분에 작업량이 줄었다.
- 1~6단계는 동작을 변경하지 않는 것이 규칙이라, 빌드한 CSS를 바이트 단위로, 화면을 계산된 스타일로, 서버를 거절 문구 시험으로 비교해 "변경 없음"을 증명했다. `parse()`가 기존 함수와 같은 반환 형태를 쓴 것처럼, 새 모듈이 기존 형태를 유지하면 교체 PR이 기계적인 치환이 된다는 것도 확인했다.
- 규칙은 기억에 맡기지 않고 도구로 강제했다. 순환은 madge가, 이름 없는 아이콘 버튼은 `tsc`가, 토큰 밖의 CSS 값은 Stylelint가, CSP 출처·요청 제한 이름·경로 표는 코드에서 생성한 목록과 시험이 차단한다.
- 보안처럼 동작이 바뀌는 PR은 리팩터링과 섞지 않아, 거부되는 요청이 생겨도 원인을 바로 특정할 수 있었다. sandbox 시험에서는 실패하는 상태부터 확인해야 시험이 실제로 검증한다는 것을 확인했다.

## 아쉬웠던 것

- 계획 수립 시 측정한 줄 수(예: `FolderSidebar.tsx` 675줄)와 PR 직전 줄 수(697줄)가 달랐다. 계획 문서의 수치는 측정 날짜와 함께 기록했어야 했다.
- 이 기간에 Docker Hub의 내려받기 한도에 걸려 Postgres 이미지를 받지 못해 CI가 시작조차 하지 못한 날이 있었다. 이미지 저장소를 ECR Public으로 바꿨지만, 리팩터링과 무관한 문제로 머지가 늦어졌다.
- 4단계는 사용처를 교체하는 PR(#245·#246·#247)이 마지막 날에 몰리면서 길어졌다. 컴포넌트를 만든 PR과 사용처를 교체하는 PR 사이에 다른 기능 작업(#187 등)을 끼워 넣어 간격이 벌어졌다.

## 의도적으로 남긴 것

- 공통 컴포넌트 후보 여섯 개(`ListRow`, `SegmentedControl`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`)는 보류했다.
- 앱 CSS의 hex 색 225곳과 프로젝트 페이지의 브랜드 색은 토큰으로 바꾸지 않았다.
- 같은 의미의 `z-index` 값 통합, `Memo.tsx` 분리는 진행하지 않았다.

## 다음 작업

- 리팩터링 이후 생긴 큰 파일을 같은 기준으로 분리한다. `settings/ProjectsPane.tsx`(3,307줄)는 #281에서 분할했고, `Memo.tsx`는 917줄로 늘었다.
- 비슷한 값의 통합(간격 18px·28px, 같은 의미의 `z-index` 값)은 화면을 확인하며 하나씩 진행한다.

## 관련 글

- [zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-package#댓글좋아요-스키마-200): 1단계 contracts 패키지와 `parse()`
- [madge로 찾은 순환 import를 셋째 파일로 끊고 CI에서 막기](/memo/break-import-cycles): 2단계 순환 의존 해소
- [공통 API 클라이언트 api()·apiFetch()로 fetch 호출과 401 처리 통합하기](/memo/shared-modules#서버-호출-apiapifetch): 3단계 요청 함수
- [공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-modal#공통-부품-집계): 4단계 후보 재집계
- [그림자와 간격 값을 집계해 CSS 변수 디자인 토큰으로 이름 붙이기](/memo/design-tokens#그림자와-간격---shadow---space--248): 5단계 토큰
- [상태 기준으로 AnalyticsService를 저장·집계·조회 서비스로 나누기](/memo/analytics-service-split): 6단계 서비스 분리
- [Semgrep·pnpm audit·osv-scanner로 코드와 의존성 취약점 점검하기](/memo/security-scan): 7단계 이후 재점검

계획 이슈: [#150](https://github.com/hyeoniverse/MacFolio/issues/150).

[^brand]: 브랜드 타입(branded type)은 `string` 같은 기본 타입에 런타임에는 존재하지 않는 표시 속성을 교차 타입으로 붙여, 검사 함수를 거친 값만 그 타입으로 인정하게 하는 TypeScript 기법이다. 런타임에는 일반 문자열이므로 비용이 없다.

[^magic]: 매직 바이트는 파일 앞부분의 고정된 바이트 열이다. 예를 들어 PNG는 `89 50 4E 47`로 시작한다. 확장자나 `Content-Type` 대신 실제 파일 형식을 확인하는 데 쓴다.

[^cycle]: 순환 의존(circular dependency)은 A가 B를 import하고 B가 다시 A를 import하는 구조다. `Mail.tsx`와 `MailMobile.tsx`가 그 예다.

[^specificity]: 명시도(specificity)는 여러 CSS 규칙이 같은 속성을 지정하는 경우 어느 규칙을 적용할지 정하는 점수다. `:where()` 안의 선택자는 명시도가 0이라, 다른 어떤 규칙에도 덮어쓰일 수 있다. [MDN Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity) 참고.

[^module]: NestJS에서 컨트롤러와 서비스(프로바이더)를 묶는 단위. `@Module()`의 `providers`에 등록한 클래스는 생성자 주입으로 서로를 받는다.

[^contracts]: API 요청·응답 형태를 zod 스키마로 정의한 패키지. 서버는 스키마로 검사하고, 화면은 같은 이름의 타입만 가져온다.

[^zod]: TypeScript용 스키마 검증 라이브러리. 스키마 하나에서 런타임 검사와 정적 타입을 함께 얻는다.

#MacFolio #리팩터링 #회고
