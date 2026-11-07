---
title: Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험
date: 2026-10-09
category: 개발 기록/MacFolio/테스트·보안·성능
series: 보안 점검
seriesOrder: 5
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

## 배경: 경로, 가드, 데코레이터

### API 경로와 권한

API 서버는 "HTTP 메서드 + 주소" 조합마다 처리 함수를 하나씩 연결한다. 이 조합을 **경로(route)**라고 부른다. 예를 들어 `GET /posts`는 글 목록을 반환하고, `DELETE /posts/:slug`는 주소의 `:slug` 자리에 들어온 글을 삭제한다. 경로마다 호출할 수 있는 사람이 다르다.

| 권한      | 뜻                                                    | 예                                             |
| --------- | ----------------------------------------------------- | ---------------------------------------------- |
| `public`  | 누구나 호출한다                                       | `GET /posts` (글 목록)                         |
| `visitor` | 누구나 호출하지만, 방문자 쿠키로 본인 데이터만 다룬다 | `POST /posts/:slug/comments` (댓글 작성)       |
| `admin`   | 관리자로 로그인한 경우에만 호출한다                   | `POST /posts` (글 작성), `DELETE /posts/:slug` |

`admin` 경로를 로그인하지 않은 사람이 호출하면 서버는 처리 함수를 실행하지 않고 [401 Unauthorized](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401)를 반환해야 한다.

```http
DELETE /posts/hello HTTP/1.1
(세션 쿠키 없음)

HTTP/1.1 401 Unauthorized
```

### 가드와 데코레이터

