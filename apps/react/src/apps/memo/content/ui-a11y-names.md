---
title: IconButton props 유니언 타입으로 아이콘 버튼의 접근 가능한 이름 강제하기
date: 2026-10-17
category: 개발 기록/MacFolio/화면·스타일
series: 공통 UI 컴포넌트
seriesOrder: 5
summary: 공통 부품이 스크린 리더에 어떤 이름과 역할로 읽히는지 브라우저 없이 실행하는 시험 10개로 고정하고 규칙을 문서 표로 정리했다. 아이콘만 있는 버튼은 label을 생략하면 타입 검사에서 오류가 나도록 했다.
---

## 배경

### 스크린 리더와 접근성 트리

**스크린 리더**는 화면의 내용을 음성이나 점자로 전달하는 프로그램이다. macOS의 VoiceOver, Windows의 NVDA가 대표적이다. 화면을 보지 못하는 사용자는 Tab 키나 손가락 쓸기로 요소를 하나씩 이동하고, 스크린 리더는 이동한 요소를 "메모 삭제, 버튼"처럼 읽는다.

스크린 리더는 화면의 픽셀을 읽지 않는다. 브라우저는 DOM을 바탕으로 **접근성 트리**(accessibility tree)[^1]를 따로 만들고, 스크린 리더는 이 트리에 담긴 세 가지 정보만 사용한다.

| 정보 | 뜻                               | 예                                          |
| ---- | -------------------------------- | ------------------------------------------- |
| 역할 | 요소의 종류 (role)               | `button`, `dialog`, `textbox`               |
| 이름 | 요소를 다른 요소와 구분하는 글자 | "메모 삭제", "사이드바 가리기"              |
| 상태 | 지금 값이나 상태                 | 눌림(`aria-pressed`), 펼침(`aria-expanded`) |

여기서 **접근 가능한 이름**(accessible name)이 버튼을 구분하는 유일한 수단이다. 휴지통 아이콘만 표시한 버튼은 시각적으로는 '삭제'를 뜻하지만, 이름이 없으면 스크린 리더는 '버튼'이라고만 읽는다. 도구 막대에 이름 없는 버튼이 다섯 개 있으면 사용자는 "버튼, 버튼, 버튼…"을 듣고 어느 것이 삭제인지 알 수 없다.

![이름 없는 휴지통 버튼은 '버튼'으로, aria-label이 있는 버튼은 '메모 삭제, 버튼'으로 읽히는 과정](./images/ui-a11y-names-tree.svg '같은 아이콘 버튼이 HTML의 aria-label 유무에 따라 접근성 트리에서 다른 이름을 갖는다')

### 이름이 정해지는 순서

브라우저는 W3C의 이름 계산 규칙(Accessible Name and Description Computation)에 따라 이름을 정한다. 버튼에 해당하는 단계만 줄이면 다음 순서이고, 위에서부터 처음 찾은 값을 사용한다.

![aria-labelledby, aria-label, 요소 고유의 이름, 안쪽 글자, title 순서로 이름을 찾는 단계와 IconButton 예시](./images/ui-a11y-names-accname.svg 'label을 넘긴 IconButton은 2단계(aria-label)에서, 글자가 있는 IconButton은 4단계(안쪽 글자)에서 이름을 얻는다')

아이콘 글꼴(`<i class="fa-solid fa-trash-can">`)은 글자가 아니라 CSS로 그린 그림이고, MacFolio는 아이콘에 `aria-hidden="true"`를 지정해 접근성 트리에서 제외한다. 그래서 아이콘만 있는 버튼은 4단계(안쪽 글자)에서 아무것도 얻지 못한다. 이름을 주려면 `aria-label`을 지정해야 한다.

### MacFolio에서 이름이 중요한 이유

