---
title: Semgrep과 SCA 도구로 MacFolio 점검하기 - 7건 중 실제 취약점 0
date: 2026-10-18
category: 개발기/MacFolio/인프라
summary: Semgrep, pnpm audit, osv-scanner로 코드와 의존성을 점검했다. Semgrep이 7건을 냈고 오탐 4, 영향 없음 3, 실제 취약점은 없었다. 영향 없음 셋은 고쳤고, Dependency-Check는 NVD API 키가 없어 돌리지 못했다. ERROR만 막는 CI 작업을 더했다.
---

보안 점검은 그동안 "있어야 할 것을 하나씩 더하는" 쪽이었다. CSP 헤더, iframe `sandbox`, 요청 제한, zod 검증, 업로드 매직 바이트 확인, 로그 마스킹. 이번에는 반대로 도구에게 먼저 찾게 하고, 나온 것마다 진짜인지 판정했다. 자세한 표는 저장소의 `docs/security-scan.md`에 있다.

## 돌린 것

| 도구                                                                                    | 본 것                           | 결과      |
| --------------------------------------------------------------------------------------- | ------------------------------- | --------- |
| Semgrep 1.181.0, 지정 묶음 (`p/owasp-top-ten`·`p/typescript`·`p/nodejs`·`p/javascript`) | 파일 962개, 규칙 112개          | 0건       |
| Semgrep `--config auto`                                                                 | 같은 파일, 규칙 266개           | 7건       |
| `pnpm audit` (전체·`--prod`)                                                            | 워크스페이스                    | 0건       |
| osv-scanner 2.7.0                                                                       | `pnpm-lock.yaml` 패키지 1,268개 | 0건       |
| OWASP Dependency-Check 13.0.0                                                           | -                               | 실행 실패 |

시험 코드(`*.test.ts`, `e2e`)와 빌드 결과는 뺐다. 시험용 가짜 값이 규칙에 걸리면 잡음만 늘어난다.

Dependency-Check는 받아서 실행까지 했지만 NVD 데이터 받기에서 `Invalid API Key, length of 0`으로 멈췄다. 지금 버전은 API 키 없이는 NVD를 받지 않는다. 그래서 잠금 파일의 정확한 버전을 OSV 데이터베이스와 맞추는 osv-scanner로 대신했다. `pnpm audit`과 같은 데이터를 보는 만큼 둘 다 0건으로 결과가 맞았다. 0건인 이유는 앞서 운영 의존성 취약점 6건을 `overrides`로 올리고 Dependabot을 매주 돌린 덕이다.

## 오탐 넷: 값이 어디서 오는가

네 건은 모두 "정규식이나 서식 문자열을 변수로 만든다"는 패턴 규칙이었다. 규칙은 값의 모양만 보고 출처는 모른다. 그래서 판정은 값이 어디서 오는지 따라가는 일이 된다.

- CORS 허용 주소를 정규식으로 바꾸는 곳: 재료는 요청이 아니라 운영자가 정한 `CORS_ORIGINS`이고, 메타 문자를 모두 이스케이프한 뒤 `*`만 `[a-z0-9-]+`로 바꾼다. 요청의 `Origin`은 검사받는 글일 뿐이다.
- GitHub 기여 달력 HTML에서 속성을 읽는 곳, `/proc/meminfo`에서 값을 읽는 곳: 정규식에 들어가는 이름이 코드에 적은 상수다.
- 앱 오류를 콘솔에 찍는 곳: 서식 자리에 들어가는 앱 이름은 `AppName` 유니언 타입이라 `%s`가 들어갈 수 없다.

억제는 규칙을 끄지 않고 그 줄 위에 규칙 ID와 사유를 함께 적었다.

```ts
// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- key는 코드에 적은 MemTotal·MemAvailable뿐이다
```

같은 파일에 새로 생기는 다른 위반은 그대로 잡히고, 억제한 곳은 `grep nosemgrep`으로 모두 찾을 수 있다.

## 영향 없음 셋: 모양은 맞았다

나머지 셋은 `prototype-pollution-loop`, 이름을 객체 키로 써서 트리를 만드는 반복문이었다. 프로젝트 페이지의 "폴더 구조" 글을 트리로 바꾸는 함수에 `__proto__/` 줄을 넣어 보니 실제로 `Object.prototype`에 값이 쓰였다. 규칙이 가리킨 약점은 진짜였다.

하지만 이 글은 코드에 적어 빌드에 넣는 프로젝트 소개뿐이고, API나 방문자가 바꿀 수 없다. 그래서 판정은 실제 취약점이 아니라 "영향 없음"으로 두었다. 그래도 고치는 비용이 작아 고쳤다. `__proto__`·`constructor`·`prototype` 이름과 그 아래 줄을 건너뛰고, 오염되지 않는지 보는 시험을 더했다.

셋째는 프로젝트 페이지 터미널의 경로 따라가기였다. 방문자가 입력하는 값이지만 읽기만 해서 오염은 없다. 대신 `cd __proto__`가 빈 폴더로 들어가지는 버그가 있었다. `Object.hasOwn`으로 자기 키만 따라가게 고쳤다.

고친 뒤에도 Semgrep은 같은 줄을 잡는다. 규칙이 거르는 코드를 알아보지 못하기 때문이다. 그 줄에는 무엇이 막는지와 시험 위치를 적어 억제했다.

## 규칙이 못 본 곳

0건이 안전하다는 뜻은 아니다. HTML을 직접 넣는 `dangerouslySetInnerHTML`(Mermaid SVG)과 `innerHTML`(아이콘 상수) 두 곳은 어느 묶음에서도 걸리지 않았다. 둘 다 예전에 출처를 주석과 시험으로 고정해 두어 손으로 다시 확인했다.

## 라이선스

운영 의존성 717개에 GPL·AGPL·LGPL은 없었다. LGPL인 `sharp-libvips`와 MPL인 `lightningcss`는 빌드 도구라 배포물에 들어가지 않는다. `khroma`는 `package.json`에 라이선스 칸이 없어 Unknown으로 나왔지만 저장소의 라이선스 파일은 MIT다.

## CI

`sast` 워크플로에 `semgrep` 작업을 더했다. 지정 묶음 네 개로 PR·main·매주 돌고, **ERROR만** 실패로 친다. 이번 7건은 모두 WARNING·INFO였고, 판정하려면 사람이 코드 경로를 따라가야 했다. 이것까지 막으면 PR마다 억제 주석부터 다는 습관이 생긴다. WARNING 이하는 실행 요약에 건수로 남긴다. 버전은 `semgrep==1.181.0`, 액션은 커밋 SHA로 고정했고 권한은 `contents: read`뿐이다. SARIF는 Code scanning 설정 없이 아티팩트로 올린다.

#MacFolio #보안 #Semgrep #SAST #SCA
