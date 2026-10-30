---
title: CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기
date: 2026-10-18
category: 개발 기록/MacFolio/품질
series: 리팩터링
seriesOrder: 7
summary: 리팩터링 7단계를 정리한다. 사이트 헤더와 CSP, iframe sandbox, 쓰기 경로의 요청 제한, 의존성 취약점, 액션 고정과 비밀 값 검사를 하나의 기준으로 통일했다. 동작이 바뀌는 작업이라 PR을 분리하고 바뀌는 동작마다 시험을 추가했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 7단계는 기능마다 개별로 관리하던 보안 설정을 하나의 기준으로 통일하는 작업이었다. 동작이 바뀔 수 있으므로 리팩터링 PR과 분리해 별도 PR로 진행했고, 바뀌는 동작마다 시험을 추가했다.

## 배경

API에는 helmet, `httpOnly`·`SameSite=Lax`·`Secure` 쿠키, 해시로 저장한 세션 토큰이 이미 적용되어 있었다. 하지만 사이트 응답에는 보안 헤더가 없었고, 프로젝트 iframe에 sandbox가 없었고, 요청 제한 방식이 세 가지로 나뉘어 있었고, 운영 의존성 취약점이 6건(high 3)이었고, Dependabot이 없었다.

구체적인 취약 지점은 다음과 같았다.

- 프로젝트 앱의 iframe 안 페이지에서 `<a target="_top">` 링크를 클릭하면 MacFolio 창 전체가 그 주소로 이동했다.
- 글 작성, 폴더 정리, 설정, 파일 업로드, 분석 이벤트에는 1분 요청 제한이 없었다. 관리자 경로는 로그인이 필요하지만, 로그인 확인(`AdminGuard`)은 요청마다 DB에서 세션을 조회한다. 쿠키 없는 `POST /posts`를 초당 수백 회 보내면 모두 401로 끝나도 그 횟수만큼 DB 조회가 발생한다.
- `pnpm audit --prod`에서 prisma·milkdown·Scalar의 하위 의존성 취약점 6건이 검출되었다.
- 워크플로의 액션은 `@v4` 같은 태그로 지정되어 있었다. 태그는 다른 커밋으로 옮길 수 있으므로, 액션 저장소가 침해되면 다음 실행부터 다른 코드가 실행된다.

## 검토한 방법

| 문제               | 제외한 방법                                       | 선택한 방법                                                     |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------------- |
| 사이트 헤더        | Cloudflare 대시보드의 Transform Rules에 수동 입력 | 빌드가 `dist/_headers`를 생성한다. 출처 목록은 코드에서 생성    |
| CSP 출처 목록      | `_headers`에 수동 기록                            | `PROJECTS`와 `VITE_API_URL`에서 생성하고, E2E가 같은 CSP로 실행 |
| 요청 제한          | 전역 `ThrottlerGuard` 하나로 모든 경로            | 이름 7개, 쓰기 경로마다 `@RateLimit('이름')` 하나               |
| 하위 의존성 취약점 | 상위 패키지의 수정을 기다리기                     | `pnpm-workspace.yaml`의 `overrides`로 수정 버전을 강제          |
| 액션 버전          | 태그(`@v4`) 유지                                  | 커밋 SHA로 고정, 업데이트는 Dependabot이 PR로 제안              |

대시보드 설정은 저장소에 기록되지 않아 변경 내용과 시각을 추적할 수 없다. 전역 요청 제한 하나는 분석 이벤트(5초마다 전송)와 댓글(도배 차단)처럼 성격이 다른 경로에 같은 횟수를 적용한다. 그래서 두 방법을 제외했다.

동작이 바뀌는 작업은 리팩터링 PR과 분리한다는 것이 이 단계의 규칙이었다. 거부되는 요청이 생기면 원인 PR을 즉시 특정할 수 있어야 하기 때문이다.

## 변경 내용

**프론트엔드**

