---
title: Semgrep과 SCA 도구로 MacFolio 점검하기 - 7건 중 실제 취약점 0
date: 2026-10-18
category: 개발기/MacFolio/인프라
summary: Semgrep, pnpm audit, osv-scanner로 코드와 의존성을 점검했다. Semgrep이 7건을 냈고 오탐 4, 영향 없음 3, 실제 취약점은 0이었다. 영향 없음 셋은 고쳤고, 라이선스를 셌고, ERROR만 막는 CI 작업을 더했다.
---

보안 점검은 그동안 "있어야 할 것을 하나씩 더하는" 쪽이었다. CSP 헤더, iframe `sandbox`, 요청 제한, zod 검증, 업로드 매직 바이트 확인, 로그 마스킹. 이번에는 반대로 도구에게 먼저 찾게 하고, 나온 것마다 진짜인지 판정했다. 자세한 표는 저장소의 `docs/security-scan.md`에 있다. 점검일은 10월 18일, 기준 커밋은 main의 `aa23e0a`다.

## 판정 기준

도구가 낸 것을 그대로 고치면 일은 빨리 끝나지만, 왜 위험한지 모른 채 코드만 바뀐다. 그래서 먼저 판정을 셋으로 나눴다.

| 판정        | 뜻                                                                                   |
| ----------- | ------------------------------------------------------------------------------------ |
| 실제 취약점 | 공격자가 닿을 수 있는 입력이 위험한 동작까지 이어진다                                |
| 오탐        | 규칙이 가리킨 위험이 이 코드에서는 성립하지 않는다 (입력이 상수이거나 이미 검증된다) |
| 영향 없음   | 코드 모양은 규칙이 말하는 약점이 맞지만, 입력을 공격자가 정할 수 없다                |

