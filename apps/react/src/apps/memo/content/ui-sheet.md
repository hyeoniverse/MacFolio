---
title: 휴대폰 시트 3곳의 공통 동작을 Sheet 컴포넌트로 추출
date: 2026-10-12
category: 개발 기록/MacFolio/디자인 시스템
summary: 휴대폰 시트 3곳(메일 쓰기·메일 동작·음악 지금 재생 중)의 오버레이·애니메이션·닫기·role을 Sheet로 추출하고 모양은 variant 세 개로 나눴다. 닫기 타이머를 제거했고, 전환 중 발견한 343px 스크롤 튐과 가로 40px 스크롤도 수정했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계 둘째 항목 "새로 뽑을 것"의 둘째 컴포넌트다. [Modal 추출](/memo/ui-modal)에 이어, [공통 UI 부품 목록](/memo/ui-inventory)에서 추출하기로 한 `Sheet`를 진행했다. 시트(sheet)는 화면 아래에서 올라와 현재 화면 위에 겹쳐 표시되는 패널로, iOS의 기본 UI 요소다([Apple HIG: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)).

## 세 곳의 시트

휴대폰 화면에서 아래에서 올라오는 시트는 세 곳에 있었다.

| 시트              | 오버레이 | 모양                                      | 닫힐 때                       |
| ----------------- | -------- | ----------------------------------------- | ----------------------------- |
| 메일 쓰기·답장    | 있음     | 화면 높이에 가까운 시트, 위에 손잡이 막대 | 타이머로 240ms 대기 후 내려감 |
| 메일 동작         | 있음     | 아래에 떠 있는 카드                       | 같은 타이머                   |
| 음악 지금 재생 중 | 없음     | 화면 전체를 덮음                          | 애니메이션 없이 사라짐        |

세 곳 모두 `translateY(100%)`에서 올라오는 키프레임과 `role="dialog"`를 각자 작성했다. 메일은 닫히는 애니메이션을 표시하려고 `closing` 상태와 `setTimeout(240)`을 사용해, 240ms 뒤에 시트를 DOM에서 제거했다. 음악은 닫히는 애니메이션이 없었다.

## 검토한 방법

| 방법                                   | 장점                                  | 단점                                                         |
| -------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| 바텀 시트 라이브러리를 추가한다        | 끌어 내리기 같은 제스처까지 제공한다  | 세 곳뿐인데 의존성과 스타일 덮어쓰기가 늘어난다              |
| `Modal`에 `variant="sheet"`를 추가한다 | 부품 하나                             | 나타나는 방향·오버레이·높이·닫기가 달라 내부 분기가 늘어난다 |
| 공통 CSS 클래스만 만든다               | 코드가 가장 적다                      | 포커스·Esc·닫는 애니메이션은 여전히 세 곳에서 각자 처리한다  |
| 동작을 담은 `Sheet` 컴포넌트 + variant | 동작은 한 곳, 모양 차이는 셋으로 고정 | 새 모양이 생기면 variant를 늘려야 한다                       |

이미 [`Modal`](/memo/ui-modal)을 같은 방식으로 추출했고, 닫는 애니메이션도 `useExitMotion`이 처리하고 있었다. 두 부품이 같은 구조를 사용하면 코드를 읽는 사람도 한 가지 구조만 이해하면 된다.

## Sheet 컴포넌트

![Sheet가 담당하는 것과 호출하는 쪽이 정하는 것](./images/ui-sheet-layers.svg '공통 동작은 Sheet가, 콘텐츠와 안쪽 여백·색은 호출하는 쪽이 정한다')

`shared/ui/sheet/Sheet`는 공통 동작만 담당한다.