| 항목                       | PR                                                       | 글                                                                                           |
| -------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 보안 헤더와 CSP            | [#156](https://github.com/hyeoniverse/MacFolio/pull/156) | [CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers)          |
| iframe sandbox             | [#157](https://github.com/hyeoniverse/MacFolio/pull/157) | [iframe sandbox에서 allow-top-navigation을 빼 최상위 창 이동 막기](/memo/iframe-sandbox)     |
| HTML 넣는 곳·Markdown 링크 | [#159](https://github.com/hyeoniverse/MacFolio/pull/159) | [react-markdown 렌더링 경로마다 XSS 차단 설정을 시험으로 고정하기](/memo/markdown-xss-tests) |

**API**

| 항목                             | PR                                                       | 글                                                                                                      |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 경로 표와 `AdminGuard`, 400 검증 | [#160](https://github.com/hyeoniverse/MacFolio/pull/160) | [Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험](/memo/api-route-table-test)        |
| 요청 제한 한 방식                | [#162](https://github.com/hyeoniverse/MacFolio/pull/162) | [@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes) |
| 업로드 EXIF 지우기               | [#163](https://github.com/hyeoniverse/MacFolio/pull/163) | [JPEG·PNG·WebP 세그먼트를 순회해 EXIF를 지우고 방향 값만 남기기](/memo/upload-strip-exif)               |
| 오류 응답·로그 마스킹            | [#167](https://github.com/hyeoniverse/MacFolio/pull/167) | [모든 로그가 거치는 ConsoleLogger에서 비밀 값 마스킹하기](/memo/error-log-masking)                      |
| 미리보기 CORS                    | [#182](https://github.com/hyeoniverse/MacFolio/pull/182) | [PR 미리보기 주소에는 읽기만 열기](/memo/preview-cors-read-only)                                        |

**의존성과 CI, 서버**

| 항목                      | PR                                                       | 글                                                                                                      |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 취약점 6건과 `pnpm audit` | [#152](https://github.com/hyeoniverse/MacFolio/pull/152) | [pnpm overrides로 하위 의존성 취약점 고치고 pnpm audit로 CI에서 막기](/memo/dependency-vulnerabilities) |
| 액션 SHA 고정·Dependabot  | [#169](https://github.com/hyeoniverse/MacFolio/pull/169) | [GitHub Actions를 커밋 SHA로 고정하고 Dependabot으로 업데이트 받기](/memo/pin-actions-dependabot)       |
| 비밀 값 스캔              | [#170](https://github.com/hyeoniverse/MacFolio/pull/170) | [gitleaks 사용자 규칙과 CI 작업으로 저장소 기록 전체의 비밀 값 검사하기](/memo/secret-scanning)         |
| 서버 하드닝 점검          | [#183](https://github.com/hyeoniverse/MacFolio/pull/183) | [서버 하드닝 규칙을 문서 대신 audit.sh 점검 스크립트로 남기기](/memo/server-hardening-audit)            |

![사이트, API, 서버, CI의 계층마다 적용한 보안 설정과 PR 번호](./images/refactor-step7-security-layers.svg '한 계층이 놓쳐도 다음 계층이 차단하도록 계층마다 별도로 적용했다')

## 구현 세부 사항

### 요청 제한은 이름 하나로 지정

`@RateLimit('이름')`은 지정한 이름 하나만 집계하고 나머지 이름은 제외한다. 횟수는 IP별, 경로별로 집계한다.

```ts
// apps/api/src/common/rate-limit.ts
export const RATE_LIMIT_NAMES = ['login', 'comment', 'like', 'write', 'upload', 'demo', 'events'] as const;

export function RateLimit(name: RateLimitName) {
	const skip = Object.fromEntries(RATE_LIMIT_NAMES.filter((other) => other !== name).map((other) => [other, true]));
	return applyDecorators(SetMetadata(RATE_LIMIT_KEY, name), SkipThrottle(skip), UseGuards(ThrottlerGuard));
}
```

관리자 경로에서는 `@UseGuards(AdminGuard)` **아래**에 적는다. 데코레이터는 아래부터 적용되므로, 이 위치여야 요청 제한이 세션 조회보다 먼저 실행된다. 이 순서는 경로 표 시험(`test/routes.e2e.test.ts`)이 검사한다.

![이름 7개의 1분당 기본 횟수](./images/refactor-step7-security-limits.svg '성격이 다른 경로는 다른 이름으로 집계한다')

### iframe은 필요한 권한만 허용

`sandbox`는 값 없이 지정하면 모든 권한을 차단하고, 값으로 필요한 권한만 허용한다. 프로젝트 사이트 실행에 필요한 스크립트·같은 출처·폼·새 탭은 허용하고, 최상위 창을 이동시키는 `allow-top-navigation`은 제외했다(`shared/ui/web-frame/WebFrame.tsx`의 `FRAME_SANDBOX`).

시험 작성 중에 확인한 사실이 있다. 처음에는 iframe 안의 스크립트로 최상위 창을 이동시켰는데, `sandbox`가 없어도 시험이 통과했다. Chrome은 사용자 클릭 없이 다른 출처의 iframe이 최상위 창을 이동시키는 것을 기본으로 차단한다. 차단되지 않는 경우는 사용자가 `<a target="_top">`을 클릭한 경우였다. 시험을 이 경우로 바꾸자 `sandbox`가 없으면 실패하고, 있으면 통과했다.

### 취약점은 overrides로 수정

```yaml
# pnpm-workspace.yaml
overrides:
  # prisma > @prisma/config: 재귀 객체 병합 시 스택 소진 (high)
  deepmerge-ts: '^8.0.0'
  # milkdown > vue 컴파일러: 소스맵 해석 서비스 거부 (high)
  source-map-js: '^1.2.2'
```

줄마다 어느 상위 패키지 때문에 업데이트했는지 주석으로 기록했다. 상위 패키지가 수정 버전을 의존하게 되면 이 줄을 삭제한다. CI는 `pnpm audit --prod --audit-level=high`로 high 이상 취약점이 다시 생기면 실패한다.

## 전후

|                    | 전           | 후                                                                                    |
| ------------------ | ------------ | ------------------------------------------------------------------------------------- |
| 사이트 보안 헤더   | 없음         | CSP·`X-Content-Type-Options`·`Referrer-Policy`·`Permissions-Policy`·`frame-ancestors` |
| 프로젝트 iframe    | 제한 없음    | `sandbox`, 누락하면 시험 실패                                                         |
| 요청 제한          | 세 가지 방식 | 이름 7개, 쓰기 경로 33개에 `@RateLimit`                                               |
| 관리자 경로        | 시험 없음    | 경로 64개 표, 관리자 경로 29개가 로그인 없이 401                                      |
| 운영 의존성 취약점 | 6건 (high 3) | overrides로 수정, CI가 high 이상을 차단                                               |
| GitHub Actions     | 태그         | 9종 17곳을 커밋 SHA로                                                                 |
| 비밀 값            | 검사 없음    | 커밋 791개를 gitleaks로 검사, PR·main·매주 월요일 실행                                |

## 확인

- CSP: E2E가 배포와 같은 CSP를 적용한 상태로 실행되고, 모든 시험에 적용되는 fixture가 콘솔에서 CSP 위반을 하나라도 감지하면 실패한다.
- sandbox: `e2e/project-apps.spec.ts`의 "안에 띄운 사이트의 링크가 이 사이트를 다른 주소로 바꾸지 못한다"가 가짜 사이트 안의 `target="_top"` 링크를 클릭한 뒤 MacFolio 주소가 유지되는지 확인한다.
- 경로: 경로 64개를 표 하나에 기록하고, 관리자 경로 29개가 로그인 없이 401을 반환하는지, 쓰기 경로마다 요청 제한 이름이 있는지 확인한다. 이후 경로가 늘어 현재 API 코드에는 `@RateLimit(`이 46곳 있다.
- 비밀 값: 커밋 791개·392MB를 gitleaks로 검사하는 데 약 15초가 걸렸고, 검출된 항목은 Oracle 문서의 시험용 키 4건뿐이었다.

## 직접 확인하는 방법

```bash
# 사이트 헤더: 미리보기 서버에 붙는지
cd apps/react && pnpm build && npx vite preview --port 4173 &
curl -sI http://localhost:4173/ | grep -iE 'content-security-policy|x-frame-options|referrer-policy'

# 프로젝트 앱 iframe sandbox
npx playwright test e2e/project-apps.spec.ts

# 서버 하드닝 (서버에서)
~/macfolio/ops/audit.sh      # 모두 OK
```

각 항목의 상세 내용은 [CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers), [서버 하드닝 규칙을 문서 대신 audit.sh 점검 스크립트로 남기기](/memo/server-hardening-audit), [@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes)에 있다. 코드: [apps/react/worker/securityHeaders.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/worker/securityHeaders.ts), [apps/react/src/shared/ui/web-frame/WebFrame.tsx](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/shared/ui/web-frame/WebFrame.tsx), [ops/audit.sh](https://github.com/hyeoniverse/MacFolio/blob/main/ops/audit.sh).

참고 문서: [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP), [MDN iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox).

## 의도적으로 적용하지 않은 것

- `localStorage`의 값은 휴지통의 '내 브라우저 데이터'에 전체 목록이 이미 표시되고 민감한 값이 없어 코드를 변경하지 않았다.
- 저장소 설정의 Secret scanning·Push protection과 Ruleset의 필수 검사는 수동으로 활성화한다.
- 서버 하드닝은 문서 대신 읽기 전용 스크립트 `ops/audit.sh`로 기록했다.

이후 같은 주제로 Semgrep과 SCA 도구를 사용해 다시 점검했다. 도구가 보고한 7건 중 실제 취약점은 없었다([Semgrep·pnpm audit·osv-scanner로 코드와 의존성 취약점 점검하기](/memo/security-scan)).

## 정리

- **시험이 실패하는 상태부터 확인한다.** sandbox 시험은 처음에 sandbox 없이도 통과했다. 차단 대상을 정확히 정의하자 시험이 실제로 검증하게 되었다.
- **목록은 코드에서 생성한다.** CSP 출처, 요청 제한 이름, 경로 표 모두 수동 문서 대신 코드에서 생성하고 시험이 검증한다. 새 프로젝트나 경로를 추가해도 누락이 시험에서 드러난다.
- **설정 화면에서 활성화하는 항목은 별도로 기록한다.** Secret scanning·Push protection·Ruleset은 코드로 설정할 수 없으므로, CONTRIBUTING.md에 버튼 위치까지 기록했다.

## 관련 글

- [CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers)
- [@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes)
- [서버 하드닝 규칙을 문서 대신 audit.sh 점검 스크립트로 남기기](/memo/server-hardening-audit)
- [Semgrep·pnpm audit·osv-scanner로 코드와 의존성 취약점 점검하기](/memo/security-scan)

- 이전 단계: [책임별 서비스 분리와 공유 zod 스키마로 정리한 서버 코드](/memo/refactor-step6-server)
- 전체 회고: [리팩터링 계획을 마치며 — 일곱 단계 전후](/memo/refactor-retrospective)

#MacFolio #보안 #CSP #CI
