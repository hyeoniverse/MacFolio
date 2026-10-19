---
title: API 경로 64개를 표 하나로 고정하기
date: 2026-10-09
category: 개발기/MacFolio/인프라
summary: 관리자 API에 가드를 빠뜨리면 아무도 모른다. 컨트롤러 데코레이터에서 경로·가드를 읽어 표와 비교하고, 관리자 경로는 로그인 없이 401, 몸통을 받는 경로는 틀린 값에 400인지 한 파일에서 본다. 64개로 시작한 표는 지금 85개다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 중 API 쪽을 시작했다. 첫 항목은 "요청 검증을 DTO로"였는데, 코드를 보니 몸통을 받는 경로 19개에는 이미 각자의 검사 함수가 있었다. 글은 제목 100자·본문 5만 자, 댓글은 2천 자, 데모는 60~800자, 분석 이벤트는 한 번에 30개까지. 없는 것은 검사가 아니라 **"모든 경로가 규칙을 지킨다"는 것을 확인하는 시험**이었다.

## 무엇이 걱정이었나

API 경로는 64개다. 그중 29개는 관리자만 써야 한다(글 쓰기·지우기, 파일 올리기, 배경화면 관리 등). 관리자 확인은 경로마다 `@UseGuards(AdminGuard)`를 붙여서 한다. 그런데 새 경로를 만들면서 이 한 줄을 빠뜨리면, 아무 오류 없이 누구나 글을 지울 수 있는 경로가 생긴다. 지금까지는 PR을 보는 사람(나)의 눈에만 기대고 있었다.

## 막는 방법 셋

| 방법                                               | 좋은 점                                  | 문제                                                                    |
| -------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| 전역 가드로 "기본은 관리자", 공개 경로만 `@Public` | 빠뜨리면 막히는 쪽으로 틀린다            | 공개·방문자 경로가 35+11개라 예외 표시가 더 많다. 기존 코드를 다 고친다 |
| 린트 규칙 (컨트롤러 메서드에 가드가 없으면 경고)   | 편집기에서 바로 보인다                   | "가드가 없어도 되는 경로"를 린트가 모른다. 401을 실제로 내는지도 모른다 |
| 표 하나와 실제 서버 비교 (고른 방법)               | 권한을 한곳에서 읽는다. 실제로 불러 본다 | 경로를 더할 때마다 표를 고쳐야 한다 (이것이 목적이다)                   |

전역 가드는 가장 안전한 기본값이지만, 이미 있는 64개 경로를 모두 고쳐야 했다. 표는 코드를 하나도 고치지 않고 시작할 수 있었다.

## 용어

- **가드(Guard)**: NestJS에서 요청이 처리 함수에 닿기 전에 "들어와도 되는지"를 정하는 것. `AdminGuard`는 세션 쿠키로 관리자인지 확인하고, 아니면 401을 돌려준다
- **데코레이터 메타데이터**: `@Get('posts')`, `@UseGuards(AdminGuard)` 같은 데코레이터는 그 함수에 "이 함수는 GET /posts다", "가드는 AdminGuard다"라는 정보를 붙여 둔다. NestJS는 서버를 띄울 때 이 정보를 읽어 라우터를 만든다. 시험도 같은 정보를 읽을 수 있다
- **401과 400**: 401은 "누구인지 확인되지 않았다"(로그인 필요), 400은 "요청 내용이 잘못되었다"(검사 실패). 500은 "서버가 처리하다 터졌다"로, 입력 때문에 500이 나면 검사가 빠진 것이다

## 시험 하나에 네 가지

`test/routes.e2e.test.ts`는 서버를 띄운 뒤 `DiscoveryService`로 컨트롤러를 모두 찾고, 각 함수의 메타데이터에서 HTTP 메서드·경로·가드를 읽어 목록을 만든다. 그리고 파일 안의 표와 비교한다.

```ts
const ACCESS = {
	'GET /posts': 'public',
	'POST /posts': 'admin',
	'POST /posts/:slug/comments': 'visitor',
	// … 64개
};
```

경로를 읽는 부분은 NestJS가 라우터를 만들 때 쓰는 메타데이터를 그대로 읽는다.

```ts
for (const { metatype, instance } of discovery.getControllers()) {
	const prefix = Reflect.getMetadata(PATH_METADATA, metatype) as string;
	const classGuards = (Reflect.getMetadata(GUARDS_METADATA, metatype) ?? []) as { name: string }[];
	const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
	for (const name of scanner.getAllMethodNames(proto)) {
		const handler = proto[name] as object;
		const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
		if (path === undefined) continue;
		const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
		// 클래스에 붙은 가드와 메서드에 붙은 가드를 합친다
	}
}
```

클래스 전체에 `@UseGuards`를 붙인 컨트롤러도 있어서, 클래스의 가드와 메서드의 가드를 합쳐서 본다.

1. **실제 경로 목록 = 표.** 경로를 더하거나 지우면 표도 고쳐야 통과한다. 표를 고치는 순간 "이 경로는 누구 것인가"를 정하게 된다
2. **표에서 `admin`인 경로에만 `AdminGuard`가 있다.** 가드를 빠뜨리면 여기서 깨진다. 반대로 공개 경로에 가드를 잘못 붙여도 깨진다
3. **관리자 경로 29개는 로그인 없이 모두 401.** 파라미터나 몸통을 보기 전에 가드가 먼저 막는지 본다. 틀린 몸통을 같이 보내서, 400이 아니라 401이 나와야 한다
4. **몸통을 받는 경로 19개는 타입이 틀린 값(`{ title: 1, body: 1, repos: 'x', … }`)에 모두 400.** 500이 나면 검사 없이 처리 함수까지 들어간 것이고, 2xx가 나면 검사가 없는 것이다

