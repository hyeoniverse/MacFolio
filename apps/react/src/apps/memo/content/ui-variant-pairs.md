---
title: variant prop과 별도 컴포넌트 중 macOS·iOS 모양 분기 방식 고르기
date: 2026-10-18
category: 개발 기록/MacFolio/화면·스타일
series: 공통 UI 컴포넌트
seriesOrder: 7
summary: 같은 부품이 macOS와 iOS 모양을 선택하는 곳을 모두 찾았다. variant가 적합한 곳은 Menu 하나라 className="touch"를 variant="ios"로 바꿨고(9파일), Sheet·Modal 등은 이유를 기록하고 별도 부품으로 유지했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계의 마지막 항목은 "데스크톱·휴대폰 짝: 같은 컴포넌트가 `variant`로 macOS·iOS 모양을 고르게 하기"였다. 버튼은 이미 `IconButton`이 `tool`·`float`·`circle`로 모양을 선택한다([아이콘 버튼 전환 글](/memo/icon-button-migrate)). 이번에는 나머지 부품을 전수 조사해, 같은 일을 다른 방식으로 처리하는 곳이 있는지 확인했다.

## 배경

### 한 코드로 두 화면을 렌더링하는 구조

MacFolio는 하나의 코드로 데스크톱 화면(macOS 재현)과 휴대폰 화면(iOS 재현)을 함께 렌더링한다. 그래서 같은 부품이 두 모양을 가져야 하는 경우가 많다. 메뉴가 대표적이다. 데스크톱 메뉴는 마우스 포인터로 선택하므로 항목이 작고 촘촘해도 된다. 휴대폰에서는 손가락으로 눌러야 하므로 항목 하나의 높이와 여백이 커야 한다. Apple의 접근성 지침([Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility))은 컨트롤의 기본 크기를 macOS에서 28×28pt, 손가락으로 누르는 iOS에서 44×44pt로 제시한다. 같은 메뉴라도 iOS에서는 한 변이 약 1.6배 큰 누름 영역이 필요하다.

![데스크톱 Finder의 mac 메뉴와 휴대폰 메모 목록의 ios 메뉴](./images/ui-variant-pairs-menus.jpg '같은 Menu 컴포넌트가 데스크톱에서는 작은 모서리와 촘촘한 항목, 휴대폰에서는 넓은 폭과 큰 모서리로 렌더링된다')

### 모양을 고르는 두 가지 방법: className과 variant

React 컴포넌트가 여러 모양을 지원하는 방법은 크게 두 가지다.

| 방법                 | 동작                                                                                | 예시                         |
| -------------------- | ----------------------------------------------------------------------------------- | ---------------------------- |
| `className` 덧붙이기 | 호출하는 쪽이 CSS 클래스 이름을 문자열로 넘기고, CSS가 그 이름에 규칙을 건다        | `<Menu className="touch" />` |
| `variant` prop       | 컴포넌트가 허용하는 모양의 목록을 타입으로 정하고, 호출하는 쪽은 그중 하나를 고른다 | `<Menu variant="ios" />`     |

`variant`의 타입은 TypeScript의 [리터럴 유니언 타입](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types)으로 정한다. `'mac' | 'ios'`처럼 정확한 문자열 몇 개만 허용하는 타입이라, 목록에 없는 값을 넘기면 편집기와 `tsc`가 오류를 표시한다. 반면 `className`의 타입은 `string`이므로 어떤 문자열이든 통과한다.

### 부품마다 달랐던 선택 방법

문제는 ==모양을 선택하는 방법이 부품마다 달랐다==는 점이다.

| 부품         | 휴대폰 모양 선택 방법                    |
| ------------ | ---------------------------------------- |
| `IconButton` | `variant` prop                           |
| `Menu`       | 호출하는 쪽이 `className="touch"`를 추가 |

둘 다 동작은 한다. 하지만 새 앱을 만들 때 "휴대폰 모양은 어떻게 선택하는가"에 대한 답이 두 가지라서, 코드를 읽을 때마다 부품별 규칙을 기억해야 했다.

## 조사 방법

같은 부품이 두 모양을 선택하는 패턴을 세 가지로 나눠 검색했다.

1. 호출하는 쪽이 `className`으로 휴대폰 모양을 덮어쓰는 곳 (`className="touch"` 등)
2. `FinderMobile`처럼 휴대폰용 컴포넌트를 따로 만든 곳
3. `useIsMobile`(현재 화면이 휴대폰 크기인지 반환하는 hook)로 같은 컨트롤의 마크업을 바꾸는 곳

1번은 `Menu` 한 곳에서만 검색됐다. 2번과 3번은 여러 곳에서 검색됐지만, 하나씩 열어 확인하니 부품이 아니라 화면 단위로 다르거나, 두 모양이 원래 다른 부품이었다. 아래 "variant로 묶지 않은 짝"에 이유를 기록했다.

