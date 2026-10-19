---
title: 오류 응답은 감추고, 로그는 가리고
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: 100KB를 넘는 요청 몸통이 413이 아니라 500으로 떨어지고 스택이 로그에 남았다. 전역 예외 필터가 Express 미들웨어의 오류를 알아보게 하고, 모든 로그가 거치는 로거에서 DB 비밀번호·API 키·쿠키·메일 주소를 가렸다. 4xx는 로그에 남기지 않는다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 둘, "오류 응답에 내부 정보가 나가지 않는지 시험 보강"과 "로그에 쿠키·토큰·메일 주소가 남지 않게 마스킹"을 한 번에 했다. 둘 다 같은 자리(전역 예외 필터와 로거)를 손보는 일이라서다.

## 먼저 직접 보내 봤다

시험을 쓰기 전에 지금 서버가 이상한 입력에 어떻게 답하는지 다섯 가지를 직접 보냈다.

| 보낸 것                       | 답      |
| ----------------------------- | ------- |
| 깨진 JSON (`{"name": `)       | 400     |
| 100KB를 넘는 JSON 몸통        | **500** |
| 32KB를 넘는 분석 이벤트(text) | **500** |
| 없는 경로                     | 404     |
| 있는 경로에 틀린 메서드       | 404     |

큰 몸통 두 건이 문제였다. 응답은 "서버에서 문제가 생겼습니다"였고, 로그에는 `PayloadTooLargeError`의 스택 열 줄이 ERROR로 찍혔다. 누군가 큰 요청을 계속 보내면 로그가 스택으로 가득 차고, 진짜 오류를 찾기 어려워진다.

## 용어

- **전역 예외 필터**: NestJS에서 처리 함수나 가드가 던진 오류를 받아 응답으로 바꾸는 마지막 자리. MacFolio는 `@Catch()`로 모든 오류를 받아 `{ statusCode, error, message, path, timestamp }` 한 모양으로 답한다
- **`HttpException`**: NestJS가 아는 오류. `NotFoundException`처럼 상태 코드와 설명을 들고 있어 그대로 내보낸다. 이것이 아니면 필터는 "모르는 오류"로 보고 500으로 감춘다
- **http-errors**: Express 미들웨어(body-parser 등)가 쓰는 오류 모양. `status`(413), `expose`(설명을 내보내도 되는지), `type`(`entity.too.large`)이 붙어 있다. NestJS의 `HttpException`이 아니라서 필터가 500으로 보냈던 것이다
- **마스킹**: 로그에 쓰기 전에 값의 일부를 `***`로 바꾸는 것. 지우는 것이 아니라 "무엇이 있었는지"는 남기고 "값"만 가린다

## 고를 수 있던 방법

| 방법                                                    | 좋은 점                      | 나쁜 점                                                            |
| ------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| body-parser 앞에 몸통 크기를 보는 미들웨어를 둔다       | 413을 직접 정한다            | 깨진 JSON(400) 같은 다른 미들웨어 오류는 그대로 500                |
| 필터에서 `PayloadTooLargeError` 이름만 골라낸다         | 한 줄                        | 다음에 다른 미들웨어 오류가 오면 또 500. 이름에 기대는 것이 약하다 |
| **필터가 http-errors 모양(`status`·`expose`)을 믿는다** | 미들웨어 오류 전체를 한 번에 | `expose`가 참인 4xx만 믿어야 한다(5xx는 감춘다)                    |

로그 쪽도 비슷하게 견줬다. 서비스마다 로그를 쓰기 전에 가리는 함수를 부르게 할 수도 있지만, 한 곳만 빠뜨려도 새어 나간다. 모든 로그가 지나가는 로거 하나를 바꾸는 편이 빠뜨릴 곳이 없다.

## 필터: http-errors도 알아본다