판정의 근거로는 그동안 붙인 보안 설정을 그대로 썼다. CSP(#156), iframe `sandbox`(#157), HTML 넣는 곳의 출처 고정(#159), `@RateLimit`(#162), zod 검증(#160·#235·#236), 업로드 확인(#163), 로그 마스킹(#167), CORS의 `*` 범위(#182)다.

## 돌린 것

| 도구                                                                                    | 본 것                           | 결과      |
| --------------------------------------------------------------------------------------- | ------------------------------- | --------- |
| Semgrep 1.181.0, 지정 묶음 (`p/owasp-top-ten`·`p/typescript`·`p/nodejs`·`p/javascript`) | 파일 962개, 규칙 112개          | 0건       |
| Semgrep `--config auto`                                                                 | 같은 파일, 규칙 266개           | 7건       |
| `pnpm audit` (전체·`--prod`)                                                            | 워크스페이스                    | 0건       |
| osv-scanner 2.7.0                                                                       | `pnpm-lock.yaml` 패키지 1,268개 | 0건       |
| OWASP Dependency-Check 13.0.0                                                           | -                               | 실행 실패 |

시험 코드(`*.test.ts`, `e2e`)와 빌드 결과는 뺐다. 시험용 가짜 값이 규칙에 걸리면 잡음만 늘어난다. 이렇게 빠진 파일이 226개다. 1MB가 넘어 Semgrep이 건너뛴 파일 18개는 모두 글꼴·음악·영상이었다. 보조 묶음(`p/react`·`p/secrets`·`p/xss`·`p/jwt`, 규칙 58개)도 돌렸고 0건이었다.

```sh
# 지정한 규칙 묶음 (112개 규칙)
semgrep scan --config p/owasp-top-ten --config p/typescript --config p/nodejs --config p/javascript \
  --metrics=off $EXCLUDE --json --output semgrep.json --sarif-output semgrep.sarif apps/react apps/api packages

# 자동 선택 규칙 (266개. 저장소 정보를 보내므로 --metrics=off를 쓸 수 없다)
semgrep scan --config auto $EXCLUDE --json --output semgrep-auto.json apps/react apps/api packages
```

Dependency-Check는 받아서 실행까지 했지만 NVD 데이터 받기에서 멈췄다.

```text
[ERROR] Error updating the NVD Data
Caused by: io.github.jeremylong.openvulnerability.client.nvd.NvdApiException: Invalid API Key, length of 0 too short to provided a masked partial key
[ERROR] Unable to continue dependency-check analysis.
exit=13
```

지금 버전(13.0.0)은 NVD API 2.0을 쓰고 API 키 없이는 데이터를 받지 않는다. 키를 받아 다시 돌릴 수도 있었지만, Dependency-Check는 제품 이름(CPE)을 맞추는 방식이라 npm 패키지에서는 오탐이 많다. 그래서 잠금 파일의 정확한 버전을 OSV 데이터베이스와 맞추는 osv-scanner로 대신했다. `pnpm audit`과 같은 데이터를 보는 만큼 둘 다 0건으로 결과가 맞았다. 0건인 이유는 앞서 운영 의존성 취약점 6건을 `overrides`로 올리고 Dependabot을 매주 돌린 덕이다.

![Semgrep 7건을 오탐 4건과 영향 없음 3건으로 판정하고 처리한 흐름](./images/security-scan-triage.svg '7건 모두 규칙을 끄지 않고 그 줄에 사유를 적어 억제했다')

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

셋째는 프로젝트 페이지 터미널의 경로 따라가기였다. 방문자가 입력하는 값이지만 읽기만 해서 오염은 없다. 대신 `cd __proto__`가 빈 폴더로 들어가지는 버그가 있었다. `Object.hasOwn`으로 자기 키만 따라가게 고쳤다.

```ts
// apps/react/src/apps/safari/project/terminalRepo.ts
-const name = dir[part] !== undefined ? part : Object.keys(dir).find((key) => key.toLowerCase() === part.toLowerCase());
+const name = Object.hasOwn(dir, part) ? part : Object.keys(dir).find((key) => key.toLowerCase() === part.toLowerCase());
```

`dir[part] !== undefined`는 자기 키가 아닌 `Object.prototype`의 이름에도 참이 된다. 시험에 `__proto__`, `constructor`, `toString`을 넣어 모두 `null`이 되는지 본다.

고친 뒤에도 Semgrep은 같은 줄을 잡는다. 규칙이 거르는 코드를 알아보지 못하기 때문이다. 그 줄에는 무엇이 막는지와 시험 위치를 적어 억제했다.

## 규칙이 못 본 곳

0건이 안전하다는 뜻은 아니다. HTML을 직접 넣는 `dangerouslySetInnerHTML`(Mermaid SVG)과 `innerHTML`(아이콘 상수) 두 곳은 어느 묶음에서도 걸리지 않았다. 둘 다 예전에 출처를 주석과 시험으로 고정해 두어 손으로 다시 확인했다.

## 라이선스

![운영 의존성 717개의 라이선스](./images/security-scan-licenses.svg 'MIT가 대부분이고 GPL 계열은 없다')

운영 의존성 717개에 GPL·AGPL·LGPL은 없었다. 확인이 필요한 다섯 중 `elkjs`(Mermaid의 배치 엔진)는 EPL-2.0으로 약한 copyleft지만, 고치지 않고 번들에 그대로 넣으므로 소스를 공개할 의무가 생기지 않는다. Font Awesome은 아이콘이 CC-BY라 패키지에 든 라이선스 문구를 그대로 둔다. LGPL인 `sharp-libvips`와 MPL인 `lightningcss`는 빌드 도구라 배포물에 들어가지 않는다. `khroma`는 `package.json`에 라이선스 칸이 없어 Unknown으로 나왔지만 저장소의 라이선스 파일은 MIT다.

## CI

`sast` 워크플로에 `semgrep` 작업을 더했다. 지정 묶음 네 개로 PR·main·매주 돌고, **ERROR만** 실패로 친다. 이번 7건은 모두 WARNING·INFO였고, 판정하려면 사람이 코드 경로를 따라가야 했다. 이것까지 막으면 PR마다 억제 주석부터 다는 습관이 생긴다. WARNING 이하는 실행 요약에 건수로 남긴다. 버전은 `semgrep==1.181.0`, 액션은 커밋 SHA로 고정했고 권한은 `contents: read`뿐이다. SARIF는 Code scanning 설정 없이 아티팩트로 올린다.

```yaml
# .github/workflows/sast.yml (발췌)
errors=$(jq '[.results[] | select(.extra.severity == "ERROR")] | length' semgrep.json)
echo "Semgrep: 전체 $(jq '.results | length' semgrep.json)건, ERROR ${errors}건" >> "$GITHUB_STEP_SUMMARY"
[ "$errors" -eq 0 ]
```

`--config auto`는 CI에 쓰지 않았다. 저장소 정보를 Semgrep에 보내야 하고, 규칙 목록이 실행마다 달라질 수 있어 같은 커밋이 어제는 통과하고 오늘은 실패할 수 있다. 사람이 판정할 때만 돌린다.

## Dependency-Check를 다시 시도한 일

점검 뒤 Dependency-Check를 마저 돌리려고 NVD API 키를 받으려 했다. NVD 사이트의 신청 양식을 채우고 보냈는데 메일이 오지 않고 화면이 멈춰 있었다. 찾아본 방법 세 가지를 차례로 해 봐도 같았다. 그래서 Dependency-Check는 osv-scanner로 대신한다는 지금 판단을 그대로 두고, 그 내용을 정리해 이슈를 닫았다.

## 다시 돌리는 방법

```bash
pip install semgrep==1.181.0
semgrep scan --config p/owasp-top-ten --config p/typescript --config p/nodejs --config p/javascript \
  --metrics=off apps/react apps/api packages
pnpm audit --prod
osv-scanner scan source --lockfile pnpm-lock.yaml
```

제외 목록까지 포함한 전체 명령과 판정 표는 [docs/security-scan.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/security-scan.md), CI는 [.github/workflows/sast.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/sast.yml)에 있다. 새 발견 항목이 나오면 문서 표에 한 줄을 더하고, 값이 어디서 오고 무엇이 막는지를 판정 근거로 적는다.

참고 문서: [Semgrep](https://semgrep.dev/docs/), [osv-scanner](https://google.github.io/osv-scanner/), [pnpm audit](https://pnpm.io/cli/audit), [NVD API 키 신청](https://nvd.nist.gov/developers/request-an-api-key).

## 남은 것과 배운 것

- **Dependency-Check는 키를 받으면 다시 돌린다.** 같은 명령에 `--nvdApiKey`만 더하면 된다.
- **억제는 7곳뿐이다.** `grep -rn nosemgrep apps packages`가 6개 파일 7곳을 보여 준다. 줄마다 사유와 시험 위치가 있어, 나중에 코드를 고치는 사람이 억제가 아직 맞는지 판단할 수 있다.
- **"값이 어디서 오는가"가 판정의 전부였다.** 일곱 건 모두 규칙은 모양만 봤고, 진짜인지는 값의 출처를 따라가야 알 수 있었다.
- **영향이 없어도 싸면 고친다.** 프로토타입 오염 셋은 공격 경로가 없었지만, 고치다 `cd __proto__` 동작 버그를 찾았다.

관련 글: [리팩터링 7단계 — 보안](/memo/refactor-step7-security) · [커밋에 비밀 값이 섞이지 않았는지 기록 전체를 훑기](/memo/secret-scanning) · [하위 의존성 취약점 6건을 overrides로](/memo/dependency-vulnerabilities). PR: [#252](https://github.com/hyeoniverse/MacFolio/pull/252).

#MacFolio #보안 #Semgrep #SAST #SCA