## Menu의 문제

`Menu`(`apps/react/src/shared/ui/menu/Menu.tsx`)는 원래 다음처럼 클래스를 조합했다.

```tsx
className={['ui-menu', className].filter(Boolean).join(' ')}
```

휴대폰 모양은 `Menu.css`의 `.ui-menu.touch` 규칙이 담당한다. 최소 폭을 180px에서 250px로, 모서리 반지름을 12px에서 22px로 키우고 항목 여백도 넓힌다.

![mac 메뉴와 ios 메뉴의 크기를 나란히 놓은 그림](./images/ui-variant-pairs-sizes.svg 'Menu.css가 정한 두 모양의 크기')

> [!WARNING] className으로 고르는 모양
> `touch`라는 이름은 CSS와 호출하는 쪽 사이의 암묵적인 규칙이다. `className="tuoch"`라고 잘못 입력해도 타입 검사는 통과하고, 화면에서 메뉴가 작게 표시된 뒤에야 발견된다. 또 `className`은 위치를 미세 조정하는 용도로도 쓰여서, 이 값이 "모양"인지 "위치 조정"인지 코드만으로는 구별할 수 없었다.

## 검토한 방법

| 방법                                           | 장점                                                     | 단점                                                    |
| ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| 그대로 `className="touch"`                     | 변경할 것이 없다                                         | 오타를 막지 못한다. 모양과 위치 조정이 한 속성에 섞인다 |
| `variant`를 `useIsMobile`로 자동 선택          | 호출하는 쪽이 아무것도 지정하지 않아도 된다              | 휴대폰 화면 안에서 mac 모양을 쓰는 곳이 예외가 된다     |
| `variant?: 'mac' \| 'ios'`, 호출하는 쪽이 명시 | 잘못된 값을 타입 검사가 막는다. `IconButton`과 같은 방식 | 아홉 파일을 수정해야 한다                               |

자동 선택이 가장 간편해 보였지만 채택하지 않았다. 메모 앱의 폴더 행은 휴대폰 화면에서도 편집 모드에서만 iOS 메뉴를 쓰고, 그 밖에는 mac 메뉴를 쓴다. 자동으로 선택하면 이런 곳마다 "자동 선택을 끄는" prop이 추가로 필요하다. ==호출하는 쪽이 값 하나를 명시하는 편이 더 단순하다.==

## 구현

먼저 variant를 클래스로 변환하는 작은 함수를 별도 파일로 분리했다(`apps/react/src/shared/ui/menu/variant.ts`). 컴포넌트를 렌더링하지 않고도 시험할 수 있게 하기 위해서다.

```ts
export type MenuVariant = 'mac' | 'ios';

/** variant가 붙이는 클래스 (Menu.css의 .ui-menu.touch). 'mac'은 덧붙이지 않는다 */
export const menuVariantClass = (variant: MenuVariant): string | undefined => (variant === 'ios' ? 'touch' : undefined);
```

`Menu`는 기본값을 `mac`으로 지정하고 이 함수를 적용했다.

```tsx
variant = 'mac',
// ...
className={['ui-menu', menuVariantClass(variant), className].filter(Boolean).join(' ')}
```

입력과 결과는 다음과 같다.

| 호출                                       | 렌더링된 `class`      |
| ------------------------------------------ | --------------------- |
| `<Menu />`                                 | `ui-menu`             |
| `<Menu variant="ios" />`                   | `ui-menu touch`       |
| `<Menu variant="ios" className="extra" />` | `ui-menu touch extra` |
| `<Menu variant="iso" />`                   | 타입 오류로 빌드 실패 |

==CSS는 한 줄도 수정하지 않았다.== `ios`가 기존 `touch` 클래스를 그대로 붙이므로 화면은 같아야 한다. 그다음 호출하는 쪽 아홉 파일을 수정했다.

- 메모: `PhoneListBars`, `PhoneReaderBars`, `FolderPickMenu`, `FolderRow`(두 곳)
- Finder 휴대폰(`FinderMobile`), 음악(`Music`), 사진 휴대폰·크게 보기(`PhotosMobile`, `PhoneViewer`), Safari 휴대폰(`SafariMobile`)

메모 폴더 행만 조건식을 사용한다.

```tsx
// 전
className={props.editing ? 'touch' : undefined}
// 후
variant={props.editing ? 'ios' : 'mac'}
```

