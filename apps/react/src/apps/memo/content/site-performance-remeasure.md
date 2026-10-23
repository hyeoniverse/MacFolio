---
title: 성능 재측정 — 운영 휴대폰 98점, 그리고 다시 커진 첫 번들
date: 2026-10-23
category: 개발기/MacFolio/프론트엔드
summary: 3차까지 배포된 운영 사이트를 다시 측정했다. 휴대폰 98점(LCP 1.9초), 데스크톱 97점(LCP 1.0초). 같은 측정에서 명언 위젯의 데이터 66KB가 첫 번들에 들어간 것을 찾아 lazy로 분리했다.
---

[성능 측정 리포트](/memo/site-performance-report)에서 첫 방문 성능을 세 차례 개선했다([#319](https://github.com/hyeoniverse/MacFolio/pull/319) 1차, [#323](https://github.com/hyeoniverse/MacFolio/pull/323) 2·3차). 그 뒤 운영 사이트에서는 1차 배포 후의 값만 측정했고, 2·3차가 배포된 운영 사이트는 측정하지 않았다. 그사이 명언 위젯([#330](https://github.com/hyeoniverse/MacFolio/pull/330)), 활동 상태 보기의 IP 표 같은 기능도 추가했다. 그래서 같은 조건으로 다시 측정했다. 재측정과 4차 개선은 [#338](https://github.com/hyeoniverse/MacFolio/pull/338)에 있다.

결론부터 적는다.

- **운영 사이트:** 휴대폰 98점(LCP[^lcp] 1.9초, 첫 방문 전송량 602KB), 데스크톱 97점(LCP 1.0초, 889KB). 1차 배포 후의 73점·89점에서 각각 25점, 8점 올랐다.
- **로컬:** 첫 방문 전송량이 3차보다 22KB 늘어 있었다. 원인은 명언 위젯의 명언 365개가 첫 번들(`boot`)에 들어간 것이었다. 위젯을 lazy로 분리해 3차 수준으로 되돌렸다(4차).

## 측정 조건

측정 조건은 앞 글과 같다.

- **도구:** [Lighthouse](https://developer.chrome.com/docs/lighthouse/overview) 12.8.2(성능 항목만), Playwright 1.64(Chromium 156)
- **휴대폰:** Lighthouse 기본값. 느린 4G(왕복 150ms, 1.6Mbps)와 4배 느린 CPU를 시뮬레이션한다(simulate[^simulate])
- **데스크톱:** `--preset=desktop` (왕복 40ms, 10Mbps)
- **로컬 서버:** 빌드 결과를 `apps/react/scripts/perf/serve.mjs`로 제공한다. 텍스트 파일은 brotli로 압축한다
- **횟수:** 5회씩 측정하고 중앙값을 쓴다. 한 번에 하나씩 실행하고, 빌드나 시험과 겹친 측정은 버렸다

<details>
<summary>측정 중의 실수: 이전 빌드를 측정한 일</summary>

전날 측정에 쓴 정적 서버가 같은 포트(4810)를 아직 점유하고 있었다. 새 서버는 `EADDRINUSE`로 시작하지 못했고, 측정 스크립트는 **이전 빌드를 제공하던 서버**를 측정했다. 진입 단계에서 로딩 화면을 찾지 못해 측정이 실패했고, 이 실패로 원인을 확인했다. 비어 있는 포트(4811)로 다시 측정했고, `docs/performance.md`의 측정 방법에 이 주의 사항을 추가했다.

</details>

## 운영 사이트

![운영 사이트의 LCP, FCP, 첫 방문 전송량](./images/site-performance-remeasure-production.svg '개선 전, 1차 배포 후, 3차 배포 후(재측정)의 운영 사이트 측정값. 휴대폰 LCP는 31.5초에서 1.9초가 되었다')

| 항목            | 휴대폰 개선 전 | 1차 배포 후 | 3차 배포 후    | 데스크톱 개선 전 | 1차 배포 후 | 3차 배포 후     |
| --------------- | -------------- | ----------- | -------------- | ---------------- | ----------- | --------------- |
| Lighthouse 성능 | 53             | 73          | **98** (86~98) | 60               | 89          | **97** (96~100) |
| FCP             | 15.0초         | 2.4초       | **1.9초**      | 2.9초            | 0.9초       | **1.0초**       |
| LCP             | 31.5초         | 7.1초       | **1.9초**      | 5.8초            | 2.1초       | **1.0초**       |
| 첫 방문 전송량  | 6,342KB        | 1,239KB     | **602KB**      | 7,134KB          | 3,229KB     | **889KB**       |

3차 배포 후 운영에서는 FCP[^fcp]와 LCP가 같다. 3차에서 로딩 화면 뒤의 홈 화면을 누른 뒤에 렌더링하도록 바꿨다. 그래서 첫 렌더링(HTML의 사과와 "탭하여 로딩을 시작하세요")이 곧 최대 콘텐츠다.

휴대폰 점수는 5회 중 3회가 98점, 2회가 86~87점이었다. 86점인 회차는 LCP가 3.1~3.3초였다. 로컬에서도 같은 현상이 있다(아래).

### 운영이 로컬보다 무거운 이유

같은 코드인데 운영의 첫 방문 전송량이 로컬보다 약 100KB 크다(휴대폰 602KB, 로컬 505KB). 운영과 로컬을 같은 방법으로 열어 파일별 전송량을 비교했다.

- **JS 압축 수준:** 파일 목록은 같다. 다만 같은 파일이 운영에서 10~15% 크다(`boot` 70KB → 80KB, `jsx-runtime` 60KB → 66KB). 로컬 측정 서버는 brotli 최고 압축(품질 11)으로 미리 압축해 두지만, Cloudflare는 응답마다 압축하므로 더 낮은 수준을 쓴다([Cloudflare 압축 문서](https://developers.cloudflare.com/speed/optimization/content/compression/)).
- **HTML:** 운영 Worker가 검색엔진용으로 첫 화면 본문을 HTML에 삽입한다. 로컬 `index.html`은 2KB, 운영은 15KB다.

반대로 운영은 HTTP/2라 번들 33개를 한 연결로 동시에 수신한다. 로컬 서버는 HTTP/1.1이라 동시 연결 6개로 대기열이 생긴다. 그래서 전송량은 더 크지만 휴대폰 FCP는 운영(1.9초)이 로컬 simulate(3.2초)보다 빠르다.

## 로컬: 첫 번들이 다시 커졌다

로컬 측정값은 3차와 거의 같았지만, 첫 방문 전송량만 조금 늘어 있었다.

| 항목            | 3차   | 재측정 (개선 전) | 4차   |
| --------------- | ----- | ---------------- | ----- |
| 휴대폰 전송량   | 483KB | 505KB            | 485KB |
| 데스크톱 전송량 | 771KB | 793KB            | 772KB |

22KB는 작은 값이지만, 성능 개선 뒤에 기능을 추가하면서 첫 번들이 다시 커지는 회귀다. 기능을 계속 추가하면 같은 방식으로 누적되므로 원인을 추적했다.

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

## 실제로 느리게 한 휴대폰

simulate는 빠른 네트워크에서 수신한 기록으로 느린 네트워크의 시간을 계산한다. 브라우저를 실제로 느리게 하는 방식(`--throttling-method=devtools`)으로도 측정했다.

| 항목    | 3차       | 4차              |
| ------- | --------- | ---------------- |
| 점수    | 92        | 100 (5회 중 4회) |
| FCP·LCP | 1.2~2.7초 | 1.2초            |

## 아직 풀지 못한 것: 휴대폰 LCP의 편차

로컬 simulate의 휴대폰 점수는 이번에도 갈렸다.

| 회차 | 1     | 2     | 3     | 4     | 5     |
| ---- | ----- | ----- | ----- | ----- | ----- |
| 점수 | 97    | 78    | 78    | 78    | 80    |
| LCP  | 2.1초 | 4.5초 | 4.5초 | 4.5초 | 4.2초 |

전송량은 다섯 회차 모두 485KB로 같다. 차이는 LCP 요소다. 4.5초인 회차는 React가 로딩 화면을 다시 렌더링한 시작 안내가 LCP로 다시 집계된다. HTML의 첫 렌더링과 같은 문구라 원래는 새 LCP 후보가 아니어야 한다. Chrome은 이전 후보보다 **큰** 요소가 렌더링될 때만 LCP를 갱신하므로, 웹 글꼴로 바뀌며 글자 영역이 조금 커지는 것으로 추정한다. 아직 확인하지 못해 다음 과제로 남긴다.

## 다음 과제

- **CI 성능 예산:** 이번 회귀는 재측정에서만 발견했다. 첫 방문 전송량과 `boot` 크기에 상한을 설정하고 CI에서 검사하면, 기능을 추가하는 PR에서 바로 드러난다
- **휴대폰 LCP 편차:** 위의 추정을 확인한다
- **4차의 운영 측정:** 배포한 뒤 다시 측정해 이 글에 더한다

측정 조건과 다시 측정하는 명령은 저장소의 [`docs/performance.md`](https://github.com/hyeoniverse/MacFolio/blob/main/docs/performance.md)에 정리했다. 앞선 개선 과정은 [첫 방문 전송량 9MB를 0.8MB로](/memo/site-performance-diet)에 있다.

## 관련 글

- [성능 측정 리포트 — 휴대폰 LCP 25.7초에서 3.2초로](/memo/site-performance-report)
- [첫 방문 전송량 9MB를 0.8MB로 — 글꼴, 글 원문, 앱 코드, 이미지 최적화 과정](/memo/site-performance-diet)
- [바탕화면과 홈 화면에 위젯 — 칸 격자, 같이 쓰는 부품, 한 번만 묻는 날씨](/memo/desktop-widgets)

[^lcp]: Largest Contentful Paint. 화면에 보이는 가장 큰 글자 덩어리나 이미지가 렌더링된 시각이다. [web.dev 설명](https://web.dev/articles/lcp)

[^fcp]: First Contentful Paint. 글자나 이미지가 처음 렌더링된 시각이다. [web.dev 설명](https://web.dev/articles/fcp)

[^simulate]: Lighthouse의 기본 측정 방식. 페이지는 빠른 네트워크로 불러오고, 기록한 요청 순서와 크기로 느린 네트워크에서 걸릴 시간을 계산한다.

#MacFolio #성능 #Lighthouse #코드분할 #회귀
