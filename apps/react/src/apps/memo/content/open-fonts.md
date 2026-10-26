---
title: OS마다 다르던 글꼴을 하나로 — Apple 글꼴 배포를 멈추고 Pretendard·JetBrains Mono·Noto Serif KR로
date: 2026-10-26
category: 개발기/MacFolio/프론트엔드
summary: 같은 화면이 macOS와 Windows·Android·Linux에서 다른 글꼴로 보였다. 원인은 -apple-system을 맨 앞에 둔 글꼴 지정과 Regular 한 굵기의 웹 글꼴이었고, 그 웹 글꼴은 웹 배포 허락이 없는 Apple 글꼴이었다. 오픈 라이선스 글꼴로 바꾸고 전송량을 측정했다.
---

같은 사이트를 macOS에서 볼 때와 Windows·Android·Linux에서 볼 때 글꼴이 달랐다. 영문과 숫자의 모양, 굵은 글씨, 코드 블록의 고정폭 글꼴이 모두 기기에 따라 바뀌었다. 이 글은 원인, 라이선스 문제, 새 글꼴을 고른 근거, 바꾼 뒤 전송량을 정리한다([#384](https://github.com/hyeoniverse/MacFolio/pull/384)).

![고치기 전: macOS와 Linux](./images/open-fonts-before-os.jpg '고치기 전. 같은 빌드를 macOS Chromium과 Linux Chromium(CI와 같은 Playwright Docker 이미지)에서 열었다. 영문·숫자·고정폭·굵은 글씨가 다르다')

![고친 뒤: macOS와 Linux](./images/open-fonts-after-os.jpg '고친 뒤. 두 OS가 같은 글꼴을 받는다. 글자 사이 간격의 미세한 차이는 Linux Chromium이 글자 폭을 화소 단위로 반올림해 생긴다')

## OS마다 달랐던 이유

고치기 전 본문 글꼴 지정은 `font-family: -apple-system, MacSystemFont, Arial, sans-serif`였다(`index.css`, 같은 모양의 지정이 20여 곳). 브라우저는 목록의 앞에서부터 기기에 있는 글꼴을 쓴다.

| 영역                                         | macOS·iOS                             | Windows·Android·Linux                                       |
| -------------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| 본문 영문·숫자                               | `-apple-system` → SF Pro              | 웹 글꼴 `MacSystemFont`의 라틴 글자                         |
| 본문 한글                                    | `-apple-system` → Apple SD Gothic Neo | 웹 글꼴 `MacSystemFont`(Apple SD Gothic Neo Regular)        |
| 굵은 글씨 (`font-weight` 500\~800, 약 500곳) | 시스템의 실제 굵기                    | 웹 글꼴은 Regular 한 굵기뿐이라 브라우저가 획을 두껍게 합성 |
| 코드 (`ui-monospace, 'SF Mono', Menlo, …`)   | SF Mono                               | Consolas·DejaVu Sans Mono 등 OS마다 다름                    |
| 명조 (`'Nanum Myeongjo', 'AppleMyungjo', …`) | AppleMyungjo                          | 기기에 있는 명조, 없으면 기본 serif                         |

같은 웹 글꼴을 받은 기기끼리도 굵은 글씨는 합성이라 실제 굵은 글꼴과 모양이 다르다. 앞서 CI에서 휴대폰 위젯 높이가 2px 달라진 것도 이 차이였다([머지하자 CI가 연달아 실패한 원인](/memo/ci-failures-after-merges)).

## 라이선스: Apple 글꼴은 웹으로 배포할 수 없다

`-apple-system`을 앞에 둔 것은 Apple 기기에서 기기의 글꼴을 부르는 것이라 문제가 없다. 문제는 그 밖의 기기를 위해 `public/fonts/`에 둔 Apple SD Gothic Neo 파일(TTF 9종, woff2 2조각)이었다.

- **SF Pro:** Apple이 [글꼴 페이지](https://developer.apple.com/fonts/)에서 배포하는 라이선스는 Apple 운영체제용 소프트웨어의 UI 시안(mock-up) 제작으로 쓰임을 한정한다. Apple 개발자 포럼의 답변도 웹 글꼴로 쓰지 말고 `-apple-system`·`system-ui`로 기기의 글꼴을 부르라고 안내한다([포럼 1](https://developer.apple.com/forums/thread/733267), [포럼 2](https://developer.apple.com/forums/thread/127350)). 상업·비상업으로 나뉘는 조건이 아니다.
- **Apple SD Gothic Neo:** macOS·iOS에 들어 있는 글꼴이다. Apple의 라이선스 원문은 찾지 못했다. 웹 배포를 허락한다는 근거도 찾지 못했다. 기기 안에서 쓰는 것과 파일을 서버에 올려 다른 기기에 내려보내는 것은 다른 행위라, 배포를 멈추는 쪽으로 판단했다.

그래서 화면 통일과 함께, 웹 배포가 허락된 글꼴로 바꾸는 것이 목표가 되었다.

## 고른 글꼴

모두 [SIL Open Font License 1.1](https://openfontlicense.org)이라 웹 글꼴로 함께 배포할 수 있다. 외부 CDN을 쓰지 않고 빌드 결과에 포함한다(사이트 CSP의 `font-src 'self'`).

| 용도   | 글꼴                                                                           | 고른 근거                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 본문   | [Pretendard](https://github.com/orioncactus/pretendard) Variable               | 한글과 라틴을 함께 설계했고 Apple 시스템 글꼴과 비슷한 인상이라 기존 화면이 크게 바뀌지 않는다. 가변 글꼴 하나에 굵기 45\~920이 있어 굵은 글씨를 합성하지 않는다 |
| 고정폭 | [JetBrains Mono](https://github.com/JetBrains/JetBrainsMono) Variable          | 라틴 조각이 39KB. 한글이 든 고정폭 글꼴(D2Coding 등)은 한글 글자 수만큼 파일이 커서, 코드 블록의 한글은 다음 글꼴인 Pretendard로 그린다                          |
| 명조   | [Noto Serif KR](https://fonts.google.com/noto/specimen/Noto+Serif+KR) Variable | Safari 프로젝트 페이지의 명조 제목. [Fontsource](https://fontsource.org) 패키지가 `unicode-range` 조각으로 나눠 둔 것을 쓴다                                     |

이모지는 범위에서 뺐다. 기기의 이모지 글꼴을 쓰고, 같게 하려면 이모지 글꼴(수 MB)을 받아야 한다.

![휴대폰 홈](./images/open-fonts-iphone.jpg '휴대폰 홈(iPhone 15, WebKit). 고치기 전에는 Apple 기기라 시스템 글꼴, 고친 뒤에는 다른 기기와 같은 Pretendard')

![Safari 프로젝트 페이지의 고정폭](./images/open-fonts-safari-mono.jpg 'DevCourse 터미널 화면. 고정폭이 SF Mono에서 JetBrains Mono로 바뀌었다')

## 글꼴 지정을 변수 셋으로

글꼴 이름을 파일마다 적던 것을 `src/styles/fonts.css`의 변수 셋으로 모았다. CSS 34개 파일의 지정을 이 변수로 바꿨다.

```css
:root {
	--font-sans:
		'Pretendard Variable', -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic',
		sans-serif;
	--font-mono: 'JetBrains Mono Variable', 'Pretendard Variable', ui-monospace, Menlo, Consolas, monospace;
	--font-serif: 'Noto Serif KR Variable', Georgia, 'Times New Roman', serif;
}
```

`-apple-system` 등은 웹 글꼴을 받기 전이나 받지 못했을 때만 쓰인다. 입력 칸·버튼은 브라우저 기본값이 시스템 글꼴이라, `reset` 층에 `font-family: inherit`를 더해 사이트 글꼴을 물려받게 했다.

예외가 둘 있다.

- **로딩 화면 안내 문구:** HTML이 스크립트보다 먼저 그리는 문구라 웹 글꼴을 기다리지 않는 시스템 글꼴 그대로 둔다. 웹 글꼴로 바꾸면 글자 영역이 달라져 LCP가 다시 집계된다([성능 5차](/memo/site-performance-lcp-budget)).
- **글의 SVG 도식:** `<img>`로 넣은 SVG는 페이지의 웹 글꼴을 쓸 수 없다. 도식 안의 글자는 지금처럼 기기의 글꼴로 그려진다.

## 조각 나누기: 동적 서브셋 92조각 대신 core 하나

처음에는 Pretendard 패키지의 동적 서브셋(`pretendardvariable-dynamic-subset.css`, 92조각)을 그대로 불러왔다. 자주 쓰는 순서로 글자를 나눠, 화면에 있는 글자의 조각만 받는 방식이다. 측정해 보니 두 가지가 맞지 않았다.

| 항목                                                    | 동적 서브셋 92조각                        | 직접 나눈 core + ext 8조각 |
| ------------------------------------------------------- | ----------------------------------------- | -------------------------- |
| 메모 앱 첫 화면(글 234편의 제목·요약)이 받는 Pretendard | 92조각 중 거의 전부, 약 1.7MB             | core 하나, 456KB           |
| `@font-face` CSS (첫 방문 번들에 포함, brotli)          | 약 14.6KB → 성능 예산 265KB 초과(271.4KB) | 1KB 미만 → 259.7KB         |

글 목록은 한 화면에 다양한 한글이 나와 빈도 순 조각이 거의 다 필요했다. 그래서 예전 Apple 글꼴과 같은 방식([첫 방문 전송량 9MB를 0.8MB로](/memo/site-performance-diet))으로 `scripts/subset-font.py`를 다시 썼다.

- **core:** 영문·숫자·라틴-1, 문장 부호, 화살표, 한글 자모, KS X 1001 완성형 2,350자. 가변 글꼴이라 굵기 전체를 포함해 456KB
- **ext-0\~7:** 나머지 한글 8,822자를 코드 순서로 8등분(각 170\~210KB). 저장소의 글과 화면 문구 전체에서 KS X 1001 밖 글자는 '긂·똠·햏' 세 글자, 글 2편뿐이었다

![글꼴을 고르는 순서](./images/open-fonts-stack.svg '도식. 고치기 전과 고친 뒤의 글꼴 지정, core와 ext 조각')

<details>
<summary>core가 ext보다 먼저 쓰이는 이유</summary>

ext의 `unicode-range`는 코드 범위(예: `U+AC02-B1C1`)라 자주 쓰는 글자도 범위 안에 든다. 같은 이름(`'Pretendard Variable'`)의 `@font-face`가 여럿이면 브라우저는 나중에 정의한 것부터 찾고, 그 글꼴에 글자가 없을 때만 앞의 것으로 간다([CSS Fonts 4](https://www.w3.org/TR/css-fonts-4/#font-matching-algorithm)). core를 맨 마지막에 정의해, 자주 쓰는 글자는 core에서 찾고 ext는 core에 없는 글자가 화면에 있을 때만 받는다. Linux Chromium에서 `document.fonts`를 확인하면 첫 화면 뒤 core는 `loaded`, ext 8개는 `unloaded`다.

</details>

## 전송량 (고치기 전·후)

`vite preview`로 연 화면에서 Playwright로 글꼴 파일(woff2·woff) 요청을 집계했다. 같은 파일은 한 번만 셌고, Font Awesome 아이콘 글꼴을 포함한다.

| 화면                   | 전 (Chromium) | 전 (WebKit) | 후      |
| ---------------------- | ------------- | ----------- | ------- |
| 데스크톱 첫 화면       | 397KB         | 248KB       | 1,187KB |
| Safari 프로젝트 페이지 | 284KB         | 136KB       | 631KB   |
| 휴대폰 홈 (iPhone 15)  | -             | 136KB       | 591KB   |

- **고치기 전 구성:** Font Awesome 아이콘 248KB(데스크톱)에, Chromium은 Apple 글꼴 core 149KB를 더 받았다. WebKit(Apple 기기)은 시스템 글꼴이라 받지 않았다
- **고친 뒤 데스크톱 구성:** 아이콘 248 + Pretendard core 456 + Noto Serif KR 443 + JetBrains Mono 39KB. Chromium과 WebKit이 같다
- **늘어난 양:** 같은 화면을 보여 주는 대가다. 예전 Apple 기기는 기기의 글꼴을 써서 받지 않았고, 그 밖의 기기는 Regular 한 굵기(149KB)만 받았다. 지금은 모든 기기가 굵기 전체가 든 가변 글꼴(456KB)을 받는다.
- **데스크톱의 Noto Serif KR 443KB:** 첫 화면에 열려 있는 Safari 창의 프로젝트 페이지가 명조 제목을 쓴다. 명조 조각 11개를 받는다.
- **첫 방문 번들 예산:** `perf:budget` 기준 256.4KB → 259.7KB(상한 265KB, brotli). 글꼴 파일 자체는 이 예산에 들어가지 않는다(`index.html`이 처음부터 요청하는 파일만 집계).
- **캐시:** 글꼴은 Vite가 해시를 붙인 `assets/` 파일이라 다시 방문하면 받지 않는다.

PDF 이력서와 공유 카드도 Pretendard로 바꿨다. 브라우저의 react-pdf(fontkit)는 woff를 풀 때 Node의 `Buffer`가 필요해 PDF는 OTF(Regular·Bold)를, Node에서 그리는 공유 카드(satori)는 woff2를 읽지 못해 woff(Medium·Bold)를 쓴다.

## 시험

- **E2E 전체 (CI=1, desktop-chromium·mobile-iphone·mobile-android):** 처음 실행에서 PDF 이력서 시험 3개가 실패했다. react-pdf가 woff를 읽지 못해(`Buffer is not defined`) 다운로드가 일어나지 않았고, OTF로 바꿔 통과했다. 그 밖에 실패한 메모 시험은 다른 빌드를 동시에 돌린 부하에서 생긴 것으로, 작업자 수를 줄여 다시 실행해 통과했다
- **공유 카드 시험:** Pretendard woff로 카드를 그려 통과
- **단위 시험:** 1,205개 통과

## 관련 글

- [첫 방문 전송량 9MB를 0.8MB로 — 글꼴, 글 원문, 앱 코드, 이미지 최적화 과정](/memo/site-performance-diet): Apple 글꼴을 core·ext로 나눴던 1차 최적화
- [성능 5차 — 휴대폰 LCP가 4초대로 다시 집계되던 원인과 CI 성능 예산](/memo/site-performance-lcp-budget): 첫 방문 번들 예산과 로딩 문구의 글꼴
- [PR을 머지하자 CI가 연달아 실패한 원인 네 가지](/memo/ci-failures-after-merges): 글꼴마다 다른 줄 높이로 위젯 크기가 달라진 사례

#MacFolio #글꼴 #웹폰트 #라이선스 #성능