- **오버레이**: 시트 뒤를 어둡게 덮고, 누르면 `onClose`를 호출한다.
- **올라오는 애니메이션**: `sheet-in` 키프레임 하나.
- **닫기**: Esc, 오버레이 누르기.
- **접근성**: `role="dialog"`, `aria-modal`, `aria-label`. 열린 시각에 시트로 포커스를 옮긴다(스크롤 없이). 안의 입력 칸이 이미 포커스를 가져갔으면(autoFocus) 그대로 유지한다.
- **닫히는 애니메이션**: 오버레이의 어두운 배경이 사라지고 시트가 아래로 내려간다.

모양 차이는 `variant` 세 개로 나눴다.

| variant | 사용처            | 모양                                                             |
| ------- | ----------------- | ---------------------------------------------------------------- |
| `page`  | 메일 쓰기·답장    | 상태 표시줄 아래부터 바닥까지, 위 모서리만 둥글게, 손잡이 막대   |
| `card`  | 메일 동작         | 홈 막대 위에 떠 있는 카드, 네 모서리를 둥글게, 스프링 애니메이션 |
| `cover` | 음악 지금 재생 중 | 오버레이 없이 앱 화면 전체를 덮는다                              |

오버레이 색·z-index·시트 배경색은 호출하는 쪽 CSS가 `--ui-sheet-dim`·`--ui-sheet-z`·`--ui-sheet-bg`로 지정한다. 음악은 `--ui-sheet-bg: #1c1c1e`로 어두운 배경을 사용한다. 안쪽 여백과 콘텐츠는 `className`과 children이 정한다.

호출하는 쪽 코드는 다음처럼 짧아졌다. 메일 동작 카드를 예로 들면, 오버레이·키프레임·Esc 처리가 모두 빠지고 이름과 모양만 남는다.

```tsx
{sheet &&
	(sheet.kind === 'actions' ? (
		<Sheet key="actions" variant="card" label="메일 동작" className="mail-phone-actions" onClose={() => setSheet(null)}>
			{/* 보낸 사람, 동작 목록 */}
		</Sheet>
	) : (
		/* 쓰기·답장: variant="page" */
	))}
```

`cover`는 `aria-modal`을 붙이지 않는다. 음악의 시트는 시트 바깥에 떠 있는 뒤로 가기 버튼으로 닫는데, [`aria-modal`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-modal)을 붙이면 스크린 리더가 다이얼로그 바깥 요소를 탐색 대상에서 제외해 그 버튼에 접근할 수 없기 때문이다.

## 닫기 타이머를 없앤 방법

닫히는 애니메이션을 표시하려면 요소가 애니메이션 동안 DOM에 남아 있어야 한다. 메일은 이것을 상태로 처리했다. 닫기를 누르면 `closing`을 켜고 240ms 뒤에 시트를 제거했다. 그 사이 시트는 아직 열린 상태라, 시험과 스크린 리더도 240ms 동안 열린 시트를 인식했다.

`Sheet`는 `Modal`과 같이 `useExitMotion`을 사용한다. 호출하는 쪽이 `{sheet && <Sheet />}`로 제거하면, React가 요소를 DOM에서 분리하기 직전에 요소의 복제본을 같은 위치에 배치하고, 복제본에 사라지는 애니메이션을 적용한다. 실제 시트는 즉시 제거되므로 상태와 시험은 닫힌 이후를 기준으로 동작한다.

- 오버레이 복제본에는 `dim-out`을 적용한다. 오버레이 전체의 투명도를 낮추는 `fade-out`을 쓰면 안의 시트까지 흐려지므로, 어두운 배경색만 사라지게 했다.
- 복제본 안의 시트에는 `[data-exiting] .ui-sheet` 선택자로 `sheet-out`(아래로 내려감)을 적용한다.
- 둘 다 240ms라 기존 메일과 같은 시간에 끝난다.

![닫기 뒤 240ms 동안 전에는 실제 시트가 남고, 후에는 복제본만 내려가는 모습](./images/ui-sheet-exit-timeline.svg '닫는 동안 DOM에 남는 것')

