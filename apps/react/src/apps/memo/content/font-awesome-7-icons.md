---
title: 구조도 아이콘이 깨진 까닭 - Font Awesome 7의 글꼴 이름
date: 2026-10-19
category: 개발기/MacFolio/프론트엔드
summary: Font Awesome을 7로 업그레이드한 뒤 HYEONIVERSE 구조도의 아이콘이 깨졌다. 7은 5·4의 글꼴 이름은 호환용으로 유지했지만 6의 이름은 제거했고, SVG 텍스트로 렌더링하는 아이콘 다섯 곳이 6의 이름을 직접 지정하고 있었다.
---

## 배경

Safari 앱의 HYEONIVERSE 페이지에는 요청 경로를 표시하는 구조도가 있다. 관리자 · Next.js · Supabase · AI 공급자 · Resend 메일 같은 상자가 화살표로 연결되고, 상자마다 위쪽에 아이콘이 하나씩 있다. 10월 19일에 이 페이지를 열자 아이콘 위치가 비어 있거나 사각형으로 표시됐다. 같은 페이지의 버튼 아이콘(`<i class="fa-solid …">`)은 정상이었다.

![구조도 전후](./images/font-awesome-7-icons-diagram.jpg '왼쪽: 글꼴 이름을 6으로 되돌려 재현한 화면 (이 캡처의 Chromium에서는 빈칸으로 표시된다). 오른쪽: 7 이름으로 수정한 현재 화면')

