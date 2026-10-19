---
title: 데스크톱과 휴대폰의 메뉴 모양을 variant로 고르기
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 같은 부품이 macOS와 iOS 모양을 고르는 곳을 모두 찾았다. variant가 맞는 곳은 Menu 하나라 className="touch"를 variant="ios"로 바꿨고(9파일), Sheet·Modal 등은 이유를 적고 따로 두었다.
---

리팩터링 계획 4단계의 마지막 항목은 "데스크톱·휴대폰 짝: 같은 컴포넌트가 `variant`로 macOS·iOS 모양을 고르게 하기"였다. 버튼은 이미 `IconButton`이 `tool`·`float`·`circle`로 모양을 고른다(/memo/icon-button-migrate). 이번에는 나머지 부품을 훑어서, 같은 일을 다른 방식으로 하는 곳이 있는지 본다.

## 배경

MacFolio는 한 코드로 데스크톱 화면(macOS 흉내)과 휴대폰 화면(iOS 흉내)을 함께 그린다. 그래서 같은 부품이 두 모양을 가져야 할 때가 많다. 메뉴가 대표적이다. 데스크톱 메뉴는 마우스로 고르니 작고 촘촘해도 되지만, 휴대폰에서는 손가락으로 눌러야 하니 iOS 메뉴처럼 크고 둥글어야 한다.

문제는 이 모양을 고르는 방법이 부품마다 제각각이었다는 점이다. `IconButton`은 `variant` 속성으로 고르는데, `Menu`는 쓰는 쪽이 `className="touch"`를 덧붙였다. 둘 다 동작은 한다. 하지만 새 앱을 만들 때 "휴대폰 모양은 어떻게 고르지?"에 답이 두 가지라서, 코드를 읽을 때마다 부품별 약속을 기억해야 했다.

## 어떻게 찾았나

같은 부품이 두 모양을 고르는 흔적을 세 가지로 나눠 찾았다.

1. 쓰는 쪽이 `className`으로 휴대폰 모양을 덧씌우는 곳 (`className="touch"` 같은 것)
2. `FinderMobile`처럼 휴대폰용 컴포넌트를 따로 만든 곳
3. `useIsMobile`로 같은 컨트롤의 마크업을 바꾸는 곳

1번은 `Menu` 한 곳에서만 나왔다. 2번과 3번은 여러 곳에서 나왔지만, 하나씩 열어 보니 부품이 아니라 화면 단위로 다르거나, 두 모양이 원래 다른 부품이었다. 아래 "따로 둔 짝"에 이유를 적었다.

## Menu: 무엇이 문제였나

`Menu`(`apps/react/src/shared/ui/menu/Menu.tsx`)는 원래 이렇게 클래스를 만들었다.

```tsx
className={['ui-menu', className].filter(Boolean).join(' ')}
```

휴대폰 모양은 `Menu.css`의 `.ui-menu.touch` 규칙이 맡는다. 최소 폭을 180px에서 250px로, 모서리를 12px에서 22px로 키우고 항목 여백도 넓힌다.

![mac 메뉴와 ios 메뉴의 크기를 나란히 놓은 그림](./images/ui-variant-pairs-sizes.svg 'Menu.css가 정한 두 모양의 크기')

`touch`라는 이름은 CSS와 쓰는 쪽 사이의 약속일 뿐이다. `className="tuoch"`라고 잘못 적어도 타입 검사는 통과하고, 화면에서 메뉴가 작게 나와야 알아챈다. 또 `className`은 위치를 조금 옮기는 용도로도 쓰여서, 이 값이 "모양"인지 "위치 조정"인지 읽는 쪽에서 구별이 안 됐다.

## 고른 방법과 버린 방법

| 방법                                       | 장점                                         | 단점                                                  |
| ------------------------------------------ | -------------------------------------------- | ----------------------------------------------------- |
| 그대로 `className="touch"`                 | 바꿀 것이 없다                               | 오타를 못 막는다. 모양과 위치 조정이 한 속성에 섞인다 |
| `variant`를 `useIsMobile`로 자동 선택      | 쓰는 쪽이 아무것도 안 적어도 된다            | 휴대폰 화면 안에서 mac 모양을 쓰는 곳이 예외가 된다   |
| `variant?: 'mac' \| 'ios'`, 쓰는 쪽이 명시 | 타입이 값을 막는다. `IconButton`과 같은 방식 | 아홉 파일을 고쳐야 한다                               |

자동 선택이 가장 편해 보였지만 버렸다. 메모 앱의 폴더 줄은 휴대폰 화면에서도 편집 중일 때만 iOS 메뉴를 쓰고, 평소에는 mac 메뉴를 쓴다. 자동으로 고르면 이런 곳마다 "자동을 끄는" 속성이 또 필요하다. 쓰는 쪽이 한 단어를 적는 편이 더 단순하다.

## 구현

