---
title: 공통 단추의 여백이 사라진 이유 — CSS 층 순서는 처음 나온 파일이 정한다
date: 2026-10-12
category: 개발기/MacFolio/프론트엔드
summary: 메일 앱의 불러오기 오류 문구가 12px로 작고 목록에 붙어 있다는 이야기를 듣고 여백을 점검하다가, 공통 단추(Button)의 안쪽 여백이 0이 된 것을 찾았다. 빌드한 HTML에서 공통 컴포넌트 CSS가 든 파일이 main CSS보다 먼저 붙어 components 층이 reset 층보다 먼저 정해졌고, 그래서 reset의 * { padding: 0 }이 단추 여백을 이겼다. 층 순서 선언을 index.html의 인라인 스타일로 옮겨 모든 CSS보다 앞에 두었다. 메일의 불러오기 오류는 아이콘이 있는 안내 상자로 바꾸고 데스크톱·휴대폰에 맞는 글자 크기와 여백을 줬다.
---

메일 앱에서 서버 응답이 실패하면 "서버에서 문제가 생겼습니다."가 뜬다. 이 문구가 데스크톱과 휴대폰 모두 12px로 작고, 위아래 목록에 여백 없이 붙어 있었다. 이 문구를 고치면서 같은 화면의 다른 여백도 살펴보다가, 본문 아래 "김정현에게 답장" 단추의 파란 바탕이 글자에 딱 붙어 있는 것을 찾았다.

## 단추의 안쪽 여백이 0이었다

단추의 계산된 스타일을 보니 `padding`이 `0px`였다. 이 단추는 공통 컴포넌트 `Button`이고, 여백은 `.ui-button { padding: 5px 14px }`로 정해 두었다. 이 값을 이긴 규칙은 `index.css`의 `* { padding: 0 }`이었다.

둘 다 CSS 층(cascade layer) 안에 있다. [앱 루트 기본값을 reset 층으로 옮긴 글](/memo/css-layer-reset)에서 정한 순서는 이렇다.

```css
/* styles/layers.css: main.tsx가 가장 먼저 불러온다 */
@layer reset, components;
```

층끼리는 나중에 정한 층이 이긴다. 그래서 `components` 층의 `.ui-button` 여백이 `reset` 층의 `*`를 이겨야 한다.

## 층 순서는 문서에서 처음 나온 곳이 정한다

![빌드한 HTML에서 CSS 파일이 붙는 순서와 층 순서](./images/css-layer-order-fix.svg '공통 컴포넌트 CSS가 든 파일이 먼저 붙어 components 층이 먼저 정해졌다')

`@layer reset, components;`라는 선언이 있어도, 브라우저는 문서 안에서 그 층 이름이 처음 나온 순서로 층 순서를 정한다. 빌드한 `index.html`을 보니 CSS 파일이 이렇게 붙어 있었다.

```html
<link rel="stylesheet" href="/assets/repository-….css" /> <link rel="stylesheet" href="/assets/main-….css" />
```

`repository-….css`는 여러 앱이 함께 쓰는 코드를 묶은 파일이고, 공통 컴포넌트의 CSS가 들어 있다. 첫 줄이 `@layer components { … }`다. 이 파일이 `main-….css`보다 먼저 붙으니, 문서에 처음 나온 층은 `components`이고 `reset`은 그다음이다. 그러면 순서가 `components, reset`으로 정해져 `reset`이 이긴다.

`layers.css`의 순서 선언은 `main-….css` 안에 들어가 있어서 너무 늦었다. 게다가 빌드 결과에는 선언 한 줄이 따로 남지 않고 바로 뒤의 `@layer reset { … }`과 합쳐져 있었다.

## 고친 것

층 순서 선언을 `index.html`의 `<style>` 맨 앞으로 옮겼다. 이 인라인 스타일은 빌드가 붙이는 어떤 CSS 파일보다 앞에 있다.

```html
<style>
	@layer reset, components;
	…
</style>
```

이 사이트의 보안 헤더(CSP)는 `style-src`에 `'unsafe-inline'`을 허용하고, 이미 로딩 화면용 인라인 스타일이 있어서 따로 바꿀 것이 없었다. `styles/layers.css`는 개발 서버용으로 그대로 둔다.

고친 뒤 답장 단추의 `padding`은 `5px 14px`로 돌아왔다. 같은 파일에 묶인 다른 공통 컴포넌트도 이제 설계한 층 순서대로 그려진다.

## 메일 불러오기 오류

목록 전체를 불러오지 못했다는 오류는 입력 칸 하나의 오류와 무게가 다르다. 칸 오류(`.mail-error`, 12px)를 그대로 쓰지 않고 `.mail-load-error`를 따로 두었다.

|           | 데스크톱                                  | 휴대폰                             |
| --------- | ----------------------------------------- | ---------------------------------- |
| 글자 크기 | 13px                                      | 15px (본문 크기)                   |
| 안쪽 여백 | 8px 12px                                  | 12px 16px                          |
| 바깥 여백 | 위 4px, 아래 10px, 좌우 12px              | 위 16px (메일상자 묶음과 떨어지게) |
| 모양      | 연한 빨간 바탕, 모서리 8px, 느낌표 아이콘 | 같은 모양, 모서리 12px             |

바탕색은 `color-mix(in srgb, var(--mail-error) 12%, transparent)`로 오류 색에서 만들어, 라이트·다크 모드에서 같은 비율로 보인다. 쓰기 창 맨 아래의 "내용을 입력해주세요."도 창 바닥에 붙어 있어서 위아래 여백을 줬다.

#MacFolio #CSS #메일 #트러블슈팅