메일의 `closing` 상태, `setTimeout`, 타이머 정리 `useEffect`, 동작 줄이기(reduced motion) 분기가 모두 제거됐다. `MailMobile.tsx`는 150줄이 변경되며 줄었고, `MailMobile.css`에서는 키프레임과 오버레이 규칙 60줄을 삭제했다. 음악 지금 재생 중은 이번에 처음으로 내려가는 애니메이션으로 닫힌다.

## 열린 시각의 포커스가 화면을 스크롤한 문제

처음 만든 `Sheet`를 미리보기에서 휴대폰으로 열어 보니, 음악 지금 재생 중이 올라올 때 화면이 위아래로 흔들렸다. 열리는 순간 시트에 포커스를 주는데, 이 시각에 시트는 아직 `translateY(100%)`에서 올라오는 중이었다. 브라우저는 포커스를 받은 요소를 화면에 표시하려고 앱 화면(`.music`)을 343px 스크롤했고, 애니메이션이 끝나며 다시 0으로 돌아왔다.

![시트가 올라오는 동안 앱 화면의 스크롤 위치](./images/ui-sheet-scroll.svg '수정 전에는 343px까지 스크롤됐다가 돌아오고, 수정 후에는 0에 머문다')

[`focus({ preventScroll: true })`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)로 포커스는 옮기되 스크롤은 하지 않게 했다.

```ts
// 열 때 한 번 초점을 둔다. 안의 입력 칸이 먼저 초점을 가져갔으면(autoFocus) 그대로 둔다
if (!box.current?.contains(document.activeElement)) box.current?.focus({ preventScroll: true });
```

