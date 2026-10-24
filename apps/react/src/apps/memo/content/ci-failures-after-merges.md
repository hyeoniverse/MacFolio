---
title: PR을 머지하자 CI가 연달아 실패한 원인 네 가지 — 글꼴 줄 높이, 목록 재정렬, 새 취약점, scroll 이벤트
date: 2026-10-24
category: 개발기/MacFolio/인프라
summary: 10월 24일 PR을 머지할 때마다 main과 열린 PR의 CI가 다른 이유로 실패했다. macOS에서 재현되지 않는 E2E 세 건은 CI 아티팩트로 원인을 확인했고, 나머지 하나는 새로 공개된 의존성 취약점으로, 같은 날 body-parser와 multer 두 번 CI가 차단했다.
---

10월 24일 [#368](https://github.com/hyeoniverse/MacFolio/pull/368)을 머지한 뒤 main과 main을 합친 PR의 CI가 연달아 실패했다. 새벽에 두 건(①②)을 고쳐 머지했고, 아침에 남은 두 건(③④)이 드러났다. 실패 원인은 네 가지였고 서로 관계가 없었다. 세 건은 macOS에서 재현되지 않는 E2E 시험이었고, 한 건은 코드를 바꾸지 않았는데 새로 공개된 의존성 취약점 때문에 검사 단계가 막힌 경우였다.

| 원인                      | 실패한 곳                           | 수정                                                                                                                        |
| ------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ① 글꼴마다 다른 줄 높이   | `mobile.spec.ts:1874`               | [#369](https://github.com/hyeoniverse/MacFolio/pull/369) CSS                                                                |
| ② 클릭 사이 목록 재정렬   | `markdown-safety.spec.ts:22` 외 1건 | [#369](https://github.com/hyeoniverse/MacFolio/pull/369) 앱                                                                 |
| ③ 새 취약점 공개          | `check` › 의존성 취약점 검사        | [#371](https://github.com/hyeoniverse/MacFolio/pull/371)·[#374](https://github.com/hyeoniverse/MacFolio/pull/374) overrides |
| ④ scroll 이벤트 전달 시각 | `live-refresh.spec.ts:65`           | [#370](https://github.com/hyeoniverse/MacFolio/pull/370) 시험                                                               |

![CI가 연달아 실패한 순서](./images/ci-failures-after-merges-timeline.svg '한국 시각 기준. 머지 한 번마다 다른 원인이 드러났다')

## 재현되지 않는 실패를 CI 아티팩트로 확인하기

처음 두 시험(①, ②)은 macOS에서 CI와 같은 조건으로 실행해도 통과했다. `CI=1`로 재시도와 작업자 수를 CI와 맞추고, `--repeat-each 6 --workers 6`으로 같은 시험을 여섯 번씩 동시에 실행해도 실패하지 않았다. 로컬에서 원인을 찾을 수 없으므로 CI가 남긴 결과물을 내려받아 확인했다.

CI의 E2E 작업은 실패하면 `playwright-report`와 `test-results` 폴더를 아티팩트로 업로드한다(`ci.yml`, 보관 기간 7일). 시험마다 세 가지 파일이 들어 있다.

| 파일                | 내용                                                                      | 이번에 확인한 것                                   |
| ------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| `error-context.md`  | 실패한 단언, 호출 기록, 실패 시각의 접근성 트리                           | 어느 글이 열려 있었는지                            |
| `test-failed-1.png` | 실패 시각의 화면                                                          | 열린 글의 제목, 위젯 크기                          |
| `trace.zip`         | 동작마다 시각·로그·DOM 스냅숏, `page.evaluate` 반환값, 네트워크 요청 순서 | 클릭 직전 항목의 속성, 요청 순서, `sizes()` 반환값 |

```bash
# 실패한 실행의 아티팩트를 빈 폴더에 내려받는다
gh run download <실행 번호> -D ./ci-artifacts
# trace.zip은 압축을 풀면 줄마다 JSON인 *.trace 파일이 있다
unzip trace.zip -d trace && grep '"type":"log"' trace/1-trace.trace
```

`npx playwright show-trace trace.zip`으로 열어 볼 수도 있지만, 이번에는 필요한 값(클릭 대상, 반환값)만 찾으면 되어 `*.trace` 파일을 직접 검색했다[^trace].

![CI가 남긴 실패 화면](./images/ci-failures-after-merges-ci-shots.jpg '왼쪽: 위험한 본문을 눌렀는데 Google Search Console 글이 열려 있다. 오른쪽: 위젯을 옮긴 뒤 2쪽의 위젯 높이가 117px이다')

## ① 위젯 줄 높이가 2px 달라진 원인: 글꼴마다 다른 줄 높이

### 증상

시험은 휴대폰 홈 화면에서 위젯 크기를 측정하고, 음악 위젯을 2쪽으로 옮겨 2쪽을 위젯 세 줄로 만든 뒤, 모든 쪽의 위젯 크기가 처음과 같은지 확인한다([위젯 끌어 옮기기](/memo/mobile-widget-reorder)에서 추가한 시험이다). trace에 남은 측정값은 다음과 같았다.

| 측정 시점                          | 작은 위젯     | 중간 위젯     |
| ---------------------------------- | ------------- | ------------- |
| 처음 (1쪽·2쪽)                     | 153 × 115     | 323 × 115     |
| 위젯을 옮기고 '완료'를 누른 뒤 2쪽 | 153 × **117** | 323 × **117** |

### 원인

위젯 한 줄의 높이는 `MobileHome.tsx`가 첫 앱 아이콘(`.mobile-app`)의 `offsetHeight`를 측정해 `widgetRowHeight()`로 계산한다. 위젯 두 줄 아래에 아이콘 두 줄을 남기는 식이라 아이콘 높이가 2px 커지면 위젯 줄 높이는 2px 작아진다. 아이콘 높이는 이미지 60px, 간격 6px, 이름 줄 높이의 합이다.

이름(`span`)에는 [`line-height`](https://developer.mozilla.org/ko/docs/Web/CSS/line-height)를 지정하지 않아 `normal`이었다. `normal`은 글꼴 파일에 기록된 ascent와 descent로 줄 높이를 정하므로, 같은 12px이어도 글꼴마다 줄 높이가 다르다. 여기에 운영체제 차이가 겹친다.

- **macOS:** `font-family`의 첫 항목 `-apple-system`이 바로 적용된다. 웹 글꼴을 기다리지 않으므로 이름 줄은 처음부터 15px이다.
- **Linux CI 러너:** `-apple-system`이 없다. 다음 항목인 웹 글꼴 `MacSystemFont`는 [`font-display: swap`](https://developer.mozilla.org/ko/docs/Web/CSS/@font-face/font-display)이라, 파일을 받기 전에는 다른 한글 글꼴로 그리고 받은 뒤 다시 그린다. 이 시각에 이름 줄 높이가 바뀐다.

높이가 바뀌어도 위젯 줄 높이를 다시 계산하지 않은 것이 두 번째 원인이다. 측정을 다시 실행하는 [`ResizeObserver`](https://developer.mozilla.org/ko/docs/Web/API/ResizeObserver)는 페이지와 위젯 묶음만 관찰했고 아이콘은 관찰하지 않았다. 그래서 웹 글꼴 적용 전에 측정한 115px이 남아 있다가, 위젯을 옮겨 측정 effect가 다시 실행된 뒤에야 117px이 되었다.

![위젯 줄 높이 계산과 실패 순서](./images/ci-failures-after-merges-widget-row.svg '아이콘 높이에 이름 줄이 포함되고, 이름 줄 높이는 글꼴에 따라 다르다')

macOS Chromium에서 이름 '파일'(12px)의 줄 높이를 글꼴마다 측정한 값이다.

| `font-family`              | MacSystemFont | Arial | Helvetica | serif    | monospace | Courier New |
| -------------------------- | ------------- | ----- | --------- | -------- | --------- | ----------- |
| `line-height: normal` (전) | 15px          | 15px  | 15px      | **14px** | 15px      | 15px        |
| `line-height: 1.25` (후)   | 15px          | 15px  | 15px      | 15px     | 15px      | 15px        |

Linux에서 쓰인 대체 글꼴은 macOS에 없어 같은 방법으로 측정하지 못했다. "처음 그린 이름 줄이 웹 글꼴 적용 뒤보다 2px 높았다"는 결론은 CI의 115px → 117px과 계산식으로 역산한 것이었고, 수정한 뒤 CI에서 시험이 통과해 맞는 것으로 확인했다.

이 문제는 시험에서만 생기지 않는다. Windows·Android 같은 Apple 이외 기기에서도 웹 글꼴이 적용되는 시각에 아이콘 높이가 바뀌고, 위젯 크기는 다음 측정까지 그 이전 값으로 남는다.

### 수정

```css
.mobile-app span {
	font-size: var(--text-caption);
	/* 줄 높이를 글꼴과 무관하게 고정한다 */
	line-height: 1.25;
}
```

```ts
// MobileHome.tsx: 아이콘 높이(줄 높이 계산의 기준)가 바뀌어도 다시 측정한다
const icon = pagesEl.querySelector('.mobile-app');
if (icon) observer.observe(icon);
```

`1.25`처럼 단위 없는 숫자는 글자 크기에 곱해지므로 어떤 글꼴이든 12px × 1.25 = 15px이다. macOS의 기존 높이와 같아 화면은 바뀌지 않았다.

## ② 메모 목록이 클릭 사이에 재정렬된 원인: 늦게 도착하는 저장소 글

### 증상

`markdown-safety.spec.ts`는 가짜 API에 서버 글 1편(위험한 본문, 10월 9일)을 두고 메모 목록에서 그 글을 클릭한다. CI 실패 화면에서는 본문에 'Google Search Console 연결하기'(10월 23일, 저장소 글)가 열려 있었다. trace에서 두 가지를 확인했다.

- **클릭 직전 항목:** `<button aria-current="true" class="memo-item active">`. '위험한 본문'이 목록 첫 자리에서 이미 선택된 상태였다.
- **클릭 뒤 요청 순서:** `/posts/unsafe-body/likes`, `/comments` 다음에 `/posts/search-console-setup/likes`, `/comments`가 이어졌다. 클릭한 자리의 글이 바뀌었다는 뜻이다.

### 원인

[첫 방문 전송량을 줄인 작업](/memo/site-performance-diet)([45735c60a](https://github.com/hyeoniverse/MacFolio/commit/45735c60a)) 이후 저장소 글 원문은 별도 청크(`contentFiles-*.js`, 약 2MB)로 분리되어 메모 창을 처음 여는 시각에 받는다. 서버 글은 `GET /posts` 응답 한 번으로 먼저 도착하고, 저장소 글은 청크를 받은 뒤 합쳐진다.

그 사이 `useMemoLibrary`는 서버 글만으로 목록을 만들었다. 서버 글 1편이 첫 자리에 놓이고 본문에 열린다. 청크가 도착하면 230편이 날짜순으로 합쳐지고 첫 자리에는 최신 저장소 글이 놓인다. Playwright가 항목 좌표를 계산한 뒤 실제로 클릭하는 사이에 이 재정렬이 일어나면 그 좌표에는 다른 글이 있다. macOS에서는 청크가 로컬 디스크에서 바로 읽혀 재정렬이 항상 클릭보다 먼저 끝났다.

![메모 목록이 그려지는 순서](./images/ci-failures-after-merges-memo-race.svg '고치기 전에는 저장소 글이 합쳐지는 시각에 목록 순서가 바뀐다')

### 시험 하나에 재시도를 넣었다가 되돌린 경위

처음에는 `markdown-safety.spec.ts`에만 Playwright의 [`toPass()`](https://playwright.dev/docs/test-assertions#expecttopass)를 넣었다. 원하는 글이 열릴 때까지 다시 누르는 방식이다. 그런데 이 수정을 올린 #369의 첫 CI에서 `memo.spec.ts:424`(접기 블록)가 같은 원인으로 실패했다. 열린 글의 요약 문구가 '먼저 알아 둘 용어'가 아니라 '도메인 속성의 TXT 레코드 추가 (Cloudflare)'였다.

E2E에서 `.memo-item`을 찾아 누르는 곳을 검색하니 15개 파일에 88곳이었다. 시험마다 재시도를 넣는 대신 앱을 고쳤다. 판단 기준은 두 가지였다.

- 방문자도 같은 문제를 겪는다. 느린 네트워크에서 메모를 연 직후 글을 누르면 누른 자리에 다른 글이 놓일 수 있다.
- 재시도는 88곳에 같은 코드를 복사해야 하고, 새 시험을 쓸 때마다 같은 처리를 기억해야 한다.

### 수정

```ts
// useMemoLibrary.ts: 저장소 글이 오기 전에는 서버 글만으로 목록을 그리지 않는다
const posts = useMemo(
	() =>
		status === 'loading'
			? []
			: editing
				? mergeAdminPosts(repoPosts, adminPosts, todayIso)
				: mergeServerPosts(repoPosts, publicPosts),
	[status, editing, repoPosts, adminPosts, publicPosts, todayIso]
);
```

청크를 받는 동안은 기존 '불러오는 중…' 안내만 보이고 누를 항목이 없다. 청크가 도착하면 목록이 한 번에 나타난다. 서버 글이 저장소 글보다 늦게 오는 경우에는 누를 글이 그 시각에 처음 생기므로, 찾은 항목의 자리가 이후 바뀌지 않는다. `markdown-safety.spec.ts`의 `toPass()`는 되돌렸다.

![메모 창을 연 직후 고치기 전과 후](./images/ci-failures-after-merges-memo-loading.jpg '시험 안에서 저장소 글 청크 응답을 지연시켜 촬영했다. 왼쪽은 서버 글 1편만 보이다가 230편으로 재정렬되고, 오른쪽은 불러오는 중 안내 뒤 한 번에 나타난다')

## ③ 코드를 바꾸지 않았는데 실패한 검사: 새로 공개된 의존성 취약점

#369를 머지하자 main의 CI가 E2E 이전 단계인 `check`에서 실패했다. 실패한 단계는 [의존성 취약점 검사](/memo/dependency-vulnerabilities)(`pnpm audit --prod --audit-level=high`)였다. 운영 의존성에 high 이상 취약점이 있으면 CI를 막도록 10월 9일에 추가한 단계다. 이번 실패는 이 단계가 의도한 대로 동작한 경우다. 저장소의 코드와 잠금 파일은 바뀌지 않았고, 새로 공개된 권고가 검사 결과를 바꿨다.

### 공개에서 운영 반영까지 (한국 시각)

| 시각        | 내용                                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| 10/22 20:39 | body-parser 2.4.0 배포 (수정판)                                                                                            |
| 10/24 05:53 | [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) 공개 (CVE-2026-111181, high, CVSS 7.5)            |
| 07:27       | #369 머지 뒤 main CI의 `check` 실패. 같은 시각 이후 main을 합친 #366·#370도 같은 단계에서 실패                             |
| 07:40       | 수정 PR [#371](https://github.com/hyeoniverse/MacFolio/pull/371) 생성                                                      |
| 07:52       | #371 CI 통과, 머지                                                                                                         |
| 08:26       | API 이미지 빌드·배포 완료 (#370 머지 실행. #371 머지 실행의 배포는 다음 머지로 취소되어, 다음 실행이 같은 변경을 배포했다) |

권고가 공개된 뒤 약 1시간 30분 만에 CI가 차단했고, 공개 2시간 33분 뒤 수정한 API가 운영 서버에서 동작했다. 사람이 권고 메일이나 Dependabot 알림을 확인하기 전에, 다음 머지가 검사를 실행하는 시각에 바로 드러났다.

| 심각도   | 패키지            | 경로                                                                | 수정 버전 | 내용                                            |
| -------- | ----------------- | ------------------------------------------------------------------- | --------- | ----------------------------------------------- |
| high     | body-parser 2.3.0 | `apps/api` › `@nestjs/platform-express` › `express` › `body-parser` | 2.4.0     | 압축된 요청 본문 뒤에 남은 바이트로 서비스 거부 |
| moderate | fflate 0.7.3      | `packages/og-card` › `satori` › `fflate`                            | 0.7.5     | `unzipSync`가 무한 반복에 빠질 수 있음          |

### API 서버에 미치는 영향

body-parser는 express가 요청 본문을 해석할 때 쓰는 라이브러리다. MacFolio API는 NestJS 기본 설정으로 JSON·URL 인코딩 파서를 쓰고, `app.setup.ts`에서 분석 이벤트용 `text/plain` 파서를 하나 더 등록한다. 세 파서 모두 `inflate` 옵션의 기본값이 `true`라 `Content-Encoding: gzip`·`deflate` 본문을 풀어서 해석한다. 본문을 받는 경로는 댓글·메시지·좋아요·분석 이벤트처럼 로그인 없이 호출할 수 있는 것도 있으므로, 이 취약점은 운영 서버에서 실제로 도달할 수 있는 경로였다.

<details>
<summary>왜 express 업데이트를 기다리지 않았나</summary>

body-parser는 직접 설치한 패키지가 아니라 `@nestjs/platform-express` › `express`가 가져오는 하위 의존성이다. express의 의존성 범위(`^2.x`)가 이미 2.4.0을 허용하므로, 잠금 파일만 새 버전을 가리키면 된다. 상위 패키지 배포를 기다리면 그동안 main과 모든 PR의 CI가 막히고 운영 서버는 취약한 버전으로 남는다. 그래서 저장소에서 이미 쓰는 방식대로 `pnpm-workspace.yaml`의 `overrides`로 올렸다. 같은 방식으로 관리하는 항목(prisma의 deepmerge-ts, milkdown의 source-map-js 등)과 함께 이유를 주석으로 남겼다.

</details>

```yaml
overrides:
  # nestjs > express: 압축된 요청 본문 뒤의 남은 바이트로 서비스 거부 (GHSA-27r3-jxmh-p828, high)
  body-parser: '^2.4.0'
  # og-card > satori(0.7.3 고정): unzipSync 무한 반복 (moderate). 같은 0.7 버전의 수정판으로 올린다
  'fflate@0.7.3': '0.7.5'
```

- **fflate:** satori가 `0.7.3`으로 고정해 두었다. `'fflate@0.7.3'` 선택자는 이 버전만 바꾸고, 다른 패키지가 쓰는 fflate 0.8.3은 그대로 둔다. moderate라 CI를 막지는 않았지만 같은 검사 결과에 나와 함께 올렸다.
- **확인:** `pnpm audit --prod`가 `No known vulnerabilities found`를 출력하는 것을 확인했다. API 단위 시험 190개, OG 이미지 시험, CI의 API E2E(실제 PostgreSQL)가 통과했다.
- **열린 PR:** 기능 PR(#366·#370)에 섞지 않고 별도 PR로 고친 뒤, 두 PR에 main을 다시 합쳤다.

### 같은 날 두 번째: multer

#371을 머지하고 46분 뒤(08:38), 이 글의 PR([#373](https://github.com/hyeoniverse/MacFolio/pull/373))에 커밋을 올리자 같은 단계가 다시 실패했다. 이번에는 권고 다섯 건이 새로 공개되어 있었고, 그중 multer가 high였다.

| 패키지         | 수정   | 쓰는 곳             | 권고                                                                                              |
| -------------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------- |
| multer 2.4.0   | 2.5.0  | API 파일 업로드     | [high](https://github.com/advisories/GHSA-q7qp-rjg7-q26m): 끊긴 요청의 `fileFilter`로 서비스 거부 |
| undici 7.29.1  | 7.30.1 | API 문서 앱(scalar) | moderate 2건: 메모리 무제한, SRI 우회                                                             |
| fast-uri 3.1.8 | 3.1.9  | prisma 개발 도구    | moderate·low 3건: 스킴 위장 등                                                                    |

한국 시각으로 맞춰 보면 GitHub 권고 공개와 `pnpm audit` 결과 반영 사이에 시간 차이가 있다.

| 시각  | 내용                                                                  |
| ----- | --------------------------------------------------------------------- |
| 07:08 | multer 권고 공개 (GitHub Advisory Database)                           |
| 08:33 | main(#372 머지)의 `check` 통과: 이 시각까지는 audit 결과에 없었다     |
| 08:38 | #373의 `check` 실패: 처음으로 audit 결과에 나타났다                   |
| 08:46 | 수정 PR [#374](https://github.com/hyeoniverse/MacFolio/pull/374) 생성 |
| 09:09 | #374 CI 통과(API E2E의 파일 업로드 시험 포함), 머지                   |
| 09:25 | API 이미지 빌드·배포 완료                                             |

`pnpm audit`는 npm 레지스트리의 취약점 조회 API에 질의하므로, GitHub에 권고가 공개된 시각과 audit 결과에 나타나는 시각이 다르다. 이번에는 07:08에 공개된 권고가 08:33에 끝난 검사에는 없었고 08:38에 끝난 검사에서 처음 나타나, 1시간 25분 이상 차이가 났다. 그래서 같은 커밋도 실행 시각에 따라 통과하거나 실패한다. CI가 처음 실패한 시각부터 운영 서버 반영까지는 47분, 권고 공개부터는 2시간 17분이 걸렸다.

multer는 `@nestjs/platform-express`가 `2.4.0`으로 고정해 가져오므로, `fflate`와 같은 방식으로 그 버전만 바꾸는 선택자를 썼다. undici도 scalar가 `7.29.1`로 고정해 같은 방식이고, fast-uri는 `ajv`의 범위(`^3.0.1`) 안이라 범위로 올렸다.

```yaml
overrides:
  # nestjs > multer(2.4.0 고정): 요청이 끊긴 뒤 비동기 fileFilter가 남아 서비스 거부 (GHSA-q7qp-rjg7-q26m, high)
  'multer@2.4.0': '2.5.0'
  # scalar 문서 앱 > undici(7.29.1 고정): EventSource 파서 메모리 무제한, SRI 우회 (moderate)
  'undici@7.29.1': '7.30.1'
  # prisma 개발 도구 > ajv > fast-uri: 스킴 위장·호스트 혼동 (moderate, low)
  fast-uri: '^3.1.9'
```

영향 범위는 body-parser와 달랐다. API에서 multer를 쓰는 곳은 관리자 전용 파일 업로드(`POST /files`) 하나다. 이 경로에는 `@UseGuards(AdminGuard)`가 붙어 있고, Nest는 [가드를 인터셉터보다 먼저 실행](https://docs.nestjs.com/faq/request-lifecycle)하므로 관리자 세션이 없는 요청은 `FileInterceptor`(multer)에 도달하지 않는다. `fileFilter`도 지정하지 않아 권고의 조건과 다르다. 도달 가능성은 낮지만, 운영 의존성에 high 취약점이 남으면 모든 CI가 막히고 이후 업로드 경로를 추가할 때 조건이 바뀔 수 있어 같은 날 올렸다.

## ④ 새 답글이 와도 아래로 따라가지 않은 원인: scroll 이벤트 전달 시각

main을 다시 합친 #370의 CI에서 `live-refresh.spec.ts:65`가 재시도까지 실패했다. 메시지 앱에서 맨 아래를 보고 있으면 새 답글을 따라 내려가는지 확인하는 시험이다([메시지·댓글도 보이는 동안만 갱신하기](/memo/live-refresh-more)). 새 답글이 도착했지만 대화 칸이 맨 아래에서 37px 떨어진 채였다.

![새 답글을 따라 내려가지 않은 화면](./images/ci-failures-after-merges-live-refresh.jpg '맨 아래에서 받은 답글이 입력 칸 위에서 잘려 있다')

#370은 새 피드백 화면만 바꾸고 대화 화면 코드는 바꾸지 않았다. 대화 화면은 맨 아래를 보고 있는지를 `onScroll`에서 기록하고, 새 답글이 오면 그 기록을 읽는다.

```tsx
// ChatView.tsx
onScroll={(event) => {
	const list = event.currentTarget;
	atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight <= STICK_PX;
}}
// 새 말풍선이 오면 맨 아래를 보고 있었으면(또는 내가 보냈으면) 따라 내려간다
useEffect(() => {
	if (atBottom.current || last?.mine) scrollToEnd();
}, [last?.id, last?.mine]);
```

시험은 `scrollTop`을 코드로 바꾼 직후 가짜 시계를 16초 앞당겨 새 답글을 받는다. 브라우저는 `scrollTop`이 바뀌어도 [scroll 이벤트](https://developer.mozilla.org/ko/docs/Web/API/Element/scroll_event)를 즉시 보내지 않고 다음 렌더링 단계에서 보낸다. 그 전에 새 답글이 렌더링되면 effect는 직전 단계(맨 위로 올린 상태)에서 기록한 `atBottom = false`를 읽는다. 실제 사용자는 스크롤과 다음 조회(15초 간격) 사이에 시간이 충분해 이 순서가 뒤바뀌지 않는다. 그래서 앱이 아니라 시험을 고쳤다.

```ts
// live-refresh.spec.ts: scroll 이벤트를 바로 보내 순서를 고정한다
const scrollLog = (log: Locator, to: 'top' | 'bottom') =>
	log.evaluate((element, where) => {
		element.scrollTop = where === 'top' ? 0 : element.scrollHeight;
		element.dispatchEvent(new Event('scroll'));
	}, to);
```

이 실패도 macOS에서 재현하지 못했다. 원인은 실패 화면과 코드로 추정한 것이었고, 수정한 뒤 CI에서 통과해 확인했다.

## 이번에 정한 기준

- **macOS에서 통과해도 Linux 글꼴로 결과가 달라질 수 있다.** 측정값을 계산에 쓰는 요소(여기서는 아이콘 이름)는 `line-height`를 숫자로 지정해 글꼴 메트릭에 의존하지 않게 한다. 측정 effect는 계산에 쓰는 요소를 모두 `ResizeObserver`로 관찰한다.
- **재현되지 않으면 추측으로 고치기 전에 아티팩트를 내려받는다.** 이번 네 건 중 세 건은 `trace.zip`의 반환값·요청 순서와 `test-failed-1.png`로 원인을 좁혔다.
- **재시도를 넣기 전에 같은 패턴의 시험이 몇 곳인지 검색한다.** 여러 곳이 같은 원인에 걸리면 방문자도 겪는 문제일 가능성이 높고, 앱을 고치는 편이 수정 범위가 작다. 반대로 실제 사용자에게는 생기지 않는 순서(④)는 시험을 고친다.
- **`check` 단계 실패는 먼저 실패한 단계 이름을 확인한다.** 의존성 검사는 코드와 무관하게 외부 권고 공개 시각에 따라 실패한다. 이 경우 기능 PR이 아니라 별도 PR(#371, #374)로 고치고, 열린 PR들은 main을 다시 합친다. 권고는 GitHub 공개 뒤 시간 차이를 두고 audit 결과에 반영되므로, 직전 실행이 통과했어도 다음 실행에서 실패할 수 있다.

<details>
<summary>실행별 결과 (한국 시각)</summary>

| 시각  | 실행                      | 결과                                               |
| ----- | ------------------------- | -------------------------------------------------- |
| 01:17 | main, #368 머지           | 실패: E2E 2칸(②), E2E 5칸(①)                       |
| 01:20 | #366, main 합침           | 실패: E2E 5칸(①)                                   |
| 01:47 | #369 첫 커밋              | 실패: `memo.spec.ts:424`(②)                        |
| 02:15 | #369 앱 수정              | 02:31 커밋(PR 그림)이 올라와 취소, 02:31 실행 통과 |
| 07:27 | main, #369 머지           | 실패: `check` › 의존성 취약점 검사(③)              |
| 07:36 | #366·#370, main 합침      | #366 `check` 실패, #370 `check`와 E2E 1칸(④) 실패  |
| 07:40 | #371                      | 통과, 07:52 머지                                   |
| 07:57 | #366·#370, main 다시 합침 | 통과, 08:09 머지                                   |
| 08:33 | main, #372 머지           | `check` 통과                                       |
| 08:38 | #373 (이 글)              | 실패: `check` › 의존성 취약점 검사(③, multer)      |
| 08:46 | #374                      | multer·undici·fast-uri 수정                        |
| 09:09 | main, #374 머지           | 통과, 09:25 API 배포                               |

</details>

## 관련 글

- [글 한 편 추가했더니 E2E가 깨졌다 - 이미지 끌기 테스트가 흔들린 이유](/memo/flaky-drag-e2e): 레이아웃이 측정 뒤에 바뀌어 흔들린 다른 E2E 사례
- [하위 의존성 취약점 6건을 overrides로 고치기](/memo/dependency-vulnerabilities): 이번에 실패한 의존성 취약점 검사를 추가한 기록
- [첫 방문 전송량 9MB를 0.8MB로 — 글꼴, 글 원문, 앱 코드, 이미지 최적화 과정](/memo/site-performance-diet): 저장소 글 원문을 별도 청크로 분리하고 웹 글꼴을 `swap`으로 바꾼 작업
- [휴대폰 홈 화면 위젯 끌어 옮기기 — 2열 격자 규칙, Pointer Events, FLIP](/memo/mobile-widget-reorder): 실패한 위젯 크기 시험을 추가한 작업
- [머지하고 배포까지 15분에서 5분으로: e2e 6칸과 같은 코드 다시 돌리지 않기](/memo/faster-e2e-ci): E2E를 6칸으로 나눈 CI 구성

[^trace]: `0-trace.trace`, `1-trace.trace`에는 브라우저 쪽 동작(`before`, `after`, `log`, `input`)이, `test.trace`에는 시험 코드의 단계가 기록된다. `page.evaluate`의 반환값은 `after` 기록의 `result`에 있다. [Playwright: Trace viewer](https://playwright.dev/docs/trace-viewer)

#MacFolio #CI #테스트 #Playwright #트러블슈팅
