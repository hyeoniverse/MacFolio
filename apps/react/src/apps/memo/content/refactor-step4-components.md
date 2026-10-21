---
title: 리팩터링 4단계 — 공통 컴포넌트 설계
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 리팩터링 4단계를 돌아본다. 후보 아홉을 다시 세어 셋만 부품으로 만들고, 아이콘 버튼 45곳과 글자 버튼 30곳을 공통 부품으로 옮겼다. 모양이 같은지는 계산된 스타일로, 이름이 있는지는 타입과 시험으로 확인했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 4단계는 공통 컴포넌트였다. 가장 PR이 많았던 단계다.

## 왜

`shared/ui`에 button·dialog·menu·popover·reorder가 있었지만, `<button>`을 쓰는 앱 파일 53개 중 공통 버튼을 쓰는 곳은 15개였다. 시트와 모달은 메일·메시지·음악·설정·휴지통이 각자 만들었다.

각자 만든 결과는 동작에서 드러났다. 모달 다섯 개가 Esc·바깥 누르기·포커스·닫기 애니메이션을 따로 구현했는데, Launchpad는 Esc로 닫히지 않았고, 배경화면 이름 바꾸기는 포커스가 입력 칸 밖에 있으면 Esc가 듣지 않았다. 아이콘 버튼의 `label`은 빠뜨려도 되는 값이었고, 그것을 확인하는 시험도 없었다. 공통 버튼 CSS를 고쳐도 앱이 직접 쓴 버튼에는 닿지 않았다.

## 고른 방법과 버린 방법

| 방법                                                   | 좋은 점                              | 걸린 점                                                                    |
| ------------------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------- |
| 계획의 후보 아홉을 모두 부품으로 만들기                | 계획대로 한 번에 끝난다              | 세어 보니 여섯은 앱마다 모양이나 뜻이 달라, 부품이 옵션투성이가 된다       |
| Radix·React Aria 같은 헤드리스 라이브러리              | 접근성과 키보드 동작이 검증되어 있다 | 이미 있는 `shared/ui`의 메뉴·팝오버와 겹치고, 모든 사용처를 다시 짜야 한다 |
| 지금 있는 부품을 넓히고, 되풀이되는 셋만 더하기 (고름) | 옮길 때 모양을 그대로 둘 수 있다     | 남은 후보 여섯은 앱마다 따로 남는다                                        |

"먼저 세기"는 #210에서 했다. `docs/ui.md`에 부품 15개의 props와 쓰는 곳을 적고, `<button>`을 직접 쓰는 곳 295곳을 "공통 버튼으로 옮길 수 있음 / 앱 고유 / Safari 데모"로 분류했다. 옮길 수 있는 것은 93곳이었다.

4단계 첫 PR은 목록 문서였는데, 제목이 "shared/ui 부품 목록과 새로 뽑을 후보 아홉의 지금 수"라 무슨 일인지 드러나지 않아 고쳤다. 문서에서 몇 후보를 "보류. 수가 많아도 모양·뜻이 다르다"로 둔 것도 다시 따졌다. 모양을 통일하면 되지 않는지, 그리고 버튼이 공통 컴포넌트의 기본인데 왜 목록에 없는지 따져 보며 버튼 295곳을 다시 셌다(/memo/ui-inventory). Modal PR은 처음 제목이 "가운데 뜨는 창 다섯의 겉을 Modal 하나로"였다. "겉"이 무엇을 가리키는지 분명하지 않아서 오버레이·포커스·Esc 같은 정확한 용어로 다시 썼다.

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

## 구현

![4단계 PR 열한 개의 날짜와 크기](./images/refactor-step4-components-timeline.svg '부품을 먼저 만들고, 사용처를 옮기는 PR은 마지막 날에 몰았다')