![시험 하나에 네 가지](./images/api-route-table-test-checks.svg '실제 서버의 경로·가드와 표를 비교하고, 401과 400은 실제로 불러서 본다')

`visitor`는 댓글·메시지·메일처럼 방문자 쿠키로 자기 것만 다루는 경로다. 가드 대신 서비스 안에서 확인하므로 표에서는 따로 두되, 가드 검사(2번)에서는 `admin`이 아닌 쪽으로 센다.

## 시험이 정말 잡는지

시험을 쓰고 나서 일부러 세 가지를 망가뜨려 봤다.

| 망가뜨린 것                                    | 깨진 시험 |
| ---------------------------------------------- | --------- |
| `/resources`에서 `@UseGuards(AdminGuard)` 제거 | 2, 3      |
| 메모 정리 내용 저장에서 검사 함수 건너뛰기     | 4         |
| 표에 없는 `GET /health/extra` 추가             | 1         |

세 경우 모두 해당 시험만 정확히 실패했다.

시험 파일은 처음 커밋(`9cbe8f914`, PR [#162](https://github.com/hyeoniverse/MacFolio/pull/162)에 함께 머지) 때 넷이었다.

## 그 뒤로 표가 한 일

표가 생긴 뒤 열흘 동안 이 파일은 아홉 번 더 고쳐졌다. 대부분 "새 경로를 표에 더한다"였다. 프로필 편집, 프로젝트 관리, Turnstile 설정, GitHub 언어 비율, UTM 추이, Finder 폴더 구조, `/documents`가 모두 이 표를 거쳐 들어왔다. 경로를 더하는 PR마다 "이 경로는 admin인가 public인가"를 한 줄로 적어야 했고, 리뷰에서도 그 한 줄만 보면 됐다.

![표가 지킨 경로 수](./images/api-route-table-test-counts.svg '64개(관리자 29)에서 85개(관리자 39, 공개 35, 방문자 11)로')

시험도 둘 늘었다.

- **쓰기 경로는 모두 요청 제한이 있고, 읽기 경로는 로그인 시작·콜백에만 있다**: 다음 날 모든 쓰기 경로에 `@RateLimit`을 붙일 때 더했다([쓰기 경로에 요청 제한](/memo/rate-limit-all-writes)). 같은 메타데이터 읽기에 `RATE_LIMIT_KEY` 하나만 더 읽으면 됐다.
- **쿼리·파라미터가 틀리면 400**: 몸통이 아니라 주소에 값을 받는 경로도 같은 규칙을 지키는지 본다.

지금 파일은 338줄, 시험은 6개다.

## 남은 것, 배운 것

- 표는 "누가 들어올 수 있나"만 본다. 관리자가 남의 것을 고칠 수 있는지 같은 세부 권한은 경로마다의 시험이 맡는다. `visitor` 경로가 "자기 것만" 다루는지는 이 표가 확인하지 않는다.
- 요청 검증을 zod 스키마로 모으는 일은 공유 타입과 함께 할 때 의미가 있어서 미뤘다. 검사 코드가 세 가지 모양(`{ errors }` 반환, 예외 던지기, 문자열 반환)으로 흩어져 있던 것은 그 뒤 `packages/contracts`로 옮기며 정리했다([분석 계약](/memo/contracts-analytics), [댓글 계약](/memo/contracts-comments)).
- 지금 급한 것은 "검사가 있다"를 고정하는 것이었고, 그것은 시험 하나로 됐다. 규칙을 코드 곳곳에 강제하기 어려울 때는, 규칙을 표로 적고 실제 상태와 비교하는 시험이 가장 싸다. 망가뜨려서 정말 깨지는지 본 것도 중요했다. 늘 통과하는 시험은 아무것도 지키지 않는다.

## 따라 해 보기

경로를 하나 더하면 이 시험이 먼저 깨진다. 그게 의도다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/routes.e2e.test.ts
```

새 경로를 만들었을 때 할 일:

1. 컨트롤러에 경로를 만든다. 관리자 전용이면 `@UseGuards(AdminGuard)`를 단다
2. 시험을 돌리면 "표에 없는 경로"로 실패한다. `test/routes.e2e.test.ts`의 표에 한 줄(방법, 경로, 가드)을 더한다
3. 관리자 경로라면 로그인 없이 401, 몸통 검사가 가드보다 먼저 돌지 않는지까지 시험이 자동으로 본다

시험이 정말 잡는지는 일부러 가드 한 줄을 지우고 돌려 보면 안다. 실패를 본 뒤 되돌린다(`git checkout -- <파일>`). 가드의 동작은 [NestJS Guards 문서](https://docs.nestjs.com/guards)에 있다.

관련 글: [관리자 로그인](/memo/admin-login-github-oauth), [쓰기 경로에 요청 제한](/memo/rate-limit-all-writes), [리팩터링 7 - 보안](/memo/refactor-step7-security), [테스트가 찾은 버그](/memo/bugs-found-by-tests)

#MacFolio #보안 #API #NestJS #테스트
