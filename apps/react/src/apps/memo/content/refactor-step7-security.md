---
title: 리팩터링 7단계 — 보안
date: 2026-10-18
category: 개발기/MacFolio/인프라
summary: 리팩터링 7단계를 돌아본다. 사이트 헤더와 CSP, iframe sandbox, 쓰기 경로의 요청 제한, 의존성 취약점, 액션 고정과 비밀 값 스캔을 한 기준으로 맞췄다. 동작이 바뀌는 일이라 PR을 따로 내고 바뀌는 동작마다 시험을 붙였다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 7단계는 기능마다 따로 챙긴 보안 설정을 한 기준으로 맞추는 일이었다. 동작이 바뀔 수 있어서 리팩터링 PR과 섞지 않고 따로 냈고, 바뀌는 동작마다 시험을 더했다.

## 왜

API에는 helmet, `httpOnly`·`SameSite=Lax`·`Secure` 쿠키, 해시로 저장한 세션 토큰이 있었다. 하지만 사이트 응답에는 보안 헤더가 없었고, 프로젝트 iframe에 sandbox가 없었고, 요청 제한 방식이 세 갈래였고, 운영 의존성 취약점이 6건(high 3)이었고, Dependabot이 없었다.

빈틈은 구체적이었다.

- 프로젝트 앱의 iframe 안 페이지에서 `<a target="_top">` 링크를 누르면 MacFolio 창 전체가 그 주소로 바뀌었다.
- 글 쓰기, 폴더 정리, 설정, 파일 올리기, 분석 이벤트에는 1분 요청 제한이 없었다. 관리자 경로는 로그인이 필요하지만, 로그인 확인(`AdminGuard`)은 요청마다 DB에서 세션을 찾는다. 쿠키 없는 `POST /posts`를 초당 수백 번 보내면 모두 401로 끝나도 그만큼 DB 조회가 일어난다.
- `pnpm audit --prod`에서 prisma와 milkdown 아래 하위 의존성 취약점 6건이 나왔다.
- 워크플로의 액션은 `@v4` 같은 태그로 적혀 있었다. 태그는 옮길 수 있어서, 액션 저장소가 뚫리면 다음 실행부터 다른 코드가 돈다.

## 고른 방법과 버린 방법

| 문제               | 버린 방법                                      | 고른 방법                                                     |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------- |
| 사이트 헤더        | Cloudflare 대시보드의 Transform Rules에 손으로 | 빌드가 `dist/_headers`를 만든다. 출처 목록은 코드에서         |
| CSP 출처 목록      | `_headers`에 손으로 적기                       | `PROJECTS`와 `VITE_API_URL`에서 만들고, E2E가 같은 CSP로 돈다 |
| 요청 제한          | 전역 `ThrottlerGuard` 하나로 모든 경로         | 이름 일곱 개, 쓰기 경로마다 `@RateLimit('이름')` 하나         |
| 하위 의존성 취약점 | 상위 패키지가 고칠 때까지 기다리기             | `pnpm-workspace.yaml`의 `overrides`로 고친 버전을 강제        |
| 액션 버전          | 태그(`@v4`) 그대로                             | 커밋 SHA로 고정, 올리는 일은 Dependabot이 PR로                |

대시보드 설정은 저장소에 남지 않아, 무엇이 언제 바뀌었는지 기록이 없다. 전역 요청 제한 하나는 분석 이벤트(5초마다)와 댓글(도배 막기)처럼 성격이 다른 경로를 같은 횟수로 묶는다. 그래서 둘 다 버렸다.

동작이 바뀌는 일이라 리팩터링 PR과 섞지 않는다는 것이 이 단계의 규칙이었다. 거절되는 요청이 생기면 어느 PR 때문인지 바로 알 수 있어야 한다.

## 무엇을 바꿨나

**프론트엔드**

| 항목                       | PR   | 글                                                                               |
| -------------------------- | ---- | -------------------------------------------------------------------------------- |
| 보안 헤더와 CSP            | #156 | [사이트에 CSP와 보안 헤더 붙이기](/memo/security-headers)                        |
| iframe sandbox             | #157 | [프로젝트 앱의 iframe에 sandbox 걸기](/memo/iframe-sandbox)                      |
| HTML 넣는 곳·Markdown 링크 | #159 | [글과 README가 스크립트가 되지 않는다는 것을 시험으로](/memo/markdown-xss-tests) |

**API**

