---
title: tabular-nums와 그리드 셀 겹치기로 가변 폭 텍스트의 칸 너비 고정하기
date: 2026-10-03
category: 개발 기록/MacFolio/화면·스타일
series: 메뉴 막대
seriesOrder: 1
summary: 메뉴 막대 오른쪽 끝의 시계 글자 너비가 바뀔 때마다 그 왼쪽의 재생·Wi-Fi·배터리 아이콘이 이동했다. tabular-nums와, 숨긴 가장 넓은 시각 문자열을 같은 그리드 셀에 겹쳐 배치하는 방법으로 시계 칸 너비를 고정했다.
---

MacFolio 데스크톱 화면의 맨 위에는 macOS처럼 메뉴 막대가 있다. 메뉴 막대 오른쪽 그룹에는 왼쪽부터 재생 버튼, Wi-Fi(서버 상태), 배터리, 시계가 차례로 놓이고, 그룹 전체가 막대의 오른쪽 끝에 붙어 있다. 이 배치에서는 맨 끝 항목인 시계의 글자 폭이 1px만 바뀌어도 그 왼쪽 항목이 모두 1px씩 이동한다. 시각이 바뀔 때마다 아이콘이 가로로 이동한 원인은 이 배치와 글꼴의 숫자 폭에 있었고, 시계 칸의 너비를 CSS만으로 고정해 해결했다.

## 배경

### 오른쪽 정렬과 가변 폭 항목

가로로 늘어선 항목을 오른쪽 끝에 붙이면, 브라우저는 오른쪽 끝을 기준점으로 삼아 항목을 오른쪽에서 왼쪽으로 채운다. 그래서 각 항목의 x 좌표는 "막대 오른쪽 끝 − (자기보다 오른쪽에 있는 항목들의 폭 합)"으로 정해진다. 오른쪽 끝 항목의 폭이 커지면 나머지 항목의 x 좌표는 그만큼 작아진다.

![오른쪽 정렬된 행에서 시계 폭이 바뀌어 아이콘이 이동하는 모습](./images/menubar-clock-width-flex-shift.svg '시계 칸이 1:11 PM(38px)에서 10:00 AM(54px)으로 넓어지면, 재생·Wi-Fi·배터리가 모두 15.7px 왼쪽으로 이동한다')

예를 들어 시계가 "1:11 PM"일 때 38px이고 "10:00 AM"일 때 54px이면, 9시 59분에서 10시로 넘어가는 시각에 재생·Wi-Fi·배터리 아이콘이 함께 약 16px 왼쪽으로 이동한다. 사용자가 Wi-Fi 아이콘 위에 마우스를 올려 둔 상태였다면 아이콘이 포인터 아래에서 빠져나간다.

### 비례 숫자와 고정폭 숫자

글자 수가 같아도 문자열 폭이 달라지는 이유는 글꼴의 숫자 설계에 있다. 글꼴은 숫자 모양(글리프)을 두 가지 방식으로 제공한다.

| 방식                            | 숫자 폭                                    | 주로 쓰는 곳                        |
| ------------------------------- | ------------------------------------------ | ----------------------------------- |
| 비례 숫자(proportional figures) | 숫자마다 다르다. "1"은 좁고 "0"·"8"은 넓다 | 본문 문장. 글자 사이 간격이 고르다  |
| 고정폭 숫자(tabular figures)    | 모든 숫자가 같다                           | 표, 가격, 시계처럼 자릿수를 맞출 곳 |

![비례 숫자와 고정폭 숫자의 글리프 폭 비교](./images/menubar-clock-width-figures.svg '자릿수가 같은 11:11과 10:00도 비례 숫자에서는 폭이 다르고, 고정폭 숫자에서는 같다')

CSS에서는 [`font-variant-numeric`](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric) 속성으로 둘 중 하나를 고른다. `tabular-nums`를 지정하면 글꼴에 들어 있는 고정폭 숫자를 사용하고, `proportional-nums`를 지정하면 비례 숫자를 사용한다. 글꼴이 고정폭 숫자를 제공하지 않으면 지정해도 결과가 바뀌지 않는다.

## 증상

데스크톱 화면을 열어 둔 상태에서 오른쪽 아이콘들이 간헐적으로 가로 방향으로 이동했다. 처음에는 음악 재생 상태 변경을 원인으로 추정했지만, 이동 시각을 확인하니 ==분이 바뀌는 시각==이었다. "9:59 AM"이 "10:00 AM"이 되는 시각처럼 자릿수가 바뀔 때뿐 아니라, 자릿수가 같아도 숫자 폭이 달라서(1은 좁고 0은 넓다) 1분마다 수 px씩 이동했다.

시계를 1:11에서 12:00으로 바꾸고 Wi-Fi 아이콘의 x 좌표를 비교하면 재현된다.

![메뉴 막대 전후](./images/menubar-clock-width.jpg '위: 시각에 따라 아이콘이 이동 / 아래: 같은 위치')

