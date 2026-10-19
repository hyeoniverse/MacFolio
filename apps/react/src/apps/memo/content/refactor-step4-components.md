---
title: 리팩터링 4단계 — 공통 컴포넌트 설계
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 리팩터링 계획 4단계를 돌아본다. 공통 부품을 먼저 세고, 후보 아홉 중 Modal·Sheet·SearchField만 뽑았다. 접근성 이름을 시험으로 고정하고, 버튼 75곳을 공통 부품으로 옮기고, Menu에 variant를 붙였다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 4단계는 공통 컴포넌트였다. 가장 PR이 많았던 단계다.

## 왜

`shared/ui`에 button·dialog·menu·popover·reorder가 있었지만, `<button>`을 쓰는 앱 파일 53개 중 공통 버튼을 쓰는 곳은 15개였다. 시트와 모달은 메일·메시지·음악·설정·휴지통이 각자 만들었다.

## 무엇을 바꿨나

| 항목                       | PR   | 글                                                                      |
| -------------------------- | ---- | ----------------------------------------------------------------------- |
| 부품 목록과 후보 다시 재기 | #210 | [공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-inventory) |
| `Modal`                    | #212 | [모달 다이얼로그 5개를 Modal로](/memo/ui-modal)                         |
| `Sheet`                    | #220 | [휴대폰 시트 3곳을 Sheet로](/memo/ui-sheet)                             |
| CSS 층 순서 고정           | #221 | [공통 버튼의 여백이 사라진 이유](/memo/css-layer-order-fix)             |
| `SearchField`              | #223 | —                                                                       |
| 접근성 이름 시험           | #243 | [공통 부품의 접근성 이름을 시험으로](/memo/ui-a11y-names)               |
| '단추'를 '버튼'으로        | #244 | —                                                                       |
| 아이콘 버튼 45곳           | #245 | [IconButton으로](/memo/icon-button-migrate)                             |
| 글자 버튼 30곳             | #246 | [Button으로](/memo/text-button-migrate)                                 |
| 시트·모달 다시 찾기        | #247 | [Modal로 옮긴 것은 하나](/memo/sheet-modal-migrate)                     |
| 데스크톱·휴대폰 짝         | #250 | [메뉴 모양을 variant로 고르기](/memo/ui-variant-pairs)                  |

먼저 세었다. `docs/ui.md`에 부품 15개의 props와 쓰는 곳을 적고, 직접 쓴 `<button>` 295곳을 분류했다(옮길 수 있는 것 93곳). 계획에 적은 후보 아홉(`Sheet`, `Modal`, `ListRow`, `SegmentedControl`, `SearchField`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`) 중 지금 코드에서 같은 뜻으로 되풀이되는 것은 셋이었다.

옮길 때는 모양을 바꾸지 않았다. E2E를 돌리며 공통 클래스를 뗀 계산된 스타일과 붙인 계산된 스타일을 비교했다. 마지막 #250에서는 macOS·iOS 모양을 고르는 곳을 찾았고, `variant`가 깔끔한 답인 곳은 Menu 하나였다(`className="touch"` → `variant="ios"`).

## 전후

|                    | 전            | 후                                                                           |
| ------------------ | ------------- | ---------------------------------------------------------------------------- |
| 직접 쓴 `<button>` | 295곳         | 265곳 (세는 방법을 정해 다시 셈: Safari 데모 91, 앱 고유 172, 일부러 남긴 2) |
| 시트·모달          | 앱마다 구현   | `Sheet`·`Modal`                                                              |
| 접근성 이름        | 규칙 없음     | 시험 10개, 아이콘만 있는 `IconButton`은 `label` 없이 타입 오류               |
| '단추'             | 255파일 949곳 | 모두 '버튼'                                                                  |

![직접 쓴 button 265곳의 구성 막대](./images/refactor-step4-components-buttons.svg '남은 버튼은 대부분 일부러 다르게 그린 Safari 데모와 앱 고유의 버튼이다')

## 일부러 남긴 것

- 후보 여섯(`ListRow`, `SegmentedControl`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`)은 수가 많아도 모양이나 뜻이 달라 보류했다.
- 남은 시트와 가운데 창은 동작이 달라 그대로 두었다.
- Safari 데모의 버튼 91곳은 페이지마다 일부러 다르게 그린 것이라 옮기지 않았다.

이전 단계: [3단계 — 공통 기반 코드](/memo/refactor-step3-foundation) · 다음 단계: [5단계 — 스타일](/memo/refactor-step5-styles)

#MacFolio #리팩터링 #React #디자인시스템
