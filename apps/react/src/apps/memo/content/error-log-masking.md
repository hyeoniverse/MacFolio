---
title: 모든 로그가 거치는 ConsoleLogger에서 비밀 값 마스킹하기
date: 2026-10-10
category: 개발 기록/MacFolio/테스트·보안·성능
series: 보안 점검
seriesOrder: 8
summary: 100KB를 넘는 요청 본문이 413이 아니라 500으로 응답되고 스택 트레이스가 로그에 기록되었다. 전역 예외 필터가 Express 미들웨어의 오류를 식별하게 하고, 모든 로그가 거치는 로거에서 DB 비밀번호·API 키·쿠키·메일 주소를 마스킹했다. 4xx는 로그에 기록하지 않는다.
---

서버가 요청을 처리하다 실패하면 두 가지 기록이 남는다. 하나는 클라이언트에게 돌려주는 **오류 응답**이고, 다른 하나는 서버 운영자가 원인을 찾기 위해 남기는 **로그**다. 두 기록은 독자가 다르므로 담아야 할 내용도 다르다. 오류 응답은 인터넷의 누구나 받을 수 있으므로 내부 구조(스택 트레이스, DB 주소, 파일 경로)를 드러내면 안 된다. 로그는 운영자만 보지만, Docker 로그나 호스팅 콘솔에 파일로 쌓이고 오래 보관되므로 DB 비밀번호·API 키·세션 쿠키·방문자 메일 주소가 그대로 남으면 로그 열람 권한이 곧 비밀 값 열람 권한이 된다.

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 두 가지, "오류 응답에 내부 정보가 노출되지 않는지 시험 보강"과 "로그에 쿠키·토큰·메일 주소가 남지 않게 마스킹"을 PR 하나([#167](https://github.com/hyeoniverse/MacFolio/pull/167))로 처리했다. 두 항목 모두 전역 예외 필터와 로거를 수정하는 작업이기 때문이다.

<details>
<summary>용어 정리</summary>

- **HTTP 상태 코드**: 응답 첫 줄의 세 자리 숫자. 첫 자리로 종류를 구분한다. 4xx는 클라이언트 요청에 문제가 있다는 뜻이고(400 잘못된 요청, 404 없는 경로, 413 본문이 너무 큼), 5xx는 서버가 올바른 요청을 처리하지 못했다는 뜻이다(500 내부 오류)[^rfc9110].
- **미들웨어**: Express에서 요청이 핸들러에 도달하기 전에 차례로 실행되는 함수. 보안 헤더(helmet), 쿠키 해석(cookie-parser), 본문 해석(body-parser)이 모두 미들웨어다.
- **body-parser**: 요청 본문(JSON, 텍스트)을 읽어 `req.body` 객체로 바꾸는 미들웨어. 기본 크기 제한은 100KB(102,400바이트)이고, 넘으면 413 오류를 만든다.
- **전역 예외 필터**: NestJS에서 핸들러나 가드가 던진 예외를 받아 HTTP 응답으로 변환하는 마지막 단계([NestJS 문서: Exception filters](https://docs.nestjs.com/exception-filters)). MacFolio는 `@Catch()`로 모든 예외를 받아 `{ statusCode, error, message, path, timestamp }` 형식 하나로 응답한다.
- **`HttpException`**: NestJS의 HTTP 예외 클래스. `NotFoundException`처럼 상태 코드와 메시지를 포함하므로 그대로 응답한다. 이 클래스가 아니면 필터는 알 수 없는 예외로 판단해 500으로 응답하고 내용을 숨긴다.
- **http-errors**: Express 미들웨어(body-parser 등)가 사용하는 오류 객체 형식([npm: http-errors](https://www.npmjs.com/package/http-errors)). `status`(413), `expose`(메시지를 클라이언트에 노출해도 되는지), `type`(`entity.too.large`) 속성을 가진다. `expose`는 상태 코드가 500 미만이면 `true`, 이상이면 `false`가 기본값이다.
- **마스킹**: 로그에 기록하기 전에 값의 일부를 `***`로 치환하는 처리. 항목 자체를 삭제하지 않고, 어떤 항목이 있었는지는 남기고 값만 숨긴다.

</details>

## 배경: 요청이 지나는 단계와 예외 필터

NestJS 서버는 내부적으로 Express 위에서 동작한다. 요청 하나는 먼저 Express 미들웨어를 차례로 지나고, 그다음 NestJS의 가드·파이프를 거쳐 컨트롤러의 핸들러에 도달한다. 어느 단계에서 예외가 발생하든 마지막에는 예외 필터가 받아 응답으로 바꾼다.

![NestJS 문서의 예외 필터 위치](./images/error-log-masking-nest-filter.png '클라이언트와 라우트 핸들러 사이에서 파이프는 요청 쪽에, 필터는 예외가 응답으로 나가는 쪽에 위치한다. NestJS 공식 문서')

NestJS 문서는 필터를 "애플리케이션에서 처리되지 않은 모든 예외를 처리하는 예외 계층"으로 설명한다. 기본 필터는 `HttpException`(과 그 하위 클래스)만 상태 코드를 알아보고, 그 밖의 예외는 모두 `500 Internal server error`로 응답한다. MacFolio는 이 기본 필터 대신 `HttpErrorFilter`를 전역으로 등록해 모든 오류 응답의 형식을 통일했다.

문제는 오류가 생기는 위치가 여러 곳이라는 점이다. 아래 그림처럼 본문 크기 초과는 NestJS에 도달하기 전, Express의 body-parser 단계에서 발생한다. 이 오류는 NestJS의 `HttpException`이 아니라 http-errors 형식의 객체다.

![요청 단계와 오류가 생기는 위치](./images/error-log-masking-pipeline.svg 'body-parser의 413은 http-errors 객체로, 파이프·핸들러의 400·404는 HttpException으로, DB 오류는 일반 Error로 필터에 도달한다')

## 수정 전 응답 확인

시험을 작성하기 전에, 서버가 비정상 입력에 어떻게 응답하는지 다섯 가지 요청을 직접 보내 확인했다.

| 요청                          | 응답    |
| ----------------------------- | ------- |
| 깨진 JSON (`{"name": `)       | 400     |
| 100KB를 넘는 JSON 본문        | **500** |
| 32KB를 넘는 분석 이벤트(text) | **500** |
| 없는 경로                     | 404     |
| 있는 경로에 틀린 메서드       | 404     |

본문이 큰 요청 두 건이 문제였다. 100KB는 body-parser의 JSON 기본 제한이고, 32KB는 분석 이벤트용 `text/plain` 파서에 직접 지정한 제한(`useBodyParser('text', { limit: '32kb' })`)이다. 두 경우 모두 클라이언트가 보낸 요청이 너무 큰 것이므로 413이 맞는 응답인데, 응답 본문은 다음과 같았다.

```json
{
	"statusCode": 500,
	"error": "Internal Server Error",
	"message": "서버에서 문제가 생겼습니다.",
	"path": "…",
	"timestamp": "…"
}
```

로그에는 `PayloadTooLargeError`의 스택 트레이스 10줄이 ERROR 수준으로 기록되었다. ==큰 요청이 반복되면 로그가 스택 트레이스로 채워져 실제 서버 오류를 찾기 어려워진다.== 누군가 큰 본문을 반복해서 보내기만 해도 운영 로그가 오염된다.

## 검토한 방법

413을 돌려주는 방법은 세 가지를 비교했다.

| 방법                                                      | 장점                              | 단점                                                                |
| --------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| body-parser 앞에 본문 크기 검사 미들웨어를 배치한다       | 413을 직접 지정한다               | 깨진 JSON(400) 같은 다른 미들웨어 오류는 계속 500                   |
| 필터에서 `PayloadTooLargeError` 이름만 판별한다           | 코드 한 줄                        | 다른 미들웨어 오류는 계속 500. 클래스 이름에 의존해 변경에 취약하다 |
| **필터가 http-errors 형식(`status`·`expose`)을 신뢰한다** | 미들웨어 오류 전체를 한 번에 처리 | `expose`가 참인 4xx만 신뢰해야 한다(5xx는 숨긴다)                   |

로그도 같은 방식으로 비교했다. 서비스마다 로그를 기록하기 전에 마스킹 함수를 호출하게 할 수도 있지만, 한 곳만 누락해도 비밀 값이 노출된다. ==모든 로그가 거치는 로거 하나를 교체하면 누락 지점이 생기지 않는다.==

## 필터: http-errors 식별

![오류 하나가 응답이 되기까지: HttpException이면 그대로, http-errors 4xx면 상태를 믿고, 나머지는 500으로 감추고 로그](./images/error-log-masking-filter.svg '로그는 500일 때만 기록한다. 4xx는 클라이언트 요청 오류라 기록하지 않는다')

`HttpException`이 아니어도 `status`가 4xx이고 `expose`가 참이면 그 상태 코드를 사용한다. 메시지는 `type`에 따라 한국어로 변환한다(`entity.too.large` → "요청이 너무 큽니다.", `entity.parse.failed` → "요청 본문을 읽을 수 없습니다."). 5xx이거나 `expose`가 거짓이면 기존처럼 500으로 응답하고 내용을 숨긴다. 로그는 **500일 때만** 기록한다. 404·413 같은 ==4xx는 클라이언트 요청의 오류이지 서버 장애가 아니기== 때문이다. 로그에는 `GET /posts → 500` 한 줄과 오류 내용을 함께 기록해 발생 경로를 확인할 수 있게 했다.

```ts
// apps/api/src/common/http-error.filter.ts
function httpLikeStatus(exception: unknown): { statusCode: number; message: string } | null {
	if (!exception || typeof exception !== 'object') return null;
	const { status, expose, type, message } = exception as HttpLikeError;
	if (typeof status !== 'number' || status < 400 || status >= 500 || expose !== true) return null;
	const known = typeof type === 'string' ? HTTP_LIKE_MESSAGES[type] : undefined;
	return { statusCode: status, message: known ?? (typeof message === 'string' ? message : statusName(status)) };
}
```

한국어 메시지로 변환하는 `type`은 `entity.too.large`, `entity.parse.failed`, `entity.verify.failed`, `encoding.unsupported`, `charset.unsupported`, `request.aborted` 여섯 가지다. 목록에 없는 `type`이면 http-errors의 메시지를 그대로 사용한다. `expose`가 참이면 그 메시지는 클라이언트에 노출해도 되는 값이라는 뜻이다.

수정 후 로컬 서버에 200KB짜리 JSON 본문을 보내면 다음 응답이 돌아온다. 상태 코드와 `error`가 413(`Payload Too Large`)으로 바뀌고, `message`는 `HTTP_LIKE_MESSAGES`의 한국어 문구다.

```text
$ curl -s -X POST http://localhost:4000/contact -H 'Content-Type: application/json' --data-binary @big.json
{"statusCode":413,"message":"요청이 너무 큽니다.","error":"Payload Too Large","path":"/contact","timestamp":"2026-11-06T17:36:27.586Z"}
```

## 로거: 모든 로그가 한 곳을 거친다

로그 마스킹은 "어디에서 마스킹 함수를 호출하는가"가 핵심이다. 로그를 남기는 코드는 서비스·필터·가드 등 여러 파일에 흩어져 있고, 새 기능을 만들 때마다 늘어난다. 호출하는 곳마다 마스킹을 맡기면 한 곳만 누락해도 비밀 값이 그대로 출력된다.

NestJS의 `Logger`는 서비스마다 `new Logger(이름)`으로 생성하지만, 실제 출력은 `app.useLogger()`로 등록한 로거 하나가 담당한다([NestJS 문서: Logger](https://docs.nestjs.com/techniques/logger)). `ConsoleLogger`를 상속한 `SafeLogger`를 등록해 `log`·`warn`·`error` 등 여섯 메서드가 모두 인자를 마스킹한 뒤 출력하게 했다. 서비스 코드는 수정하지 않았다.

마스킹 대상은 OWASP의 로깅 지침을 기준으로 골랐다. [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)는 로그에 직접 기록하지 말고 삭제·마스킹·해시 처리해야 할 항목으로 세션 식별 값, 접근 토큰, 인증 비밀번호, DB 연결 문자열, 암호화 키, 민감한 개인정보를 든다. 그중 MacFolio 로그에 섞여 들어올 수 있고 형식이 정해진 값을 마스킹한다.

| 대상               | 변경 전                                | 변경 후                          |
| ------------------ | -------------------------------------- | -------------------------------- |
| DB 주소의 비밀번호 | `postgresql://macfolio:s3cret@db/…`    | `postgresql://macfolio:***@db/…` |
| Authorization      | `Bearer re_abc…`                       | `Bearer ***`                     |
| 쿠키·쿼리 값       | `macfolio_session=abc; code=xyz`       | `macfolio_session=***; code=***` |
| 알려진 키 접두사   | `re_…`(Resend), `gsk_…`(Groq), `ghp_…` | `***`                            |
| 메일 주소          | `minsu@example.com`                    | `m***@example.com`               |

아래 그림은 같은 문자열이 마스킹 전후에 어떻게 바뀌는지 보여 준다. 값 전체를 지우지 않고 비밀 부분만 `***`로 바꾸므로, 로그를 보는 사람은 "DB 연결에서 실패했다", "세션 쿠키가 있었다" 같은 맥락을 그대로 확인할 수 있다.

![redact() 적용 전후의 로그 문자열](./images/error-log-masking-redact-example.svg '비밀번호·토큰·쿠키 값·메일 주소의 일부만 ***로 바뀌고, statusCode=500처럼 형식이 다른 값은 그대로 남는다')

`Error` 객체는 메시지와 스택을 마스킹한 복사본을 생성하고, 일반 객체는 JSON 문자열로 변환한 뒤 마스킹한다. `statusCode=500`처럼 다른 단어 끝에 붙은 `code=`는 변경하지 않도록 단어 경계를 검사한다.

```ts
// apps/api/src/common/redact.ts (일부)
const RULES: [RegExp, string][] = [
	[/(\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:)[^\s@/]+@/gi, '$1***@'], // scheme://user:비밀번호@
	[/(\bBearer\s+)[A-Za-z0-9._~+/=-]+/g, '$1***'],
	[/((?<![\w-])(?:macfolio_[a-z_]+|session|token|state|code|key|api[_-]?key|secret|password)=)[^&;\s"']+/gi, '$1***'],
	// … JSON 항목, 키 접두사, 메일 주소
];
export const redact = (text: string) =>
	RULES.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
```

`(?<![\w-])`가 앞에서 말한 단어 경계 검사다(부정 후방 탐색[^lookbehind]). `statusCode=`의 `code=` 앞에는 `s`가 있으므로 일치하지 않는다. 규칙은 모두 8개이고 위에서부터 순서대로 적용한다. 형식을 아는 값만 마스킹하고, 그 밖의 값은 그대로 둔다. ==모든 값을 마스킹하면 로그로 원인을 분석할 수 없기== 때문이다.

![오류가 응답과 로그로 나가는 길](./images/error-log-masking-flow.svg '4xx는 그 상태 코드로 응답하고 로그를 기록하지 않는다. 500만 로그에 기록하며, 마스킹한 뒤 출력한다')

## 확인

| 시험 파일                                 | 종류 | 검증 내용                                                                                                                                                                                                                          |
| ----------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/common/redact.test.ts`      | 단위 | 마스킹 규칙 5개 묶음                                                                                                                                                                                                               |
| `apps/api/src/common/safe-logger.test.ts` | 단위 | 로거가 `process.stdout`에 출력하기 전에 마스킹하는지                                                                                                                                                                               |
| `apps/api/test/errors.e2e.test.ts`        | e2e  | 실제 서버에 요청해 404·413·400 응답 형식 확인. 글 목록 서비스를 "DB 주소와 메일 주소가 포함된 오류를 던지는 서비스"로 교체한 뒤, 500 응답 본문에 내부 정보가 없고 로그에는 `***`로 마스킹되어 기록되는지, 4xx는 로그가 없는지 확인 |

<details>
<summary>시험 이름 전체</summary>

`redact.test.ts`

- DB 주소의 비밀번호
- Authorization 헤더와 알려진 키 모양
- 쿠키·쿼리 값과 JSON 항목
- 메일 주소는 첫 글자와 도메인만
- Error는 메시지와 스택을, 객체는 JSON으로 바꿔 가린다. 나머지는 그대로

`errors.e2e.test.ts`

- 모든 오류 응답은 같은 모양이다
- 몸통이 너무 크면 500이 아니라 413 (JSON 100KB, 분석 이벤트 text 32KB)
- 깨진 JSON은 400
- 서버 안의 오류(DB 등)는 내용을 감춘 500으로 답하고, 로그에는 비밀 값을 가려서 남긴다

</details>

수정 전후 결과는 다음과 같다.

| 요청                    | 전  | 후      | 로그                  |
| ----------------------- | --- | ------- | --------------------- |
| 깨진 JSON               | 400 | 400     | 없음                  |
| 100KB를 넘는 JSON 본문  | 500 | **413** | 없음 (전: 스택 10줄)  |
| 32KB를 넘는 분석 이벤트 | 500 | **413** | 없음                  |
| 없는 경로·틀린 메서드   | 404 | 404     | 없음                  |
| DB 오류                 | 500 | 500     | 한 줄 + 마스킹된 오류 |

커밋은 파일 10개, +396/−12줄이다. 그중 시험 코드가 220줄(단위 106, e2e 114)이다.

## 적용하지 않은 것

요청마다 기록하는 접근 로그(access log)는 기존에도 없었고 이번에도 추가하지 않았다. ==기록하지 않는 것이 가장 확실한 마스킹이다.== 접근 기록이 필요하면 Cloudflare 쪽 기록을 조회한다.

## 남은 과제와 정리

- 마스킹은 형식을 아는 값에만 적용된다. 새 외부 서비스의 키에 고유 접두사가 없으면 마스킹되지 않는다. 키를 추가할 때 접두사 규칙도 함께 검토한다.
- 객체를 JSON으로 변환해 마스킹하므로, 순환 참조가 있는 객체는 변환에 실패해(`catch`) 마스킹 없이 그대로 출력한다. 현재 로그에 전달하는 값 중에는 순환 참조 객체가 없다.

"알 수 없는 예외는 500으로 숨긴다"는 안전한 기본값이지만, 그 범위에 클라이언트 오류인 4xx가 포함되어 있었다. 수정 전에 요청을 직접 보내 결과를 표로 정리하자 문제가 두 건으로 좁혀졌다. 로그 마스킹은 로그를 기록하는 곳마다가 아니라 출력 지점 하나에서 처리해야 누락이 없다.

## 직접 확인하기

글 앞부분과 같이 큰 본문을 직접 전송해 확인한다.

```bash
pnpm --filter @macfolio/api db:up && pnpm dev:api
python3 -c "print('{\"name\":\"' + 'a' * 200000 + '\"}')" > /tmp/big.json
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/contact \
  -H 'Content-Type: application/json' --data-binary @/tmp/big.json
# 413이어야 한다. 서버 로그에 스택이나 본문 내용이 남지 않아야 한다
```

시험으로 확인하는 명령은 다음과 같다.

```bash
pnpm --filter @macfolio/api test -- src/common/redact.test.ts src/common/safe-logger.test.ts
pnpm --filter @macfolio/api test:e2e test/errors.e2e.test.ts
```

배포된 서버의 로그는 `docker compose logs --tail=100 api`로 조회한다([docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '로그와 상태'). 예외 필터와 로거는 [NestJS Exception filters](https://docs.nestjs.com/exception-filters), [NestJS Logger](https://docs.nestjs.com/techniques/logger) 문서를 참고했다.

## 관련 글

- [GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs)
- [Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)
- [@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes)
- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-retrospective#7단계-보안)

<details>
<summary>참고 문헌</summary>

- NestJS 문서, [Exception filters](https://docs.nestjs.com/exception-filters), [Logger](https://docs.nestjs.com/techniques/logger)
- Express 문서, [body-parser](https://expressjs.com/en/resources/middleware/body-parser.html) (`limit` 기본값 `'100kb'`)
- npm, [http-errors](https://www.npmjs.com/package/http-errors) (`expose`, `status` 속성)
- RFC 9110, [HTTP Semantics, 15. Status Codes](https://www.rfc-editor.org/rfc/rfc9110#section-15)
- MDN, [413 Content Too Large](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/413)
- MDN, [Lookbehind assertion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Lookbehind_assertion)
- OWASP, [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

</details>

<details>
<summary>사진 출처</summary>

- NestJS 예외 필터의 위치: NestJS, [Exception filters](https://docs.nestjs.com/exception-filters) (원본 [Filter_1.png](https://docs.nestjs.com/assets/Filter_1.png)), [nestjs/docs.nestjs.com](https://github.com/nestjs/docs.nestjs.com) MIT 라이선스

</details>

[^rfc9110]: HTTP 상태 코드의 분류와 각 코드의 의미는 [RFC 9110의 15절](https://www.rfc-editor.org/rfc/rfc9110#section-15)이 정의한다. 413의 이름은 RFC 7231에서 "Payload Too Large"였고 RFC 9110에서 "Content Too Large"로 바뀌었다. NestJS의 `HttpStatus` 열거형은 예전 이름 `PAYLOAD_TOO_LARGE`를 사용한다.

[^lookbehind]: `(?<!X)`는 현재 위치 바로 앞에 X가 없을 때만 일치하는 정규식 문법. [MDN: Lookbehind assertion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Lookbehind_assertion)

#MacFolio #보안 #API #NestJS #로그