계획에 적은 후보 아홉(`Sheet`, `Modal`, `ListRow`, `SegmentedControl`, `SearchField`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`) 중 지금 코드에서 같은 뜻으로 되풀이되는 것은 셋이었다.

### 이름이 없으면 타입 오류

아이콘 버튼은 `label`이 없으면 컴파일되지 않게 했다. 아이콘만 있는 버튼은 스크린 리더가 읽을 글자가 없기 때문이다.

```ts
// apps/react/src/shared/ui/button/IconButton.tsx
export type IconButtonProps = IconButtonBase &
	(
		| { label: string; children?: ReactNode } // 이름이 있거나
		| { label?: undefined; children: ReactNode } // 보이는 글자가 있거나
	);
```

`label`은 `aria-label`과 `title`이 함께 된다. 아이콘 `<i>`에는 `aria-hidden="true"`를 붙이고, 폼 안에서도 제출 버튼이 되지 않게 `type="button"`이 기본이다. 이 규칙은 `shared/ui/a11y.test.ts`가 부품을 HTML로 그려 확인한다.

```ts
it('아이콘 버튼: label이 이름(aria-label)과 마우스 설명(title)이 되고, 아이콘은 읽지 않는다', () => {
	const out = html(createElement(IconButton, { label: '지우기', icon: 'fa-solid fa-trash-can' }));
	expect(out).toContain('aria-label="지우기"');
	expect(out).toContain('<i class="fa-solid fa-trash-can" aria-hidden="true">');
});
```

### 모양을 바꾸지 않고 옮기기

옮길 때는 모양을 바꾸지 않았다. E2E를 돌리며 공통 클래스를 뗀 계산된 스타일과 붙인 계산된 스타일을 비교했다. 클래스를 뗀 상태가 곧 옮기기 전의 `<button>`이므로, 두 값이 같으면 옮겨도 화면이 같다. 시험이 지나가는 화면(데스크톱·휴대폰, 켜짐·꺼짐, 비활성, 마우스를 올린 상태)마다 기록되어 손으로 화면을 찾아다니지 않아도 됐다.

옮기다 공통 버튼의 여백이 사라진 일도 있었다. CSS 층 순서 `@layer reset, components;`를 선언해 두었는데, 빌드한 `index.html`에서 components 층이 reset 층보다 먼저 나와 초기화 규칙(`* { padding: 0 }`)이 공통 부품을 이겼다. 브라우저는 층 이름이 문서에 처음 나온 순서로 층 순서를 정한다. 선언을 `index.html`의 인라인 `<style>` 맨 앞으로 옮겨 모든 CSS보다 먼저 정했다(#221).

### variant는 Menu 하나만

마지막 #250에서는 macOS·iOS 모양을 고르는 곳을 찾았고, `variant`가 깔끔한 답인 곳은 Menu 하나였다(`className="touch"` → `variant="ios"`).

```ts
// apps/react/src/shared/ui/menu/variant.ts
export type MenuVariant = 'mac' | 'ios';
export const menuVariantClass = (variant: MenuVariant): string | undefined => (variant === 'ios' ? 'touch' : undefined);
```

다른 짝(사진 보기, 메일 목록 등)은 데스크톱과 휴대폰에서 구조 자체가 달라, 한 부품에 모양 이름 하나를 붙이는 것으로는 풀리지 않았다.

## 전후

|                    | 전            | 후                                                                           |
| ------------------ | ------------- | ---------------------------------------------------------------------------- |
| 직접 쓴 `<button>` | 295곳         | 265곳 (세는 방법을 정해 다시 셈: Safari 데모 91, 앱 고유 172, 일부러 남긴 2) |
| 시트·모달          | 앱마다 구현   | `Sheet`·`Modal`                                                              |
| 접근성 이름        | 규칙 없음     | 시험 10개, 아이콘만 있는 `IconButton`은 `label` 없이 타입 오류               |
| '단추'             | 255파일 949곳 | 모두 '버튼'                                                                  |

![직접 쓴 button 265곳의 구성 막대](./images/refactor-step4-components-buttons.svg '남은 버튼은 대부분 일부러 다르게 그린 Safari 데모와 앱 고유의 버튼이다')

## 확인

- 접근성 이름: `shared/ui/a11y.test.ts`가 버튼·대화상자·시트·찾기 칸·날짜 고르기의 이름과 역할을 본다. `IconButton`에 `label`을 빠뜨리면 `tsc`가 먼저 막는다.
- 모양: 아이콘 버튼 45곳과 글자 버튼 30곳 모두 계산된 스타일 비교에서 차이가 없었다. 차이가 난 값은 공통 CSS가 더하는 값이었고, 앱마다 점수가 0인 규칙(`:where()`) 하나로 되돌렸다.
- '단추'를 '버튼'으로(#244): 머지 커밋에서 751줄이 바뀌었다. 글자만 바꾼 PR이라 더한 줄과 지운 줄이 같다.

## 일부러 남긴 것

- 후보 여섯(`ListRow`, `SegmentedControl`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`)은 수가 많아도 모양이나 뜻이 달라 보류했다.
- 남은 시트와 가운데 창은 동작이 달라 그대로 두었다.
- Safari 데모의 버튼 91곳은 페이지마다 일부러 다르게 그린 것이라 옮기지 않았다.

## 배운 것

- **세어 보면 줄어든다.** 계획 단계의 후보 아홉 중 진짜로 되풀이되는 것은 셋이었다. 나머지를 부품으로 만들었다면 옵션만 늘었을 것이다.
- **"그대로"는 숫자로 확인한다.** 클래스를 떼고 붙여 계산된 스타일을 비교하는 방법은 5단계 스타일 작업에서도 그대로 썼다.
- **규칙은 타입으로 거는 것이 가장 싸다.** 이름 없는 아이콘 버튼은 시험보다 먼저 컴파일러가 막는다.

관련 글: [공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-inventory) · [IconButton으로](/memo/icon-button-migrate) · [공통 버튼의 여백이 사라진 이유](/memo/css-layer-order-fix). PR: [#210](https://github.com/hyeoniverse/MacFolio/pull/210), [#245](https://github.com/hyeoniverse/MacFolio/pull/245), [#250](https://github.com/hyeoniverse/MacFolio/pull/250).

이전 단계: [3단계 — 공통 기반 코드](/memo/refactor-step3-foundation) · 다음 단계: [5단계 — 스타일](/memo/refactor-step5-styles)

#MacFolio #리팩터링 #React #디자인시스템