`className`은 위치 조정 용도로 남겼고, [`docs/ui.md`](https://github.com/hyeoniverse/MacFolio/blob/main/docs/ui.md)의 "데스크톱·휴대폰 짝" 절에 부품별 variant 표와 "모양은 더 이상 className으로 선택하지 않는다"는 규칙을 기록했다.

## variant로 묶지 않은 짝

나머지 후보는 `variant`로 묶지 않았다. 판단 순서는 다음 그림과 같다.

![화면 전체가 다르면 화면 단위 컴포넌트, 나타나는 방식이 다르면 별도 부품, 크기만 다르면 variant를 고르는 순서도](./images/ui-variant-pairs-decision.svg '위에서부터 차례로 질문해 처리 방식을 고른다')

| 후보                                         | 묶지 않은 이유                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Sheet`와 `Modal`                            | 둘 다 다이얼로그지만 나타나는 방향, 오버레이, 높이, 닫는 동작이 다르다. 한 부품으로 묶으면 내부 분기만 늘어난다 ([Sheet](/memo/ui-sheet), [Modal](/memo/ui-modal)) |
| `SearchField`                                | 데스크톱과 휴대폰의 모양이 같다. 앱마다 다른 크기는 호출하는 쪽 `className`이 담당한다                                                                             |
| `FinderMobile`·`PhotosMobile`·`SafariMobile` | 부품이 아니라 화면 전체(탭 막대, 내비게이션 막대)가 다르다. 안쪽 부품은 이미 `variant`를 사용한다                                                                  |
| `Button`과 목록 행                           | 휴대폰 전용 모양을 선택하는 곳이 없다                                                                                                                              |

`Sheet`와 `Modal`을 예로 들면, `Modal`은 화면 가운데에 나타나고 `Sheet`는 아래에서 올라온다. 한 컴포넌트로 합치면 위치 계산, 등장·퇴장 키프레임, 오버레이 유무를 모두 `if (variant === 'sheet')`로 나눠야 하고, 그 분기는 두 부품 코드를 한 파일에 합친 것과 같다.

![Menu는 className touch에서 variant ios로 바뀌었고, 나머지 짝은 그대로 유지한 이유](./images/ui-variant-pairs-menu.svg '변경한 것과 유지한 것')

## 확인

- 단위 시험: `apps/react/src/shared/ui/menu/variant.test.ts`에 두 가지를 추가했다. "mac은 클래스를 덧붙이지 않는다", "ios는 Menu.css의 touch 모양을 붙인다".
- 화면: 데스크톱과 iPhone 크기, 라이트 모드와 다크 모드에서 메뉴를 열고, 변경 전과 후의 계산된 스타일([`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle), 브라우저가 모든 CSS 규칙을 적용한 뒤 요소에 최종으로 지정한 값)을 비교했다. 차이는 없었다.
- 남은 사용처: 변경 후 소스에서 `className="touch"`를 검색하면 결과가 없다. `variant="ios"`(또는 조건식)는 11곳이다.

변경 크기는 14파일, 81줄 추가와 13줄 삭제였고 그중 51줄은 문서(`docs/ui.md`)와 이 글이다([#250](https://github.com/hyeoniverse/MacFolio/pull/250)).

## 남은 것·배운 것

결과적으로 변경한 부품은 `Menu` 하나다. 조사해 보니 나머지는 이미 적합한 구조였다. ==이번 작업의 결과물은 코드보다 판단 기준이다.==

- 두 모양의 차이가 크기·간격 수준이면 `variant`가 적합하다. 나타나는 방식이나 구조가 다르면 부품을 분리하는 편이 낫다.
- 기본값을 화면 크기로 자동 선택하면 처음에는 간편하지만, 예외가 하나만 생겨도 규칙이 두 개가 된다. 그래서 호출하는 쪽이 명시하게 했다.
- 클래스 이름 규칙은 가능하면 타입으로 바꾼다. 오타가 화면이 아니라 편집기의 타입 검사에서 발견된다.

> [!TIP]
> 다음에 휴대폰 전용 모양이 필요한 부품이 생기면 `className`이 아니라 `variant`부터 추가한다.

## 관련 글

- [계산된 스타일 비교로 화면 변화 없이 아이콘 버튼을 IconButton으로 옮기기](/memo/icon-button-migrate): 버튼 모양을 variant로 선택하는 방식
- [shared/ui 사용처 집계로 공통 컴포넌트 후보를 고르고 모달 동작을 Modal 컴포넌트로 추출하기](/memo/ui-modal): 휴대폰 시트와 데스크톱 모달을 분리한 이유
- [오버레이·닫기·role을 공통 Sheet 컴포넌트로 추출하고 모양은 variant로 나누기](/memo/ui-sheet)
- [계산된 스타일 비교로 검증한 공통 버튼 컴포넌트 교체](/memo/refactor-retrospective#4단계-공통-컴포넌트): 4단계 정리
- PR: [#250](https://github.com/hyeoniverse/MacFolio/pull/250)

<details><summary>참고 문헌</summary>

- [Apple Human Interface Guidelines: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines: Menus](https://developer.apple.com/design/human-interface-guidelines/menus)
- [TypeScript Handbook: Literal Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types)
- [MDN: Window.getComputedStyle()](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)

</details>

#MacFolio #React #리팩터링
