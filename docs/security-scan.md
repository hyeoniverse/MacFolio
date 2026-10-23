**한국어** | [English](en/security-scan.md)

# 보안 점검 (SAST·SCA)

MacFolio 코드와 의존성을 정적 분석(SAST)·구성 요소 분석(SCA) 도구로 점검하고, 발견 항목마다 판정과 근거를 적는다 (#213). 점검일은 2026-10-18, 기준 커밋은 `aa23e0a`(main)이다.

판정은 세 가지로 나눈다.

- **실제 취약점**: 공격자가 닿을 수 있는 입력이 위험한 동작까지 이어진다.
- **오탐**: 규칙이 가리킨 위험이 이 코드에서는 성립하지 않는다 (입력이 상수이거나 이미 검증된다).
- **영향 없음**: 코드 모양은 규칙이 말하는 약점이 맞지만, 입력을 공격자가 정할 수 없어 피해가 나지 않는다.

## 도구와 버전

| 도구                   | 버전             | 실행 여부                    | 명령                               |
| ---------------------- | ---------------- | ---------------------------- | ---------------------------------- |
| Semgrep CE             | 1.181.0          | 실행                         | 아래 1~3                           |
| pnpm audit             | pnpm 10.34.5     | 실행                         | `pnpm audit`, `pnpm audit --prod`  |
| OWASP Dependency-Check | 13.0.0 (Java 21) | **실패** (NVD API 키 없음)   | 아래 4                             |
| osv-scanner            | 2.7.0            | 실행 (Dependency-Check 대신) | 아래 5                             |
| pnpm licenses          | pnpm 10.34.5     | 실행                         | `pnpm licenses list --prod --json` |

```sh
# 1. 지정한 규칙 묶음 (112개 규칙)
semgrep scan --config p/owasp-top-ten --config p/typescript --config p/nodejs --config p/javascript \
  --metrics=off $EXCLUDE --json --output semgrep.json --sarif-output semgrep.sarif apps/react apps/api packages

# 2. 자동 선택 규칙 (266개 규칙. --config auto는 저장소 정보를 보내므로 --metrics=off를 쓸 수 없다)
semgrep scan --config auto $EXCLUDE --json --output semgrep-auto.json apps/react apps/api packages

# 3. 보조 묶음 (58개 규칙)
semgrep scan --config p/react --config p/secrets --config p/xss --config p/jwt --metrics=off $EXCLUDE apps/react apps/api packages

# EXCLUDE
--exclude node_modules --exclude dist --exclude coverage --exclude e2e --exclude test \
--exclude '*.test.ts' --exclude '*.test.tsx' --exclude '*.spec.ts'

# 4. OWASP Dependency-Check (GitHub 릴리스의 CLI zip)
dependency-check.sh --project MacFolio --scan pnpm-lock.yaml --scan package.json \
  --exclude '**/node_modules/**' --data ./dc-data --format JSON --format HTML --out ./dc-out

# 5. osv-scanner (잠금 파일 기준)
osv-scanner scan source --lockfile pnpm-lock.yaml
```

### Dependency-Check를 돌리지 못한 이유

CLI는 내려받아 실행했지만, 처음 실행할 때 NVD 데이터를 내려받는 단계에서 멈췄다.

```
[ERROR] Error updating the NVD Data
Caused by: io.github.jeremylong.openvulnerability.client.nvd.NvdApiException: Invalid API Key, length of 0 too short to provided a masked partial key
[ERROR] Unable to continue dependency-check analysis.
[ERROR] No documents exist
exit=13
```

13.0.0은 NVD API 2.0을 쓰고 API 키 없이는 데이터를 받지 않는다. 키를 받으면(`--nvdApiKey`) 같은 명령으로 돌릴 수 있다. 다만 Dependency-Check는 CPE(제품 이름) 맞추기 방식이라 npm 패키지에서는 오탐이 많고, pnpm 잠금 파일은 `pnpm audit` 분석기를 거쳐 읽는다. 그래서 같은 역할을 잠금 파일의 정확한 버전으로 OSV 데이터베이스(GitHub Advisory·npm 포함)와 맞추는 osv-scanner로 대신했다.

## 범위와 제외

- 대상: `apps/react`(Cloudflare Worker `apps/react/worker` 포함), `apps/api`, `packages/*`. git이 추적하는 파일만 본다.
- 제외: `node_modules`, `dist`, `coverage`(빌드·설치 결과), `e2e`, `test`, `*.test.ts(x)`, `*.spec.ts`(시험 코드. 운영 경로에 실리지 않고, 시험용 가짜 값이 규칙에 걸려 잡음이 된다). 제외로 빠진 파일 226개.
- 1MB가 넘어 Semgrep이 건너뛴 파일 18개는 모두 글꼴(`.ttf`)·음악(`.mp3`)·영상(`.mp4`)이라 코드가 아니다.
- 구문을 일부 읽지 못한 파일 1개: `apps/react/src/apps/activity/Server.tsx` 81행. JSX 글 안의 `&` 때문에 Semgrep 파서가 그 줄만 건너뛰었다. 화면 문구라 검사 대상 코드가 아니다.
- 기존 보안 조치(#150 7. 보안)는 이 점검의 판정 근거로 쓴다: 프론트 CSP(`public/_headers`, #156), 프로젝트 iframe `sandbox`(#157), HTML 삽입 출처 고정(#159), 요청 제한 `@RateLimit`(#162), 요청 몸통 zod 검증(`@macfolio/contracts`, #160·#235·#236), 업로드 매직 바이트 확인·메타데이터 제거(#163), 오류 응답·로그 마스킹 `SafeLogger`(#167), CORS 와일드카드 범위(#182).

## 도구별 요약

| 도구                                 | 본 범위                  | 발견 | 실제 취약점 | 오탐 | 영향 없음 |
| ------------------------------------ | ------------------------ | ---- | ----------- | ---- | --------- |
| Semgrep 지정 규칙 세트 (112개 규칙)  | 파일 962개               | 0    | 0           | 0    | 0         |
| Semgrep `--config auto` (266개 규칙) | 파일 962개               | 7    | 0           | 4    | 3         |
| Semgrep 보조 규칙 세트 (58개 규칙)   | 파일 962개               | 0    | 0           | 0    | 0         |
| pnpm audit (전체)                    | 워크스페이스 전체        | 0    | 0           | 0    | 0         |
| pnpm audit `--prod`                  | 운영 의존성              | 0    | 0           | 0    | 0         |
| OWASP Dependency-Check               | 실행 실패                | -    | -           | -    | -         |
| osv-scanner                          | 잠금 파일 패키지 1,268개 | 0    | 0           | 0    | 0         |

`pnpm audit`이 0건인 것은 #152에서 운영 의존성 취약점 6건을 `overrides`로 올리고, #169에서 Dependabot이 매주 올리기 때문이다. 같은 데이터(GitHub Advisory)를 보는 osv-scanner도 0건이라 두 결과가 서로 맞는다.

## 발견 항목

모두 `--config auto`에서만 나왔다. 줄 번호는 점검 당시(`aa23e0a`) 기준이다. 규칙 ID의 앞부분 `javascript.lang.security.audit.`은 줄였다.

| #   | 규칙 ID                     | 위치                                                            | 심각도  | 판정      | 근거                                                                                                                                                                                                                                                                              | 조치                                                                                                                                      |
| --- | --------------------------- | --------------------------------------------------------------- | ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `detect-non-literal-regexp` | `apps/api/src/common/cors.ts:18`                                | WARNING | 오탐      | 정규식 재료는 요청이 아니라 운영자가 정한 환경 변수 `CORS_ORIGINS`(`config.ts`)다. `escape()`로 메타 문자를 모두 이스케이프한 뒤 `*`만 `[a-z0-9-]+`로 바꾸므로 ReDoS가 될 반복이 없다. 요청의 `Origin`은 `test()`의 입력일 뿐이다 (#182)                                          | `nosemgrep` (`e2fad78`)                                                                                                                   |
| 2   | `detect-non-literal-regexp` | `apps/api/src/github/activity.ts:53`                            | WARNING | 오탐      | `attribute(tag, name)`의 `name`은 코드에 적은 `for`·`data-date`·`data-level`·`id` 넷뿐이다. 바깥 값(GitHub HTML)은 정규식이 아니라 검사 대상 글로만 들어간다                                                                                                                      | `nosemgrep` (`e2fad78`)                                                                                                                   |
| 3   | `detect-non-literal-regexp` | `apps/api/src/resources/rules.ts:42`                            | WARNING | 오탐      | `value(key)`의 `key`는 `MemTotal`·`MemAvailable` 상수다. 읽는 글은 서버 자신의 `/proc/meminfo`다                                                                                                                                                                                  | `nosemgrep` (`e2fad78`)                                                                                                                   |
| 4   | `unsafe-formatstring`       | `apps/react/src/desktop/window/AppErrorBoundary.tsx:29`         | INFO    | 오탐      | `console.error`의 첫 인자에 넣는 `appName`은 `AppName` 유니언 타입(앱 목록 상수)이라 `%s` 같은 서식 문자가 들어갈 수 없다. 결과도 브라우저 콘솔 출력뿐이다                                                                                                                        | `nosemgrep` (`e2fad78`)                                                                                                                   |
| 5   | `prototype-pollution-loop`  | `apps/react/src/apps/safari/project/templates/repo/repo.ts:198` | WARNING | 영향 없음 | `structureRepo()`는 폴더 구조 글의 이름을 객체 키로 쓴다. 이름이 `__proto__`면 `Object.prototype`에 값이 쓰이는 것이 실제로 재현된다(시험 추가). 다만 입력은 `shared/profile/projects/*.ts`에 적어 빌드에 넣는 프로젝트 소개(`tech.structure`)뿐이고, API나 방문자가 정할 수 없다 | 방어 보완: `__proto__`·`constructor`·`prototype` 이름과 그 아래를 건너뜀, 시험 추가 (`eaccdfd`). 보완 뒤 규칙은 모양만 보므로 `nosemgrep` |
| 6   | `prototype-pollution-loop`  | `apps/react/src/apps/safari/project/templates/repo/repo.ts:206` | WARNING | 영향 없음 | 5와 같은 함수의 다른 줄                                                                                                                                                                                                                                                           | 5와 같음 (`eaccdfd`)                                                                                                                      |
| 7   | `prototype-pollution-loop`  | `apps/react/src/apps/safari/project/terminalRepo.ts:55`         | WARNING | 영향 없음 | 프로젝트 페이지 터미널의 `cd`·`cat` 경로를 따라가는 `nodeAt()`. 방문자가 경로를 입력하지만 읽기만 하므로 오염은 없다. 대신 `cd __proto__`가 빈 폴더로 들어가지던 동작 버그가 있었다                                                                                               | `Object.hasOwn`으로 자기 키만 따라가게 고침, 시험 추가 (`9708cd0`). 보완 뒤 `nosemgrep`                                                   |

실제 취약점은 0건이다. 5~7은 코드 모양은 규칙이 말하는 약점이 맞아 수정했지만, 공격자가 닿는 입력이 없거나(5·6) 쓰기가 없어(7) 판정은 "영향 없음"으로 한다.

### 규칙이 잡지 않은 곳

규칙 결과가 0건이라고 위험한 곳이 없다는 뜻은 아니다. HTML을 직접 넣는 두 곳은 어느 규칙 세트에서도 검출되지 않아 직접 확인했다.

- `apps/react/src/apps/finder/DocView.tsx:37` `dangerouslySetInnerHTML`: Mermaid가 `securityLevel: 'strict'`로 렌더링한 SVG만 넣고, 그 출처를 #159에서 주석과 시험으로 고정했다. 프론트 CSP(#156)가 인라인 스크립트도 막는다.
- `apps/react/src/apps/memo/writer/blocks.ts:109` `innerHTML`: 코드에 적은 아이콘 태그 상수다.

### 억제 방식

오탐은 규칙 전체를 끄거나 파일을 `.semgrepignore`에 넣지 않고, 걸린 줄 바로 위에 규칙 ID와 사유를 함께 적는다.

```ts
// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- key는 코드에 적은 MemTotal·MemAvailable뿐이다
const value = (key: string) => Number(meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1]);
```

이렇게 하면 같은 파일에 새로 생기는 다른 위반은 그대로 잡힌다. 억제한 곳은 `grep -rn nosemgrep apps packages`로 모두 찾을 수 있다 (6개 파일 7곳).

## 라이선스

`pnpm licenses list --prod` 기준 운영 의존성 717개.

| 라이선스                                                                                             | 개수 |
| ---------------------------------------------------------------------------------------------------- | ---- |
| MIT                                                                                                  | 598  |
| ISC                                                                                                  | 50   |
| Apache-2.0                                                                                           | 43   |
| BSD-3-Clause                                                                                         | 13   |
| 그 밖의 허용형 (BSD-2-Clause, 0BSD, Unlicense, MIT OR CC0-1.0, AFL-2.1 OR BSD-3-Clause, MIT and ISC) | 8    |
| 확인이 필요한 것                                                                                     | 5    |

운영 의존성에 GPL·AGPL·LGPL은 없다. 확인이 필요한 다섯은 다음과 같다.

| 패키지                          | 라이선스                      | 판단                                                                                     |
| ------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| `dompurify`                     | MPL-2.0 OR Apache-2.0         | 둘 중 고를 수 있어 Apache-2.0으로 쓴다                                                   |
| `elkjs` (Mermaid 배치)          | EPL-2.0                       | 약한 copyleft. 고치지 않고 번들에 그대로 넣으므로 소스 공개 의무가 생기지 않는다         |
| `argparse`                      | Python-2.0                    | 허용형                                                                                   |
| `@fortawesome/fontawesome-free` | CC-BY-4.0 AND OFL-1.1 AND MIT | 아이콘은 CC-BY(출처 표시), 글꼴은 OFL. 패키지에 포함된 라이선스 문구를 그대로 유지한다   |
| `khroma`                        | Unknown                       | `package.json`에 `license` 칸이 없어 Unknown으로 나온다. 저장소의 `license` 파일은 MIT다 |

개발 의존성까지 넓히면 `@img/sharp-libvips-linux-x64`(LGPL-3.0-or-later)와 `lightningcss`(MPL-2.0)가 더 있다. 둘 다 빌드 도구(이미지 변환, CSS 처리)라 배포물에 들어가지 않는다.

## CI

`.github/workflows/sast.yml`에 `semgrep` 작업을 더했다 (`5297ace`).

- 언제: PR, main push, 월요일 09:20 KST, 손으로 실행. `secrets` 워크플로와 같은 방식이다.
- 무엇: 위의 지정 규칙 세트 네 개(`p/owasp-top-ten`, `p/typescript`, `p/nodejs`, `p/javascript`). `--config auto`는 저장소 정보를 Semgrep에 보내야 하고(`--metrics=off`와 함께 쓸 수 없다) 규칙 목록이 실행마다 달라질 수 있어 CI에는 쓰지 않는다.
- 실패 기준: **ERROR만**. 이번에 나온 WARNING·INFO 7건은 모두 값의 출처를 모르는 패턴 규칙이었고, 판정하려면 사람이 코드 경로를 따라가야 했다. 이것까지 막으면 PR마다 `nosemgrep`을 먼저 다는 습관이 생겨 억제가 의미를 잃는다. WARNING 이하는 실행 로그의 경고 주석과 작업 요약에 건수로 남긴다.
- 고정: 액션은 기존처럼 커밋 SHA로(#169), Semgrep은 `pipx install semgrep==1.181.0`으로 버전을 고정한다.
- 권한: `contents: read`만. SARIF는 GitHub Code scanning에 올리려면 `security-events: write`와 저장소 설정이 필요해, 아티팩트(`semgrep-sarif`, 14일)로 올린다.
- 이름: 워크플로 `sast`, 작업 `semgrep`. `ci`의 `check`·`e2e`, `conventions`의 `conventions`, `secrets`의 `secrets`와 겹치지 않는다. 브랜치 조건을 따로 두지 않아 `conventions`의 브랜치 이름 규칙과 부딪히지 않는다.

SCA는 이미 `ci.yml`의 `pnpm audit --prod --audit-level=high`가 맡고 있어 더하지 않는다. osv-scanner는 같은 데이터에서 같은 결과를 냈고, Dependency-Check는 NVD API 키를 Secrets에 넣어야 하고 처음 NVD 데이터 전체를 내려받아야 해 PR마다 돌리기에 맞지 않는다.

## 다시 돌리기

```sh
pip install semgrep==1.181.0     # 또는 pipx install semgrep==1.181.0

EXCLUDE="--exclude node_modules --exclude dist --exclude coverage --exclude e2e --exclude test --exclude *.test.ts --exclude *.test.tsx --exclude *.spec.ts"
semgrep scan --config p/owasp-top-ten --config p/typescript --config p/nodejs --config p/javascript \
  --metrics=off $EXCLUDE apps/react apps/api packages
semgrep scan --config auto $EXCLUDE apps/react apps/api packages

pnpm audit && pnpm audit --prod
pnpm licenses list --prod

# osv-scanner: https://github.com/google/osv-scanner/releases 에서 받는다
osv-scanner scan source --lockfile pnpm-lock.yaml

# Dependency-Check: NVD API 키(https://nvd.nist.gov/developers/request-an-api-key)가 있어야 한다
dependency-check.sh --project MacFolio --scan pnpm-lock.yaml --nvdApiKey "$NVD_API_KEY" --format HTML --out ./dc-out
```

새 발견 항목이 나오면 이 문서의 표에 한 줄을 더하고, 판정과 근거(값이 어디서 오고 무엇이 막는지)를 함께 적는다. 결과 원본(JSON·SARIF)은 저장소에 넣지 않는다.