10월 3일에 이 현상을 발견했고, 수정 기준은 "어떤 시각을 표시하든 시계 이외 요소의 위치가 바뀌지 않는다"로 정했다.

## 원인

시계는 `apps/react/src/desktop/status-bar/StatusBar.tsx`가 1초마다 `Date`를 조회해 `h:mm AM` 형식으로 렌더링한다. 시계 칸에는 고정 너비가 없어서 글자 폭이 곧 칸 너비였다. 메뉴 막대 오른쪽 그룹은 flex로 오른쪽 끝에 정렬되어 있으므로, ==칸 너비가 바뀌면 그만큼 왼쪽 항목이 이동한다==.

글자 폭이 바뀌는 원인은 두 가지다.

1. **자릿수**: 시가 한 자리(1~9)일 때와 두 자리(10~12)일 때 글자 수가 다르다. "9:59 AM"은 7글자, "10:00 AM"은 8글자다.
2. **숫자 글리프 폭**: macOS의 기본 글꼴은 비례 숫자를 사용한다. 그래서 글자 수가 같은 "11:11"과 "10:00"도 폭이 다르다.

## 검토한 방법

| 방법                                               | 장점                           | 단점                                                                            |
| -------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `min-width: 8ch`처럼 숫자로 칸 너비를 정한다       | 선언 한 줄로 끝난다            | 글꼴이 바뀌면 다시 측정해야 한다. `ch`는 "0"의 폭이라 글꼴마다 맞는 값이 다르다 |
| 자바스크립트로 가장 넓은 시각을 측정해 너비를 지정 | 정확하다                       | 웹 글꼴 로드 완료 후에 측정해야 하고, 렌더링마다 측정이 필요하다                |
| **숨긴 가장 넓은 시각을 같은 셀에 겹친다 (선택)**  | 글꼴과 무관하게 CSS만으로 처리 | 가장 넓은 문자열은 사람이 지정한다                                              |

첫 번째 방법의 `ch`는 현재 글꼴에서 숫자 "0"의 폭을 뜻하는 CSS 길이 단위다. "10:00 AM"에는 숫자 외에 콜론, 공백, 알파벳이 섞여 있어서 `8ch`가 실제 폭과 맞는지는 글꼴마다 따로 확인해야 한다.

## 시계 칸 고정

