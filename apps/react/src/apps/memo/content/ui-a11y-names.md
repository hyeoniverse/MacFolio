---
title: 공통 부품의 접근성 이름을 시험으로 — 아이콘만 있는 버튼은 이름 없이 만들 수 없게
date: 2026-10-17
category: 개발기/MacFolio/프론트엔드
summary: 공통 부품이 스크린 리더에 어떤 이름과 역할로 읽히는지 브라우저 없는 시험 10개로 고정하고 규칙을 문서 표로 정리했다. 아이콘만 있는 버튼은 label을 빼면 타입 검사에서 막히게 했다.
---

화면을 보지 못하는 사람은 스크린 리더가 읽어 주는 **이름**과 **역할**로 버튼과 창을 구분한다. 휴지통 아이콘만 그린 버튼은 눈으로는 '지우기'지만, 이름이 없으면 스크린 리더는 그냥 '버튼'이라고만 읽는다.

## 배경

MacFolio는 아이콘 버튼이 많은 사이트다. macOS와 iOS를 흉내 내다 보니 도구 막대, 창 제목 줄, 휴대폰 아래 막대가 대부분 글자 없는 아이콘으로 되어 있다. 이 버튼들이 스크린 리더에서 무엇으로 읽히는지는 E2E 시험이 간접적으로 지켜 왔다. Playwright 시험은 `getByRole('button', { name: '사이드바 가리기' })`처럼 이름으로 버튼을 찾으므로, 이름이 없으면 시험이 버튼을 못 찾고 실패한다.

하지만 그것은 시험이 누르는 버튼에만 해당한다. 리팩터링 계획 4단계에서 공통 부품(`shared/ui`)을 늘리고 앱마다 직접 그린 버튼을 옮기기 시작하면서, 부품 자체가 이름을 제대로 내보내는지 따로 지켜야겠다고 판단했다.

## 지금까지

공통 부품은 이미 이름을 붙이도록 만들어 두었다. 아이콘 버튼은 `label`을 `aria-label`로, 창은 `role="dialog"`·`aria-modal`·`aria-label`을 붙인다. 다만 이것을 확인하는 시험이 없었고, 아이콘 버튼의 `label`은 빠뜨려도 되는 값이었다.

```ts
// 전 (apps/react/src/shared/ui/button/IconButton.tsx)
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	/** 버튼 이름 (스크린 리더). title을 따로 주지 않으면 마우스를 올렸을 때도 이 이름이 보인다 */
	label?: string;
	// ...
}
```

`label?`이 선택이라, 아이콘만 넣고 이름을 빠뜨려도 아무도 알려 주지 않는다.

## 아이콘만 있는 버튼은 이름이 있어야 한다

`IconButton`의 props를 두 경우로 나눴다.

```ts
export type IconButtonProps = IconButtonBase &
	(
		| { label: string; children?: ReactNode } // 이름이 있거나
		| { label?: undefined; children: ReactNode } // 보이는 글자가 있거나
	);
```

`children`을 `ButtonHTMLAttributes`에서 빼고(`Omit<..., 'children'>`) 두 갈래에서 다시 정한 것이 요점이다. 이렇게 해야 "label이 없으면 children이 꼭 있어야 한다"를 타입이 강제한다.

이제 `<IconButton icon="fa-solid fa-xmark" />`처럼 이름도 글자도 없으면 타입 검사에서 막힌다. 사이트 안의 44곳을 세어 보니 이름 없는 곳은 '‹ 블로그'처럼 글자가 함께 있는 한 곳뿐이라 그대로 통과했다.

![label이 있거나 글자가 있으면 통과, 둘 다 없으면 타입 오류](./images/ui-a11y-names-union.svg '이름 없는 아이콘 버튼은 타입 검사에서 막힌다')

## 고른 방법과 버린 방법

부품이 내보내는 이름을 확인할 방법은 여럿 있다.

| 방법                                   | 장점                                  | 단점                                                        |
| -------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| ESLint 접근성 플러그인(jsx-a11y)       | 쓰는 곳마다 바로 경고                 | 공통 부품 안으로 감싼 `aria-label`은 따라가지 못한다        |
| jsdom + Testing Library로 렌더         | 실제 접근성 트리에 가까운 질의        | 새 의존성 두세 개, 시험 환경 설정이 늘어난다                |
| axe-core를 E2E에서 돌린다              | 대비·구조까지 넓게 본다               | 느리고, 지금 고정하려는 "이름"보다 훨씬 넓다                |
| `renderToStaticMarkup`으로 HTML 문자열 | 의존성 0개(React에 들어 있다), 빠르다 | 동작(누르기·초점)은 못 본다. body에 그리는 부품은 안 나온다 |

React 앱의 단위 시험은 지금까지 Node 환경에서 순수 함수만 시험했다. jsdom을 들이면 시험 환경이 하나 더 생긴다. 이번에 지키려는 것은 "그린 HTML에 이 속성이 있다"뿐이라 문자열 비교로 충분하다고 봤다. 동작은 이미 E2E가 본다.