Font Awesome은 10월 12일에 Dependabot PR([#217](https://github.com/hyeoniverse/MacFolio/pull/217))로 6.7.2에서 7.3.1로 업그레이드했다. 변경 파일은 `package.json`과 잠금 파일뿐이었고 CI는 모두 통과했다. 그 뒤 일주일 동안 구조도 아이콘이 깨진 상태로 배포되어 있었다.

## 원인 분석

### SVG 안에서는 `<i>`를 쓸 수 없다

구조도는 하나의 SVG다. SVG 안에는 HTML 요소인 `<i class="fa-solid fa-globe">`를 넣을 수 없다. 그래서 아이콘 글꼴의 문자를 SVG `<text>`에 직접 넣고, CSS로 글꼴만 Font Awesome으로 지정한다. `CreativeArchitecture.tsx`의 노드는 아이콘을 사용자 정의 영역(Private Use Area)[^pua] 문자로 보관한다.

```tsx
<text className={node.brand ? 'cr-node-icon brand' : 'cr-node-icon'} x={node.x} y={node.y - 6}>
	{node.icon}
</text>
```

```css
/* CreativeArchitecture.css (수정 전) */
.cr-node-icon {
	font-family: 'Font Awesome 6 Free';
	font-weight: 900;
}
.cr-node-icon.brand {
	font-family: 'Font Awesome 6 Brands';
	font-weight: 400;
}
```

`<i>` 아이콘은 Font Awesome이 제공하는 CSS가 글꼴 이름을 지정한다. 패키지를 업그레이드하면 그 CSS도 함께 바뀌므로 깨지지 않는다. 반면 위처럼 이름을 직접 지정한 곳은 패키지가 바뀌어도 이전 이름이 그대로 남는다.

### 7은 6의 이름을 유지하지 않았다

`node_modules/@fortawesome/fontawesome-free/css/all.min.css`에서 [`@font-face`](https://developer.mozilla.org/ko/docs/Web/CSS/@font-face)의 `font-family` 값을 모두 추출해 집계했다.

![7.3.1이 선언하는 글꼴 이름](./images/font-awesome-7-icons-names.svg '이전 이름 호환용으로 5와 4(FontAwesome)는 남았지만 6은 없다')

7은 `Font Awesome 7 Free`·`Font Awesome 7 Brands`를 쓰고, 이전 버전 코드와의 호환을 위해 `Font Awesome 5 Free`·`5 Brands`·`FontAwesome`(4)라는 이름으로도 같은 글꼴을 한 번 더 선언한다. 그런데 6의 이름은 없다. 그래서 `'Font Awesome 6 Free'`를 지정한 CSS는 존재하지 않는 글꼴을 찾다가 브라우저 기본 글꼴로 대체되고, 기본 글꼴에는 사용자 정의 영역 문자가 없으므로 빈칸이나 사각형(대체 문자)이 표시된다. 표시 결과는 브라우저와 운영체제에 따라 다르다. 버전별 변경 사항은 [Font Awesome 업그레이드 문서](https://docs.fontawesome.com/upgrade/upgrade-on-web)에 정리되어 있다.

### 시험에서 검출되지 않은 이유

E2E는 구조도 SVG의 접근성 이름이 노출되는지 확인한다. 아이콘은 문자 하나라 `<text>` 요소가 존재하면 통과한다. 문자가 어떤 글꼴로 렌더링됐는지는 DOM으로 확인할 수 없다. 이 화면에는 스크린샷 비교 시험이 없어서 검출되지 않았다.

## 선택한 방법과 제외한 방법

| 방법                                          | 장점                                                     | 단점                                                                                            |
| --------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **이름을 `Font Awesome 7 Free`/`7 Brands`로** | 즉시 수정된다. 현재 코드 구조 유지                       | 8이 출시되면 같은 수정을 다시 해야 한다                                                         |
| `var(--fa-family-classic)` 변수로             | 7의 CSS가 `:root`에 이 변수를 선언한다. 다음 버전에도 자동 반영 | 변수 이름도 버전마다 바뀔 수 있다. 다섯 곳 모두 그 변수가 정의된 범위에서 렌더링되는지 별도 확인이 필요하다 |
| 5 이름(`Font Awesome 5 Free`)으로             | 7에도 호환 이름이 남아 있다                              | 이전 이름에 의존하므로 언제 제거될지 알 수 없다                                                 |
| SVG 안에 아이콘 모양(path)을 직접 넣기        | 글꼴과 무관하게 항상 같다                                | 아이콘마다 path를 복사해야 하고, 구조도 데이터 크기가 커진다                                    |

첫 번째를 선택했다. 깨진 화면을 먼저 복구하는 것이 우선이었고, 다섯 곳 모두 같은 줄 하나만 바꾸면 됐다. 변수로 바꾸는 방법은 다음 업그레이드 시각에 다시 검토하기로 했다.

## 구현

글꼴 이름을 직접 지정한 곳을 `grep -rn "Font Awesome 6"`으로 검색하자 다섯 파일이 나왔다([#262](https://github.com/hyeoniverse/MacFolio/pull/262)).

| 파일                                         | 사용 위치                                        |
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

일곱 줄을 수정했다. 문자 코드 포인트는 6과 7이 같아서 노드 데이터나 `content: '\f0c6'` 같은 값은 그대로 둔다. 메모의 첨부 파일 아이콘은 이번 검색에서 함께 발견했다. 첨부 파일이 있는 글이 적어서 깨진 것을 인지하지 못했다.

## 확인

- 미리보기 배포에서 HYEONIVERSE·MacFolio 페이지의 구조도를 끝까지 스크롤해 모든 노드에 아이콘이 표시되는지 확인했다. 위 캡처의 오른쪽이 수정 후다.
- 재현은 개발자 도구에서 `.cr-node-icon`의 글꼴을 6 이름으로 되돌려 확인했다. 왼쪽 캡처가 그 화면이다.
- 수정 후 `grep -rn "Font Awesome 6" apps/react/src`의 결과는 0줄이다.

## 남은 것·배운 것

- 의존성 버전 업그레이드는 "빌드와 시험이 통과하면 안전하다"가 아니다. 라이브러리의 식별자(글꼴 이름, CSS 변수, 클래스 이름)를 코드에 직접 지정한 곳은 시험이 검출하지 못한다. 메이저 버전을 업그레이드할 때는 그 라이브러리 이름으로 저장소를 한 번 검색한다.
- SVG 안의 아이콘 글꼴은 깨져도 DOM이 그대로라 E2E로 검출하기 어렵다. [`document.fonts.check`](https://developer.mozilla.org/ko/docs/Web/API/FontFaceSet/check)`("18px 'Font Awesome 7 Free'")` 같은 검사를 시험에 넣는 방법이 있지만 아직 넣지 않았다.
- 다음 메이저 버전에서는 글꼴 이름 대신 Font Awesome의 CSS 변수를 쓰는 방식으로 바꿀지 다시 검토한다.

[^pua]: 유니코드의 U+E000~U+F8FF 구간으로, 표준 문자가 배정되지 않아 글꼴마다 임의의 기호를 넣는다. Font Awesome도 이 구간에 아이콘을 배치하므로, 해당 글꼴이 없으면 다른 글꼴로 대체할 문자가 없다.

## 관련 글

- [액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게](/memo/pin-actions-dependabot): Font Awesome 7 업그레이드를 연 Dependabot 설정
- [1,861줄짜리 데모 파일을 데모마다 한 파일로](/memo/split-creative-demos): HYEONIVERSE 페이지의 데모 분리
- [두 CSS 파일에 똑같이 적힌 규칙 103개 지우기 — 계산된 스타일로 같은지 확인](/memo/creative-css-dedupe): 같은 페이지의 CSS 정리

#MacFolio #CSS #FontAwesome
