---
title: API 경로 64개를 표 하나로 고정하기
date: 2026-10-09
category: 개발 기록/MacFolio/테스트·CI
summary: 관리자 API에 가드를 빠뜨려도 오류가 나지 않는다. 컨트롤러 데코레이터에서 경로·가드를 읽어 표와 비교하고, 관리자 경로는 로그인 없이 401, 본문을 받는 경로는 잘못된 값에 400인지 한 파일에서 확인한다. 64개로 시작한 표는 10월 19일 85개가 됐다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 중 API 쪽을 시작했다. 첫 항목은 "요청 검증을 DTO[^dto]로"였는데, 코드를 확인해 보니 요청 본문(body)을 받는 경로 19개에는 이미 각자의 검사 함수가 있었다.

| 대상        | 검사 한도               |
| ----------- | ----------------------- |
| 글          | 제목 100자, 본문 5만 자 |
| 댓글        | 2천 자                  |
| 데모        | 60~800자                |
| 분석 이벤트 | 한 번에 30개            |

없는 것은 검사가 아니라 **"모든 경로가 규칙을 지킨다"를 확인하는 시험**이었다.

## 무엇이 걱정이었나

작업 당시 API 경로는 64개였다. 그중 29개는 관리자만 호출해야 한다(글 작성·삭제, 파일 업로드, 배경화면 관리 등). 관리자 확인은 경로마다 `@UseGuards(AdminGuard)`를 붙여서 한다. 그런데 새 경로를 만들면서 이 한 줄을 빠뜨리면, 빌드·린트·기존 시험 어디에서도 오류가 나지 않은 채 누구나 글을 삭제할 수 있는 경로가 생긴다. 그때까지는 PR 리뷰(혼자 작업하므로 작성자 본인)에만 의존하고 있었다.

## 막는 방법 세 가지

| 방법                                               | 장점                                           | 단점                                                                               |
| -------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| 전역 가드로 "기본은 관리자", 공개 경로만 `@Public` | 빠뜨리면 차단되는 쪽으로 실패한다(fail-closed) | 공개·방문자 경로가 28+7개(작업 당시)라 예외 표시가 많다. 기존 코드를 모두 수정한다 |
| 린트 규칙 (컨트롤러 메서드에 가드가 없으면 경고)   | 편집기에서 바로 표시된다                       | "가드가 없어도 되는 경로"를 린트가 모른다. 실제로 401을 내는지도 모른다            |
| 표 하나와 실제 서버 비교 (고른 방법)               | 권한을 한곳에서 조회한다. 실제로 호출해 본다   | 경로를 추가할 때마다 표를 수정해야 한다 (이것이 목적이다)                          |

전역 가드는 가장 안전한 기본값이지만, 이미 있는 64개 경로를 모두 수정해야 했다. 표 방식은 서버 코드를 수정하지 않고 시험 파일 하나로 시작할 수 있었다.

<details><summary>용어 정리: 가드, 데코레이터 메타데이터, 401·400·500</summary>

