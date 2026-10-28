---
title: 쓰지 않는 CSS 클래스 찾기 — 2,761개 중 정말 안 쓰는 것은 9개
date: 2026-10-17
category: 개발 기록/MacFolio/스타일·컴포넌트
summary: CSS 클래스 2,761개를 소스 코드에서 문자열로 검색하니 150개가 '사용하지 않는' 것으로 나왔다. 조합해 만드는 이름과 라이브러리 클래스를 제외하니 실제로는 9개였고, 규칙 24개(166줄)와 이미지 한 장(58KB)을 삭제했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 5단계 "스타일"에 "쓰지 않는 선택자 지우기 (Stylelint 도입 검토)" 항목이 있다. 먼저 Stylelint로 해결할 수 있는 일인지 검토했다.

## 배경

이 사이트의 CSS는 컴포넌트마다 파일을 분리한다. 작업 시각 기준으로 `apps/react/src` 아래 CSS 파일은 92개, 합계 5만 줄에 가까웠다. 화면을 여러 차례 재작성하면서(프로젝트 페이지를 템플릿으로 전환, Launchpad와 창 최소화 재구현, 메모 도구 막대 재구성) 이전 화면의 규칙이 남아 있을 것으로 추정했지만, 어떤 규칙이 남았는지는 확인하지 못한 상태였다.

사용하지 않는 규칙은 화면에 영향을 주지 않지만 두 가지 비용이 있다.

1. **번들 크기**: 사용하지 않는 규칙도 CSS 파일에 포함되어 전송된다.
2. **유지보수 비용**: 비슷한 이름의 규칙이 두 벌 있으면 어느 쪽을 수정해야 화면이 바뀌는지 매번 확인해야 한다.

## Stylelint로 해결할 수 없는 이유