## 그려 보고 확인하기

브라우저 없이 부품을 HTML 문자열로 그리는 `renderToStaticMarkup`으로 시험 10개를 만들었다. 그린 HTML에 이름·역할·숨김이 들어 있는지 본다.

| 부품            | 확인하는 것                                                             |
| --------------- | ----------------------------------------------------------------------- |
| 아이콘 버튼     | `aria-label`·`title`, 아이콘 `aria-hidden`, 기본 `type="button"`        |
| 사이드바 여닫기 | '사이드바 가리기'↔'사이드바 보기', `aria-expanded`                      |
| 검색 칸         | `aria-label`, placeholder 기본값                                        |
| 날짜 고르기     | '게시일 고르기' / '게시일 2026. 10. 17., 바꾸기', `aria-haspopup`       |
| 창·경고창·시트  | `role`, `aria-modal`, `aria-label` (덮개 없는 시트는 `aria-modal` 없음) |

시험은 이런 모양이다. 아이콘 버튼 하나에서 이름, 마우스 설명, 아이콘 숨김, 기본 `type`을 함께 본다.

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

타입 규칙도 시험 안에 남겼다. `@ts-expect-error`는 다음 줄에 타입 오류가 **없으면** 오히려 오류를 낸다. 그래서 누군가 `label`을 다시 선택값으로 풀면 이 줄에서 타입 검사가 깨진다.

```ts
// @ts-expect-error 아이콘만 있고 이름이 없다
html(createElement(IconButton, { icon: 'fa-solid fa-xmark' }));
```

누르기·Esc·초점 이동 같은 동작은 원래대로 브라우저 E2E가 맡는다. 메뉴는 body에 그리는 부품(포털)이라 이 시험에서 빼고 E2E로 본다.

![타입 검사, 정적 HTML 단위 시험, E2E가 각각 무엇을 잡는지 나눈 그림](./images/ui-a11y-names-layers.svg '이름을 지키는 세 겹')

## 규칙을 표로

`docs/ui.md`에 부품마다 무엇이 이름이 되고 쓰는 쪽이 무엇을 줘야 하는지 표로 적었다. 함께 정한 두 가지:

- 장식 아이콘은 `aria-hidden="true"`, 그린 SVG는 `focusable="false"`도
- 이름은 할 일을 말한다('지우기'). 켜짐·펼침 같은 상태는 이름에 넣지 않고 `aria-pressed`·`aria-expanded`로 알린다

두 번째 규칙의 예가 사이드바 여닫기다. 이름은 "사이드바 가리기"와 "사이드바 보기"로 바뀌지만, 열려 있는지는 `aria-expanded`가 따로 알린다. 날짜 고르기는 고른 날짜를 이름에 함께 넣는다("게시일 2026. 10. 17., 바꾸기"). 버튼만 듣고도 지금 값과 할 일을 함께 알 수 있게 하려는 것이다.

## 확인

- `apps/react/src/shared/ui/a11y.test.ts`: 처음 10개로 시작했고 지금은 11개다(버튼 5, 입력 2, 창 3에, 나중에 `variant="circle"` 시험이 하나 더해졌다). 모두 Node에서 돌고 브라우저를 띄우지 않는다.
- 타입 검사: 이 PR 시점에 사이트 안의 `IconButton` 44곳이 그대로 통과했다. 이름 없이 쓴 곳은 글자가 함께 있는 '‹ 블로그' 한 곳뿐이었다.
- 바뀐 파일은 4개다(시험 114줄, `IconButton.tsx`, `docs/ui.md`, 이 글).

## 남은 것·배운 것

바로 다음 일은 앱마다 직접 그린 아이콘 버튼을 `IconButton`으로 옮기는 작업(/memo/icon-button-migrate)이었다. 옮긴 곳은 모두 이 타입 규칙을 거쳤다. 지금 사이트 안의 `<IconButton` 사용처는 97곳이다.

- 접근성 규칙은 문서로만 두면 지켜지지 않는다. 가능한 것은 타입으로, 그다음은 빠른 시험으로 내린다.
- 시험 도구를 고를 때는 지키려는 것의 범위를 먼저 정한다. 이번에는 "HTML에 이 속성이 있다"였고, 그래서 가장 가벼운 도구로 충분했다.
- 아직 대비(색 대조)나 키보드 초점 순서를 자동으로 보는 시험은 없다. 이것은 E2E에서 axe-core를 쓰는 쪽으로 따로 볼 일이다.

## 관련 글

- 앱마다 직접 그린 아이콘 버튼을 IconButton으로 옮긴 일: /memo/icon-button-migrate
- 공통 부품 목록을 만든 일: /memo/ui-inventory
- 리팩터링 4단계 정리: /memo/refactor-step4-components
- PR: https://github.com/hyeoniverse/MacFolio/pull/243

#MacFolio #접근성 #React #테스트