- **가드(Guard)**: NestJS에서 요청이 핸들러(처리 함수)에 도달하기 전에 "이 요청을 통과시킬지"를 결정하는 클래스. `AdminGuard`는 세션 쿠키로 관리자인지 확인하고, 아니면 401을 응답한다([NestJS Guards](https://docs.nestjs.com/guards))
- **데코레이터 메타데이터**: `@Get('posts')`, `@UseGuards(AdminGuard)` 같은 데코레이터는 그 함수에 "이 함수는 GET /posts다", "가드는 AdminGuard다"라는 정보를 `Reflect.defineMetadata`로 저장한다. NestJS는 서버를 시작할 때 이 정보를 읽어 라우터를 만든다. 시험도 같은 정보를 읽을 수 있다
- **401과 400**: [401](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401)은 "인증되지 않았다"(로그인 필요), [400](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/400)은 "요청 내용이 잘못되었다"(검사 실패). 500은 "서버가 처리 중 예외를 냈다"로, 입력 때문에 500이 나면 검사가 빠진 것이다

</details>

## 시험 하나에 네 가지

`test/routes.e2e.test.ts`는 서버를 시작한 뒤 [`DiscoveryService`](https://docs.nestjs.com/fundamentals/discovery-service)로 컨트롤러를 모두 찾고, 각 핸들러의 메타데이터에서 HTTP 메서드·경로·가드를 읽어 목록을 만든다. 그리고 파일 안의 표와 비교한다.

```ts
const ACCESS = {
	'GET /posts': 'public',
	'POST /posts': 'admin',
	'POST /posts/:slug/comments': 'visitor',
	// … 64개
};
```

경로를 읽는 부분은 NestJS가 라우터를 만들 때 쓰는 메타데이터 키(`PATH_METADATA`, `METHOD_METADATA`, `GUARDS_METADATA`)를 그대로 사용한다.

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

클래스 전체에 `@UseGuards`를 붙인 컨트롤러도 있어서, 클래스의 가드와 메서드의 가드를 합쳐서 판정한다. 이렇게 만든 목록으로 네 가지를 확인한다.

1. **실제 경로 목록 = 표.** 경로를 추가하거나 삭제하면 표도 수정해야 통과한다. 표를 수정하는 시점에 "이 경로의 권한은 무엇인가"를 결정하게 된다
2. **표에서 `admin`인 경로에만 `AdminGuard`가 있다.** 가드를 빠뜨리면 여기서 실패한다. 반대로 공개 경로에 가드를 잘못 붙여도 실패한다
3. **관리자 경로 29개는 로그인 없이 모두 401.** 파라미터나 본문을 검사하기 전에 가드가 먼저 차단하는지 확인한다. 잘못된 본문을 함께 보내서, 400이 아니라 401이 나와야 한다
4. **본문을 받는 경로 19개는 타입이 틀린 값(`{ title: 1, body: 1, repos: 'x', … }`)에 모두 400.** 500이 나면 검사 없이 핸들러까지 들어간 것이고, 2xx가 나면 검사가 없는 것이다

![시험 하나에 네 가지](./images/api-route-table-test-checks.svg '실제 서버의 경로·가드와 표를 비교하고, 401과 400은 실제로 불러서 본다')

`visitor`는 댓글·메시지·메일처럼 방문자 쿠키로 본인 데이터만 다루는 경로다. 가드 대신 서비스 안에서 확인하므로 표에서는 별도 값으로 구분하되, 가드 검사(2번)에서는 `admin`이 아닌 쪽으로 집계한다.

## 시험이 실제로 잡아내는지

시험을 작성한 뒤 코드를 세 군데 일부러 잘못 수정하고 결과를 확인했다.

| 일부러 넣은 결함                               | 실패한 시험 |
| ---------------------------------------------- | ----------- |
| `/resources`에서 `@UseGuards(AdminGuard)` 제거 | 2, 3        |
| 메모 정리 내용 저장에서 검사 함수 건너뛰기     | 4           |
| 표에 없는 `GET /health/extra` 추가             | 1           |

세 경우 모두 해당 시험만 실패했다. 이 파일이 들어간 첫 커밋(`9cbe8f914`, PR [#162](https://github.com/hyeoniverse/MacFolio/pull/162)에 함께 머지)에는 위 네 가지와 함께 **쿼리·파라미터가 틀리면 400** 시험이 있었다. 본문이 아니라 URL로 값을 받는 경로도 같은 규칙을 지키는지 확인한다.

## 그 뒤로 표가 한 일

표가 생긴 뒤 열흘 동안 이 파일은 아홉 번 더 수정됐다. 대부분 "새 경로를 표에 추가한다"였다. 프로필 편집, 프로젝트 관리, Turnstile 설정, GitHub 언어 비율, UTM 추이, Finder 폴더 구조, `/documents`가 모두 이 표를 거쳐 추가됐다. 경로를 추가하는 PR마다 "이 경로는 admin인가 public인가"를 한 줄로 적어야 했고, 리뷰에서도 그 한 줄만 확인하면 됐다.

![표가 지킨 경로 수](./images/api-route-table-test-counts.svg '64개(관리자 29)에서 10월 19일 85개(관리자 39, 공개 35, 방문자 11)로')

시험은 하나 늘었다. **쓰기 경로는 모두 요청 제한이 있고, 읽기 경로는 로그인 시작·콜백에만 있다**는 시험으로, 모든 쓰기 경로에 `@RateLimit`을 붙이면서 추가했다([쓰기 경로에 요청 제한](/memo/rate-limit-all-writes)). 기존 메타데이터 수집 코드에서 `RATE_LIMIT_KEY` 하나만 더 읽으면 됐다.

| 시각      | 경로 수 | admin | public | visitor | 파일 길이 | 시험 수 |
| --------- | ------- | ----- | ------ | ------- | --------- | ------- |
| 10월 9일  | 64      | 29    | 28     | 7       | 263줄     | 5       |
| 10월 19일 | 85      | 39    | 35     | 11      | 338줄     | 6       |
| 10월 23일 | 93      | 46    | 36     | 11      | 351줄     | 6       |

## 남은 것, 배운 것

- 표는 "누가 호출할 수 있나"만 확인한다. 방문자가 다른 방문자의 댓글을 수정할 수 있는지 같은 세부 권한은 경로별 시험이 담당한다. `visitor` 경로가 본인 데이터만 다루는지는 이 표가 확인하지 않는다.
- 요청 검증을 zod 스키마로 통합하는 작업은 공유 타입과 함께 할 때 의미가 있어서 미뤘다. 검사 코드가 세 가지 형태(`{ errors }` 반환, 예외 발생, 문자열 반환)로 흩어져 있던 것은 그 뒤 `packages/contracts`로 옮기며 하나로 맞췄다([분석 계약](/memo/contracts-analytics), [댓글 계약](/memo/contracts-comments)).
- 당장 필요한 것은 "검사가 있다"를 고정하는 것이었고, 시험 파일 하나로 해결됐다. 규칙을 코드 전체에 강제하기 어려울 때는 규칙을 표로 적고 실제 상태와 비교하는 시험이 비용이 가장 적다. 결함을 일부러 넣어 시험이 실패하는지 확인한 단계도 필요했다. 결함이 있어도 통과하는 시험은 아무것도 보장하지 않는다.

## 따라 해 보기

경로를 하나 추가하면 이 시험이 먼저 실패한다. 의도한 동작이다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/routes.e2e.test.ts
```

새 경로를 만들었을 때 할 일:

1. 컨트롤러에 경로를 만든다. 관리자 전용이면 `@UseGuards(AdminGuard)`를 붙인다
2. 시험을 실행하면 "표에 없는 경로"로 실패한다. `test/routes.e2e.test.ts`의 표에 한 줄(메서드·경로·권한)을 추가한다
3. 관리자 경로라면 로그인 없이 401이 나오는지, 본문 검사가 가드보다 먼저 실행되지 않는지까지 시험이 자동으로 확인한다

시험이 실제로 잡아내는지는 가드 한 줄을 일부러 삭제하고 실행해 보면 확인할 수 있다. 아래는 `/resources`의 가드를 삭제하는 예다.

```bash
sed -i.bak '/@UseGuards(AdminGuard)/d' apps/api/src/resources/resources.controller.ts
pnpm --filter @macfolio/api test:e2e test/routes.e2e.test.ts   # 시험 2·3이 실패한다
mv apps/api/src/resources/resources.controller.ts.bak apps/api/src/resources/resources.controller.ts
```

가드의 동작은 [NestJS Guards 문서](https://docs.nestjs.com/guards)에 있다.

## 관련 글

- [정적 사이트에 관리자 로그인 붙이기](/memo/admin-login-github-oauth)
- [쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)
- [리팩터링 7단계 — 보안](/memo/refactor-step7-security)
- [테스트를 붙이자 보인 버그들](/memo/bugs-found-by-tests)
- [응답 타입을 두 번 적지 않기 — @macfolio/contracts와 zod](/memo/contracts-comments)

[^dto]: Data Transfer Object. NestJS에서는 요청 본문의 모양을 클래스로 선언하고 `class-validator` 데코레이터로 검사하는 방식을 말한다. [NestJS Validation](https://docs.nestjs.com/techniques/validation)

#MacFolio #보안 #API #NestJS #테스트