먼저 variant를 클래스로 바꾸는 작은 함수를 따로 뒀다(`apps/react/src/shared/ui/menu/variant.ts`). 컴포넌트를 렌더하지 않고도 시험할 수 있게 하려는 것이다.

```ts
export type MenuVariant = 'mac' | 'ios';

/** variant가 붙이는 클래스 (Menu.css의 .ui-menu.touch). 'mac'은 덧붙이지 않는다 */
export const menuVariantClass = (variant: MenuVariant): string | undefined => (variant === 'ios' ? 'touch' : undefined);
```

`Menu`는 기본값을 `mac`으로 두고 이 함수를 끼웠다.

```tsx
variant = 'mac',
// ...
className={['ui-menu', menuVariantClass(variant), className].filter(Boolean).join(' ')}
```

CSS는 한 줄도 고치지 않았다. `ios`가 기존 `touch` 클래스를 그대로 붙이므로 화면은 같아야 한다. 그다음 쓰는 쪽 아홉 파일을 바꿨다.

- 메모: `PhoneListBars`, `PhoneReaderBars`, `FolderPickMenu`, `FolderRow`(두 곳)
- Finder 휴대폰(`FinderMobile`), 음악(`Music`), 사진 휴대폰·크게 보기(`PhotosMobile`, `PhoneViewer`), Safari 휴대폰(`SafariMobile`)

메모 폴더 줄만 조건이 붙는다.

```tsx
// 전
className={props.editing ? 'touch' : undefined}
// 후
variant={props.editing ? 'ios' : 'mac'}
```

`className`은 위치 조정용으로 남겼고, `docs/ui.md`의 "데스크톱·휴대폰 짝" 절에 부품별 variant 표와 "모양은 더 이상 className으로 고르지 않는다"는 규칙을 적었다.

## 따로 둔 짝

나머지 후보는 `variant`로 묶지 않았다.

- `Sheet`와 `Modal`: 둘 다 다이얼로그지만 나타나는 방향, 덮개, 높이, 닫는 몸짓이 다르다. 한 부품으로 묶으면 안쪽에 분기만 늘어난다(/memo/ui-sheet, /memo/ui-modal).
- `SearchField`: 데스크톱과 휴대폰이 같은 모양이다. 앱마다 다른 크기는 쓰는 쪽 `className`이 맡는다.
- `FinderMobile`·`PhotosMobile`·`SafariMobile`: 부품이 아니라 화면 전체(탭 막대, 내비게이션 막대)가 다르다. 안쪽 부품은 이미 `variant`를 쓴다.
- `Button`과 목록 줄: 휴대폰 전용 모양을 고르는 곳이 없다.

![Menu는 className touch에서 variant ios로 바뀌었고, 나머지 짝은 그대로 둔 이유](./images/ui-variant-pairs-menu.svg '바꾼 것과 그대로 둔 것')

## 확인

- 단위 시험: `apps/react/src/shared/ui/menu/variant.test.ts`에 두 가지를 넣었다. "mac은 클래스를 덧붙이지 않는다", "ios는 Menu.css의 touch 모양을 붙인다".
- 화면: 데스크톱과 iPhone 크기, 밝은 화면과 어두운 화면에서 메뉴를 열고, 바꾸기 전과 후의 계산된 스타일을 비교했다. 차이는 없었다.
- 남은 흔적: 바꾼 뒤 소스에서 `className="touch"`를 찾으면 나오는 곳이 없다. `variant="ios"`(또는 조건식)는 11곳이다.

변경 크기는 14파일, 81줄 추가와 13줄 삭제였고 그중 51줄은 문서(`docs/ui.md`)와 이 글이다.

## 남은 것·배운 것

결과적으로 바꾼 부품은 `Menu` 하나다. 찾아 보니 나머지는 이미 맞는 모양이었다. 이번 일에서 남는 것은 코드보다 판단 기준이다.

- 두 모양의 차이가 크기·간격 정도면 `variant`가 맞다. 나타나는 방식이나 구조가 다르면 부품을 나누는 편이 낫다.
- 기본값을 화면 크기에서 자동으로 고르면 처음엔 편하지만 예외가 하나만 생겨도 규칙이 두 개가 된다. 쓰는 쪽이 명시하게 했다.
- 클래스 이름 약속은 타입으로 바꿀 수 있으면 바꾼다. 오타가 화면에서가 아니라 편집기에서 잡힌다.

다음에 휴대폰 전용 모양이 필요한 부품이 생기면 `className`이 아니라 `variant`부터 더한다.

## 관련 글

- 버튼 모양을 variant로 고르기: /memo/icon-button-migrate
- 휴대폰 시트와 데스크톱 모달을 따로 둔 이유: /memo/sheet-modal-migrate
- 리팩터링 4단계 정리: /memo/refactor-step4-components
- PR: https://github.com/hyeoniverse/MacFolio/pull/250

#MacFolio #React #리팩터링