함께 수정한 것이 하나 더 있다. 포커스와 Esc 처리를 담은 `useEffect`가 `onClose`에 의존하고 있었는데, 음악 화면은 재생 위치가 바뀔 때마다 다시 렌더링되며 새 `onClose` 함수를 넘긴다. effect가 반복 실행되지 않도록, 최신 `onClose`는 [ref](https://react.dev/reference/react/useRef)에 보관하고 effect는 열린 시각에 한 번만 실행되게 했다.

```ts
const close = useRef(onClose);
useEffect(() => {
	close.current = onClose;
}, [onClose]);
// Esc는 close.current()를 부른다. 키 효과의 의존성은 []
```

같은 이유로 시트의 [ref 콜백](https://react.dev/reference/react-dom/components/common#ref-callback)도 [`useCallback`](https://react.dev/reference/react/useCallback)으로 한 번만 만든다. 렌더링마다 새 ref 함수를 넘기면 React가 이전 ref를 정리하면서 사라지는 애니메이션을 실행해, 재생 시간이 바뀔 때마다 시트 복제본이 내려가는 애니메이션이 계속 반복된다. 애니메이션을 켠 E2E에 "시트가 올라오는 동안 앱 화면이 스크롤되지 않는다" 시험을 추가했고, 수정 전 코드에서는 이 시험이 실패한다.

## 가로로 스와이프하면 왼쪽 여백이 사라지던 문제

같은 미리보기에서 음악 지금 재생 중을 가로로 스와이프하자 왼쪽 여백이 사라져 제목과 재생 시간이 화면 끝에 닿았다. 시트 안의 블러 처리된 앨범 표지 배경(`::before`)은 가장자리가 비지 않도록 [`inset`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/inset)`: -40px`로 시트보다 사방 40px 크게 렌더링한다. 시트는 `overflow-y: auto`였는데, 한 축만 `auto`로 지정하면 다른 축도 `visible`이 아니라 `auto`로 계산된다[^1]. 그래서 넘친 배경 때문에 시트에 가로 스크롤 40px가 생겼고, 휴대폰에서 가로로 스와이프하면 내용이 왼쪽으로 밀렸다. 이 문제는 `Sheet`로 옮기기 전부터 있었다.

![overflow-y만 auto일 때 넘친 배경이 가로 스크롤을 만들고, overflow-x hidden을 추가하면 사라지는 모습](./images/ui-sheet-overflow.svg '수정 전에는 가로 스크롤 40px, 수정 후에는 0')

`Sheet.css`에서 `page`·`cover` 시트에 `overflow-x: hidden`을 지정해 세로로만 스크롤되게 했다. 휴대폰 E2E에서 시트를 가로로 스와이프해도 `scrollLeft`가 0인지 확인한다. 수정 전 코드에서는 40이 나온다.

두 문제 모두 10월 12일 오후 휴대폰에서 미리보기를 직접 조작하다 발견했다. 음악 앱의 지금 재생 중을 열자 화면이 위아래로 흔들렸고(343px 스크롤), 가로로 스와이프하자 왼쪽 여백이 사라졌다(가로 스크롤 40px). 둘 다 수정한 뒤 PR 본문에 원인과 수정 내용을 기록했다.

## 확인

- 전후 화면: 메일 쓰기 시트와 메일 동작 카드는 픽셀 단위로 같다. 음악 지금 재생 중은 상태 표시줄의 시계만 달랐다.
- E2E: 휴대폰 메일·음악 시험이 그대로 통과한다. 닫힌 시각에 복제본이 내려가고 애니메이션이 끝나면 DOM에 남지 않는지는 애니메이션을 켠 `mobile-motion.spec.ts`에 시험을 하나 추가해 확인한다.

변경된 파일은 14개(468줄 추가, 189줄 삭제)였다. 새로 생긴 것은 `shared/ui/sheet/Sheet.tsx`(89줄)와 `Sheet.css`(67줄), `styles/motion.css`의 `sheet-in`·`sheet-out`·`dim-out` 키프레임이다.

## 남은 것·배운 것

- 시트를 손가락으로 끌어 내려 닫는 제스처는 아직 없다. iOS 시트의 대표적인 동작이지만 세 곳 모두 현재는 버튼과 오버레이로 닫는다.
- 닫는 애니메이션을 상태로 처리하면 "닫혔지만 아직 보이는" 구간이 생기고, 그 구간 동안 시험과 스크린 리더는 열린 시트를 인식한다. 복제본만 내려보내는 방식은 이 구간을 없앤다.
- 열린 시각의 포커스 이동은 화면을 스크롤할 수 있다. 애니메이션 중인 요소에 포커스를 줄 때는 `preventScroll`을 먼저 검토한다.
- 한 축만 `overflow: auto`로 지정하면 다른 축도 `visible`이 아니게 된다. 넘치게 렌더링하는 장식(블러 배경 등)이 있으면 다른 축을 명시적으로 `hidden`으로 지정한다.
- 공통 부품으로 옮기는 작업은 기존 버그를 발견하는 계기이기도 했다. 가로 스크롤은 옮기기 전부터 있던 문제였다.

다음은 셋째 컴포넌트 `SearchField`다([#223](https://github.com/hyeoniverse/MacFolio/pull/223)).

## 관련 글

- [모달 다이얼로그 5개의 공통 동작을 Modal 컴포넌트로 추출](/memo/ui-modal): 데스크톱 가운데 창을 Modal로 추출한 일
- [공통 부품 목록을 먼저 작성하고, 후보 아홉 개를 다시 집계했다](/memo/ui-inventory): 추출할 부품을 결정한 목록
- [남은 시트와 창을 찾아 보니 — Modal로 옮긴 것은 하나](/memo/sheet-modal-migrate): 앱마다 직접 만든 시트·모달을 옮긴 일
- PR: [#220](https://github.com/hyeoniverse/MacFolio/pull/220)

[^1]: CSS 명세상 `overflow-x`와 `overflow-y` 중 하나가 `visible`이 아닌 값이면, 다른 축의 `visible`은 `auto`로 계산된다. [MDN: overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow)

#MacFolio #공통컴포넌트 #리팩터링
