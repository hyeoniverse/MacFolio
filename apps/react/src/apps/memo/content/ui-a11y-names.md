---
title: 공통 부품의 접근성 이름을 시험으로 — 아이콘만 있는 단추는 이름 없이 만들 수 없게
date: 2026-10-17
category: 개발기/MacFolio/프론트엔드
summary: 공통 부품(단추, 검색 칸, 날짜 고르기, 창, 시트)이 스크린 리더에 어떤 이름과 역할로 읽히는지 시험 10개로 고정하고, 규칙을 문서 표로 정리했다. 아이콘만 있는 단추는 이름(label)을 빼면 타입 검사에서 막히게 했다.
---

화면을 보지 못하는 사람은 스크린 리더가 읽어 주는 **이름**과 **역할**로 단추와 창을 구분한다. 휴지통 아이콘만 그린 단추는 눈으로는 '지우기'지만, 이름이 없으면 스크린 리더는 그냥 '단추'라고만 읽는다.

## 지금까지

공통 부품(`shared/ui`)은 이미 이름을 붙이도록 만들어 두었다. 아이콘 단추는 `label`을 `aria-label`로, 창은 `role="dialog"`·`aria-modal`·`aria-label`을 붙인다. 다만 이것을 확인하는 시험이 없었고, 아이콘 단추의 `label`은 빠뜨려도 되는 값이었다.

## 아이콘만 있는 단추는 이름이 있어야 한다

`IconButton`의 props를 두 경우로 나눴다.

```ts
export type IconButtonProps = IconButtonBase &
	(
		| { label: string; children?: ReactNode } // 이름이 있거나
		| { label?: undefined; children: ReactNode } // 보이는 글자가 있거나
	);
```

이제 `<IconButton icon="fa-solid fa-xmark" />`처럼 이름도 글자도 없으면 타입 검사에서 막힌다. 사이트 안의 44곳을 세어 보니 이름 없는 곳은 '‹ 블로그'처럼 글자가 함께 있는 한 곳뿐이라 그대로 통과했다.

## 그려 보고 확인하기

브라우저 없이 부품을 HTML 문자열로 그리는 `renderToStaticMarkup`으로 시험 10개를 만들었다. 그린 HTML에 이름·역할·숨김이 들어 있는지 본다.

| 부품            | 확인하는 것                                                             |
| --------------- | ----------------------------------------------------------------------- |
| 아이콘 단추     | `aria-label`·`title`, 아이콘 `aria-hidden`, 기본 `type="button"`        |
| 사이드바 여닫기 | '사이드바 가리기'↔'사이드바 보기', `aria-expanded`                      |
| 검색 칸         | `aria-label`, placeholder 기본값                                        |
| 날짜 고르기     | '게시일 고르기' / '게시일 2026. 10. 17., 바꾸기', `aria-haspopup`       |
| 창·경고창·시트  | `role`, `aria-modal`, `aria-label` (덮개 없는 시트는 `aria-modal` 없음) |

누르기·Esc·초점 이동 같은 동작은 원래대로 브라우저 E2E가 맡는다. 메뉴는 body에 그리는 부품이라 이 시험에서 빼고 E2E로 본다.

## 규칙을 표로

`docs/ui.md`에 부품마다 무엇이 이름이 되고 쓰는 쪽이 무엇을 줘야 하는지 표로 적었다. 함께 정한 두 가지:

- 장식 아이콘은 `aria-hidden="true"`, 그린 SVG는 `focusable="false"`도
- 이름은 할 일을 말한다('지우기'). 켜짐·펼침 같은 상태는 이름에 넣지 않고 `aria-pressed`·`aria-expanded`로 알린다

#MacFolio #접근성 #React #테스트
