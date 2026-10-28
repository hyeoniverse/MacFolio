---
title: Apple HIG 글자 스타일 이름으로 font-size 디자인 토큰 만들기
date: 2026-10-16
category: 개발 기록/MacFolio/디자인 시스템
summary: CSS의 font-size 958곳 중 자주 쓰는 여덟 값에 Apple HIG의 글자 스타일 이름(--text-caption2~title2)을 붙여 645곳을 바꿨다. 값은 그대로라 화면은 같다. 사흘 뒤 다른 브랜치에서 숫자 값 375곳이 다시 유입된 경위까지 정리했다.
---

## 배경

[z-index](/memo/z-index-layers)와 [모서리 둥글기](/memo/radius-tokens)에 이어 글자 크기에도 이름을 붙였다([#234](https://github.com/hyeoniverse/MacFolio/pull/234)). [리팩터링 계획](/memo/refactor-step5-styles)의 스타일 단계에서 "반복되는 숫자를 theme.css의 이름으로" 작업을 순서대로 진행하던 중이었다.

숫자만으로는 12px와 13px 중 어느 것이 "날짜 크기"인지 알 수 없다. 이름이 있어야 "날짜는 caption"이라는 규칙을 정하고 적용할 수 있다. 같은 용도에 다른 숫자가 섞여 있어도, 숫자만으로는 실수인지 의도인지 구분할 수 없다.

## 사용 현황 집계

`apps/react/src` 아래 CSS에서 `font-size`는 958곳이었다. 사용 빈도가 높은 값은 다음과 같다.

| 값   | 사용 수 |
| ---- | ------- |
| 12px | 156     |
| 13px | 130     |
| 15px | 99      |
| 11px | 88      |
| 14px | 85      |
| 17px | 60      |
| 16px | 57      |
| 20px | 39      |
| 18px | 32      |
| 22px | 15      |

위 열 개 값이 761곳으로 전체의 약 80%다. 나머지는 em·rem, 10px 이하나 26px 이상의 큰 제목, 소수점 값 등이다.

MacFolio는 macOS와 iOS 화면을 재현하는 사이트라, 이 값들은 대부분 Apple이 정의한 글자 크기에서 왔다. 그래서 숫자보다 Apple의 스타일 이름이 용도를 더 정확히 나타낸다.

## 이름 체계 선택

| 후보                      | 예                              | 장점                                            | 단점                                                    |
| ------------------------- | ------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| 숫자 그대로               | `--text-13`                     | 치환이 쉽다                                     | 숫자를 변수명으로 옮겼을 뿐, 용도를 나타내지 않는다     |
| 크기 단계                 | `--text-xs`·`sm`·`md`·`lg`      | Tailwind 등에서 익숙하다                        | 여덟 단계면 `xs`·`2xs`처럼 이름이 부자연스러워진다      |
| **Apple HIG 글자 스타일** | `--text-footnote`·`--text-body` | 재현 대상과 이름이 같고, 용도가 이름에 드러난다 | iOS 기준이라 macOS 화면에서는 이름과 용도가 일부 다르다 |

세 번째를 선택했다. HIG(Human Interface Guidelines)는 Apple의 앱 UI 설계 지침이다. [Typography 항목](https://developer.apple.com/design/human-interface-guidelines/typography)에 글자 용도별 이름과 크기가 정의되어 있다. iOS 기준으로 본문(Body)은 17pt, 보조 문구(Footnote)는 13pt, 가장 작은 설명(Caption 2)은 11pt다. 화면 재현 중에 HIG를 참고할 때, 문서의 이름이 CSS에도 그대로 있으면 두 곳을 대조하기 쉽다.

| 이름              | 크기 | 용도                                 |
| ----------------- | ---- | ------------------------------------ |
| `--text-caption2` | 11px | 가장 작은 설명, 배지                 |
| `--text-caption`  | 12px | 날짜, 작은 설명                      |
| `--text-footnote` | 13px | 보조 문구 (macOS 앱에서는 본문 크기) |
| `--text-subhead`  | 15px | 휴대폰 목록의 둘째 줄                |
| `--text-callout`  | 16px | 강조한 설명                          |
| `--text-body`     | 17px | 휴대폰 본문                          |
| `--text-title3`   | 20px | 작은 제목                            |
| `--text-title2`   | 22px | 중간 제목                            |

macOS 앱의 본문은 13px이라 데스크톱 창 안에서는 `--text-footnote`가 실질적인 본문 크기다. 이름과 용도가 다른 부분이지만, 휴대폰 화면과 같은 이름 체계를 쓰는 쪽을 선택했다.

![여덟 글자 크기 이름과 실제 크기](./images/font-size-tokens-scale.svg '이름별 실제 크기와, 변경 전 그 값의 사용 수')

## 구현

### 1. theme.css에 여덟 이름

```css
:root {
	/*
	 * 글자 크기. Apple HIG의 글자 스타일 이름을 빌려, 자주 쓰는 여덟 값에 이름을 붙였다
	 * (14·18px 등 그 밖의 값과 em·rem은 각 CSS에 그대로)
	 */
	--text-caption2: 11px;
	--text-caption: 12px;
	--text-footnote: 13px;
	--text-subhead: 15px;
	--text-callout: 16px;
	--text-body: 17px;
	--text-title3: 20px;
	--text-title2: 22px;
}
```

다크 모드에서 글자 크기는 바뀌지 않으므로 색 이름과 달리 다크 모드용 값은 없다.

### 2. 단일 값 선언만 변경

`font-size: 13px;`처럼 값 하나만 있는 선언만 바꿨다. `font: 600 13px/1.2 …` 같은 [단축 속성](https://developer.mozilla.org/ko/docs/Web/CSS/Shorthand_properties), `calc()` 안의 값, `clamp()`는 변경하지 않았다. 단축 속성 안의 값은 다른 값과 함께 있어서, 변수로 바꾸면 한 줄이 오히려 읽기 어려워진다.

```css
/* Memo.css */
-	font-size: 13px;
+	font-size: var(--text-footnote);

-	font-size: 12px;
+	font-size: var(--text-caption);
```

45개 CSS 파일에서 645곳을 바꿨고, 커밋은 47개 파일, +712/−645다. 추가한 줄 중 13줄은 `theme.css`, 54줄은 이 글의 초판이다.

## caption2를 caption으로 합칠까

작업 중에 `--text-caption2`(11px)를 `--text-caption`(12px)으로 통합하는 방안도 검토했다. 통합하면 이름은 하나 줄지만 11px로 렌더링하던 배지·작은 설명 88곳이 1px씩 커져 화면이 바뀐다. 이번 작업은 값을 유지하고 이름만 붙이는 것이 목표라 둘을 유지했다.

## 이름을 붙이지 않은 값

| 값                    | 이름을 붙이지 않은 이유                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14px(85곳)·18px(32곳) | HIG에 대응하는 이름이 없다. 대부분 데스크톱 앱에서 임의로 정한 크기라, 가까운 이름으로 통합할지는 화면을 확인하며 하나씩 정한다. 일괄로 13이나 15로 바꾸면 화면이 1px씩 달라지므로, "화면 유지" 원칙에 따라 변경하지 않았다 |
| em·rem                | 부모 글자 크기에 비례한다는 의미라 고정 이름으로 바꾸면 안 된다                                                                                                                                                             |
| 10px 이하·26px 이상   | 사용 수가 적고 앱마다 용도가 달라 그대로 두었다                                                                                                                                                                             |

## 확인

- 값이 그대로이므로 화면이 달라지면 안 된다. 변경 전후 커밋에서 `font-size`가 숫자인 곳(여덟 값)은 645 → 0, `var(--text-*)`는 0 → 645로 정확히 일치했다. `git grep -hE 'font-size:\s*(11|12|13|15|16|17|20|22)px'`로 집계했다.
- 변수 이름에 오타가 있으면(`--text-captoin` 등) [`var()`](https://developer.mozilla.org/ko/docs/Web/CSS/var)는 유효하지 않은 값이 되어 상속받은 크기가 적용된다. 화면에서는 1~2px 차이라 육안으로 찾기 어렵다. 그래서 `var(--text-`로 시작하는 값을 모두 추출해 이름별로 집계했고, 여덟 이름 외에는 기존의 `--text-scale` 하나뿐이었다.
- PR의 CI(타입 검사·단위 시험·E2E)가 모두 통과했다.

## 사흘 뒤 재집계

10월 19일에 다시 집계하자 이름을 쓴 곳은 646곳, 여덟 값을 숫자로 쓴 곳은 375곳이었다.

![숫자와 이름의 사용 수](./images/font-size-tokens-counts.svg '#234 직후에는 숫자가 0이었지만, 다른 브랜치의 CSS가 병합되며 375곳이 다시 유입됐다')

숫자 375곳 중 253곳이 Safari 프로젝트 템플릿 다섯 개(`repo`·`devtool`·`friendly`·`keynote`·`paper`)와 `Settings.css`다. 이 CSS는 #234와 같은 시기에 다른 브랜치에서 작성되어, #234가 병합된 뒤에 합쳐졌다. 이름을 정의하는 것만으로는 새로 작성하는 코드에 적용되지 않는다는 것이 수치로 확인됐다.

## 남은 것·배운 것

- 재유입을 막는 장치가 없다. [Stylelint 규칙 `declaration-property-value-disallowed-list`](https://stylelint.io/user-guide/rules/declaration-property-value-disallowed-list/)로 `font-size`에 여덟 값을 숫자로 쓰면 경고하게 하면 다시 유입되지 않는다. 다음 단계로 남겼다.
- 14px·18px는 화면을 확인하며 하나씩 정한다.
- 이름이 생기자 "이 날짜 글자는 왜 12px인가"라는 질문에 "caption이기 때문"이라고 답할 수 있게 되었다. 숫자를 이름으로 바꾸는 일은 디자인 기준을 코드에 기록하는 일이다.

## 관련 글

- PR: [#234](https://github.com/hyeoniverse/MacFolio/pull/234)
- [리팩터링 5단계 - CSS 값에 토큰 이름을 붙이고 자동 비교로 동일성 검증하기](/memo/refactor-step5-styles)
- [흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/z-index-layers)
- [자주 쓰는 border-radius 여섯 값을 --radius-* 디자인 토큰으로 바꾸기](/memo/radius-tokens)
- [직접 쓴 hex 색을 --color-* 디자인 토큰과 Apple 시스템 색 이름으로 바꾸기](/memo/color-tokens)
- [그림자와 간격 값을 집계해 CSS 변수 디자인 토큰으로 이름 붙이기](/memo/shadow-space-tokens)

#MacFolio #CSS #리팩터링