![오류 하나가 응답이 되기까지: HttpException이면 그대로, http-errors 4xx면 상태를 믿고, 나머지는 500으로 감추고 로그](./images/error-log-masking-filter.svg '로그는 500일 때만. 4xx는 방문자가 만든 것이라 남기지 않는다')

`HttpException`이 아니어도 `status`가 4xx이고 `expose`가 참이면 그 상태를 믿는다. 설명은 `type`에 따라 우리말로 바꾼다 (`entity.too.large` → "요청이 너무 큽니다.", `entity.parse.failed` → "요청 본문을 읽을 수 없습니다."). 5xx이거나 `expose`가 거짓이면 전처럼 500으로 감춘다. 그리고 로그는 **500일 때만** 남긴다. 404·413 같은 4xx는 방문자가 만든 것이지 서버의 문제가 아니라서다. 로그에는 `GET /posts → 500` 한 줄과 오류를 함께 남겨 어느 경로에서 났는지 보이게 했다.

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

우리말로 바꾸는 `type`은 여섯 가지다. `entity.too.large`, `entity.parse.failed`, `entity.verify.failed`, `encoding.unsupported`, `charset.unsupported`, `request.aborted`. 모르는 `type`이면 http-errors가 준 메시지를 쓴다. `expose`가 참이면 그 메시지는 밖에 보여도 되는 것이라는 뜻이다.

## 로거: 모든 로그가 한 곳을 거친다

NestJS의 `Logger`는 서비스마다 `new Logger(이름)`으로 만들지만, 실제 쓰기는 `app.useLogger()`로 건 하나가 맡는다. `ConsoleLogger`를 상속한 `SafeLogger`를 걸어 `log`·`warn`·`error` 등 여섯 메서드가 모두 인자를 가린 뒤 넘기게 했다. 서비스 코드는 한 줄도 바꾸지 않았다.

가리는 것은 모양이 정해진 값들이다.

| 무엇               | 전                                     | 후                               |
| ------------------ | -------------------------------------- | -------------------------------- |
| DB 주소의 비밀번호 | `postgresql://macfolio:s3cret@db/…`    | `postgresql://macfolio:***@db/…` |
| Authorization      | `Bearer re_abc…`                       | `Bearer ***`                     |
| 쿠키·쿼리 값       | `macfolio_session=abc; code=xyz`       | `macfolio_session=***; code=***` |
| 알려진 키 접두사   | `re_…`(Resend), `gsk_…`(Groq), `ghp_…` | `***`                            |
| 메일 주소          | `minsu@example.com`                    | `m***@example.com`               |

`Error` 객체는 메시지와 스택을 가린 복사본을 만들고, 객체는 JSON으로 바꿔 가린다. `statusCode=500`처럼 다른 단어 끝에 붙은 `code=`는 건드리지 않게 단어 경계를 봤다.

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

`(?<![\w-])`가 앞에서 말한 단어 경계다. `statusCode=`의 `code=` 앞에는 `s`가 붙어 있으니 걸리지 않는다. 규칙은 모두 여덟 개이고 위에서부터 차례로 적용한다. 원래 모양을 아는 값만 가리고, 모르는 것은 그대로 둔다. 무엇이든 가리면 로그가 쓸모없어지기 때문이다.

![오류가 응답과 로그로 나가는 길](./images/error-log-masking-flow.svg '4xx는 그 상태로 답하고 로그를 남기지 않는다. 500만 로그에 남고, 로그는 가린 뒤 쓴다')

## 확인