| 항목                             | PR   | 글                                                                      |
| -------------------------------- | ---- | ----------------------------------------------------------------------- |
| 경로 표와 `AdminGuard`, 400 검증 | #160 | [API 경로 64개를 표 하나로 고정하기](/memo/api-route-table-test)        |
| 요청 제한 한 방식                | #162 | [쓰기 경로 33개에 같은 방식으로 요청 제한](/memo/rate-limit-all-writes) |
| 업로드 EXIF 지우기               | #163 | [올린 사진의 EXIF를 지우되 방향은 남기기](/memo/upload-strip-exif)      |
| 오류 응답·로그 마스킹            | #167 | [오류 응답은 감추고, 로그는 가리고](/memo/error-log-masking)            |
| 미리보기 CORS                    | #182 | [PR 미리보기 주소에는 읽기만 열기](/memo/preview-cors-read-only)        |

**의존성과 CI, 서버**

| 항목                      | PR   | 글                                                                                   |
| ------------------------- | ---- | ------------------------------------------------------------------------------------ |
| 취약점 6건과 `pnpm audit` | #152 | [하위 의존성 취약점 6건을 overrides로](/memo/dependency-vulnerabilities)             |
| 액션 SHA 고정·Dependabot  | #169 | [액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게](/memo/pin-actions-dependabot) |
| 비밀 값 스캔              | #170 | [커밋에 비밀 값이 섞이지 않았는지 기록 전체를 훑기](/memo/secret-scanning)           |
| 서버 하드닝 점검          | #183 | [서버 하드닝은 문서가 아니라 스크립트로](/memo/server-hardening-audit)               |

![사이트, API, 서버, CI의 겹마다 붙인 보안 설정과 PR 번호](./images/refactor-step7-security-layers.svg '한 겹이 놓쳐도 다음 겹이 막도록 겹마다 따로 붙였다')

## 구현에서 짚을 것

### 요청 제한은 이름 하나

`@RateLimit('이름')`은 그 이름 하나만 세고 나머지 이름은 건너뛴다. 횟수는 IP마다, 경로마다 센다.

```ts
// apps/api/src/common/rate-limit.ts
export const RATE_LIMIT_NAMES = ['login', 'comment', 'like', 'write', 'upload', 'demo', 'events'] as const;

export function RateLimit(name: RateLimitName) {
	const skip = Object.fromEntries(RATE_LIMIT_NAMES.filter((other) => other !== name).map((other) => [other, true]));
	return applyDecorators(SetMetadata(RATE_LIMIT_KEY, name), SkipThrottle(skip), UseGuards(ThrottlerGuard));
}
```

관리자 경로에서는 `@UseGuards(AdminGuard)` **아래**에 적는다. 데코레이터는 아래부터 적용되므로, 그래야 요청 제한이 세션 조회보다 먼저 돈다. 이 순서는 경로 표 시험(`test/routes.e2e.test.ts`)이 확인한다.

![이름 일곱 개의 1분당 기본 횟수](./images/refactor-step7-security-limits.svg '성격이 다른 경로는 다른 이름으로 센다')

### iframe은 필요한 권한만

`sandbox`는 값 없이 쓰면 모든 권한을 막고, 값으로 필요한 것만 연다. 프로젝트 사이트가 돌아가는 데 필요한 스크립트·같은 출처·폼·새 탭은 열고, 맨 위 창을 옮기는 `allow-top-navigation`은 넣지 않았다(`shared/ui/web-frame/WebFrame.tsx`의 `FRAME_SANDBOX`).

시험을 짜다 알게 된 것이 있다. 처음에는 iframe 안에서 스크립트로 맨 위 창을 옮겨 봤는데, `sandbox`가 없어도 시험이 통과했다. Chrome은 사용자 클릭 없이 다른 출처의 iframe이 맨 위 창을 옮기는 것을 이미 막는다. 막히지 않는 것은 사용자가 `<a target="_top">`을 누른 경우였다. 시험을 이 경우로 바꾸자 `sandbox` 없이는 실패하고, 있으면 통과했다.

### 취약점은 overrides로

```yaml
# pnpm-workspace.yaml
overrides:
  # prisma > @prisma/config: 재귀 객체 병합 시 스택 소진 (high)
  deepmerge-ts: '^8.0.0'
  # milkdown > vue 컴파일러: 소스맵 해석 서비스 거부 (high)
  source-map-js: '^1.2.2'
```

