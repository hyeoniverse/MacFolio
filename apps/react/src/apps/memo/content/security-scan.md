---
title: Semgrep과 SCA 도구로 MacFolio 점검하기 - 7건 중 실제 취약점 0
date: 2026-10-18
category: 개발 기록/MacFolio/테스트·보안·성능
summary: Semgrep, pnpm audit, osv-scanner로 코드와 의존성을 점검했다. Semgrep이 7건을 냈고 오탐 4, 영향 없음 3, 실제 취약점은 0이었다. 영향 없음 3건은 수정했고, 라이선스를 집계했고, ERROR만 차단하는 CI 작업을 추가했다.
---

그동안의 보안 작업은 필요한 설정을 하나씩 추가하는 방식이었다. CSP 헤더, iframe `sandbox`, 요청 제한, zod 검증, 업로드 매직 바이트 확인, 로그 마스킹이 그 결과다. 이번에는 반대로 정적 분석 도구가 먼저 후보를 찾고, 발견 항목마다 실제 취약점인지 판정했다([#213](https://github.com/hyeoniverse/MacFolio/issues/213)). 전체 판정 표는 저장소의 `docs/security-scan.md`에 있다. 점검일은 10월 18일, 기준 커밋은 main의 `aa23e0a`다.

<details>
<summary>용어 정리: SAST와 SCA</summary>

- **SAST(정적 애플리케이션 보안 시험)**: 코드를 실행하지 않고 소스에서 위험한 패턴을 찾는다. 이 글에서는 [Semgrep](https://semgrep.dev/docs/)을 썼다.
- **SCA(소프트웨어 구성 분석)**: 설치한 의존성 패키지의 버전을 취약점 데이터베이스와 비교한다. 이 글에서는 `pnpm audit`, osv-scanner, OWASP Dependency-Check를 썼다.
- **오탐(false positive)**: 도구가 보고했지만 실제로는 문제가 아닌 항목.

</details>

## 판정 기준

도구가 보고한 항목을 그대로 수정하면 작업은 빨리 끝나지만, 위험의 근거를 확인하지 않은 채 코드만 바뀐다. 그래서 먼저 판정을 세 가지로 나눴다.

| 판정        | 뜻                                                                                   |
| ----------- | ------------------------------------------------------------------------------------ |
| 실제 취약점 | 공격자가 제어할 수 있는 입력이 위험한 동작까지 이어진다                              |
| 오탐        | 규칙이 가리킨 위험이 이 코드에서는 성립하지 않는다 (입력이 상수이거나 이미 검증된다) |
| 영향 없음   | 코드 모양은 규칙이 말하는 약점이 맞지만, 입력을 공격자가 정할 수 없다                |

판정 근거로는 그동안 추가한 보안 설정을 사용했다.

| 보안 설정                  | PR                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CSP                        | [#156](https://github.com/hyeoniverse/MacFolio/pull/156)                                                                                                                       |
| iframe `sandbox`           | [#157](https://github.com/hyeoniverse/MacFolio/pull/157)                                                                                                                       |
| HTML 삽입 위치의 출처 고정 | [#159](https://github.com/hyeoniverse/MacFolio/pull/159)                                                                                                                       |
| zod 검증                   | [#160](https://github.com/hyeoniverse/MacFolio/pull/160) · [#235](https://github.com/hyeoniverse/MacFolio/pull/235) · [#236](https://github.com/hyeoniverse/MacFolio/pull/236) |
| `@RateLimit`               | [#162](https://github.com/hyeoniverse/MacFolio/pull/162)                                                                                                                       |
| 업로드 파일 확인           | [#163](https://github.com/hyeoniverse/MacFolio/pull/163)                                                                                                                       |
| 로그 마스킹                | [#167](https://github.com/hyeoniverse/MacFolio/pull/167)                                                                                                                       |
| CORS의 `*` 범위            | [#182](https://github.com/hyeoniverse/MacFolio/pull/182)                                                                                                                       |

## 실행한 도구

| 도구                                                                                    | 검사 대상                       | 결과      |
| --------------------------------------------------------------------------------------- | ------------------------------- | --------- |
| Semgrep 1.181.0, 지정 묶음 (`p/owasp-top-ten`·`p/typescript`·`p/nodejs`·`p/javascript`) | 파일 962개, 규칙 112개          | 0건       |
| Semgrep `--config auto`                                                                 | 같은 파일, 규칙 266개           | 7건       |
| `pnpm audit` (전체·`--prod`)                                                            | 워크스페이스                    | 0건       |
| osv-scanner 2.7.0                                                                       | `pnpm-lock.yaml` 패키지 1,268개 | 0건       |
| OWASP Dependency-Check 13.0.0                                                           | -                               | 실행 실패 |

시험 코드(`*.test.ts`, `e2e`)와 빌드 결과는 검사에서 제외했다. 시험용 가짜 값이 규칙에 걸리면 의미 없는 발견 항목만 늘어난다. 이렇게 제외한 파일이 226개다. 1MB를 넘어 Semgrep이 건너뛴 파일 18개는 모두 글꼴·음악·영상이었다. 보조 묶음(`p/react`·`p/secrets`·`p/xss`·`p/jwt`, 규칙 58개)도 실행했고 결과는 0건이었다.

```sh
# 지정한 규칙 묶음 (112개 규칙)
semgrep scan --config p/owasp-top-ten --config p/typescript --config p/nodejs --config p/javascript \
  --metrics=off $EXCLUDE --json --output semgrep.json --sarif-output semgrep.sarif apps/react apps/api packages

# 자동 선택 규칙 (266개. 저장소 정보를 보내므로 --metrics=off를 쓸 수 없다)
semgrep scan --config auto $EXCLUDE --json --output semgrep-auto.json apps/react apps/api packages
```

Dependency-Check는 내려받아 실행했지만 NVD[^nvd] 데이터를 내려받는 단계에서 중단됐다.

<details>
<summary>Dependency-Check 오류 출력</summary>

```text
[ERROR] Error updating the NVD Data
Caused by: io.github.jeremylong.openvulnerability.client.nvd.NvdApiException: Invalid API Key, length of 0 too short to provided a masked partial key
[ERROR] Unable to continue dependency-check analysis.
exit=13
```

</details>

현재 버전(13.0.0)은 NVD API 2.0을 사용하며, API 키가 없으면 데이터를 내려받지 않는다. 키를 발급받아 다시 실행하는 방법도 있지만, Dependency-Check는 제품 이름(CPE[^cpe])을 대조하는 방식이라 npm 패키지에서 오탐이 많다. 그래서 잠금 파일의 정확한 버전을 [OSV](https://osv.dev/) 데이터베이스와 대조하는 osv-scanner로 대체했다. osv-scanner와 `pnpm audit`의 결과는 모두 0건으로 일치했다. 0건인 이유는 앞서 운영 의존성 취약점 6건을 `overrides`로 올리고([하위 의존성 취약점 6건을 overrides로](/memo/dependency-vulnerabilities)) Dependabot을 매주 실행해 왔기 때문이다.

![Semgrep 7건을 오탐 4건과 영향 없음 3건으로 판정하고 처리한 흐름](./images/security-scan-triage.svg '7건 모두 규칙을 끄지 않고 그 줄에 사유를 적어 억제했다')

## 오탐 4건: 값의 출처 추적

네 건은 모두 "정규식이나 서식 문자열을 변수로 생성한다"는 패턴 규칙이었다. 규칙은 값의 형태만 검사하고 출처는 알지 못한다. 그래서 판정은 값의 출처를 추적하는 작업이 된다.

| 위치                                | 변수로 만드는 값 | 값의 출처                                                                                                                                               |
| ----------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORS 허용 주소를 정규식으로 변환    | 정규식           | 요청이 아니라 운영자가 설정한 `CORS_ORIGINS`. 메타 문자를 모두 이스케이프한 뒤 `*`만 `[a-z0-9-]+`로 바꾼다. 요청의 `Origin`은 검사 대상 문자열일 뿐이다 |
| GitHub 기여 달력 HTML에서 속성 추출 | 정규식           | 코드에 적은 상수 이름                                                                                                                                   |
| `/proc/meminfo`에서 값 추출         | 정규식           | 코드에 적은 상수 `MemTotal`·`MemAvailable`                                                                                                              |
| 앱 오류를 콘솔에 출력               | 서식 문자열      | 앱 이름은 `AppName` 유니언 타입이라 `%s` 같은 서식 지정자가 들어갈 수 없다                                                                              |

억제는 규칙을 끄지 않고 해당 줄 위에 규칙 ID와 사유를 함께 기록했다([Semgrep 억제 주석 문서](https://semgrep.dev/docs/ignoring-files-folders-code)).

```ts
// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- key는 코드에 적은 MemTotal·MemAvailable뿐이다
```

같은 파일에 새로 생기는 다른 위반은 계속 검출되고, 억제한 위치는 `grep nosemgrep`으로 모두 찾을 수 있다.

## 영향 없음 3건: 패턴은 실제 약점과 일치

나머지 세 건은 `prototype-pollution-loop` 규칙으로, 이름을 객체 키로 써서 트리를 만드는 반복문이었다. 프로젝트 페이지의 "폴더 구조" 텍스트를 트리로 변환하는 함수에 `__proto__/` 줄을 입력하자 실제로 `Object.prototype`에 값이 기록됐다. 규칙이 가리킨 약점([프로토타입 오염](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Prototype_pollution))은 실재했다.

하지만 이 텍스트는 코드에 작성해 빌드에 포함하는 프로젝트 소개뿐이고, API나 방문자가 변경할 수 없다. 그래서 실제 취약점이 아니라 "영향 없음"으로 판정했다. 다만 수정 비용이 작아 수정했다. `__proto__`·`constructor`·`prototype` 이름과 그 하위 줄을 건너뛰고, 오염이 발생하지 않는지 확인하는 시험을 추가했다.

```ts
// apps/react/src/apps/safari/project/templates/repo/repo.ts
/** 객체 키로 쓰면 Object.prototype을 건드리는 이름 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// …
if (skipBelow !== null && row.depth > skipBelow) continue;
skipBelow = null;
if (parts.some((part) => UNSAFE_KEYS.has(part))) {
	skipBelow = row.depth;
	continue;
}
```

세 번째는 프로젝트 페이지 터미널의 경로 탐색이었다. 방문자가 입력하는 값이지만 읽기만 하므로 오염은 발생하지 않는다. 대신 `cd __proto__`를 입력하면 빈 폴더로 이동되는 버그가 있었다. [`Object.hasOwn`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn)으로 객체 자신의 키만 탐색하도록 수정했다.

```ts
// apps/react/src/apps/safari/project/terminalRepo.ts
-const name = dir[part] !== undefined ? part : Object.keys(dir).find((key) => key.toLowerCase() === part.toLowerCase());
+const name = Object.hasOwn(dir, part) ? part : Object.keys(dir).find((key) => key.toLowerCase() === part.toLowerCase());
```

`dir[part] !== undefined`는 객체 자신의 키가 아닌 `Object.prototype`의 이름에도 참이 된다. 시험에서 `__proto__`, `constructor`, `toString`을 입력해 모두 `null`이 반환되는지 확인한다.

수정한 뒤에도 Semgrep은 같은 줄을 검출한다. 규칙이 필터링 코드를 인식하지 못하기 때문이다. 해당 줄에는 차단 방법과 시험 위치를 적어 억제했다.

## 규칙이 검출하지 못한 위치

0건이 안전을 보장하지는 않는다. HTML을 직접 삽입하는 `dangerouslySetInnerHTML`(Mermaid SVG)과 `innerHTML`(아이콘 상수) 두 곳은 어느 규칙 묶음에서도 검출되지 않았다. 두 곳 모두 이전에 출처를 주석과 시험으로 고정해 두었고, 이번에 코드를 직접 다시 확인했다.

## 라이선스

![운영 의존성 717개의 라이선스](./images/security-scan-licenses.svg 'MIT가 대부분이고 GPL 계열은 없다')

운영 의존성 717개에 GPL·AGPL·LGPL 라이선스는 없었다. 추가 확인이 필요한 패키지 다섯 개는 아래와 같이 판단했다.

| 패키지          | 라이선스      | 판단                                                                                         |
| --------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `elkjs`         | EPL-2.0       | Mermaid의 레이아웃 엔진. 약한 copyleft지만 수정 없이 번들에 포함하므로 소스 공개 의무가 없다 |
| Font Awesome    | CC-BY(아이콘) | 패키지에 포함된 라이선스 문구를 그대로 유지한다                                              |
| `sharp-libvips` | LGPL          | 빌드 도구라 배포물에 포함되지 않는다                                                         |
| `lightningcss`  | MPL           | 빌드 도구라 배포물에 포함되지 않는다                                                         |
| `khroma`        | Unknown       | `package.json`에 라이선스 항목이 없어 Unknown으로 집계됐지만, 저장소의 라이선스 파일은 MIT다 |

## CI

`sast` 워크플로에 `semgrep` 작업을 추가했다.

- **실행 시각**: PR, main 푸시, 매주 정기 실행
- **규칙**: 지정 묶음 4개
- **실패 기준**: **ERROR만** 실패로 처리한다. 이번 7건은 모두 WARNING·INFO였고, 판정하려면 사람이 코드 경로를 추적해야 했다. WARNING까지 차단하면 PR마다 억제 주석부터 추가하는 관행이 생긴다. WARNING 이하는 실행 요약에 건수로 기록한다.
- **고정**: 버전은 `semgrep==1.181.0`, 액션은 커밋 SHA로 고정했고 권한은 `contents: read`만 부여한다.
- **결과 파일**: SARIF[^sarif]는 Code scanning 설정 없이 아티팩트로 업로드한다.

```yaml
# .github/workflows/sast.yml (발췌)
errors=$(jq '[.results[] | select(.extra.severity == "ERROR")] | length' semgrep.json)
echo "Semgrep: 전체 $(jq '.results | length' semgrep.json)건, ERROR ${errors}건" >> "$GITHUB_STEP_SUMMARY"
[ "$errors" -eq 0 ]
```

`--config auto`는 CI에 사용하지 않았다. 저장소 정보를 Semgrep에 전송해야 하고, 규칙 목록이 실행마다 달라질 수 있어 같은 커밋이 전날에는 통과하고 다음 날에는 실패할 수 있다. 사람이 판정하는 점검에서만 실행한다.

## Dependency-Check 재시도

점검 후 Dependency-Check를 실행하기 위해 NVD API 키 발급을 신청했다. NVD 사이트의 신청 양식을 제출했지만 확인 메일이 수신되지 않았고 화면이 다음 단계로 진행되지 않았다. 다른 해결 방법 세 가지를 순서대로 시도해도 결과는 같았다. 그래서 Dependency-Check를 osv-scanner로 대체한다는 판단을 유지하고, 그 내용을 정리해 [#213](https://github.com/hyeoniverse/MacFolio/issues/213)을 닫았다.

## 다시 실행하는 방법

```bash
pip install semgrep==1.181.0
semgrep scan --config p/owasp-top-ten --config p/typescript --config p/nodejs --config p/javascript \
  --metrics=off apps/react apps/api packages
pnpm audit --prod
osv-scanner scan source --lockfile pnpm-lock.yaml
```

제외 목록까지 포함한 전체 명령과 판정 표는 [docs/security-scan.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/security-scan.md), CI는 [.github/workflows/sast.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/sast.yml)에 있다. 새 발견 항목이 나오면 문서 표에 한 줄을 추가하고, 값의 출처와 차단 방법을 판정 근거로 기록한다.

참고 문서: [Semgrep](https://semgrep.dev/docs/), [osv-scanner](https://google.github.io/osv-scanner/), [pnpm audit](https://pnpm.io/cli/audit), [NVD API 키 신청](https://nvd.nist.gov/developers/request-an-api-key).

## 남은 과제와 정리

- **Dependency-Check는 API 키를 발급받으면 다시 실행한다.** 같은 명령에 `--nvdApiKey`만 추가하면 된다.
- **억제 주석은 7곳이다.** `grep -rn nosemgrep apps packages`가 6개 파일 7곳을 출력한다. 줄마다 사유와 시험 위치가 있어, 이후 코드를 수정하는 사람이 억제가 여전히 유효한지 판단할 수 있다.
- **판정 기준은 값의 출처였다.** 7건 모두 규칙은 코드 형태만 검사했고, 실제 취약점 여부는 값의 출처를 추적해야 판단할 수 있었다.
- **영향이 없어도 수정 비용이 작으면 수정한다.** 프로토타입 오염 3건은 공격 경로가 없었지만, 수정 과정에서 `cd __proto__` 동작 버그를 발견했다.

## 관련 글

- [리팩터링 7단계 — 보안](/memo/refactor-step7-security)
- [커밋에 비밀 값이 섞이지 않았는지 기록 전체를 훑기](/memo/secret-scanning)
- [하위 의존성 취약점 6건을 overrides로](/memo/dependency-vulnerabilities)
- [사이트에 CSP와 보안 헤더 붙이기](/memo/security-headers)

PR: [#252](https://github.com/hyeoniverse/MacFolio/pull/252)

[^nvd]: National Vulnerability Database. 미국 NIST가 운영하는 공개 취약점(CVE) 데이터베이스.

[^cpe]: Common Platform Enumeration. 제품을 `cpe:2.3:a:<제조사>:<제품>:<버전>` 형식으로 식별하는 이름 체계. npm 패키지 이름과 정확히 대응하지 않아 다른 제품으로 잘못 대응되는 경우가 생긴다.

[^sarif]: Static Analysis Results Interchange Format. 정적 분석 도구의 결과를 담는 JSON 기반 표준 형식으로, GitHub Code scanning이 읽는다.

#MacFolio #보안 #Semgrep #SAST #SCA
