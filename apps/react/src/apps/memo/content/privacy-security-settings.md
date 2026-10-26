---
title: 시스템 설정에서 사람 확인을 켜고 끄기
date: 2026-10-10
category: 개발 기록/MacFolio/서버
summary: 메일에만 있던 Cloudflare Turnstile 사람 확인을 댓글·메시지에도 걸 수 있게 하고, macOS '개인정보 보호 및 보안' 모양 화면에서 관리자가 곳마다 켜고 끄게 했다. 설정은 서버 DB의 한 행짜리 테이블에 저장하고, 확인은 requireHuman 함수 하나로 통합했다.
---

메일 앱의 연락 메일에는 Cloudflare Turnstile[^turnstile]로 사람인지 확인하는 단계가 있었다. 댓글과 메시지에는 IP마다 1분당 요청 횟수를 제한하는 장치만 있었다. 사이트가 Cloudflare 프록시를 거쳐도, 스크립트가 API에 직접 보내는 정상 형식의 요청은 프록시가 차단하지 않는다. 이 요청을 차단하는 수단이 사람 확인이다.

다만 처음부터 모든 쓰기 경로에 적용하면 댓글을 작성할 때마다 확인 단계가 하나 추가된다. 그래서 적용 위치를 **설정으로 켜고 끄도록** 했다. 스팸이 들어오는 경로에만 켜면 된다([#168](https://github.com/hyeoniverse/MacFolio/pull/168)).

설정을 저장할 위치는 세 가지를 비교했다.

| 방법                                                | 좋은 점                                               | 문제                                                                     |
| --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| 모든 곳에 항상 적용한다                             | 설정이 필요 없다                                      | 스팸이 없을 때도 방문자가 매번 확인을 기다린다                           |
| 서버 환경 변수로 켜고 끈다                          | 코드가 짧다                                           | 바꿀 때마다 서버를 재시작해야 한다. 방문자는 현재 적용 위치를 알 수 없다 |
| DB 한 행에 저장하고 관리자가 화면에서 바꾼다 (선택) | 즉시 적용되고, 방문자도 같은 화면에서 상태를 확인한다 | 테이블·API·화면이 하나씩 추가된다                                        |

## 설정 화면

macOS 시스템 설정의 **개인정보 보호 및 보안** 화면을 재현했다.

| 영역                                 | 표시 내용                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| 상단 칸                              | 손 아이콘과 설명, **더 알아보기…** (Finder에서 개인정보 처리 방침을 연다)                 |
| **사람 확인 (Cloudflare Turnstile)** | 메일·댓글·메시지별 색 아이콘, 확인 시점, 켜기 스위치                                      |
| **이 브라우저**                      | 이 브라우저가 방문 분석 집계 대상인지 (Global Privacy Control[^gpc]이나 로컬 주소면 제외) |

![개인정보 보호 및 보안](./images/privacy-security-settings-pane.jpg '방문자에게 보이는 화면. 서버 기본값(메일만 켜짐)과 같은 가짜 응답으로 표시했다. 스위치는 관리자만 조작한다')

사이트 전체에 적용되는 설정이므로 스위치는 **관리자만** 조작한다. 방문자에게는 같은 화면이 비활성화된 스위치로 표시되어, 현재 어느 경로에 사람 확인이 켜져 있는지 확인할 수 있다. 서버에 Turnstile 키가 없으면 "켜도 확인하지 않는다"는 안내를 표시한다.

## 서버

설정은 행이 하나뿐인 테이블(`id = 1`)에 저장한다.

```prisma
model SecuritySetting {
  id           Int     @id @default(1)
  contactHuman Boolean @default(true)
  commentHuman Boolean @default(false)
  messageHuman Boolean @default(false)
}
```

행이 없으면 기본값(메일만 켜짐)을 사용한다. 메일은 사이트 밖으로 발송되므로 처음부터 켜 둔다.

| 요청            | 권한   | 동작                                                   |
| --------------- | ------ | ------------------------------------------------------ |
| `GET /security` | 누구나 | 경로별 켜짐 여부, 키 설정 여부(`available`), 사이트 키 |
| `PUT /security` | 관리자 | `{ comment: true }`처럼 바꿀 경로만 전송               |

쓰기 요청마다 DB를 조회하지 않도록 설정은 메모리에 캐시하고(`SecurityService.cache`), 관리자가 값을 바꾸면 캐시를 비워 다음 요청에서 다시 조회한다.

확인은 `SecurityService.requireHuman(경로, 토큰, IP, 관리자)` 하나로 처리한다. 메일·댓글·메시지(새 피드백과 답글)의 서비스가 입력 검사 뒤에 호출한다.

```ts
async requireHuman(check: HumanCheck, token: string | undefined, ip: string, admin: AdminIdentity | null = null) {
	if (admin) return;
	const keys = this.keys;
	if (!keys) return;
	const { settings } = await this.load();
	if (!settings[check]) return;
	if (!(await verifyTurnstile(keys.secret, token, ip)))
		throw new BadRequestException('사람인지 확인하지 못했습니다. 다시 시도해 주세요.');
}
```

입력 검사 뒤에 호출하므로, 내용이 비었거나 너무 긴 요청은 Cloudflare에 조회하지 않고 400으로 종료된다.

| 조건                     | 결과                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| 관리자 세션              | 확인 없이 통과                                                   |
| 서버에 Turnstile 키 없음 | 확인 없이 통과                                                   |
| 해당 경로 설정이 꺼짐    | 확인 없이 통과                                                   |
| 위 셋이 아님             | 토큰을 Cloudflare `siteverify`[^siteverify]로 검증, 실패하면 400 |

![쓰기 요청이 입력 검사 뒤 requireHuman에서 관리자, 꺼짐, 키 없음이면 통과하고 아니면 siteverify에 묻는 흐름](./images/privacy-security-settings-flow.svg '설정 한 행을 메모리에 캐시하고, 쓰기 요청마다 세 조건을 검사한 뒤 Cloudflare에 조회한다')

메일 서비스 안에 있던 Turnstile 검증 코드는 `common/turnstile.ts`로 분리해 세 서비스가 공유한다. 메일의 `GET /contact`도 이 설정을 따른다. 메일의 사람 확인을 끄면 응답에 사이트 키를 넣지 않으므로, 화면에 위젯이 렌더링되지 않는다.

## 화면

메일 앱에 있던 Turnstile 위젯을 `shared/ui/turnstile`로 옮겼다. 각 화면은 `useHumanCheck('comment')` 훅 하나로 다음 값을 받는다.

| 반환값    | 의미                                                                     |
| --------- | ------------------------------------------------------------------------ |
| 사이트 키 | 위젯에 전달할 키. 확인이 필요 없으면 `null` (꺼짐, 서버 키 없음, 관리자) |
| 토큰      | 위젯이 발급한 토큰                                                       |
| `ready`   | 전송 가능 여부                                                           |
| `reset()` | 토큰은 한 번만 쓸 수 있으므로 전송 뒤 새 토큰을 발급받는다               |

위젯은 댓글에서는 입력 칸 아래, 메시지에서는 알약 모양 입력창 위에 표시된다. 확인이 끝나기 전에 전송하면 "사람인지 확인하는 칸이 끝날 때까지 기다려 주세요"라는 안내를 표시한다. 메시지를 서버 없이 브라우저 저장소에만 보관하는 모드(`VITE_MESSAGES_STORE=local`)에서는 확인하지 않는다.

## 시험에서 발견한 가짜 위젯의 순서 오류

E2E에서는 외부 Turnstile 스크립트 대신 가짜 스크립트를 사용한다. 이 가짜가 실제 위젯과 다른 순서로 동작해 시험이 두 번 실패했다.

| 증상                                    | 원인                                                                            | 수정                               |
| --------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| 첫 댓글 전송이 "기다려 주세요"로 차단됨 | 가짜가 렌더링 즉시 '사람 확인 완료'를 표시하고, 토큰은 50ms 뒤에 전달했다       | 토큰을 전달한 **뒤에** 글자를 표시 |
| 두 번째 댓글도 같은 증상                | 새 토큰을 받으려고 위젯을 다시 렌더링해도 이전 위젯의 '사람 확인 완료'가 남았다 | 가짜의 `remove()`가 글자를 삭제    |

두 경우 모두 앱은 토큰이 없는 전송을 정상적으로 차단했고, 시험은 가짜가 표시한 글자만 보고 전송했다. 수정 뒤 6회 반복 실행해 36건 모두 통과했다.

## 시험

기능 커밋(`971bd125f`)은 34개 파일을 수정했다. 서버에 `security/` 폴더가 추가됐고, 메일 서비스의 Turnstile 코드 35줄이 `common/turnstile.ts`(27줄)로 이동했다. 변경량은 시험이 가장 크다. API 통합 시험 `security.e2e.test.ts`가 190줄, 화면 E2E `privacy.spec.ts`가 120줄이다.

<details>
<summary>시험 항목 전체</summary>

- 단위: 설정 입력(켜고 끌 곳만, true/false만, 빈 몸통 거절)
- API e2e: 처음에는 메일만 켜짐, 방문자는 401, 잘못된 값 400 / 댓글에 켜면 토큰이 없거나 사람이 아니면 400, 사람이면 쓰고, 관리자는 확인하지 않음, 끄면 다시 확인 없이 통과 / 메시지의 새 피드백과 답글 / 메일을 끄면 사이트 키를 주지 않음 / 키가 없으면 켜도 확인하지 않음
- 경로 표: `GET /security`(공개), `PUT /security`(관리자)
- E2E: 방문자에게는 꺼진 스위치와 안내, 더 알아보기는 개인정보 처리 방침 / 관리자가 켜고 끄면 서버에 저장 / 키가 없을 때 안내 / 댓글·메시지에 켜면 위젯이 생기고 토큰과 함께 보냄(댓글마다 새 토큰) / 꺼져 있으면 위젯이 없음

</details>

API 시험 이름은 "처음에는 메일만 확인한다. 누구나 읽고, 바꾸기는 관리자만", "댓글: 켜면 토큰이 없거나 사람이 아니면 400, 사람이면 쓴다. 관리자는 확인하지 않는다. 끄면 다시 그냥", "메일: 끄면 사이트 키를 주지 않고, 토큰 없이도 사람 확인을 건너뛴다"처럼 위 항목과 일대일로 대응한다.

## 남은 과제와 정리

- 서버에 Turnstile 키가 없으면 켜 두어도 확인하지 않는다. 쓰기는 차단되지 않지만 사람 확인도 없는 상태이므로, 관리자는 화면의 "켜도 확인하지 않는다" 안내를 확인해야 한다.
- 설정은 메모리에 캐시하고 관리자가 바꿀 때만 다시 조회한다. API 서버가 한 대이기 때문에 가능한 방식이다. 서버가 여러 대가 되면 변경을 처리하지 않은 서버의 캐시는 갱신되지 않는다.
- 시험용 가짜 스크립트도 실제 위젯과 같은 순서(토큰 전달 → 완료 표시)로 동작해야 시험 결과를 신뢰할 수 있다. 순서가 다르면 앱이 정상적으로 차단해도 시험이 실패한다.
- 쓰기를 제한하는 장치는 사람 확인 외에 요청 제한이 있고, 두 장치를 함께 적용한다([쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)).

## 적용 방법

1. Cloudflare 대시보드 → Turnstile에서 위젯을 생성하고 사이트 도메인을 입력한다. 사이트 키와 비밀 키가 발급된다
2. 서버 `~/deploy/api.env`에 `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`를 추가하고 `docker compose up -d api`로 재시작한다
3. 관리자로 로그인해 시스템 설정 → 개인정보 보호 및 보안에서 메일·댓글·메시지별로 켠다

확인은 로그아웃한 창에서 댓글을 작성해 본다. 입력 칸 아래에 사람 확인 위젯이 표시되고, 확인이 끝나기 전에 전송하면 대기 안내가 나와야 한다. 되돌리려면 설정에서 끄거나, 두 키를 비워 서버가 확인 자체를 건너뛰게 한다. 서버 쪽은 [apps/api/src/common/turnstile.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/common/turnstile.ts), 시험은 `cd apps/react && npx playwright test e2e/privacy.spec.ts`와 [apps/api/test/security.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/security.e2e.test.ts). 수집하는 정보는 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)에 있다.

참고 문서: [Cloudflare Turnstile 시작하기](https://developers.cloudflare.com/turnstile/get-started/), [서버 쪽 검증](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Prisma 모델 정의](https://www.prisma.io/docs/orm/prisma-schema/data-model/models).

## 관련 글

- [쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)
- [댓글에 남기지 않은 것들](/memo/post-comments)
- [서버가 없으면 메시지 앱을 열지 않기](/memo/messages-offline)

[^turnstile]: Cloudflare가 제공하는 CAPTCHA 대체 서비스. 방문자 브라우저에서 위젯이 토큰을 발급하고, 서버가 그 토큰을 Cloudflare에 보내 사람인지 검증한다.

[^gpc]: 브라우저가 "내 정보를 판매·공유하지 말라"는 의사를 사이트에 전달하는 신호. `navigator.globalPrivacyControl`로 확인한다([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl)).

[^siteverify]: Turnstile 토큰을 검증하는 Cloudflare API 주소 `https://challenges.cloudflare.com/turnstile/v0/siteverify`. 토큰과 비밀 키를 보내면 성공 여부를 반환한다.

#MacFolio #백엔드 #보안 #Cloudflare #개인정보