MacFolio는 아이콘 버튼이 많은 사이트다. macOS와 iOS의 화면을 재현하므로 도구 막대, 창 제목 표시줄, 휴대폰 하단 막대가 대부분 글자 없는 아이콘 버튼으로 구성된다. 이 버튼들이 스크린 리더에서 어떤 이름으로 읽히는지는 E2E 시험이 간접적으로 검사해 왔다. Playwright 시험은 [`getByRole('button', { name: '사이드바 가리기' })`](https://playwright.dev/docs/locators#locate-by-role)처럼 접근성 트리의 역할과 이름으로 버튼을 찾으므로, 이름이 없으면 시험이 버튼을 찾지 못하고 실패한다.

하지만 이 검사는 시험이 클릭하는 버튼에만 적용된다. [계산된 스타일 비교로 검증한 공통 버튼 컴포넌트 교체](/memo/refactor-retrospective#4단계-공통-컴포넌트)에서 공통 부품(`shared/ui`)을 늘리고 앱마다 직접 작성한 버튼을 옮기기 시작하면서, 부품 자체가 이름을 올바르게 출력하는지 별도로 검사하기로 했다.

## 변경 전 상태

공통 부품은 이미 이름을 지정하도록 구현되어 있었다. 아이콘 버튼은 `label`을 `aria-label`로 출력하고, 창은 `role="dialog"`·`aria-modal`·`aria-label`을 지정한다. 다만 이것을 확인하는 시험이 없었고, 아이콘 버튼의 `label`은 생략할 수 있는 선택 속성이었다.

```ts
// 전 (apps/react/src/shared/ui/button/IconButton.tsx)
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** 버튼 이름 (스크린 리더). title을 따로 주지 않으면 마우스를 올렸을 때도 이 이름이 보인다 */
	label?: string;
	// ...
}
```

> [!WARNING]
> `label?`이 선택 속성이라, 아이콘만 지정하고 이름을 생략해도 타입 검사·lint·시험 어디에서도 오류가 나지 않는다.

예를 들어 다음 코드도 오류 없이 통과했다.

```tsx
<IconButton icon="fa-solid fa-xmark" onClick={close} /> // 이름 없음. 스크린 리더는 "버튼"
```

## 아이콘만 있는 버튼은 이름이 있어야 한다

TypeScript의 **유니언 타입**(`A | B`)은 "A 모양이거나 B 모양인 값"을 뜻한다. 객체 유니언에 값을 넘기면 타입 검사기는 두 모양 가운데 하나에 맞는지 검사하고, 어느 쪽에도 맞지 않으면 오류를 낸다. 이것을 이용해 `IconButton`의 props를 두 경우로 나눴다.

```ts
export type IconButtonProps = IconButtonBase &
	(
		| { label: string; children?: ReactNode } // 이름이 있거나
		| { label?: undefined; children: ReactNode } // 보이는 글자가 있거나
	);
```

> [!IMPORTANT]
> 핵심은 `children`을 `ButtonHTMLAttributes`에서 제외하고(`Omit<..., 'children'>`) 두 분기에서 다시 정의한 부분이다. 이렇게 해야 "label이 없으면 children이 반드시 있어야 한다"는 조건을 타입이 강제한다.

| 사용 예                                      | 맞는 분기 | 결과      |
| -------------------------------------------- | --------- | --------- |
| `<IconButton label="메모 삭제" icon="…" />`  | 첫 번째   | 통과      |
| `<IconButton>‹ 블로그</IconButton>`          | 두 번째   | 통과      |
| `<IconButton label="서식">가가</IconButton>` | 첫 번째   | 통과      |
| `<IconButton icon="fa-solid fa-xmark" />`    | 없음      | 타입 오류 |

이제 이름도 글자도 없는 아이콘 버튼은 타입 검사에서 오류가 난다. 당시 사이트 안의 사용처 44곳을 집계하니 `label`이 없는 곳은 '‹ 블로그'처럼 글자가 함께 있는 한 곳뿐이라 수정 없이 통과했다.

![label이 있거나 글자가 있으면 통과, 둘 다 없으면 타입 오류](./images/ui-a11y-names-union.svg '이름 없는 아이콘 버튼은 타입 검사에서 막힌다')

## 검토한 방법

부품이 출력하는 이름을 확인하는 방법은 여러 가지다.

| 방법                                                                                                             | 장점                             | 단점                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| [ESLint 접근성 플러그인(jsx-a11y)](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)                         | 사용하는 위치마다 바로 경고      | 공통 부품 안에서 지정하는 `aria-label`은 추적하지 못한다                                |
| jsdom + Testing Library로 렌더링                                                                                 | 실제 접근성 트리에 가까운 질의   | 새 의존성 두세 개, 시험 환경 설정이 늘어난다                                            |
| [axe-core](https://github.com/dequelabs/axe-core)를 E2E에서 실행                                                 | 색 대비·구조까지 넓게 검사       | 느리고, 지금 고정하려는 "이름"보다 범위가 훨씬 넓다                                     |
| [`renderToStaticMarkup`](https://react.dev/reference/react-dom/server/renderToStaticMarkup)으로 HTML 문자열 생성 | 의존성 0개(React에 포함), 빠르다 | 동작(클릭·포커스)은 검사하지 못한다. body에 렌더링하는 부품(포털[^2])은 출력되지 않는다 |

jsdom은 Node에서 브라우저의 DOM API를 흉내 내는 라이브러리이고, Testing Library는 그 DOM에서 `getByRole`처럼 역할과 이름으로 요소를 찾는 도구다. React 앱의 단위 시험은 그때까지 Node 환경에서 순수 함수만 시험했다. jsdom을 도입하면 시험 환경이 하나 더 생긴다. 이번에 검사하려는 것은 "렌더링한 HTML에 이 속성이 있다"뿐이라 ==문자열 비교로 충분==하다고 판단했다. 동작은 이미 E2E가 검사한다.

## 렌더링 결과로 확인하기

`renderToStaticMarkup`은 React 컴포넌트를 실행해 HTML 문자열을 반환하는 함수다. 서버 렌더링용이라 브라우저가 필요 없다. 예를 들어 `IconButton`에 `label: '지우기'`를 넘기면 다음 문자열을 얻는다.

```html
<button type="button" class="ui-icon-button tool" aria-label="지우기" title="지우기">
	<i class="fa-solid fa-trash-can" aria-hidden="true"></i>
</button>
```

이 함수로 시험 10개를 작성했다. 렌더링한 HTML에 이름·역할·`aria-hidden`이 들어 있는지 확인한다.

| 부품            | 확인하는 것                                                             |
| --------------- | ----------------------------------------------------------------------- |
| 아이콘 버튼     | `aria-label`·`title`, 아이콘 `aria-hidden`, 기본 `type="button"`        |
| 사이드바 여닫기 | '사이드바 가리기'↔'사이드바 보기', `aria-expanded`                      |
| 검색 칸         | `aria-label`, placeholder 기본값                                        |
| 날짜 고르기     | '게시일 고르기' / '게시일 2026. 10. 17., 바꾸기', `aria-haspopup`       |
| 창·경고창·시트  | `role`, `aria-modal`, `aria-label` (덮개 없는 시트는 `aria-modal` 없음) |

시험 코드는 다음과 같다. 아이콘 버튼 하나에서 이름, 툴팁(`title`), 아이콘의 `aria-hidden`, 기본 `type`을 함께 확인한다.

```ts
it('아이콘 버튼: label이 이름(aria-label)과 마우스 설명(title)이 되고, 아이콘은 읽지 않는다', () => {
	const out = html(createElement(IconButton, { label: '지우기', icon: 'fa-solid fa-trash-can' }));
	expect(out).toContain('aria-label="지우기"');
	expect(out).toContain('title="지우기"');
	expect(out).toContain('<i class="fa-solid fa-trash-can" aria-hidden="true">');
	// 폼 안에서도 제출 버튼이 되지 않게 기본은 button
	expect(out).toContain('type="button"');
});
```

마지막 줄의 `type="button"`은 HTML 규칙 때문에 확인한다. `<button>`의 `type` 기본값은 `submit`이라, `<form>` 안에 둔 아이콘 버튼은 `type`을 지정하지 않으면 누를 때 폼을 제출한다.

> [!TIP] 타입 규칙을 시험에 기록하기
> 타입 규칙도 시험 안에 기록했다. [`@ts-expect-error`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#-ts-expect-error-comments)는 다음 줄에 타입 오류가 **없으면** 오히려 오류를 낸다. 그래서 `label`을 다시 선택 속성으로 바꾸면 이 줄에서 타입 검사가 실패한다.

```ts
// @ts-expect-error 아이콘만 있고 이름이 없다
html(createElement(IconButton, { icon: 'fa-solid fa-xmark' }));
```

클릭·Esc·포커스 이동 같은 동작은 기존대로 브라우저 E2E가 검사한다. 메뉴는 body에 렌더링하는 부품(포털)이라 이 시험에서 제외하고 E2E로 검사한다.

![타입 검사, 정적 HTML 단위 시험, E2E가 각각 무엇을 잡는지 나눈 그림](./images/ui-a11y-names-layers.svg '이름을 지키는 세 겹')

## 규칙을 문서 표로 정리

[`docs/ui.md`](https://github.com/hyeoniverse/MacFolio/blob/main/docs/ui.md)에 부품마다 어떤 값이 이름이 되고 사용하는 쪽이 어떤 속성을 지정해야 하는지 표로 정리했다. 함께 정한 규칙은 두 가지다.

- 장식 아이콘은 `aria-hidden="true"`, 인라인 SVG는 `focusable="false"`도 지정한다
- 이름은 동작을 나타낸다('삭제'). 켜짐·펼침 같은 상태는 이름에 넣지 않고 [`aria-pressed`](https://www.w3.org/TR/wai-aria-1.2/#aria-pressed)·[`aria-expanded`](https://www.w3.org/TR/wai-aria-1.2/#aria-expanded)로 전달한다

두 번째 규칙이 필요한 이유는 스크린 리더가 상태 속성을 이름과 별도로 읽기 때문이다. 이름에 "열림"을 넣고 `aria-expanded="true"`도 지정하면 같은 정보가 이름과 상태로 두 번 전달되고, 상태가 바뀌어도 이름을 함께 고치지 않으면 둘이 서로 다른 값을 전달한다.

두 번째 규칙의 예가 사이드바 여닫기다. 이름은 "사이드바 가리기"와 "사이드바 보기"로 바뀌지만, 열림 여부는 `aria-expanded`가 별도로 전달한다. 날짜 선택 버튼은 선택한 날짜를 이름에 함께 넣는다("게시일 2026. 10. 17., 바꾸기"). ==버튼 이름만으로 현재 값과 동작을 함께 알 수 있도록== 하기 위해서다.

| 부품            | 상태   | 접근 가능한 이름             | 상태 속성               |
| --------------- | ------ | ---------------------------- | ----------------------- |
| 사이드바 여닫기 | 열림   | 사이드바 가리기              | `aria-expanded="true"`  |
| 사이드바 여닫기 | 닫힘   | 사이드바 보기                | `aria-expanded="false"` |
| 날짜 선택       | 미선택 | 게시일 고르기                | `aria-haspopup`         |
| 날짜 선택       | 선택   | 게시일 2026. 10. 17., 바꾸기 | `aria-haspopup`         |

## 확인

- `apps/react/src/shared/ui/a11y.test.ts`: 처음 10개(버튼 5, 입력 2, 창 3)로 시작했다. 이후 `variant="circle"`, 스위치, 탭 목록, 목록 행 시험이 추가되어 2026년 10월 23일 기준 14개다. 모두 Node에서 실행되고 브라우저를 실행하지 않는다.
- 타입 검사: 이 PR 시점에 사이트 안의 `IconButton` 44곳이 수정 없이 통과했다. `label` 없이 사용한 곳은 글자가 함께 있는 '‹ 블로그' 한 곳뿐이었다.
- 변경 파일은 4개다(시험 114줄, `IconButton.tsx`, `docs/ui.md`, 이 글).

## 남은 것·배운 것

바로 다음 작업은 앱마다 직접 작성한 아이콘 버튼을 `IconButton`으로 옮기는 작업([계산된 스타일 비교로 화면 변화 없이 아이콘 버튼을 IconButton으로 옮기기](/memo/icon-button-migrate))이었다. 옮긴 곳은 모두 이 타입 규칙을 거쳤다. 2026년 10월 23일 기준 `apps/react/src`의 `.tsx` 파일에서 `<IconButton`을 포함한 줄은 99개다.

- ==접근성 규칙은 문서로만 기록하면 지켜지지 않는다.== 가능한 규칙은 타입으로, 그다음은 빠른 시험으로 강제한다.
- 시험 도구를 선택할 때는 검사 범위를 먼저 정한다. 이번 범위는 "HTML에 이 속성이 있다"였고, 그래서 가장 가벼운 도구로 충분했다.
- 색 대비나 키보드 포커스 순서를 자동으로 검사하는 시험은 아직 없다. E2E에서 axe-core를 실행하는 방식으로 별도로 검토할 작업이다.

## 관련 글

- 앱마다 직접 작성한 아이콘 버튼을 IconButton으로 옮긴 작업: [계산된 스타일 비교로 화면 변화 없이 아이콘 버튼을 IconButton으로 옮기기](/memo/icon-button-migrate)
- 공통 부품 목록을 작성한 작업: [shared/ui 사용처 집계로 추출할 공통 컴포넌트 후보 줄이기](/memo/ui-modal#공통-부품-집계)
- 리팩터링 4단계 정리: [계산된 스타일 비교로 검증한 공통 버튼 컴포넌트 교체](/memo/refactor-retrospective#4단계-공통-컴포넌트)
- PR: [#243](https://github.com/hyeoniverse/MacFolio/pull/243)

[^1]: 접근성 트리(accessibility tree): 브라우저가 DOM에서 만들어 스크린 리더 같은 보조 기술에 전달하는 구조. 요소마다 역할·이름·상태가 들어 있다. [MDN: Accessibility tree](https://developer.mozilla.org/en-US/docs/Glossary/Accessibility_tree)

[^2]: 포털(portal): React 컴포넌트를 부모 DOM 밖(예: `document.body`)에 렌더링하는 기능. [React 문서: createPortal](https://react.dev/reference/react-dom/createPortal)

<details>
<summary>참고 문헌</summary>

- [W3C: Accessible Name and Description Computation 1.2](https://www.w3.org/TR/accname-1.2/)
- [W3C: WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/)
- [W3C WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [MDN: Accessibility tree](https://developer.mozilla.org/en-US/docs/Glossary/Accessibility_tree)
- [MDN: aria-label](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label)
- [MDN: `<button>`의 type 속성](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#type)
- [TypeScript Handbook: Union Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types)
- [React: renderToStaticMarkup](https://react.dev/reference/react-dom/server/renderToStaticMarkup)

</details>

#MacFolio #접근성 #React #테스트