줄마다 어느 패키지 아래에서 왜 올렸는지 적었다. 상위 패키지가 고친 버전을 내면 이 줄을 지운다. CI는 `pnpm audit --prod --audit-level=high`로 high 이상이 다시 생기면 실패한다.

## 전후

|                    | 전           | 후                                                                                    |
| ------------------ | ------------ | ------------------------------------------------------------------------------------- |
| 사이트 보안 헤더   | 없음         | CSP·`X-Content-Type-Options`·`Referrer-Policy`·`Permissions-Policy`·`frame-ancestors` |
| 프로젝트 iframe    | 제한 없음    | `sandbox`, 빠뜨리면 시험 실패                                                         |
| 요청 제한          | 세 갈래      | 이름 일곱 개, 쓰기 경로 33개에 `@RateLimit`                                           |
| 관리자 경로        | 시험 없음    | 경로 64개 표, 관리자 경로 29개가 로그인 없이 401                                      |
| 운영 의존성 취약점 | 6건 (high 3) | overrides로 고침, CI가 high 이상을 막음                                               |
| GitHub Actions     | 태그         | 9종 17곳을 커밋 SHA로                                                                 |
| 비밀 값            | 검사 없음    | 791커밋을 gitleaks로, PR·main·월요일마다                                              |

## 확인

- CSP: E2E가 배포와 같은 CSP를 켠 채로 돌고, 모든 시험에 붙는 fixture가 콘솔의 CSP 위반을 하나라도 보면 실패한다.
- sandbox: `e2e/project-apps.spec.ts`의 "안에 띄운 사이트의 링크가 이 사이트를 다른 주소로 바꾸지 못한다"가 가짜 사이트 안의 `target="_top"` 링크를 누른 뒤 MacFolio 주소가 그대로인지 본다.
- 경로: 경로 64개를 표 하나에 적고, 관리자 경로 29개가 로그인 없이 401인지, 쓰기 경로마다 요청 제한 이름이 있는지 본다. 그 뒤 경로가 늘어 지금 API 코드에는 `@RateLimit(`이 46곳 있다.
- 비밀 값: 791커밋·392MB를 gitleaks로 훑는 데 15초쯤 걸리고, 걸린 것은 Oracle 문서의 시험용 키 4건뿐이었다.

## 일부러 남긴 것

- `localStorage`의 값은 이미 휴지통의 '내 브라우저 데이터'가 전체 목록이고 민감한 값이 없어 코드를 바꾸지 않았다.
- 저장소 설정의 Secret scanning·Push protection과 Ruleset의 필수 검사는 손으로 켠다.
- 서버 하드닝은 문서 대신 읽기 전용 스크립트 `ops/audit.sh`로 남겼다.

그 뒤 같은 주제로 Semgrep과 SCA 도구로 다시 점검했다. 도구가 낸 7건 중 실제 취약점은 없었다([Semgrep과 SCA 도구로 MacFolio 점검하기](/memo/security-scan)).

## 배운 것

- **시험이 실패하는 것부터 본다.** sandbox 시험은 처음에 sandbox 없이도 통과했다. 막으려는 것이 무엇인지 정확히 하자 시험이 의미를 가졌다.
- **목록은 코드에서 만든다.** CSP 출처, 요청 제한 이름, 경로 표 모두 손으로 적는 문서 대신 코드에서 나오고 시험이 확인한다. 새 프로젝트나 새 경로를 더해도 빠뜨린 것이 시험에서 드러난다.
- **설정 화면에서 켜는 것은 따로 적어 둔다.** Secret scanning·Push protection·Ruleset은 코드로 할 수 없어, CONTRIBUTING.md에 버튼 위치까지 적었다.

관련 글: [사이트에 CSP와 보안 헤더 붙이기](/memo/security-headers) · [쓰기 경로 33개에 같은 방식으로 요청 제한](/memo/rate-limit-all-writes) · [서버 하드닝은 문서가 아니라 스크립트로](/memo/server-hardening-audit). PR: [#156](https://github.com/hyeoniverse/MacFolio/pull/156), [#162](https://github.com/hyeoniverse/MacFolio/pull/162), [#170](https://github.com/hyeoniverse/MacFolio/pull/170).

이전 단계: [6단계 — 서버](/memo/refactor-step6-server) · 전체 회고: [리팩터링 회고](/memo/refactor-retrospective)

#MacFolio #보안 #CSP #CI
