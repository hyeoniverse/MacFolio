---
title: Lighthouse 운영 재측정, 명언 데이터 lazy 분리, #boot-splash 삭제 시각으로 휴대폰 LCP 편차 해결과 CI 성능 예산
date: 2026-10-23
category: 개발 기록/MacFolio/테스트·보안·성능
series: 성능 최적화
seriesOrder: 2
summary: 3차까지 배포한 운영 사이트를 재측정해 휴대폰 98점(LCP 1.9초)을 확인하고, 첫 번들에 들어간 명언 데이터 66KB를 lazy로 분리했다. LCP가 3.3초와 4.6초로 갈리던 원인인 #boot-splash 삭제 시각을 고치고 번들 크기에 CI 상한을 걸었다.
---

[Lighthouse 병목 분석과 글꼴 subset·lazy import·modulepreload·WebP로 첫 방문 전송량 9MB를 0.8MB로](/memo/site-performance-diet)에서 첫 방문 성능을 세 차례 개선했다([#319](https://github.com/hyeoniverse/MacFolio/pull/319) 1차, [#323](https://github.com/hyeoniverse/MacFolio/pull/323) 2·3차). 그 뒤 운영 사이트에서는 1차 배포 후의 값만 측정했고, 2·3차가 배포된 운영 사이트는 측정하지 않았다. 그사이 명언 위젯([#330](https://github.com/hyeoniverse/MacFolio/pull/330)), 활동 상태 보기의 IP 표 같은 기능도 추가했다. 그래서 같은 조건으로 다시 측정했고, 측정에서 찾은 과제를 두 PR로 처리했다.

| 단계 | PR                                                       | 내용                                                                        |
| ---- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| 4차  | [#338](https://github.com/hyeoniverse/MacFolio/pull/338) | 운영·로컬 재측정, 명언 위젯 lazy 분리                                       |
| 5차  | [#367](https://github.com/hyeoniverse/MacFolio/pull/367) | 휴대폰 LCP 편차 해결, 휴대폰 로딩 화면 밖으로 비치던 배경화면, CI 성능 예산 |

결론부터 적는다.

- **운영 사이트:** 휴대폰 98점(LCP[^lcp] 1.9초, 첫 방문 전송량 602KB), 데스크톱 97점(LCP 1.0초, 889KB). 1차 배포 후의 73점·89점에서 각각 25점, 8점 올랐다.
- **첫 번들 회귀(4차):** 로컬 첫 방문 전송량이 3차보다 22KB 늘어 있었다. 원인은 명언 위젯의 명언 365개가 첫 번들(`boot`)에 들어간 것이었다. 위젯을 lazy로 분리해 3차 수준으로 되돌렸다.
- **LCP 편차의 원인은 글꼴이 아니었다(5차).** React가 처음 렌더링하는 시각에 HTML의 첫 렌더링(`#boot-splash`)을 삭제했는데, 그 시각이 HTML 시작 안내가 LCP 후보로 기록되기 전이면 후보가 사라졌다. `#boot-splash`를 로딩 화면을 누를 때까지 남겨, 번갈아 측정한 28회씩에서 4초대 회차가 3회에서 0회가 되었다.
- **첫 방문 전송량이 휴대폰 487KB에서 278KB로 줄었다(5차).** 본문 글꼴(149KB)과 배경화면을 누른 뒤로 지연했다. 진입 후까지의 전송량은 같다.
- **CI 성능 예산(5차):** `boot` 번들 55KB, `index.html`이 처음부터 요청하는 번들 합계 265KB(brotli)를 넘으면 CI가 실패한다.

## 측정 조건

측정 조건은 1~3차와 같다.

- **도구:** [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview) 12.8.2(성능 항목만), Playwright 1.64(Chromium 156)
- **휴대폰:** Lighthouse 기본값. 느린 4G(왕복 150ms, 1.6Mbps)와 4배 느린 CPU를 시뮬레이션한다(simulate[^simulate])
- **데스크톱:** `--preset=desktop` (왕복 40ms, 10Mbps)
- **로컬 서버:** 빌드 결과를 `apps/react/scripts/perf/serve.mjs`로 제공한다. 텍스트 파일은 brotli로 압축한다
- **횟수:** 5회씩 측정하고 중앙값을 쓴다. 한 번에 하나씩 실행하고, 빌드나 시험과 겹친 측정은 버렸다. 5차의 전후 비교는 main과 브랜치를 한 회씩 번갈아 28회씩 측정했다

<details>
<summary>측정 중의 실수: 이전 빌드를 측정한 일</summary>

전날 측정에 쓴 정적 서버가 같은 포트(4810)를 아직 점유하고 있었다. 새 서버는 `EADDRINUSE`로 시작하지 못했고, 측정 스크립트는 **이전 빌드를 제공하던 서버**를 측정했다. 진입 단계에서 로딩 화면을 찾지 못해 측정이 실패했고, 이 실패로 원인을 확인했다. 비어 있는 포트(4811)로 다시 측정했고, `docs/performance.md`의 측정 방법에 이 주의 사항을 추가했다.

</details>

## 운영 사이트 재측정

![운영 사이트의 LCP, FCP, 첫 방문 전송량](./images/site-performance-remeasure-production.svg '개선 전, 1차 배포 후, 3차 배포 후(재측정)의 운영 사이트 측정값. 휴대폰 LCP는 31.5초에서 1.9초가 되었다')

| 항목            | 휴대폰 개선 전 | 1차 배포 후 | 3차 배포 후    | 데스크톱 개선 전 | 1차 배포 후 | 3차 배포 후     |
| --------------- | -------------- | ----------- | -------------- | ---------------- | ----------- | --------------- |
| Lighthouse 성능 | 53             | 73          | **98** (86~98) | 60               | 89          | **97** (96~100) |
| FCP             | 15.0초         | 2.4초       | **1.9초**      | 2.9초            | 0.9초       | **1.0초**       |
| LCP             | 31.5초         | 7.1초       | **1.9초**      | 5.8초            | 2.1초       | **1.0초**       |
| 첫 방문 전송량  | 6,342KB        | 1,239KB     | **602KB**      | 7,134KB          | 3,229KB     | **889KB**       |

3차 배포 후 운영에서는 FCP[^fcp]와 LCP가 같다. 3차에서 로딩 화면 뒤의 홈 화면을 누른 뒤에 렌더링하도록 바꿨다. 그래서 첫 렌더링(HTML의 사과와 "탭하여 로딩을 시작하세요")이 곧 최대 콘텐츠다.

휴대폰 점수는 5회 중 3회가 98점, 2회가 86~87점이었다. 86점인 회차는 LCP가 3.1~3.3초였다. 로컬에서도 같은 현상이 있었고, 원인은 [휴대폰 LCP 편차](#휴대폰-lcp-편차)에서 다룬다.

### 운영이 로컬보다 무거운 이유

같은 코드인데 운영의 첫 방문 전송량이 로컬보다 약 100KB 크다(휴대폰 602KB, 로컬 505KB). 운영과 로컬을 같은 방법으로 열어 파일별 전송량을 비교했다.

- **JS 압축 수준:** 파일 목록은 같다. 다만 같은 파일이 운영에서 10~15% 크다(`boot` 70KB → 80KB, `jsx-runtime` 60KB → 66KB). 로컬 측정 서버는 brotli 최고 압축(품질 11)으로 미리 압축해 두지만, Cloudflare는 응답마다 압축하므로 더 낮은 수준을 쓴다([Cloudflare 압축 문서](https://developers.cloudflare.com/speed/optimization/content/compression/)).
- **HTML:** 운영 Worker가 검색엔진용으로 첫 화면 본문을 HTML에 삽입한다. 로컬 `index.html`은 2KB, 운영은 15KB다.

반대로 운영은 HTTP/2라 번들 33개를 한 연결로 동시에 수신한다. 로컬 서버는 HTTP/1.1이라 동시 연결 6개로 대기열이 생긴다. 그래서 전송량은 더 크지만 휴대폰 FCP는 운영(1.9초)이 로컬 simulate(3.2초)보다 빠르다.

## 4차: 첫 번들에서 명언 데이터 66KB 빼기

로컬 측정값은 3차와 거의 같았지만, 첫 방문 전송량만 조금 늘어 있었다.

| 항목            | 3차   | 재측정 (개선 전) | 4차   |
| --------------- | ----- | ---------------- | ----- |
| 휴대폰 전송량   | 483KB | 505KB            | 485KB |
| 데스크톱 전송량 | 771KB | 793KB            | 772KB |

22KB는 작은 값이지만, ==성능 개선 뒤에 기능을 추가하면서 첫 번들이 다시 커지는 회귀==다. 기능을 계속 추가하면 같은 방식으로 누적되므로 원인을 추적했다.

**어떻게 찾았나.** 3차를 머지한 시점(`3e0c919ca`)과 현재 main을 각각 빌드했다. 두 빌드를 Playwright로 같은 휴대폰 조건에서 열고, CDP(Chrome DevTools Protocol)의 [`Network.loadingFinished`](https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-loadingFinished) 이벤트로 파일별 전송량을 수집해 비교했다. 파일 이름의 해시를 제거하고 같은 파일끼리 맞추니, 300B 넘게 달라진 파일은 하나뿐이었다.

```text
total r3 431KB → now 453KB
+21KB  49KB → 70KB  /assets/boot.js
```

`boot` 번들 안을 확인하니 명언 위젯([#330](https://github.com/hyeoniverse/MacFolio/pull/330))의 명언 365개가 들어 있었다. `desktop/widgets/quotes.ts`는 원문과 우리말, 말한 사람을 담은 66KB 파일이다. 위젯 목록(`Widget.tsx`)이 `QuoteWidget`을 정적으로 import하고, `QuoteWidget`이 `quotes.ts`를 import한다. 위젯 목록은 바탕화면과 홈 화면이 쓰므로 `boot`에 들어간다.

![첫 번들(boot) 크기의 변화](./images/site-performance-remeasure-boot.svg '1차에서 250KB를 47KB로 줄인 boot 번들이 재측정에서 65KB로 늘어 있었다. 명언 위젯을 lazy로 분리해 47KB로 되돌렸다')

**개선.** 명언 위젯을 [`React.lazy`](https://react.dev/reference/react/lazy)로 분리했다(커밋 `3f7c57dae`). `lazy`로 감싼 컴포넌트는 별도 청크로 빌드되고, 처음 렌더링하는 시각에 내려받는다.

```tsx
// 전 (Widget.tsx)
import QuoteWidget from './QuoteWidget';

// 후
// 명언 365개(원문 66KB)는 첫 번들(boot)에 넣지 않고, 명언 위젯을 처음 렌더링할 때 받는다
const QuoteWidget = lazy(() => import('./QuoteWidget'));

case 'quote':
	body = (
		<Suspense fallback={null}>
			<QuoteWidget size={size} />
		</Suspense>
	);
```

명언 위젯은 로딩 화면을 누른 뒤 바탕화면과 함께 보인다. 그리고 3차부터 바탕화면은 누른 뒤에 렌더링한다. 그래서 명언 데이터는 첫 방문에서 미리 내려받을 필요가 없다. 누른 뒤 진행 막대가 차는 2.5초 동안 별도 청크(`QuoteWidget-*.js`)로 수신한다.

**효과.** `boot`는 brotli 압축 65KB에서 47KB가 되었다. 첫 방문 전송량은 휴대폰 485KB, 데스크톱 772KB로 3차 수준이다. 명언 위젯과 홈 화면 시험(`widgets.spec.ts`, `mobile.spec.ts`, `finder.spec.ts`) 178개가 그대로 통과했다.

### 실제로 느리게 한 휴대폰

simulate는 빠른 네트워크에서 수신한 기록으로 느린 네트워크의 시간을 계산한다. 브라우저를 실제로 느리게 하는 방식(`--throttling-method=devtools`)으로도 측정했다.

| 항목    | 3차       | 4차              |
| ------- | --------- | ---------------- |
| 점수    | 92        | 100 (5회 중 4회) |
| FCP·LCP | 1.2~2.7초 | 1.2초            |

## 휴대폰 LCP 편차

4차를 마친 뒤에도 로컬 simulate의 휴대폰 점수는 회차마다 갈렸다.

| 회차 | 1     | 2     | 3     | 4     | 5     |
| ---- | ----- | ----- | ----- | ----- | ----- |
| 점수 | 97    | 78    | 78    | 78    | 80    |
| LCP  | 2.1초 | 4.5초 | 4.5초 | 4.5초 | 4.2초 |

전송량은 다섯 회차 모두 485KB로 같다. 차이는 LCP 요소다. 4.5초인 회차는 React가 로딩 화면을 다시 렌더링한 시작 안내가 LCP로 다시 집계된다. HTML의 첫 렌더링과 같은 문구라 원래는 새 LCP 후보가 아니어야 한다. Chrome은 이전 후보보다 **큰** 요소가 렌더링될 때만 LCP를 갱신하므로, 처음에는 웹 글꼴로 바뀌며 글자 영역이 커지는 것을 원인 후보로 보았다. 이 가설은 Lighthouse의 trace로 검증했다.

### 4초대 회차에서 일어난 일

Lighthouse를 `-GA`(수집한 artifacts 저장) 옵션으로 실행하면 trace가 남는다. trace에서 다음 두 이벤트를 회차마다 추출했다.

- `PaintTimingVisualizer::LayoutObjectPainted`: 글자 블록이 처음 렌더링된 시각과 DOM 노드
- `largestContentfulPaint::Candidate`: LCP 후보로 기록된 시각과 노드, 크기

main을 37회 측정해 분류한 결과다.

| 회차        | HTML 시작 안내 렌더링 | LCP 후보                                          | simulate LCP |
| ----------- | --------------------- | ------------------------------------------------- | ------------ |
| 정상 (30회) | 22~79ms               | HTML 시작 안내. 렌더링 9~28ms 뒤에 기록           | 2.6~3.3초    |
| 4초대 (7회) | 29~55ms               | **React 시작 안내만**. HTML 시작 안내는 기록 없음 | 4.4~4.7초    |

4초대 회차에도 HTML의 시작 안내는 렌더링되었다. 차이는 후보 기록의 유무다. 정상 회차의 후보 기록은 렌더링 뒤 9~28ms에 나타났다. 4초대 회차에서는 그 사이에 React가 렌더링을 시작했고, `App.tsx`가 마운트되는 시각에 `#boot-splash`를 삭제했다. ==후보로 기록되기 전에 노드가 삭제되면 그 후보는 남지 않았다.==

![LCP가 React의 시작 안내로 바뀌는 순서](./images/site-performance-lcp-budget-timeline.svg '전: HTML 시작 안내가 LCP로 기록되기 전에 React가 #boot-splash를 삭제해 React의 시작 안내가 LCP가 된다. 후: #boot-splash를 누를 때까지 남겨 HTML 시작 안내가 LCP로 기록된다')

그러면 다음에 렌더링된 React의 시작 안내가 첫 LCP 후보가 된다. Lighthouse의 simulate[^simulate]는 LCP 시각 전에 실행된 스크립트와 수신한 요청을 LCP에 필요한 작업으로 계산한다. React의 안내는 앱 스크립트가 실행된 뒤에 렌더링되고, 그 사이 웹 글꼴(149KB)도 수신을 마친다. 그래서 같은 화면인데 LCP가 1.3초 늘었다.

<details>
<summary>글꼴 추정이 틀린 근거</summary>

4초대 회차의 React 시작 안내 크기는 3,078px²(웹 글꼴로 렌더링한 회차)이거나 2,754px²(대체 글꼴로 렌더링한 회차)였다. HTML 시작 안내는 3,078px²다. React의 안내가 더 커서 갱신된 것이 아니라, 비교할 이전 후보(HTML 안내)가 없어서 첫 후보가 된 것이다.

</details>

4초대 회차의 비율은 측정 컴퓨터의 부하에 따라 달랐다. 같은 날 앞선 측정에서는 약 절반이었고, 다른 작업 없이 번갈아 측정한 28회에서는 3회였다. 스크립트 수신·실행과 첫 렌더링의 순서가 경합하는 문제라 부하에 따라 결과가 달라진다.

### `#boot-splash` 삭제 시각 조정

**`#boot-splash`를 누르는 시각에 삭제한다.** React의 로딩 화면은 `#boot-splash`와 같은 위치·크기에, DOM 순서상 뒤에 렌더링되어 그 위를 덮는다. 따라서 `#boot-splash`를 바로 삭제하지 않아도 화면은 같다. ==사용자가 누르면 Chrome은 LCP 기록을 끝내므로==, 그 뒤의 삭제는 LCP에 영향이 없다.

```tsx
// 전 (App.tsx)
useEffect(() => {
	document.getElementById('boot-splash')?.remove();
}, []);

// 후: 누른 시각(shellStarted), 로딩 화면이 없으면 처음
useEffect(() => {
	if (shellStarted) document.getElementById('boot-splash')?.remove();
}, [shellStarted]);
```

**React의 시작 안내를 같은 글꼴로 렌더링한다.** `#boot-splash`는 웹 글꼴을 기다리지 않으려고 시스템 글꼴(`-apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`)을 쓴다. React의 안내(`.loading-text`)도 같은 글꼴을 지정해 글자 영역을 맞췄다. 웹 글꼴로 렌더링하면 플랫폼에 따라 HTML 안내보다 커져 새 후보가 될 수 있다. 덤으로 누르기 전에는 웹 글꼴을 수신하지 않는다.

두 화면의 상자와 글자 영역이 같은지는 `e2e/mobile-loading.spec.ts`가 확인한다. HTML 안내는 "탭"과 "클릭"을 `span`으로 나눠 둬서 폭이 소수점 아래에서 조금 다르므로, 0.5px 안의 차이는 같은 것으로 본다.

<details>
<summary>시도했다가 버린 방법: 첫 프레임 뒤에 앱 실행</summary>

처음에는 `main.tsx`가 `requestAnimationFrame` 다음의 `setTimeout`(프레임을 그린 뒤)까지 기다렸다가 `boot`를 import하게 했다. 4초대가 3.5초대로 줄었지만 React 안내가 LCP가 되는 회차는 그대로였다. 렌더링 직후가 아니라 후보 기록 뒤까지 기다려야 했기 때문이다. `PerformanceObserver`로 LCP 보고를 기다리는 방법도 가능하지만, 노드를 남기는 쪽이 대기 없이 같은 결과를 내서 그쪽을 택했다.

</details>

### 5차 결과

같은 컴퓨터에서 main과 이 브랜치를 한 회씩 번갈아 28회씩 측정했다.

![회차별 휴대폰 LCP](./images/site-performance-lcp-budget-runs.svg '전(main) 28회 중 3회가 4.5~4.7초였고, 후 28회는 모두 3.4초 이하다')

| 로컬 휴대폰 simulate | 전 (main)     | 후                    |
| -------------------- | ------------- | --------------------- |
| LCP 4초 이상         | 3회           | **0회**               |
| LCP 범위             | 2.6~4.7초     | **1.7~3.4초**         |
| 성능 점수 범위       | 77~93         | **85~99**             |
| LCP 요소             | 회차마다 다름 | 항상 `#boot-splash p` |
| 첫 방문 전송량       | 487KB         | **278KB**             |
| 진입 후까지의 전송량 | 772KB         | 772KB                 |

데스크톱도 5회 중 1회 LCP가 1.2초(React 안내)였고, 후에는 5회 모두 0.5~0.7초다. 첫 방문 전송량은 775KB에서 278KB가 되었다.

남은 편차(1.7~3.4초)는 ==LCP 요소가 아니라 simulate의 계산에서 생긴다==. LCP 요소는 항상 HTML 안내지만, 그 렌더링 전에 수신을 마친 modulepreload 번들 수가 회차마다 달라 계산 결과가 달라진다.

## 휴대폰 로딩 화면 밖으로 비치던 배경화면

5차와 같은 PR에서 로딩 화면의 다른 문제도 고쳤다. 휴대폰에서 로딩 화면이 화면을 다 덮지 않아 아래쪽에 홈 화면 배경이 비쳤다. Playwright의 휴대폰 흉내로는 재현되지 않아, 원인 후보 두 가지를 모두 처리했다.

| 원인 후보      | 전                                                                          | 후                                                    |
| -------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| 상자 크기      | 로딩 화면 `width: 100vw; height: 100vh`, 홈 화면 `inset: 0; height: 100dvh` | 로딩 화면·`#boot-splash`도 `inset: 0; height: 100dvh` |
| 상자 밖의 배경 | 로딩 화면이 표시되는 즉시 html·body 배경이 배경화면                         | 누르기 전까지 html·body는 검은색(`booting`)           |

iOS Safari의 `vh`는 도구 막대가 접힌 상태(가장 큰 뷰포트) 기준이고, `dvh`는 지금 보이는 영역 기준이다([MDN: 뷰포트 단위](https://developer.mozilla.org/en-US/docs/Web/CSS/length#relative_length_units_based_on_viewport)). 도구 막대가 나타나고 사라질 때 두 상자의 크기가 달라진다. 홈 화면과 같은 상자를 쓰면 홈 화면이 로딩 화면 밖으로 나올 수 없다. 그래도 도구 막대 뒤나 화면을 끌어 내린 영역처럼 상자 밖이 보이면 html·body 배경이 표시되므로, 그 배경을 누르기 전까지 검은색으로 유지한다.

![휴대폰 크기 세 가지에서 로딩 화면과 그 밖에 비치는 배경](./images/site-performance-lcp-budget-coverage.jpg '로딩 화면을 숨겨 그 아래를 찍었다. 전에는 배경화면, 후에는 검은색이다')

배경화면은 누른 뒤 진행 막대가 차는 2.5초 동안 수신한다. 첫 방문 전송량이 줄어든 나머지 몫(휴대폰 60KB, 데스크톱 348KB)이 이것이다. 시험은 390×844, 430×932, 375×667에서 로딩 화면이 뷰포트 전체를 덮는지, 화면 가장자리와 아래쪽 점의 최상위 요소(`elementFromPoint`)가 로딩 화면인지 확인한다. 누른 뒤 홈 화면을 렌더링하는 동안도 확인한다. 실제 iPhone Safari의 도구 막대 동작은 실기기에서 확인할 과제로 남겼다.

## CI 성능 예산

[4차의 회귀](#4차-첫-번들에서-명언-데이터-66kb-빼기)(명언 위젯이 `boot`에 포함, +19KB)는 재측정에서만 발견했다. 기능 PR에서 바로 드러나도록 CI의 `check` 작업에 성능 예산을 추가했다. `apps/react/scripts/perf/budget.mjs`가 빌드 결과의 `index.html`에서 처음부터 요청하는 파일(`<script type="module">`, `modulepreload`, `preload`, `stylesheet`)을 찾아 brotli로 압축한 크기를 측정한다.

| 항목              | 측정값  | 상한      | 여유           |
| ----------------- | ------- | --------- | -------------- |
| `boot` 번들       | 49.4KB  | **55KB**  | 5.6KB (약 10%) |
| 첫 방문 번들 합계 | 251.6KB | **265KB** | 13.4KB (약 5%) |

==상한은 4차의 회귀(+19KB)가 두 항목 모두에서 실패하도록 정했다.== 합계는 번들이 41개라 작은 증가가 누적되므로 여유를 더 작게 두었다. 넘으면 무엇이 얼마나 넘었는지와 크기 상위 파일을 출력한다.

```text
$ BUDGET_BOOT_KB=45 BUDGET_INITIAL_KB=240 pnpm --filter @macfolio/react perf:budget
boot 번들(assets/boot-wshPrf4V.js)이 49.4KB로, 상한 45.0KB보다 4.4KB 큽니다.

첫 방문 번들(index.html이 처음부터 요청하는 41개)이 251.7KB로, 상한 240.0KB보다 11.7KB 큽니다.
크기 상위 8개:
    59.4KB  assets/jsx-runtime-C2l8KVV-.js
    49.4KB  assets/boot-wshPrf4V.js
    34.6KB  assets/boot-DhNtOT2g.css
    28.8KB  assets/preload-helper-qmxL7HwO.js
    ...
```

위는 환경 변수로 상한을 낮춰 실패시킨 예다.

> [!TIP] 예산을 넘었을 때의 대응
> 넘었을 때의 대응(커진 번들 찾기, `React.lazy`로 분리, 꼭 필요하면 상한과 문서를 함께 올리기)은 저장소의 [`docs/performance.md`](https://github.com/hyeoniverse/MacFolio/blob/main/docs/performance.md#성능-예산)에 정리했다.

글꼴·이미지는 예산에 넣지 않았다. 이번 변경으로 첫 방문(누르기 전)에는 수신하지 않기 때문이다.

## 남은 과제

- **4·5차의 운영 측정:** 배포한 뒤 운영 주소로 다시 측정한다
- **진입 후의 배경화면:** 느린 네트워크에서 데스크톱 배경화면(348KB)이 진행 막대가 차는 2.5초 안에 도착하지 않으면, 로딩 화면이 걷힌 직후 잠시 검은 바탕이 보일 수 있다. 실제로 느리게 한 측정으로 확인한다
- **실기기 확인:** iPhone Safari에서 로딩 화면이 도구 막대 아래까지 덮는지 확인한다

측정 조건과 다시 측정하는 명령은 저장소의 [`docs/performance.md`](https://github.com/hyeoniverse/MacFolio/blob/main/docs/performance.md)에 정리했다.

## 관련 글

- [Lighthouse 병목 분석과 글꼴 subset·lazy import·modulepreload·WebP로 첫 방문 전송량 9MB를 0.8MB로](/memo/site-performance-diet): 측정 조건, 병목 분석, `#boot-splash`와 시작 안내를 HTML로 옮긴 1~3차
- [180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets): 명언 위젯이 놓이는 바탕화면 위젯

[^lcp]: Largest Contentful Paint. 화면에 보이는 가장 큰 글자 블록이나 이미지가 렌더링된 시각이다. [web.dev 설명](https://web.dev/articles/lcp)

[^simulate]: Lighthouse의 기본 측정 방식. 페이지는 빠른 네트워크로 불러오고, 기록한 요청과 작업으로 느린 네트워크·CPU에서 걸릴 시간을 계산한다. [Lighthouse 문서](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)

[^fcp]: First Contentful Paint. 글자나 이미지가 처음 렌더링된 시각이다. [web.dev 설명](https://web.dev/articles/fcp)

#MacFolio #성능 #Lighthouse #LCP #코드분할 #회귀 #CI
