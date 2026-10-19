---
title: 구조도 아이콘이 깨진 까닭 - Font Awesome 7의 글꼴 이름
date: 2026-10-19
category: 개발기/MacFolio/프론트엔드
summary: Font Awesome을 7로 올린 뒤 HYEONIVERSE 구조도의 아이콘이 깨졌다. 7은 5·4의 글꼴 이름은 남겼지만 6의 이름은 없앴고, SVG 글자로 그리는 아이콘 다섯 곳이 6의 이름을 직접 적고 있었다.
---

## 배경

Safari 앱의 HYEONIVERSE 페이지에는 "요청이 지나는 길"을 보여 주는 구조도가 있다. 관리자 · Next.js · Supabase · AI 공급자 · Resend 메일 같은 상자가 화살표로 이어지고, 상자마다 위에 아이콘이 하나씩 붙는다. 10월 19일에 이 페이지를 열어 보니 아이콘 자리가 비어 있거나 네모로 보였다. 같은 페이지의 버튼 아이콘(`<i class="fa-solid …">`)은 멀쩡했다.

![구조도 전후](./images/font-awesome-7-icons-diagram.jpg '왼쪽: 글꼴 이름을 6으로 되돌려 재현한 화면 (이 캡처의 Chromium에서는 빈칸으로 보인다). 오른쪽: 7 이름으로 고친 지금')

