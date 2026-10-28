---
title: 아이콘 버튼 45곳과 텍스트 버튼 30곳을 공통 컴포넌트로 교체하기 (리팩터링 4단계)
date: 2026-10-18
category: 개발 기록/MacFolio/디자인 시스템
summary: 리팩터링 4단계 회고. 후보 아홉 개를 다시 집계해 세 개만 컴포넌트로 만들고, 아이콘 버튼 45곳과 텍스트 버튼 30곳을 공통 컴포넌트로 교체했다. 스타일 동일 여부는 계산된 스타일로, 접근성 이름 여부는 타입과 시험으로 확인했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 4단계는 공통 컴포넌트였다. PR 수가 가장 많았던 단계다.

## 배경

`shared/ui`에 button·dialog·menu·popover·reorder가 있었지만, `<button>`을 사용하는 앱 파일 53개 중 공통 버튼을 사용하는 파일은 15개였다. 시트와 모달은 메일·메시지·음악·설정·휴지통이 각자 구현했다.

개별 구현의 차이는 동작에서 드러났다.

| 증상                                                   | 원인                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| Launchpad가 Esc로 닫히지 않음                          | 모달 다섯 개가 Esc·바깥 클릭·포커스·닫기 애니메이션을 각자 구현 |
| 배경화면 이름 변경 중 포커스가 입력 칸 밖이면 Esc 무시 | 같은 원인                                                       |
| 아이콘 버튼에 접근성 이름 누락 가능                    | `label`이 선택 값이었고 검사하는 시험도 없음                    |
| 공통 버튼 CSS 수정이 일부 버튼에만 반영                | 앱이 `<button>`을 직접 사용                                     |

## 채택한 방법과 제외한 방법

| 방법                                                   | 장점                                 | 단점                                                                          |
| ------------------------------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------- |
| 계획의 후보 아홉 개를 모두 컴포넌트로 만들기           | 계획대로 한 번에 끝난다              | 집계해 보니 여섯 개는 앱마다 모양이나 의미가 달라, 컴포넌트 옵션이 과도해진다 |
| Radix·React Aria 같은 헤드리스 라이브러리              | 접근성과 키보드 동작이 검증되어 있다 | 기존 `shared/ui`의 메뉴·팝오버와 겹치고, 모든 사용처를 다시 구현해야 한다     |
| 기존 컴포넌트를 확장하고, 반복되는 세 개만 추가 (채택) | 교체할 때 모양을 그대로 유지한다     | 남은 후보 여섯 개는 앱마다 개별 구현으로 남는다                               |