[Stylelint](https://stylelint.io/)는 CSS 파일만 분석한다. 어떤 클래스를 HTML이나 컴포넌트가 사용하는지는 알 수 없으므로 "사용하지 않는 선택자" 규칙이 없다. 그 일을 하는 도구([PurgeCSS](https://purgecss.com/) 등)는 소스에서 클래스 이름을 문자열로 검색하는데, 이 사이트는 클래스 이름을 조합해 만드는 곳이 많아 그대로 적용하면 사용 중인 규칙까지 삭제한다. 그래서 한 번 직접 집계했다.

| 방법                               | 장점                           | 단점                                                                          |
| ---------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Stylelint 도입                     | CSS 문법·순서 규칙을 검사한다  | 사용 여부는 알 수 없다                                                        |
| PurgeCSS를 빌드에 추가             | 빌드마다 자동으로 삭제한다     | 조합한 이름을 인식하지 못해 사용 중인 규칙까지 삭제한다. 예외 목록이 길어진다 |
| 브라우저 커버리지(개발자 도구)[^1] | 실제로 적용된 규칙을 확인한다  | 모든 앱·모든 상태를 열어야 한다. 휴대폰·다크 모드까지                         |
| 한 번 직접 집계하고 사람이 확인    | 조합 규칙을 작성자가 알고 있다 | 자동화되지 않는다                                                             |

자동화를 채택하지 않은 이유는 아래 그림 한 장으로 설명된다.

![CSS의 .sky-rain이 코드에서는 sky-와 값을 합쳐 만들어져, 문자열 검색이 놓치는 예](./images/unused-css-selectors-assembled.svg '조합한 이름은 문자열 검색으로 찾을 수 없다')

## 1단계: 문자열 검색

스크립트의 동작은 세 단계다.

1. CSS 파일에서 주석을 제거한다.
2. `{` 앞의 선택자에서 `.이름` 형태를 모두 추출한다.
3. 소스 파일 전체를 하나의 문자열로 합쳐, 그 이름이 포함되어 있는지 검사한다.

```python
for sel in re.findall(r'([^{}]+)\{', css_text):
    for name in re.findall(r'\.(-?[_a-zA-Z][\w-]*)', sel):
        names.add(name)
missing = [n for n in names if n not in source_blob]
```

CSS의 모든 선택자에서 클래스 이름 2,761개를 추출하고, `.ts`·`.tsx`·`.md` 어디에도 그 문자열이 없는 것을 필터링했다. 결과는 150개였다.

## 2단계: 조합하는 이름 제외

150개 대부분은 코드가 런타임에 이름을 조합해 붙이는 클래스였다.

| 종류                   | 예                                                          | 코드                                                                              |
| ---------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 앞부분 + 값            | `sky-rain`, `rank-1`, `view-gallery`                        | `` `weather sky-${weather.sky}` ``                                                |
| 템플릿 접두사 + 뒷부분 | `mg-trouble`, `pp-member`                                   | `cx(prefix, 'trouble')`                                                           |
| 라이브러리가 붙임      | `hljs-keyword`, `ProseMirror-selectednode`, `resize-cursor` | [highlight.js](https://highlightjs.org/), [ProseMirror](https://prosemirror.net/) |

`이름-${` 형태와 `cx(prefix, '이름')` 형태를 코드에서 수집해 이것으로 만들 수 있는 클래스를 제외하고, 라이브러리 클래스를 제외하자 9개가 남았다. 9개는 하나씩 코드를 읽어 실제로 사용하지 않는지 확인했다.

| 클래스                                    | 파일                               | 용도                                                   |
| ----------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `sp-hero-main`, `sp-tiles`, `sp-timeline` | `safari/ProjectPage.css`           | 프로젝트 페이지를 템플릿으로 바꾸기 전의 공통 레이아웃 |
| `minimized-container`, `dock-launchpad`   | `desktop/dock/DockItem.css`        | 이전 창 최소화 미리보기와 이전 Launchpad 버튼          |
| `cd-lock`, `cd-voice-script`              | `project/creative/demos.css`       | 데모의 이전 잠금 표시와 음성 대본                      |
| `tm-jump`                                 | `project/custom/DevCoursePage.css` | DevCourse 터미널의 이전 바로 가기                      |
| `memo-toolbar-title`                      | `memo/styles/toolbar.css`          | 메모 도구 막대의 이전 제목                             |

![클래스 2,761개에서 150개, 9개로 줄이고 규칙 24개를 삭제한 단계](./images/unused-css-selectors-funnel.svg '단계마다 남은 수')

## 삭제

직접 편집하지 않고 CSS 파서([PostCSS](https://postcss.org/))로 이 클래스만 사용하는 규칙 24개를 삭제하고, 다른 선택자와 함께 묶인 곳(`.minimized-container i, .dock-item i`)은 해당 선택자만 제거했다. `minimized-container`만 사용하던 배경 이미지(`imgs/minimize.JPG`, 58KB)도 삭제했다.

직접 편집하지 않은 이유는 선택자 목록[^2] 때문이다. `.minimized-container i, .dock-item i`에서 앞쪽만 삭제하다 쉼표 하나를 잘못 남기면 규칙 전체가 무효가 되어 `.dock-item i`까지 적용되지 않는다. 파서는 선택자 목록을 배열로 처리하므로 이런 실수가 발생하지 않는다.

```css
/* 전 */
.minimized-container i,
.dock-item i { … }

/* 후: 선택자 하나만 제거 */
.dock-item i { … }
```

변경된 파일과 삭제한 줄 수는 다음과 같다.

| 파일                                           | 삭제한 줄 |
| ---------------------------------------------- | --------- |
| `apps/safari/ProjectPage.css`                  | 78        |
| `apps/safari/project/creative/demos.css`       | 51        |
| `apps/safari/project/custom/DevCoursePage.css` | 16        |
| `desktop/dock/DockItem.css`                    | 11        |
| `apps/memo/styles/toolbar.css`                 | 10        |
| 합계                                           | 166       |

## 확인

- 삭제한 9개 클래스를 `.ts`·`.tsx`에서 다시 검색해 결과가 없는 것을 확인했다. 조합하는 곳(`` `sp-${` ``, `cx(prefix, …)`)에서도 이 뒷부분을 만드는 값이 없는지 별도로 확인했다.
- 단위 시험 642개와 브라우저 E2E 47개(`safari.spec`·`project-apps.spec`·`desktop.spec`)가 통과했다. 이 작업은 CSS만 삭제하므로, 시험이 실패한다면 그 클래스를 어딘가에서 사용하고 있었다는 뜻이다.
- 공개 폴더에서 `imgs/minimize.JPG`(58,836바이트)가 삭제됐다.

## 남은 것·배운 것

이 글을 쓰면서 같은 방식으로 다시 집계하니, 현재 CSS 클래스는 2,850개이고 문자열 검색으로 찾지 못하는 것이 169개다. 그사이 새 화면이 추가돼 수가 늘었다. 169개도 2단계의 조합 이름 제외를 거치지 않은 수라, 대부분 조합하는 이름으로 추정한다(2단계 이후 수는 집계하지 않았다). 1년에 한두 번은 같은 순서로 다시 집계할 계획이다.

- 사용하지 않는 규칙은 이름을 조합하는 코드 때문에 자동으로 찾기 어렵다. 다음에 정리할 때도 이 순서(문자열 검색 → 조합하는 이름 제외 → 하나씩 코드 확인)를 반복하면 된다.
- 이름을 조합하는 코드는 작성이 간편하지만 검색을 어렵게 만든다. 값이 몇 개뿐이면 `{ rain: 'sky-rain', … }`처럼 전체 이름을 명시하는 편이 나중에 검색하기 쉽다.
- 도구를 도입하기 전에 "이 도구가 실제로 그 질문에 답하는가"를 먼저 확인한다. Stylelint는 CSS 문법 검사 도구로는 유용하지만 사용 여부 판단은 할 수 없었다.

## 관련 글

- [4,600줄 Memo.css를 열다섯 파일로 — 차례를 지켜 나누고 결과가 같은지 확인하기](/memo/memo-css-split): 메모 CSS를 기능별로 나눈 일
- [1,861줄짜리 데모 파일을 데모마다 한 파일로](/memo/split-creative-demos): 프로젝트 데모 CSS의 중복을 제거한 일
- PR: [#242](https://github.com/hyeoniverse/MacFolio/pull/242)

[^1]: Chrome 개발자 도구의 Coverage 패널은 페이지를 조작하는 동안 실제로 사용된 CSS·JS 바이트를 기록한다. [Chrome DevTools: Coverage](https://developer.chrome.com/docs/devtools/coverage)

[^2]: 쉼표로 구분한 여러 선택자에 같은 선언을 적용하는 문법. 목록 중 하나라도 잘못되면 규칙 전체가 무효가 된다. [MDN: Selector list](https://developer.mozilla.org/en-US/docs/Web/CSS/Selector_list)

#MacFolio #CSS #리팩터링