Font Awesome은 10월 12일에 Dependabot PR([#217](https://github.com/hyeoniverse/MacFolio/pull/217))로 6.7.2에서 7.3.1로 올렸다. 바뀐 파일은 `package.json`과 잠금 파일뿐이었고 CI는 모두 통과했다. 그 뒤 일주일 동안 구조도 아이콘이 깨진 채로 있었다.

## 원인 분석

### SVG 안에서는 `<i>`를 못 쓴다

구조도는 하나의 SVG다. SVG 안에는 HTML 요소인 `<i class="fa-solid fa-globe">`를 넣을 수 없다. 그래서 아이콘 글꼴의 글자를 SVG `<text>`에 그대로 넣고, CSS로 글꼴만 Font Awesome으로 고른다. `CreativeArchitecture.tsx`의 노드는 아이콘을 사용자 영역(Private Use Area) 글자로 들고 있다.

```tsx
<text className={node.brand ? 'cr-node-icon brand' : 'cr-node-icon'} x={node.x} y={node.y - 6}>
	{node.icon}
</text>
```

```css
/* CreativeArchitecture.css (고치기 전) */
.cr-node-icon {
	font-family: 'Font Awesome 6 Free';
	font-weight: 900;
}
.cr-node-icon.brand {
	font-family: 'Font Awesome 6 Brands';
	font-weight: 400;
}
```

`<i>` 아이콘은 Font Awesome이 주는 CSS가 글꼴 이름을 정한다. 패키지를 올리면 그 CSS도 함께 바뀌니 깨질 일이 없다. 반면 위처럼 이름을 직접 적은 곳은 패키지가 바뀌어도 그대로 남는다.

### 7은 6의 이름을 남기지 않았다

`node_modules/@fortawesome/fontawesome-free/css/all.min.css`에서 `@font-face`의 `font-family`를 모두 뽑아 세어 보았다.

![7.3.1이 선언하는 글꼴 이름](./images/font-awesome-7-icons-names.svg '옛 이름 호환으로 5와 4(FontAwesome)는 남았지만 6은 없다')

7은 `Font Awesome 7 Free`·`Font Awesome 7 Brands`를 쓰고, 예전 코드를 위해 `Font Awesome 5 Free`·`5 Brands`·`FontAwesome`(4)라는 이름으로도 같은 글꼴을 한 번 더 선언한다. 그런데 6의 이름은 없다. 그래서 `'Font Awesome 6 Free'`를 적은 CSS는 없는 글꼴을 찾다가 브라우저 기본 글꼴로 떨어지고, 기본 글꼴에는 사용자 영역 글자가 없으니 빈칸이나 네모(대체 문자)가 나온다. 어떻게 보이는지는 브라우저와 운영체제에 따라 다르다.

### 왜 시험에서 안 걸렸나

E2E는 구조도 그림이 접근성 이름으로 보이는지를 본다. 아이콘은 글자 하나라 `<text>` 요소가 있는지만 보면 통과한다. 글자가 어떤 글꼴로 그려졌는지는 DOM으로는 알 수 없다. 화면 비교(스냅샷) 시험이 없는 곳이라 걸러지지 않았다.

## 고른 방법과 버린 방법

| 방법                                          | 좋은 점                                                  | 걸리는 점                                                                                       |
| --------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **이름을 `Font Awesome 7 Free`/`7 Brands`로** | 바로 고쳐진다, 지금 코드 모양 그대로                     | 8이 나오면 같은 일을 또 해야 한다                                                               |
| `var(--fa-family-classic)` 변수로             | 7의 CSS가 `:root`에 이 변수를 둔다. 다음 판에도 따라간다 | 변수 이름도 판마다 바뀔 수 있다. 다섯 곳이 모두 그 변수가 있는 곳에서 그려지는지 따로 봐야 한다 |
| 5 이름(`Font Awesome 5 Free`)으로             | 7에도 호환 이름이 남아 있다                              | 옛 이름에 기대는 것이라 언제 빠질지 모른다                                                      |
| SVG 안에 아이콘 모양(path)을 직접 넣기        | 글꼴과 상관없이 늘 같다                                  | 아이콘마다 path를 옮겨 와야 하고, 구조도 데이터가 무거워진다                                    |

첫 번째를 골랐다. 깨진 화면을 먼저 되돌리는 것이 급했고, 다섯 곳이 모두 같은 줄 하나만 바꾸면 됐다. 변수로 바꾸는 것은 다음 업그레이드 때 다시 볼 일로 남겼다.

## 구현

같은 방식으로 글꼴 이름을 직접 적은 곳을 `grep -rn "Font Awesome 6"`으로 찾으니 다섯 파일이었다([#262](https://github.com/hyeoniverse/MacFolio/pull/262)).

| 파일                                         | 쓰는 곳                                          |
| -------------------------------------------- | ------------------------------------------------ |
| `safari/project/CreativeArchitecture.css`    | HYEONIVERSE 구조도 노드 아이콘 (Free·Brands)     |
| `safari/project/custom/MacFolioPage.css`     | MacFolio 페이지 구조도 노드 아이콘 (Free·Brands) |
| `safari/project/templates/friendly/Page.css` | 친근한 템플릿 링크 뒤의 `›` 화살표               |
| `safari/project/templates/paper/Page.css`    | 종이 템플릿 배포 정보 앞의 링크 아이콘           |
| `memo/styles/editor-blocks.css`              | 메모 글의 첨부 파일 링크 앞 클립 아이콘          |

```css
/* 전 */
font-family: 'Font Awesome 6 Free';
/* 후 */
font-family: 'Font Awesome 7 Free';
```

일곱 줄을 바꿨다. 글자 자리(코드 포인트)는 6과 7이 같아서 노드 데이터나 `content: '\f0c6'` 같은 값은 그대로 둔다. 메모의 첨부 파일 아이콘은 이번에 같이 찾다가 발견했다. 첨부 파일이 붙은 글이 적어서 깨진 것을 몰랐다.

## 확인

- 미리보기에서 HYEONIVERSE·MacFolio 페이지의 구조도를 끝까지 내려 모든 노드에 아이콘이 보이는지 눈으로 봤다. 위 캡처의 오른쪽이 고친 뒤다.
- 재현은 개발자 도구에서 `.cr-node-icon`의 글꼴을 6 이름으로 되돌려 확인했다. 왼쪽 캡처가 그 화면이다.
- 고친 뒤 `grep -rn "Font Awesome 6" apps/react/src`의 결과가 0줄이다.

## 남은 것·배운 것

- 의존성 판 올림은 "빌드와 시험이 통과하면 괜찮다"가 아니다. 라이브러리의 이름(글꼴 이름, CSS 변수, 클래스 이름)을 내 코드에 직접 적어 둔 곳은 시험이 알 수 없다. 메이저 판을 올릴 때는 그 라이브러리 이름으로 저장소를 한 번 검색한다.
- SVG 안의 아이콘 글꼴은 깨져도 DOM이 그대로라 E2E로 잡기 어렵다. `document.fonts.check("18px 'Font Awesome 7 Free'")` 같은 확인을 시험에 넣는 방법이 있지만 아직 넣지 않았다.
- 다음 메이저 판에서는 이름 대신 Font Awesome의 CSS 변수를 쓰는 쪽으로 옮길지 다시 본다.

## 관련 글

- [의존성 업데이트와 Dependabot](/memo/pin-actions-dependabot)
- [Safari 프로젝트 페이지의 데모 나누기](/memo/split-creative-demos)
- [HYEONIVERSE 페이지 CSS 중복 지우기](/memo/creative-css-dedupe)

#MacFolio #CSS #FontAwesome
