---
title: CSS 파일 로드 순서와 무관하게 @layer 순서를 index.html에서 먼저 선언하기
date: 2026-10-12
category: 개발 기록/MacFolio/트러블슈팅
series: CSS 정리
seriesOrder: 3
summary: 공통 Button의 안쪽 여백이 0으로 계산되고 있었다. 빌드 결과에서 공통 컴포넌트 CSS 파일이 main CSS보다 먼저 로드되어 components 층이 reset 층보다 먼저 정의됐고, reset의 * { padding: 0 }이 우선 적용됐다. 층 순서 선언을 index.html 인라인 스타일로 옮겨 모든 CSS보다 먼저 선언했다.
---

| 증상                                     | 원인                                                                                     | 해결                                                   | 영향 범위                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| 공통 `Button`의 안쪽 여백이 0으로 계산됨 | 빌드 결과에서 공용 청크 CSS가 먼저 로드되어 `components` 층이 `reset` 층보다 먼저 정의됨 | 층 순서 선언을 `index.html` 인라인 `<style>` 맨 앞으로 | 빌드 결과의 공용 청크에 든 공통 컴포넌트 (개발 서버는 정상) |

## 배경

### 캐스케이드와 명시도

CSS에서 한 요소에 같은 속성을 지정한 규칙이 여러 개 있으면, 브라우저는 **캐스케이드(cascade)**라는 정해진 순서로 이길 규칙 하나를 고른다. 출처(브라우저 기본 스타일, 작성자 스타일)와 `!important`를 먼저 비교하고, 그다음 **명시도(specificity)**를 비교한다. 명시도는 선택자가 요소를 얼마나 구체적으로 가리키는지를 `(ID 수, 클래스·속성·가상 클래스 수, 태그 수)` 세 자리로 나타낸 점수다. 예를 들어 `*`는 `(0,0,0)`, `.ui-button`은 `(0,1,0)`, `.memo button`은 `(0,1,1)`이다. 점수까지 같으면 문서에서 나중에 나온 규칙이 이긴다.

### 캐스케이드 층(@layer)

명시도 비교는 앱이 커질수록 문제가 된다. 앱 전체에 적용할 기본값 `.memo button { color: inherit }`(0,1,1)을 두면, 공통 버튼 컴포넌트의 `.ui-button { color: white }`(0,1,0)가 점수에서 져서 `!important`로 덮어야 한다. [캐스케이드 층](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)은 이 경쟁을 층 단위로 끊는 기능이다. 규칙을 `@layer 이름 { … }`으로 묶으면 다음 규칙이 적용된다.

1. 층끼리는 **나중에 정의된 층**이 이긴다.
2. 명시도는 **같은 층 안에서만** 비교한다. 다른 층의 규칙끼리는 명시도와 무관하게 층 순서로 결정된다.
3. 어느 층에도 속하지 않은 규칙은 모든 층보다 우선한다.

층 순서는 `@layer reset, components;`처럼 이름만 나열한 문장으로 미리 정할 수 있다. 다만 브라우저는 ==문서 전체에서 각 층 이름이 처음 등장한 순서==로 층 순서를 확정한다. 순서 선언보다 `@layer components { … }` 블록이 먼저 읽히면 그 시각에 `components`가 첫 번째 층으로 정해진다.

MacFolio는 [CSS @layer로 명시도와 무관하게 앱 기본값의 우선순위 낮추기](/memo/css-layer-reset)에서 `reset`(앱 기본값)과 `components`(공통 컴포넌트) 두 층을 만들었다.

![왼쪽은 reset, components 순서로 components 층의 .ui-button 여백이 이기고, 오른쪽은 순서가 뒤집혀 reset 층의 * { padding: 0 }이 이긴다](./images/css-layer-order-fix-precedence.svg '같은 두 규칙이라도 층 순서에 따라 결과가 바뀐다')

### 번들 분할과 공용 청크

