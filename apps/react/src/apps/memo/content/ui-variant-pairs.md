---
title: 데스크톱과 휴대폰의 메뉴 모양을 variant로 고르기
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 같은 부품이 macOS와 iOS 모양을 고르는 곳을 찾았다. variant가 깔끔한 답인 곳은 Menu 하나였고, className="touch"를 variant="ios"로 바꿨다. 계산된 스타일이 그대로인 것을 확인했다.
---

리팩터링 계획 4단계의 남은 항목은 "데스크톱·휴대폰 짝: 같은 컴포넌트가 `variant`로 macOS·iOS 모양을 고르게 하기"다. 버튼은 이미 `IconButton`이 `tool`·`float`·`circle`로 모양을 고른다. 이번에는 다른 부품을 본다.

## 어떻게 찾았나

세 가지를 찾았다. 쓰는 쪽이 `className`으로 휴대폰 모양을 덧씌우는 곳, `FinderMobile`처럼 휴대폰용 컴포넌트를 따로 만든 곳, `useIsMobile`로 같은 컨트롤의 마크업을 바꾸는 곳이다.

## Menu

`Menu`는 휴대폰에서 iOS 메뉴처럼 크고 둥글게 보여야 한다. 지금까지는 쓰는 쪽이 `className="touch"`를 붙였다. 이 이름은 약속일 뿐이라 잘못 적어도 타입이 막지 못한다. 그래서 `variant?: 'mac' | 'ios'`를 더했다. 기본값은 `mac`이고, `ios`는 기존 CSS 클래스 `touch`를 그대로 붙인다. CSS는 고치지 않았다.

아홉 파일이 `variant="ios"`로 바뀌었다. 메모 폴더 줄은 편집 중에만 iOS 모양이라 `variant={props.editing ? 'ios' : 'mac'}`로 적는다.

기본값을 `useIsMobile`에서 자동으로 고르게 하지는 않았다. 휴대폰 화면 안에서도 데스크톱 모양 메뉴를 쓰는 곳이 있어서, 자동으로 고르면 오히려 예외가 생긴다.

## 따로 둔 짝

- `Sheet`와 `Modal`: 둘 다 다이얼로그지만 나타나는 방향, 덮개, 닫는 몸짓이 다르다. 한 부품으로 묶으면 분기만 늘어난다.
- `SearchField`: 데스크톱과 휴대폰이 같은 모양이다.
- `FinderMobile`·`PhotosMobile`·`SafariMobile`: 부품이 아니라 화면 전체가 다르다. 안쪽 부품은 이미 `variant`를 쓴다.
- `Button`과 목록 줄: 휴대폰 전용 모양을 고르는 곳이 없다.

## 확인

데스크톱과 iPhone, 밝은 화면과 어두운 화면에서 메뉴를 열고 바꾸기 전과 후의 계산된 스타일을 비교했다. 차이는 없었다.

결과적으로 바꾼 부품은 `Menu` 하나다. 찾아 보니 나머지는 이미 맞는 모양이었다.

#MacFolio #React #리팩터링