두 가지를 함께 적용했다([#80](https://github.com/hyeoniverse/MacFolio/pull/80)).

- **숫자 폭 통일**: `font-variant-numeric: tabular-nums`로 모든 숫자를 같은 폭으로 렌더링한다.
- **가장 넓은 시각만큼 공간 확보**: 시계 칸을 셀 하나짜리 그리드로 만들고, 숨긴 "12:00 AM"과 "12:00 PM"을 현재 시각과 같은 셀에 겹쳐 배치한다. 칸 너비는 셋 중 가장 넓은 요소를 따르므로 항상 같다. A와 P의 글자 폭이 달라서 AM과 PM을 둘 다 배치한다.

```tsx
<span className="menu-item time-display">
	<span className="time-display-reserve" aria-hidden="true">
		12:00 AM
	</span>
	<span className="time-display-reserve" aria-hidden="true">
		12:00 PM
	</span>
	<span className="time-display-now">{time}</span>
</span>
```

```css
.time-display {
	display: inline-grid;
	justify-items: end;
	font-variant-numeric: tabular-nums;
}

.time-display-reserve,
.time-display-now {
	grid-area: 1 / 1;
}

.time-display-reserve {
	visibility: hidden;
}
```

### 그리드 셀 겹치기

CSS 그리드에서 [`grid-area`](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-area)는 요소를 놓을 행·열 위치를 지정한다. `grid-area: 1 / 1`은 "1행 1열"이라는 뜻이고, 세 자식 모두에 같은 값을 주면 세 요소가 한 칸에 포개진다. 그리드는 열 너비를 정할 때 그 열에 놓인 요소 중 가장 넓은 요소의 폭을 사용하므로, 셀 너비는 세 문자열 중 가장 넓은 값이 된다.

![세 자식을 같은 그리드 셀에 겹친 구조](./images/menubar-clock-width-grid-overlap.svg '숨긴 12:00 AM·12:00 PM과 현재 시각이 한 셀에 겹치고, 셀 폭은 가장 넓은 12:00 AM의 52.45px로 고정된다')

[`visibility: hidden`](https://developer.mozilla.org/en-US/docs/Web/CSS/visibility)은 `display: none`과 달리 ==레이아웃 공간을 차지한다==. 화면에 그리지만 않을 뿐 폭과 높이는 그대로 계산된다. 그래서 숨긴 두 시각이 칸 너비를 결정하고, 현재 시각은 그 칸 오른쪽에 정렬된다(`justify-items: end`, macOS 메뉴 막대와 같은 정렬). 스크린 리더가 시각을 세 번 읽지 않도록 예약용 요소에는 [`aria-hidden`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden)을 지정했다.

| 요소            | `visibility` | 칸 너비에 영향 | 스크린 리더 |
| --------------- | ------------ | -------------- | ----------- |
| 예약 "12:00 AM" | `hidden`     | 있음           | 제외        |
| 예약 "12:00 PM" | `hidden`     | 있음           | 제외        |
| 현재 시각       | `visible`    | 있음           | 읽음        |

휴대폰 상태 표시줄은 시각이 왼쪽 끝, 아이콘이 오른쪽 끝에 각각 정렬되어 있어서 처음부터 이동하지 않았다. 시각 폭이 바뀌어도 시각의 오른쪽이 늘어날 뿐 아이콘과 기준점이 다르기 때문이다.

## 확인

E2E `apps/react/e2e/desktop.spec.ts`의 "메뉴 막대의 시간이 바뀌어도 옆의 아이콘은 움직이지 않는다"는 Playwright의 [`page.clock.setFixedTime`](https://playwright.dev/docs/clock)으로 브라우저 시각을 1:11 AM에서 12:00 PM으로 바꾸고, 시계 바로 옆 서버 상태(Wi-Fi 위치) 버튼의 x 좌표가 같은지 확인한다. `setFixedTime`은 페이지 안의 `Date`가 지정한 시각을 반환하게 만드는 기능이라, 실제로 시각이 바뀌기를 기다리지 않고 원하는 시각을 바로 렌더링할 수 있다.

```ts
await page.clock.setFixedTime(new Date(2026, 9, 3, 1, 11));
// ...
const before = (await wifi.boundingBox())!;
await page.clock.setFixedTime(new Date(2026, 9, 3, 12, 0));
await expect(clock).toHaveText('12:00 PM');
expect((await wifi.boundingBox())!.x).toBe(before.x);
```

미리보기 서버에서 하루 1,440개 시각을 모두 같은 글꼴로 렌더링해 폭을 측정했다.

![시간 글자 너비](./images/menubar-clock-width-measure.svg '가장 좁은 1:11 PM과 가장 넓은 10:00 AM은 15.7px 차이가 난다')

| 측정 항목                    | 값                                          |
| ---------------------------- | ------------------------------------------- |
| 가장 좁은 시각               | "1:11 PM" 37.97px                           |
| 가장 넓은 시각               | "10:00 AM" 53.69px                          |
| 최대 차이                    | 15.7px (수정 전 하루 동안 아이콘의 이동 폭) |
| 서로 다른 폭의 수            | 358가지 (분 단위로 이동한 원인)             |
| 예약 "12:00 AM" / "12:00 PM" | 52.45px / 51.78px → 칸 너비 52.45px         |

## 남은 문제

> [!WARNING] 예약 문자열보다 넓은 10:00 AM
> 측정 결과 수정 방법에도 누락된 경우가 있었다. 이 측정은 Apple 글꼴이 없는 Linux의 Chromium에서 실행했고, `-apple-system` 대신 Liberation Sans로 렌더링됐다. 이 글꼴에서는 `tabular-nums` 적용 여부와 관계없이 폭이 같았고, "10:00 AM"이 예약한 "12:00 AM"보다 1.23px 넓었다. 그래서 10시대에는 칸이 1.23px 늘어나 아이콘이 그만큼 이동한다. E2E 시험은 1:11과 12:00만 비교해서 이 경우를 검출하지 못한다.

- 수정 시점의 전제는 "12:00이 가장 넓다"는 가정이었는데, 글꼴이 바뀌면 이 가정이 성립하지 않을 수 있다. macOS 시스템 글꼴에서 하루 전체를 다시 측정하지는 않았다. 예약 문자열에 "10:00 AM"을 추가하거나, 시험이 하루 중 가장 넓은 시각도 비교하도록 하는 것이 다음 작업이다.
- "가장 넓은 값을 숨겨서 겹쳐 배치하기"는 숫자 카운터, 남은 시간 표시, 텍스트가 바뀌는 버튼(재생/일시 정지)에도 그대로 적용할 수 있다. 예를 들어 "재생"과 "일시 정지"를 번갈아 표시하는 버튼은 두 문구를 모두 같은 셀에 넣고 현재 문구만 보이게 하면 폭이 고정된다. 다만 가장 넓은 문자열은 글꼴마다 측정해야 한다.

## 관련 글

- [창 순서와 분리한 활성 앱 상태로 메뉴 막대 앱 이름 맞추기](/memo/menu-bar-app-name)
- [앱이 등록한 메뉴를 공통 메뉴와 병합하는 메뉴 막대 구조](/memo/menubar-menus)
- [배경 이미지 픽셀 샘플링과 대비 계산으로 상태 표시줄 글자색 정하기](/memo/mobile-bars-contrast)

<details>
<summary>참고 문헌</summary>

- [MDN: font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)
- [MDN: visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/visibility)
- [MDN: grid-area](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-area)
- [MDN: aria-hidden](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden)
- [MDN: CSS 값과 단위 (ch)](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/Values_and_units)
- [Playwright: Clock](https://playwright.dev/docs/clock)

</details>

#MacFolio #데스크톱 #메뉴막대 #CSS
