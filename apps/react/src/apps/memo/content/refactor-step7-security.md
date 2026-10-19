---
title: 리팩터링 7단계 — 보안
date: 2026-10-18
category: 개발기/MacFolio/인프라
summary: 리팩터링 계획 7단계를 돌아본다. 사이트에 CSP를 붙이고 iframe에 sandbox를 걸고, 요청 제한을 한 방식으로, 관리자 경로를 표로 고정했다. 의존성 취약점 6건을 고치고 액션 고정·Dependabot·비밀 값 스캔을 CI에 넣었다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 7단계는 기능마다 따로 챙긴 보안 설정을 한 기준으로 맞추는 일이었다. 동작이 바뀔 수 있어서 리팩터링 PR과 섞지 않고 따로 냈고, 바뀌는 동작마다 시험을 더했다.

## 왜

API에는 helmet, `httpOnly`·`SameSite=Lax`·`Secure` 쿠키, 해시로 저장한 세션 토큰이 있었다. 하지만 사이트 응답에는 보안 헤더가 없었고, 프로젝트 iframe에 sandbox가 없었고, 요청 제한 방식이 세 갈래였고, 운영 의존성 취약점이 6건(high 3)이었고, Dependabot이 없었다.

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

## 일부러 남긴 것

- `localStorage`의 값은 이미 휴지통의 '내 브라우저 데이터'가 전체 목록이고 민감한 값이 없어 코드를 바꾸지 않았다.
- 저장소 설정의 Secret scanning·Push protection과 Ruleset의 필수 검사는 손으로 켠다.
- 서버 하드닝은 문서 대신 읽기 전용 스크립트 `ops/audit.sh`로 남겼다.

이전 단계: [6단계 — 서버](/memo/refactor-step6-server) · 전체 회고: [리팩터링 회고](/memo/refactor-retrospective)

#MacFolio #보안 #CSP #CI