단위 시험 `redact.test.ts`는 가리기 규칙 다섯 묶음("DB 주소의 비밀번호", "Authorization 헤더와 알려진 키 모양", "쿠키·쿼리 값과 JSON 항목", "메일 주소는 첫 글자와 도메인만", "Error는 메시지와 스택을, 객체는 JSON으로 바꿔 가린다. 나머지는 그대로")을, `safe-logger.test.ts`는 로거가 `process.stdout`에 쓰기 전에 가리는지를 본다. e2e는 실제 서버에 요청을 보내서 404·413·400의 모양을 보고, 글 목록 서비스를 "DB 주소와 메일 주소가 든 오류를 던지는 것"으로 바꿔 끼운 뒤 500 응답에는 아무 내용이 없고 로그에는 `***`로 가려져 남는지, 4xx에는 로그가 없는지 본다. `apps/api/test/errors.e2e.test.ts`의 네 시험이다. "모든 오류 응답은 같은 모양이다", "몸통이 너무 크면 500이 아니라 413 (JSON 100KB, 분석 이벤트 text 32KB)", "깨진 JSON은 400", "서버 안의 오류(DB 등)는 내용을 감춘 500으로 답하고, 로그에는 비밀 값을 가려서 남긴다".

| 보낸 것                 | 전  | 후      | 로그                  |
| ----------------------- | --- | ------- | --------------------- |
| 깨진 JSON               | 400 | 400     | 없음                  |
| 100KB를 넘는 JSON 몸통  | 500 | **413** | 없음 (전: 스택 열 줄) |
| 32KB를 넘는 분석 이벤트 | 500 | **413** | 없음                  |
| 없는 경로·틀린 메서드   | 404 | 404     | 없음                  |
| DB 오류                 | 500 | 500     | 한 줄 + 가린 오류     |

커밋은 파일 10개, +396/−12다. 그중 시험이 220줄(단위 106, e2e 114)이다.

## 안 한 것

요청마다 남기는 접근 로그는 원래 없고 이번에도 더하지 않았다. 남기지 않는 것이 가장 확실한 마스킹이다. Cloudflare Tunnel 쪽에 접근 기록이 있어 필요하면 그쪽을 본다.

## 남은 것과 배운 것

- 가리기는 모양을 아는 값에만 듣는다. 새 외부 서비스의 키가 접두사 없는 모양이면 걸리지 않는다. 키를 더할 때 접두사 규칙도 함께 본다.
- 객체를 JSON으로 바꿔 가리므로, 순환 참조가 있는 객체는 가리지 못하고 그대로 넘긴다(`catch`). 지금 로그에 넘기는 값에는 그런 것이 없다.

배운 것: "처음 보는 오류는 500으로 감춘다"는 안전한 기본값이지만, 그 "처음 보는" 안에 방문자 탓인 4xx가 섞여 있었다. 감추기 전에 먼저 요청을 보내 보고 표로 만들자 문제가 두 줄로 좁혀졌다. 그리고 로그 마스킹은 쓰는 곳마다가 아니라 나가는 곳 하나에서 해야 빠뜨리지 않는다.

## 직접 확인하기

이 글의 시작처럼 큰 몸통을 직접 보내 본다.

```bash
pnpm --filter @macfolio/api db:up && pnpm dev:api
python3 -c "print('{\"name\":\"' + 'a' * 200000 + '\"}')" > /tmp/big.json
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/contact \
  -H 'Content-Type: application/json' --data-binary @/tmp/big.json
# 413이어야 한다. 서버 로그에 스택이나 몸통 내용이 남지 않아야 한다
```

시험으로는 이렇게 본다.

```bash
pnpm --filter @macfolio/api test -- src/common/redact.test.ts src/common/safe-logger.test.ts
pnpm --filter @macfolio/api test:e2e test/errors.e2e.test.ts
```

배포된 서버의 로그는 `docker compose logs --tail=100 api`로 본다([docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '로그와 상태'). 예외 필터와 로거는 [NestJS Exception filters](https://docs.nestjs.com/exception-filters), [NestJS Logger](https://docs.nestjs.com/techniques/logger) 문서를 봤다.

관련 글: [서버 가동 시간과 로그](/memo/server-uptime-and-logs), [API 서버를 무료로 띄우기](/memo/deploy-api-oracle-tunnel).

#MacFolio #보안 #API #NestJS #로그