Vite는 배포용 빌드에서 소스 파일을 묶어 몇 개의 JavaScript·CSS 파일(청크)로 만든다. `React.lazy`나 `import()`로 나중에 불러오는 앱은 별도 청크가 되고, 여러 청크가 함께 쓰는 모듈은 한 번만 내려받도록 **공용 청크**로 분리된다. CSS도 청크 단위로 별도 파일이 된다([Vite CSS 코드 분할](https://vite.dev/guide/features.html#css-code-splitting)). 반면 개발 서버(`vite dev`)는 번들을 만들지 않고, 모듈을 import하는 순서대로 `<style>` 요소를 문서에 삽입한다. 그래서 같은 코드라도 CSS가 문서에 등장하는 순서가 개발 서버와 빌드 결과에서 다를 수 있다.

## 증상

메일 앱에서 서버 응답이 실패하면 "서버에서 문제가 생겼습니다."가 표시된다. 이 문구가 데스크톱과 휴대폰 모두 12px로 작고, 위아래 목록과 여백 없이 붙어 있었다. 이 문구를 수정하면서 같은 화면의 다른 여백도 확인하다가, 본문 아래 "김정현에게 답장" 버튼의 파란 배경이 글자에 바로 붙어 있는 것을 발견했다.

![왼쪽은 층 순서가 components, reset일 때 답장 버튼의 파란 배경이 글자에 붙어 있고, 오른쪽은 reset, components일 때 좌우에 여백이 있다](./images/css-layer-order-fix-button-compare.jpg '빌드 결과의 층 순서를 개발 서버에서 재현해 촬영. 왼쪽 padding 0px, 오른쪽 5px 14px')

위 그림의 왼쪽은 `index.html`의 순서 선언을 `@layer components, reset;`으로 바꿔 빌드 결과의 층 순서를 재현한 화면이다. 버튼의 계산된 `padding`은 `0px`이고, `reset` 층의 글자색 기본값도 함께 이겨 글자가 흰색이 아니라 본문과 같은 검은색이다.

> [!WARNING] 빌드 결과에서만 발생
> 이 문제는 빌드 결과에서만 발생한다. 개발 서버는 CSS를 import 순서대로 삽입하기 때문이다.

## 원인 추적

### 버튼의 안쪽 여백이 0이었다

버튼의 계산된 스타일을 확인하니 `padding`이 `0px`이었다. 이 버튼은 공통 컴포넌트 `Button`이고, 여백은 `.ui-button { padding: 5px 14px }`로 지정되어 있었다. 이 값보다 우선 적용된 규칙은 `index.css`의 `* { padding: 0 }`이었다.

두 규칙 모두 층 안에 있다. 정한 순서는 다음과 같다.

```css
/* styles/layers.css: main.tsx가 가장 먼저 불러온다 */
@layer reset, components;
```

[배경](#캐스케이드-층layer)의 규칙대로라면 `.ui-button`(명시도 0,1,0)이든 `*`(0,0,0)든 관계없이 `components` 층의 여백이 `reset` 층보다 우선해야 한다. 이 순서를 전제로 `Button.css`는 `!important` 없이 여백을 지정했다.

```css
/* shared/ui/button/Button.css */
@layer components {
	.ui-button {
		padding: var(--ui-button-padding, 5px 14px);
		/* … */
	}
}
```

### 빌드한 HTML의 CSS 연결 순서

![빌드한 HTML에서 CSS 파일이 붙는 순서와 층 순서](./images/css-layer-order-fix.svg '공통 컴포넌트 CSS가 든 파일이 먼저 붙어 components 층이 먼저 정해졌다')

빌드한 `index.html`을 확인하니 CSS 파일이 다음 순서로 연결되어 있었다.

```html
<link rel="stylesheet" href="/assets/repository-….css" /> <link rel="stylesheet" href="/assets/main-….css" />
```

`repository-….css`는 여러 앱이 공유하는 코드를 묶은 파일이고, 공통 컴포넌트의 CSS가 포함되어 있다. 첫 줄이 `@layer components { … }`다. 이 파일이 `main-….css`보다 먼저 로드되므로 문서에 처음 등장한 층은 `components`이고 `reset`은 그다음이다. 그 결과 순서가 `components, reset`으로 결정되어 `reset`이 우선한다.

## 원인

> [!IMPORTANT] 층 순서는 문서에서 처음 등장한 위치가 결정한다
> `@layer reset, components;` 선언이 있어도, 브라우저는 문서 안에서 각 층 이름이 처음 등장한 순서로 층 순서를 결정한다.

### 공용 청크 CSS가 먼저 로드되는 이유

공통 `Button`은 여러 앱이 import하므로 ==공용 청크에 포함됐다.== HTML에는 의존 순서대로 진입점이 의존하는 공용 청크의 CSS가 먼저, 진입점(`main`)의 CSS가 나중에 연결된다. 개발 서버는 모듈마다 `<style>`을 import 순서대로 삽입하기 때문에, `main.tsx`가 가장 먼저 import하는 `layers.css`가 맨 앞에 와서 문제가 없었다.

![main.tsx와 여러 앱이 함께 import하는 공통 Button이 공용 청크 repository-….css로 분리되고, 빌드한 HTML에서 이 파일이 main-….css보다 먼저 연결된다](./images/css-layer-order-fix-chunks.svg '여러 곳에서 쓰는 Button의 CSS가 공용 청크 파일로 분리되어 먼저 연결된다')

| 환경      | 첫 번째 CSS                                | 결정된 층 순서         | `Button` 여백 |
| --------- | ------------------------------------------ | ---------------------- | ------------- |
| 개발 서버 | `layers.css` (`@layer reset, components;`) | `reset` → `components` | `5px 14px`    |
| 빌드 결과 | 공용 청크 CSS (`@layer components { … }`)  | `components` → `reset` | `0px`         |

`layers.css`의 순서 선언은 `main-….css` 안에 포함되어 있어서 너무 늦게 등장했다. 게다가 빌드 결과에는 선언 한 줄이 별도로 남지 않고 바로 뒤의 `@layer reset { … }`과 병합되어 있었다.

![개발 서버는 layers.css가 맨 앞, 빌드는 공용 CSS가 맨 앞이라 층 순서가 뒤집혔다. 인라인 선언이 이를 고친다](./images/css-layer-order-fix-dev-vs-build.svg '같은 코드라도 개발 서버와 빌드 결과에서 층 순서가 달랐다')

## 해결

### 검토한 방법

| 방법                                                      | 장점                                    | 단점                                                                     |
| --------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| `.ui-button`에 `!important`                               | 한 줄로 끝난다                          | 층을 도입한 목적(명시도 경쟁 제거)을 포기한다. 다른 공통 컴포넌트도 같다 |
| 공통 컴포넌트 CSS마다 맨 앞에 `@layer reset, components;` | 어느 파일이 먼저 로드되어도 순서가 같다 | 파일을 추가할 때마다 누락 없이 작성해야 한다                             |
| 빌드 설정으로 CSS 파일 순서를 고정                        | HTML이 바뀌지 않는다                    | 청크 분할 설정을 변경해야 한다. 버전마다 동작이 다를 수 있다             |
| `index.html` 인라인 `<style>` 맨 앞에 선언 (**채택**)     | 모든 CSS보다 먼저, 한 곳에서 관리       | 개발 서버용 `layers.css`와 두 곳에 같은 줄이 생긴다                      |

마지막 방법을 채택했다. HTML 문서에 직접 쓴 인라인 스타일은 빌드가 파일을 어떻게 분할하든 `<head>`의 같은 위치에 남는다. 같은 줄이 두 곳에 생기는 문제는 주석으로 서로를 참조하게 했다.

### 수정 내용

층 순서 선언을 `index.html`의 `<style>` 맨 앞으로 옮겼다. 이 인라인 스타일은 빌드가 연결하는 어떤 CSS 파일보다 앞에 있다.

```html
<style>
	/*
	 * CSS 층 순서 (styles/layers.css와 같다). 층 순서는 처음 나온 곳에서 정해지는데, 빌드하면 공통 컴포넌트의 CSS가
	 * 든 파일이 main CSS보다 먼저 붙을 수 있다. …
	 */
	@layer reset, components;
	…
</style>
```

![메일 앱 본문 아래 "김정현에게 답장" 버튼. 파란 바탕 안에 좌우 여백이 있다](./images/css-layer-order-fix-mail-button.jpg '고친 뒤의 답장 버튼. 안쪽 여백 5px 14px')

이 사이트의 보안 헤더(CSP)는 `style-src`에 `'unsafe-inline'`을 허용하고([CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers)), 이미 로딩 화면용 인라인 스타일이 있어서 추가 변경이 필요 없었다. `styles/layers.css`는 개발 서버용으로 유지한다.

수정 후 답장 버튼의 `padding`은 `5px 14px`로 복원됐다. 같은 파일에 묶인 다른 공통 컴포넌트도 설계한 층 순서대로 렌더링된다.

## 확인

현재 빌드(main)를 미리보기 서버(`vite preview`)로 실행해 다시 확인했다. 브라우저에서 `document.styleSheets`를 순서대로 읽고, 각 시트에 처음 등장하는 층 이름을 추출했다.

| 순서 | 시트                     | 처음 나오는 층        |
| ---- | ------------------------ | --------------------- |
| 1    | 인라인 `<style>`         | `reset, components`   |
| 2    | `MobileNavigation-….css` | `components`          |
| 3    | `boot-….css`             | `reset`, `components` |

공용 청크의 CSS(현재 이름은 `MobileNavigation-….css`)는 여전히 진입점 CSS보다 먼저 로드된다. 파일 이름은 빌드마다 바뀌지만 "공용 CSS가 먼저"라는 구조는 그대로다. ==인라인 선언이 없으면 현재도 같은 문제가 발생한다.== 답장 버튼의 계산된 `padding`은 `5px 14px`이었다.

PR은 [#221](https://github.com/hyeoniverse/MacFolio/pull/221)이고, 커밋은 파일 7개, +136/−2줄이다. 이 중 층 순서 수정은 `index.html`의 7줄(주석 포함)이 전부다.

## 재발 방지

- CSS 층 순서는 "선언 위치"가 아니라 "문서에서 처음 등장한 위치"가 결정하고, 그 위치는 ==개발 서버와 빌드 결과에서 다를 수 있다.== 스타일 문제는 빌드 결과(`pnpm build` 뒤 `vite preview`)로 한 번 더 확인한다.
- 층을 추가할 때는 `styles/layers.css`와 `index.html` 두 곳을 함께 수정한다. 두 파일의 주석이 서로를 참조한다.

## 남은 과제

- 층 순서를 검증하는 자동 시험은 아직 없다. E2E는 개발 서버가 아니라 빌드 결과로 실행되지만, 버튼 여백을 측정하는 시험이 없어서 이번 문제를 검출하지 못했다. 공통 버튼 하나의 계산된 `padding`을 확인하는 시험을 추가하면 같은 문제가 재발할 때 즉시 검출할 수 있다.

## 함께 고친 메일 오류 표시

### 메일 불러오기 오류

목록 전체를 불러오지 못했다는 오류는 입력 칸 하나의 오류보다 중요도가 높다. 칸 오류 스타일(`.mail-error`, 12px)을 그대로 사용하지 않고 `.mail-load-error`를 별도로 정의했다.

|           | 데스크톱                      | 휴대폰                             |
| --------- | ----------------------------- | ---------------------------------- |
| 글자 크기 | 13px                          | 15px (본문 크기)                   |
| 바깥 여백 | 위 4px, 아래 10px, 좌우 12px  | 위 16px (메일상자 묶음과 떨어지게) |
| 모양      | 흐린 글자, 빨간 느낌표 아이콘 | 같은 모양                          |

처음에는 연한 빨간 배경의 상자로 감쌌지만, 목록 위에 빨간 영역이 생겨 화면에서 가장 눈에 띄는 요소가 오류 문구가 됐다. 배경을 제거하고 글자는 보조 색(`--mail-muted`)으로, 빨간색은 아이콘에만 적용했다. 여백과 크기만으로도 목록과 구분된다.

### 작성 창의 입력 칸 오류

빈 칸으로 보내기를 누르면 칸마다 "이름을 입력해주세요." 같은 문구가 칸 아래 줄에 표시되고, 칸 밑줄이 빨간색으로 바뀌었다. 칸마다 줄이 하나씩 늘어 레이아웃이 이동하고, 빨간 밑줄 네 개가 겹쳐 보였다.

같은 줄 오른쪽 끝, **필수** 배지, 칸 아래 별도 줄, 안내 문구(placeholder) 변경, 이름표만 빨간색으로 표시하는 방식을 순서대로 시도했지만 모두 칸 사이에 오류 표시가 끼어 시선이 분산됐다. 결국 macOS 메일처럼 칸 사이에는 아무것도 표시하지 않기로 했다.

| 오류 종류      | 처리                                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 빈 칸          | 네 칸이 모두 채워져야 보내기 버튼이 활성화된다(`disabled`). 공백만 있는 칸도 빈 칸으로 판정한다. 입력할 항목은 칸 이름표로 알 수 있다                                                                          |
| 형식·길이 오류 | 보내기를 누르면 공통 경고창(`AlertDialog`)에 "이메일 형식을 확인해주세요." 같은 문구 하나를 표시한다. 확인을 누르면 경고창만 닫히고 작성 내용은 유지된다. 서버가 전송을 거부한 경우에도 같은 경고창을 사용한다 |
| Esc            | 작성 창은 Esc로 닫히는데, 경고창이 표시된 상태에서는 경고창만 닫도록 작성 창의 Esc 처리를 건너뛴다                                                                                                             |

## 관련 글

- [CSS @layer로 명시도와 무관하게 앱 기본값의 우선순위 낮추기](/memo/css-layer-reset)
- [getComputedStyle 비교로 동일성을 확인하며 중복 CSS 규칙 지우기](/memo/css-cleanup-tools#중복-규칙-삭제-creativepartscss와-hyeoniversepagecss)
- [Resend API와 Turnstile로 서버에서 메일 발송하고 스팸 차단하기](/memo/contact-mail)

<details>
<summary>참고 문헌</summary>

- [MDN: Cascade, specificity, and inheritance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Handling_conflicts)
- [MDN: Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity)
- [MDN: @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [MDN: Cascade layers](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Cascade_layers)
- [W3C: CSS Cascading and Inheritance Level 5, Cascade Layers](https://www.w3.org/TR/css-cascade-5/#layering)
- [Vite: CSS Code Splitting](https://vite.dev/guide/features.html#css-code-splitting)

</details>

#MacFolio #CSS #메일 #트러블슈팅
