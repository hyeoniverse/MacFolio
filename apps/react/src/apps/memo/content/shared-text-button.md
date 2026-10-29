---
title: 계산된 스타일과 스크린샷 비교로 검증한 공통 Button 추출
date: 2026-10-01
category: 개발 기록/MacFolio/디자인 시스템
series: 공통 UI 컴포넌트
seriesOrder: 3
summary: 여섯 곳에 각각 정의된 취소·보내기·삭제 버튼을 공통 Button 하나로 통합하고, 계산된 스타일과 스크린샷 58장으로 모양이 유지되는 것을 확인했다. 다른 후보 다섯 개는 사용처가 적거나 의미가 달라 만들지 않았다.
---

공통 컴포넌트로 전환하는 마지막 단계다([#61](https://github.com/hyeoniverse/MacFolio/pull/61)). 처음 계획에는 텍스트 버튼(`Button`) 외에도 목록 행(`ListRow`), 분할 버튼(`SegmentedControl`), 검색 칸(`SearchField`), 토글 스위치(`Switch`), 빈 상태 안내(`EmptyState`)가 있었다. 결론적으로 `Button`만 만들었다.

## 텍스트 버튼: 여섯 곳, 같은 모양

'취소'와 '보내기'처럼 텍스트가 있는 버튼이 여섯 곳에서 각각 정의되어 있었다.

| 위치               | 클래스                            | 모양        | 강조 버튼   | 삭제 버튼     |
| ------------------ | --------------------------------- | ----------- | ----------- | ------------- |
| 메일 쓰기          | `.mail-button`                    | 둥근 사각형 | `primary`   |               |
| 메시지 삭제 확인   | `.messages-delete-actions button` | 둥근 사각형 |             | `destructive` |
| 메모 댓글          | `.memo-comment-button`            | 알약        | `primary`   | `danger`      |
| 설정의 관리자 계정 | `.admin-account-button`           | 둥근 사각형 | `primary`   |               |
| 로그인 결과        | `.login-flow-button`              | 둥근 사각형 | (항상 강조) |               |
| 메모 이미지 창     | `.memo-image-submit`              | 알약        | (항상 강조) |               |

모양은 거의 같았다.

| 속성      | 공통 값          |
| --------- | ---------------- |
| 여백      | `5px 14px` 안팎  |
| 모서리    | 8px 또는 알약    |
| 강조 버튼 | 앱의 강조색 배경 |
| 삭제 버튼 | 빨간 배경        |
| 비활성    | 흐리게 표시      |

다른 것은 색과 이름뿐이었다. 같은 의미를 `danger`와 `destructive` 두 이름으로 쓰고 있기도 했다.

![여러 앱의 글자 버튼](./images/shared-text-button.jpg '모두 Button 하나다. 색과 모양은 앱이 정한 변수를 따른다')

```tsx
<Button onClick={onCancel}>취소</Button>
<Button tone="primary" type="submit" disabled={sending}>보내기</Button>
<Button tone="danger" type="submit">삭제</Button>
```

3단계의 `IconButton`과 같은 방식이다. 버튼 CSS는 `components` 레이어에 두고, 색과 모양은 CSS 변수로 받는다.

```css
/* 메모: 알약 모양, 노란 강조 */
[data-app='memo'] {
	--ui-button-radius: 999px;
	--ui-button-bg: var(--memo-search-bg);
	--ui-accent: var(--memo-accent);
	--ui-on-accent: #2b2100;
}

/* 메시지 삭제 확인: 여백만 조금 좁게 */
.messages-delete-actions {
	--ui-button-padding: 4px 14px;
}
```

메일 버튼의 그림자나 관리자 계정 버튼의 테두리처럼 그 앱에만 있는 스타일은 앱의 CSS에 추가했다. 앱의 CSS는 레이어 밖이라 명시도와 관계없이 우선한다.

### body에 렌더링한 팝오버에는 변수가 상속되지 않는다

메모의 서식·이미지 창은 2단계에서 만든 팝오버라 `body`에 렌더링한다([포털](https://react.dev/reference/react-dom/createPortal)). 그래서 메모 창(`[data-app='memo']`)에 정의한 변수가 상속되지 않는다. 변수 없이 렌더링하면 '넣기' 버튼이 기본 강조색인 파란색이 된다.

기존 CSS는 노란색(`#edbb4d`)을 직접 지정해 이 문제를 해결하고 있었다. 같은 방식으로, 이미지 창의 최상위 요소에 변수를 다시 정의했다.

```css
.memo-format-panel {
	--ui-button-radius: 999px;
	--ui-accent: #edbb4d;
	--ui-on-accent: #2b2100;
}
```

### 누락된 기본값 규칙

이미지 창 안에는 다음 규칙도 있었다.

```css
.memo-format-panel button {
	border: none;
	background: none;
	color: inherit;
}
```

팝오버 안의 버튼들이 공통으로 쓰는 기본값이다. 1단계에서 `reset` 레이어로 옮긴 `.memo button`과 같은 종류인데, 그 시각에는 누락했다. 레이어 밖에 그대로 두면 `background: none`이 `components` 레이어의 강조색보다 우선한다. 이 규칙도 `reset` 레이어로 옮겼다.

### 확인

3단계와 같은 두 가지 방법으로 확인했다.

- **계산된 스타일**: 메일 쓰기, 메시지 삭제 확인, 댓글 작성·삭제, 관리자 계정, 이미지 창을 열고 버튼마다 `getComputedStyle` 결과를 기록해 `main`과 비교했다. 호버 상태도 기록했다. 차이는 `display`가 `block`에서 `flex`로 바뀐 것(버튼이 `inline-flex`가 되었다)과 0.016px의 소수점 차이 하나뿐이었다. 폭, 높이, 색, 여백은 모두 같았다
- **스크린샷**: 58장 모두 0.001% 이하

## 만들지 않은 것

계획에 있던 나머지 다섯 가지도 현재 코드를 조사했다. 공통 컴포넌트는 사용처가 여러 곳이고 모양과 동작이 같을 때 효과가 있다. 사용처가 한두 곳뿐이거나 서로 다르면, 오히려 그 차이를 모두 수용하는 옵션이 생긴다.

| 후보               | 사용처                                    | 결정                                                                                                          |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Switch`           | 설정의 클릭 소리 하나                     | 만들지 않음. 사용처가 하나다                                                                                  |
| `EmptyState`       | 메모·메일·메시지의 "메모 없음" 같은 한 줄 | 만들지 않음. 텍스트 한 줄(`<p>`, `<li>`)이라 컴포넌트로 감쌀 구조가 없다                                      |
| `SearchField`      | 메모, 메시지                              | 만들지 않음. 메모는 검색 조건 칩, 조건 메뉴, 확장 애니메이션이 있고, 메시지는 입력 칸 하나다                  |
| `SegmentedControl` | 메모 보기 방식, 이미지 창의 가져올 위치   | 만들지 않음. 하나는 토글 상태(`aria-pressed`) 버튼 두 개, 하나는 탭(`role="tab"`)과 탭 패널이라 의미가 다르다 |
| `ListRow`          | 메모 글, 메일, 메시지 대화, 음악 곡       | 만들지 않음. 행마다 들어가는 내용(날짜·폴더, 보낸 사람, 곡 번호·앨범)과 배치가 모두 다르다                    |

`SegmentedControl`은 외형(회색 배경 위의 흰 알약)이 같아서 검토가 필요했다. 하지만 스크린 리더 기준으로 하나는 "토글 버튼 두 개"([`aria-pressed`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed))이고, 하나는 "탭 목록"([`role="tab"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tab_role))이다. 모양을 통합하려고 의미까지 하나로 맞추면 접근성이 나빠진다. 세 번째 사용처가 생기면 다시 검토한다.

## 네 단계를 마치며

| 단계 | 작업                                                 | 감소한 것                                      |
| ---- | ---------------------------------------------------- | ---------------------------------------------- |
| 1    | 앱 루트의 기본값을 `reset` 레이어로                  | `!important`가 필요한 원인                     |
| 2    | 메뉴·팝오버: `Menu`, `useDismiss`, `placement`       | 닫기·위치 보정 구현 5곳 → 공통 모듈            |
| 3    | `!important` 정리, `IconButton`, `components` 레이어 | `!important` 66개 → 0개, 아이콘 버튼 4종 → 1종 |
| 4    | `Button`                                             | 텍스트 버튼 6종 → 1종                          |

이 PR은 16개 파일(258줄 추가, 133줄 삭제)을 변경했다. 단계마다 스크린샷 58장을 전후로 비교했고, 3단계부터는 계산된 스타일도 비교했다. 화면이 바뀐 것은 1·2단계뿐이다. 1단계는 앱 기본값에 가려져 있던 값이 적용된 곳들이고, 2단계는 Apple 메뉴와 메모 메뉴의 모양이 통일된 것이다. 3·4단계는 화면이 그대로였다.

## 이후 변경

열흘 뒤 리팩터링 4단계를 시작하며 같은 후보를 다시 집계했다([공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-inventory)). 그사이 Finder, 사진·음악의 휴대폰 화면, 메일 휴대폰 시트가 생겨 사용처 수가 바뀌었다. 기준은 같았지만 결과 하나가 달라졌다.

![10월 1일과 10월 11일의 판단 비교](./images/shared-text-button-revisit.svg '같은 기준, 다른 수')

`SearchField`는 `type="search"`가 여섯 곳으로 늘었고, 메모를 제외한 다섯 곳이 같은 모양이라 컴포넌트로 추출했다([#223](https://github.com/hyeoniverse/MacFolio/pull/223)). 나머지는 여전히 보류다. 이 글에서 만든 `Button`은 글을 쓴 시각에 앱 쪽 25개 파일이 사용했다. 직접 작성한 텍스트 버튼 30곳도 이후 이 컴포넌트로 교체했다([계산된 스타일 비교와 명시도 0인 :where() 규칙으로 버튼 75곳을 IconButton·Button으로 옮기기](/memo/icon-button-migrate)).

## 남은 것·배운 것

- 공통 컴포넌트는 "같은 모양, 같은 의미, 여러 사용처" 세 조건이 맞을 때 만든다. 하나라도 빠지면 옵션만 늘어난다.
- "만들지 않음"은 영구적인 결정이 아니다. 그 시각의 사용처 수로 결정한 것이라, 화면이 늘면 다시 집계한다. 결정과 함께 이유를 기록해 두면 재검토가 빠르다.
- 같은 의미를 두 이름(`danger`, `destructive`)으로 쓰고 있던 것처럼, 통합 작업은 이름을 하나로 맞추는 작업이기도 하다.
- `body`에 렌더링하는 포털은 앱 루트의 CSS 변수를 상속하지 못한다. 변수로 테마를 지정하는 구조에서는 포털의 최상위 요소에 변수를 다시 정의해야 한다.

## 관련 글

- [계산된 스타일 비교로 차이를 찾으며 !important 일괄 삭제하기](/memo/shared-button)
- [placement·useDismiss·Menu 세 모듈로 중복된 메뉴 구현 합치기](/memo/shared-menu)
- [공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-inventory)
- [계산된 스타일 비교와 명시도 0인 :where() 규칙으로 버튼 75곳을 IconButton·Button으로 옮기기](/memo/icon-button-migrate)

#MacFolio #공통컴포넌트