사용 현황 집계는 [#210](https://github.com/hyeoniverse/MacFolio/pull/210)에서 했다. `docs/ui.md`에 컴포넌트 15개의 props와 사용처를 기록하고, `<button>`을 직접 사용하는 295곳을 "공통 버튼으로 교체 가능 / 앱 고유 / Safari 데모"로 분류했다. 교체 가능한 곳은 93곳이었다.

4단계 첫 PR은 목록 문서였는데, 제목이 "shared/ui 부품 목록과 새로 뽑을 후보 아홉의 지금 수"라 작업 내용이 드러나지 않아 수정했다. 문서에서 일부 후보를 "보류. 수가 많아도 모양·뜻이 다르다"로 분류한 것도 다시 검토했다. 모양을 통일하면 해결되지 않는지, 그리고 버튼이 공통 컴포넌트의 기본인데 왜 목록에 없는지 검토하며 버튼 295곳을 다시 집계했다([공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-inventory)). Modal PR의 처음 제목은 "가운데 뜨는 창 다섯의 겉을 Modal 하나로"였다. "겉"이 가리키는 대상이 불분명해서 오버레이·포커스·Esc 같은 정확한 용어로 다시 작성했다.

## 변경 목록

| 항목                        | PR                                                       | 글                                                                                                     |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 컴포넌트 목록과 후보 재집계 | [#210](https://github.com/hyeoniverse/MacFolio/pull/210) | [공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-inventory)                                |
| `Modal`                     | [#212](https://github.com/hyeoniverse/MacFolio/pull/212) | [모달 다이얼로그 5개를 Modal로](/memo/ui-modal)                                                        |
| `Sheet`                     | [#220](https://github.com/hyeoniverse/MacFolio/pull/220) | [휴대폰 시트 3곳을 Sheet로](/memo/ui-sheet)                                                            |
| CSS 레이어 순서 고정        | [#221](https://github.com/hyeoniverse/MacFolio/pull/221) | [CSS @layer 순서를 index.html 인라인 스타일에서 모든 CSS보다 먼저 선언하기](/memo/css-layer-order-fix) |
| `SearchField`               | [#223](https://github.com/hyeoniverse/MacFolio/pull/223) | —                                                                                                      |
| 접근성 이름 시험            | [#243](https://github.com/hyeoniverse/MacFolio/pull/243) | [IconButton props 유니언 타입으로 아이콘 버튼의 접근 가능한 이름 강제하기](/memo/ui-a11y-names)        |
| '단추'를 '버튼'으로         | [#244](https://github.com/hyeoniverse/MacFolio/pull/244) | —                                                                                                      |
| 아이콘 버튼 45곳            | [#245](https://github.com/hyeoniverse/MacFolio/pull/245) | [IconButton으로](/memo/icon-button-migrate)                                                            |
| 텍스트 버튼 30곳            | [#246](https://github.com/hyeoniverse/MacFolio/pull/246) | [Button으로](/memo/text-button-migrate)                                                                |
| 시트·모달 재조사            | [#247](https://github.com/hyeoniverse/MacFolio/pull/247) | [Modal로 옮긴 것은 하나](/memo/sheet-modal-migrate)                                                    |
| 데스크톱·휴대폰 짝          | [#250](https://github.com/hyeoniverse/MacFolio/pull/250) | [메뉴 모양을 variant로 고르기](/memo/ui-variant-pairs)                                                 |

## 구현

![4단계 PR 열한 개의 날짜와 크기](./images/refactor-step4-components-timeline.svg '부품을 먼저 만들고, 사용처를 옮기는 PR은 마지막 날에 몰았다')

계획에 적은 후보 아홉 개(`Sheet`, `Modal`, `ListRow`, `SegmentedControl`, `SearchField`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`) 중 현재 코드에서 같은 의미로 반복되는 것은 세 개(`Sheet`, `Modal`, `SearchField`)였다.

### 접근성 이름이 없으면 타입 오류

아이콘 버튼은 `label`이 없으면 컴파일되지 않게 했다. 아이콘만 있는 버튼은 스크린 리더가 읽을 텍스트가 없기 때문이다.

```ts
// apps/react/src/shared/ui/button/IconButton.tsx
export type IconButtonProps = IconButtonBase &
	(
		| { label: string; children?: ReactNode } // 이름이 있거나
		| { label?: undefined; children: ReactNode } // 보이는 글자가 있거나
	);
```

`label`은 [`aria-label`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label)과 `title`에 함께 적용된다. 아이콘 `<i>`에는 `aria-hidden="true"`를 붙이고, 폼 안에서도 제출 버튼이 되지 않게 `type="button"`을 기본값으로 한다. 이 규칙은 `shared/ui/a11y.test.ts`가 컴포넌트를 HTML 문자열로 렌더링해 확인한다.

```ts
it('아이콘 버튼: label이 이름(aria-label)과 마우스 설명(title)이 되고, 아이콘은 읽지 않는다', () => {
	const out = html(createElement(IconButton, { label: '지우기', icon: 'fa-solid fa-trash-can' }));
	expect(out).toContain('aria-label="지우기"');
	expect(out).toContain('<i class="fa-solid fa-trash-can" aria-hidden="true">');
});
```

### 모양을 바꾸지 않고 교체하기

교체할 때는 모양을 바꾸지 않았다. E2E를 실행하며 공통 클래스를 제거한 상태와 적용한 상태의 계산된 스타일([`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle))을 비교했다.

1. 공통 클래스를 제거한 상태 = 교체 전의 `<button>`
2. 공통 클래스를 적용한 상태 = 교체 후
3. 두 계산된 스타일이 같으면 교체해도 화면이 같다

시험이 통과하는 화면(데스크톱·휴대폰, 켜짐·꺼짐, 비활성, 호버 상태)마다 기록되어 수동으로 화면을 찾아다닐 필요가 없었다.

교체 중 공통 버튼의 여백이 사라진 문제도 있었다. CSS 레이어 순서 `@layer reset, components;`를 선언해 두었는데, 빌드한 `index.html`에서 components 레이어가 reset 레이어보다 먼저 등장해 초기화 규칙(`* { padding: 0 }`)이 공통 컴포넌트보다 우선했다. 브라우저는 레이어 이름이 문서에 처음 등장한 순서로 [레이어 순서](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)를 정한다. 선언을 `index.html`의 인라인 `<style>` 맨 앞으로 옮겨 모든 CSS보다 먼저 순서를 확정했다(#221).

### variant는 Menu 하나만

마지막 #250에서는 macOS·iOS 모양을 선택하는 곳을 조사했고, `variant` prop이 적합한 곳은 Menu 하나였다(`className="touch"` → `variant="ios"`).

```ts
// apps/react/src/shared/ui/menu/variant.ts
export type MenuVariant = 'mac' | 'ios';
export const menuVariantClass = (variant: MenuVariant): string | undefined => (variant === 'ios' ? 'touch' : undefined);
```

다른 짝(사진 보기, 메일 목록 등)은 데스크톱과 휴대폰의 DOM 구조 자체가 달라, 컴포넌트 하나에 variant 값을 추가하는 방식으로는 해결되지 않았다.

## 전후

|                    | 전            | 후                                                                          |
| ------------------ | ------------- | --------------------------------------------------------------------------- |
| 직접 쓴 `<button>` | 295곳         | 265곳 (집계 기준을 정해 재집계: Safari 데모 91, 앱 고유 172, 의도적 유지 2) |
| 시트·모달          | 앱마다 구현   | `Sheet`·`Modal`                                                             |
| 접근성 이름        | 규칙 없음     | 시험 10개, 아이콘만 있는 `IconButton`은 `label` 없이 타입 오류              |
| '단추'             | 255파일 949곳 | 모두 '버튼'                                                                 |

![직접 쓴 button 265곳의 구성 막대](./images/refactor-step4-components-buttons.svg '남은 버튼은 대부분 일부러 다르게 그린 Safari 데모와 앱 고유의 버튼이다')

## 확인

- 접근성 이름: `shared/ui/a11y.test.ts`가 버튼·대화상자·시트·검색 칸·날짜 선택기의 이름과 역할을 검사한다. `IconButton`에 `label`을 누락하면 `tsc`가 먼저 차단한다.
- 모양: 아이콘 버튼 45곳과 텍스트 버튼 30곳 모두 계산된 스타일 비교에서 최종 차이가 없었다. 비교 중 차이가 난 값은 공통 CSS가 추가하는 값이었고, 앱마다 명시도[^specificity]가 0인 규칙([`:where()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:where)) 하나로 원래 값을 복원했다.
- '단추'를 '버튼'으로(#244): 병합 커밋에서 751줄이 바뀌었다. 텍스트만 바꾼 PR이라 추가한 줄과 삭제한 줄이 같다.

## 의도적으로 남긴 것

- 후보 여섯 개(`ListRow`, `SegmentedControl`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`)는 사용처가 많아도 모양이나 의미가 달라 보류했다.
- 남은 시트와 가운데 창은 동작이 달라 유지했다.
- Safari 데모의 버튼 91곳은 페이지마다 의도적으로 다르게 디자인한 것이라 교체하지 않았다.

## 배운 것

- **집계하면 범위가 줄어든다.** 계획 단계의 후보 아홉 개 중 실제로 반복되는 것은 세 개였다. 나머지를 컴포넌트로 만들었다면 옵션만 늘었을 것이다.
- **"동일함"은 값으로 확인한다.** 클래스를 제거·적용해 계산된 스타일을 비교하는 방법은 5단계 스타일 작업에서도 그대로 사용했다.
- **규칙은 타입으로 강제하는 비용이 가장 낮다.** 이름 없는 아이콘 버튼은 시험보다 먼저 컴파일러가 차단한다.

이전 단계: [3단계 — 공통 기반 코드](/memo/refactor-step3-foundation) · 다음 단계: [5단계 — 스타일](/memo/refactor-step5-styles)

## 관련 글

- [공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-inventory)
- [모달 다이얼로그 5개의 공통 동작을 Modal 컴포넌트로 추출](/memo/ui-modal)
- [계산된 스타일 비교로 아이콘 버튼 45곳을 IconButton으로 옮기기](/memo/icon-button-migrate)
- [명시도 0인 :where() 규칙으로 글자 버튼 30곳을 Button으로 옮기기](/memo/text-button-migrate)
- [계산된 스타일 비교로 공통 Modal 교체 대상을 고른 시트·모달 조사](/memo/sheet-modal-migrate)
- [CSS @layer 순서를 index.html 인라인 스타일에서 모든 CSS보다 먼저 선언하기](/memo/css-layer-order-fix)

[^specificity]: 명시도(specificity)는 여러 CSS 규칙이 같은 속성을 지정할 때 어느 규칙을 적용할지 정하는 점수다. `:where()` 안의 선택자는 명시도가 0이라, 다른 어떤 규칙에도 덮어쓰일 수 있다. [MDN Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity) 참고.

#MacFolio #리팩터링 #React #디자인시스템