이 서버는 [NestJS](https://docs.nestjs.com/)로 작성했다. NestJS에서 "이 요청을 처리 함수까지 통과시킬지"를 결정하는 클래스를 **[가드(Guard)](https://docs.nestjs.com/guards)**라고 한다. `AdminGuard`는 세션 쿠키로 관리자인지 확인하고, 아니면 401을 반환한다.

가드는 **데코레이터**로 경로에 연결한다. 데코레이터는 `@`로 시작하는 TypeScript 문법으로, 클래스나 함수 선언 위에 붙여 그 대상에 정보를 추가한다. `@Get('posts')`, `@UseGuards(AdminGuard)` 같은 데코레이터는 내부에서 [`Reflect.defineMetadata`](https://github.com/rbuckton/reflect-metadata)를 호출해 함수 객체에 "이 함수는 GET /posts다", "가드는 AdminGuard다"라는 값을 저장한다. NestJS는 서버를 시작하면 이 값을 읽어 라우터를 구성한다. 같은 값을 시험 코드도 `Reflect.getMetadata`로 읽을 수 있다.

![컨트롤러의 데코레이터가 Reflect에 경로·메서드·가드 목록을 저장하고, 시험이 그 값으로 'POST /posts' 한 줄을 만드는 과정](./images/api-route-table-test-metadata.svg '@Post()는 path와 method를, @UseGuards는 __guards__를 처리 함수에 저장한다')

### 요청 처리 순서

NestJS는 요청 하나를 다음 순서로 처리한다([Request lifecycle](https://docs.nestjs.com/faq/request-lifecycle)). 가드가 파이프와 처리 함수보다 먼저 실행되므로, 관리자 경로는 본문이 틀려도 400보다 401이 먼저 나와야 한다. 본문 검사는 처리 함수 안의 검사 함수가 맡고, 실패하면 [400 Bad Request](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/400)를 반환한다. 입력 때문에 500(서버 내부 오류)이 나면 검사 없이 처리 함수까지 들어간 경로다.

![요청, 미들웨어, 가드, 인터셉터, 파이프, 처리 함수 순서와 401·400·500이 정해지는 단계](./images/api-route-table-test-lifecycle.svg '401은 가드에서, 400은 처리 함수의 검사 함수에서 정해진다')

## 무엇이 걱정이었나

작업 당시 API 경로는 64개였다. 그중 29개는 관리자만 호출해야 한다(글 작성·삭제, 파일 업로드, 배경화면 관리 등). 관리자 확인은 경로마다 `@UseGuards(AdminGuard)`를 붙여서 한다. 그런데 새 경로를 만들면서 이 한 줄을 빠뜨리면, ==빌드·린트·기존 시험 어디에서도 오류가 나지 않은 채 누구나 글을 삭제할 수 있는 경로가 생긴다==. 그때까지는 PR 리뷰(혼자 작업하므로 작성자 본인)에만 의존하고 있었다.

## 막는 방법 세 가지

| 방법                                               | 장점                                           | 단점                                                                               |
| -------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| 전역 가드로 "기본은 관리자", 공개 경로만 `@Public` | 빠뜨리면 차단되는 쪽으로 실패한다(fail-closed) | 공개·방문자 경로가 28+7개(작업 당시)라 예외 표시가 많다. 기존 코드를 모두 수정한다 |
| 린트 규칙 (컨트롤러 메서드에 가드가 없으면 경고)   | 편집기에서 바로 표시된다                       | "가드가 없어도 되는 경로"를 린트가 모른다. 실제로 401을 내는지도 모른다            |
| 표 하나와 실제 서버 비교 (고른 방법)               | 권한을 한곳에서 조회한다. 실제로 호출해 본다   | 경로를 추가할 때마다 표를 수정해야 한다 (이것이 목적이다)                          |

fail-closed는 설정을 빠뜨리면 "막는 쪽"으로 동작하는 설계다. 전역 가드 방식에서 새 경로에 `@Public`을 빠뜨리면 그 경로는 관리자 전용이 되어, 공개 페이지가 401을 반환해 문제가 바로 드러난다. 반대로 지금 구조(경로마다 가드)는 가드를 빠뜨리면 "여는 쪽"으로 동작한다.

전역 가드는 가장 안전한 기본값이지만, 이미 있는 64개 경로를 모두 수정해야 했다. ==표 방식은 서버 코드를 수정하지 않고 시험 파일 하나로 시작할 수 있었다==.

## 시험 하나에 네 가지

`test/routes.e2e.test.ts`는 서버를 시작한 뒤 [`DiscoveryService`](https://docs.nestjs.com/fundamentals/discovery-service)로 컨트롤러를 모두 찾고, 각 처리 함수의 메타데이터에서 HTTP 메서드·경로·가드를 읽어 목록을 만든다. 그리고 파일 안의 표와 비교한다.

```ts
const ACCESS = {
	'GET /posts': 'public',
	'POST /posts': 'admin',
	'POST /posts/:slug/comments': 'visitor',
	// … 64개
};
```

경로를 읽는 부분은 NestJS가 라우터를 구성하며 읽는 메타데이터 키(`PATH_METADATA`, `METHOD_METADATA`, `GUARDS_METADATA`)를 그대로 사용한다. 이 세 상수의 실제 값은 각각 `'path'`, `'method'`, `'__guards__'`다.

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

`METHOD_METADATA`에는 문자열이 아니라 숫자가 저장된다. `RequestMethod` 열거형에서 `GET`은 0, `POST`는 1, `DELETE`는 3이므로, `RequestMethod[1]`로 `'POST'`를 얻는다. 처리 함수가 아닌 일반 메서드에는 `PATH_METADATA`가 없으므로 `continue`로 건너뛴다.

클래스 전체에 `@UseGuards`를 붙인 컨트롤러도 있어서, 클래스의 가드와 메서드의 가드를 합쳐서 판정한다. 이렇게 만든 목록으로 네 가지를 확인한다.

1. **실제 경로 목록 = 표.** 경로를 추가하거나 삭제하면 표도 수정해야 통과한다. 표를 수정하는 시점에 "이 경로의 권한은 무엇인가"를 결정한다
2. **표에서 `admin`인 경로에만 `AdminGuard`가 있다.** 가드를 빠뜨리면 여기서 실패한다. 반대로 공개 경로에 가드를 잘못 붙여도 실패한다
3. **관리자 경로 29개는 로그인 없이 모두 401.** 파라미터나 본문을 검사하기 전에 가드가 먼저 차단하는지 확인한다. 잘못된 본문을 함께 보내서, 400이 아니라 401이 나와야 한다
4. **본문을 받는 경로 19개는 타입이 틀린 값(`{ title: 1, body: 1, repos: 'x', … }`)에 모두 400.** 500이 나면 검사 없이 처리 함수까지 들어간 경로이고, 2xx가 나면 검사가 없는 경로다

![시험 하나에 네 가지](./images/api-route-table-test-checks.svg '실제 서버의 경로·가드와 표를 비교하고, 401과 400은 실제로 불러서 본다')

4번의 예를 들면, 글 작성 경로에 제목 자리에 숫자를 보낸다. 검사 함수가 있으면 "제목은 문자열이어야 한다"는 400이 나오고, 검사 함수가 없으면 숫자 제목이 그대로 처리 함수에 들어가, 문자열 메서드(예: `trim()`)를 호출하는 지점에서 `TypeError`가 발생해 500이 나온다.

`visitor`는 댓글·메시지·메일처럼 방문자 쿠키로 본인 데이터만 다루는 경로다. 가드 대신 서비스 안에서 확인하므로 표에서는 별도 값으로 구분하되, 가드 검사(2번)에서는 `admin`이 아닌 쪽으로 집계한다.

## 시험이 실제로 잡아내는지

시험을 작성한 뒤 코드를 세 군데 일부러 잘못 수정하고 결과를 확인했다. 결함을 일부러 넣어 시험이 실패하는지 확인하는 방법은 변이 시험(mutation testing)[^mutation]의 수동 버전이다.

| 일부러 넣은 결함                               | 실패한 시험 |
| ---------------------------------------------- | ----------- |
| `/resources`에서 `@UseGuards(AdminGuard)` 제거 | 2, 3        |
| 메모 정리 내용 저장에서 검사 함수 건너뛰기     | 4           |
| 표에 없는 `GET /health/extra` 추가             | 1           |

세 경우 모두 해당 시험만 실패했다. 이 파일이 들어간 첫 커밋(`9cbe8f914`, PR [#162](https://github.com/hyeoniverse/MacFolio/pull/162)에 함께 머지)에는 위 네 가지와 함께 **쿼리·파라미터가 틀리면 400** 시험이 있었다. 본문이 아니라 URL로 값을 받는 경로(예: 분석 조회의 `?from=` 날짜 값)도 같은 규칙을 지키는지 확인한다.

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
- 요청 검증을 zod 스키마로 통합하는 작업은 공유 타입과 함께 진행해야 의미가 있어서 미뤘다. 검사 코드가 세 가지 형태(`{ errors }` 반환, 예외 발생, 문자열 반환)로 흩어져 있던 문제는 그 뒤 `packages/contracts`로 옮기며 하나로 맞췄다([분석 계약](/memo/contracts-package#분석-이벤트의-전송수신조회-형식-206), [댓글 계약](/memo/contracts-package#댓글좋아요-스키마-200)).
- 당장 필요한 것은 "검사가 있다"를 고정하는 것이었고, 시험 파일 하나로 해결됐다. 규칙을 코드 전체에 강제하기 어려우면 규칙을 표로 적고 실제 상태와 비교하는 시험이 비용이 가장 적다. 결함을 일부러 넣어 시험이 실패하는지 확인한 단계도 필요했다. ==결함이 있어도 통과하는 시험은 아무것도 보장하지 않는다==.

## 따라 해 보기

> [!NOTE]
> 경로를 하나 추가하면 이 시험이 먼저 실패한다. 의도한 동작이다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/routes.e2e.test.ts
```

새 경로를 만들면 할 일:

1. 컨트롤러에 경로를 만든다. 관리자 전용이면 `@UseGuards(AdminGuard)`를 붙인다
2. 시험을 실행하면 "표에 없는 경로"로 실패한다. `test/routes.e2e.test.ts`의 표에 한 줄(메서드·경로·권한)을 추가한다
3. 관리자 경로라면 로그인 없이 401이 나오는지, 본문 검사가 가드보다 먼저 실행되지 않는지까지 시험이 자동으로 확인한다

> [!TIP] 결함을 넣어 시험 확인
> 시험이 실제로 잡아내는지는 가드 한 줄을 일부러 삭제하고 실행해 보면 확인할 수 있다. 아래는 `/resources`의 가드를 삭제하는 예다.

```bash
sed -i.bak '/@UseGuards(AdminGuard)/d' apps/api/src/resources/resources.controller.ts
pnpm --filter @macfolio/api test:e2e test/routes.e2e.test.ts   # 시험 2·3이 실패한다
mv apps/api/src/resources/resources.controller.ts.bak apps/api/src/resources/resources.controller.ts
```

## 관련 글

- [GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기](/memo/admin-login-github-oauth)
- [@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes)
- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-retrospective#7단계-보안)
- [리팩터링 전 E2E 시험 10개로 찾은 hook 순서·클로저·ICU 버그](/memo/bugs-found-by-tests)
- [zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-package#댓글좋아요-스키마-200)

<details>
<summary>참고 문헌</summary>

- [NestJS: Guards](https://docs.nestjs.com/guards)
- [NestJS: Request lifecycle](https://docs.nestjs.com/faq/request-lifecycle)
- [NestJS: Discovery service](https://docs.nestjs.com/fundamentals/discovery-service)
- [NestJS: Validation](https://docs.nestjs.com/techniques/validation)
- [TypeScript Handbook: Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)
- [reflect-metadata (GitHub)](https://github.com/rbuckton/reflect-metadata)
- [MDN: 401 Unauthorized](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401), [400 Bad Request](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/400)

</details>

[^dto]: Data Transfer Object. NestJS에서는 요청 본문의 모양을 클래스로 선언하고 `class-validator` 데코레이터로 검사하는 방식을 말한다. [NestJS Validation](https://docs.nestjs.com/techniques/validation)

[^mutation]: 변이 시험: 코드에 작은 결함(조건 반전, 줄 삭제 등)을 자동으로 넣고, 기존 시험이 그 결함을 검출하는지로 시험의 품질을 측정하는 방법. 여기서는 세 가지 결함을 직접 넣었다.

#MacFolio #보안 #API #NestJS #테스트
