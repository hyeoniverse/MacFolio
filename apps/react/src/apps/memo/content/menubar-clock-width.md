---
title: tabular-nums와 그리드 셀 겹치기로 가변 폭 텍스트의 칸 너비 고정하기
date: 2026-10-03
category: 개발 기록/MacFolio/UI·인터랙션
series: 메뉴 막대
seriesOrder: 1
summary: 메뉴 막대 오른쪽 끝의 시계 글자 너비가 바뀔 때마다 그 왼쪽의 재생·Wi-Fi·배터리 아이콘이 이동했다. tabular-nums와, 숨긴 가장 넓은 시각 문자열을 같은 그리드 셀에 겹쳐 배치하는 방법으로 시계 칸 너비를 고정했다.
---

데스크톱 메뉴 막대의 오른쪽 그룹은 오른쪽 끝에 정렬되어 있고, 맨 끝 항목이 시계다. 그래서 시계 글자 폭이 넓어지거나 좁아지면 그 왼쪽의 재생 버튼, Wi-Fi, 배터리 아이콘이 모두 함께 이동했다.

## 배경

데스크톱 화면을 열어 둔 상태에서 오른쪽 아이콘들이 간헐적으로 가로 방향으로 이동했다. 처음에는 음악 재생 상태 변경이 원인이라고 추정했지만, 이동 시각을 확인하니 분이 바뀌는 시각이었다. "9:59 AM"이 "10:00 AM"이 되는 시각처럼 자릿수가 바뀔 때뿐 아니라, 자릿수가 같아도 글꼴의 숫자 폭이 달라서(1은 좁고 0은 넓다) 1분마다 수 px씩 이동했다.

재현 방법은 시계를 1:11에서 12:00으로 바꾸고 Wi-Fi 아이콘의 x 좌표를 비교하는 것이다. 오른쪽 정렬된 행의 맨 끝 항목 너비가 바뀌면 그 왼쪽의 모든 항목이 같은 거리만큼 이동한다.

![메뉴 막대 전후](./images/menubar-clock-width.jpg '위: 시각에 따라 아이콘이 이동 / 아래: 같은 위치')

이 현상은 10월 3일 오후에 발견했다. 수정 기준은 "어떤 시각을 표시하든 다른 요소의 위치가 바뀌지 않는다"였다.

## 원인

시계는 `apps/react/src/desktop/status-bar/StatusBar.tsx`가 1초마다 `Date`를 조회해 `h:mm AM` 형식으로 렌더링한다. 시계 칸에는 고정 너비가 없어서 글자 폭이 곧 칸 너비였다. 메뉴 막대 오른쪽 그룹은 flex로 오른쪽 끝에 정렬되어 있으므로, 칸 너비가 바뀌면 그만큼 왼쪽 항목이 이동한다.

글자 폭이 바뀌는 원인은 두 가지다.

- **자릿수**: 시가 한 자리(1~9)일 때와 두 자리(10~12)일 때 글자 수가 다르다.
- **숫자 글리프 폭**: macOS의 기본 글꼴은 숫자마다 폭이 다른 비례 숫자(proportional figures)를 사용한다. 글자 수가 같아도 "1:11"과 "10:00"의 폭이 다르다.

## 검토한 방법

| 방법                                               | 장점                           | 단점                                                                            |
| -------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `min-width: 8ch`처럼 숫자로 칸 너비를 정한다       | 선언 한 줄로 끝난다            | 글꼴이 바뀌면 다시 측정해야 한다. `ch`는 "0"의 폭이라 글꼴마다 맞는 값이 다르다 |
| 자바스크립트로 가장 넓은 시각을 측정해 너비를 지정 | 정확하다                       | 웹 글꼴 로드 완료 후에 측정해야 하고, 렌더링마다 측정이 필요하다                |
| **숨긴 가장 넓은 시각을 같은 셀에 겹친다 (선택)**  | 글꼴과 무관하게 CSS만으로 처리 | 가장 넓은 문자열은 사람이 지정한다                                              |

## 시계 칸을 고정

두 가지를 함께 적용했다([#80](https://github.com/hyeoniverse/MacFolio/pull/80)).

- **숫자 폭 통일**: [`font-variant-numeric: tabular-nums`](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)로 모든 숫자를 같은 폭(고정폭 숫자)으로 렌더링한다.
- **가장 넓은 시각만큼 공간 확보**: 시계 칸을 셀 하나짜리 그리드로 만들고, 숨긴 "12:00 AM"과 "12:00 PM"을 현재 시각과 같은 셀에 겹쳐 배치한다. 칸 너비는 셋 중 가장 넓은 요소를 따르므로 항상 같다. AM과 PM은 글자 폭이 달라서 둘 다 배치한다.

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

[`visibility: hidden`](https://developer.mozilla.org/en-US/docs/Web/CSS/visibility)은 `display: none`과 달리 레이아웃 공간을 차지한다. 그래서 숨긴 두 시각이 칸 너비를 결정하고, 현재 시각은 그 칸 오른쪽에 정렬된다(`justify-items: end`, macOS 메뉴 막대와 같은 정렬). 스크린 리더가 시각을 세 번 읽지 않도록 예약용 요소에는 `aria-hidden`을 지정했다.

| 요소            | `visibility` | 칸 너비에 영향 | 스크린 리더 |
| --------------- | ------------ | -------------- | ----------- |
| 예약 "12:00 AM" | `hidden`     | 있음           | 제외        |
| 예약 "12:00 PM" | `hidden`     | 있음           | 제외        |
| 현재 시각       | `visible`    | 있음           | 읽음        |

휴대폰 상태 표시줄은 시각이 왼쪽 끝, 아이콘이 오른쪽 끝에 각각 정렬되어 있어서 원래 이동하지 않았다.

## 확인

E2E `apps/react/e2e/desktop.spec.ts`의 "메뉴 막대의 시간이 바뀌어도 옆의 아이콘은 움직이지 않는다"는 Playwright의 [`page.clock.setFixedTime`](https://playwright.dev/docs/clock)으로 시각을 1:11 AM에서 12:00 PM으로 바꾸고, 시계 바로 옆 서버 상태(Wi-Fi 위치) 버튼의 x 좌표가 같은지 확인한다.

```ts
await page.clock.setFixedTime(new Date(2026, 9, 3, 1, 11));
// ...
const before = (await wifi.boundingBox())!;
await page.clock.setFixedTime(new Date(2026, 9, 3, 12, 0));
await expect(clock).toHaveText('12:00 PM');
expect((await wifi.boundingBox())!.x).toBe(before.x);
```

이 글을 수정하면서 미리보기 서버에서 하루 1,440개 시각을 모두 같은 글꼴로 렌더링해 폭을 측정했다.

![시간 글자 너비](./images/menubar-clock-width-measure.svg '가장 좁은 1:11 PM과 가장 넓은 10:00 AM은 15.7px 차이가 난다')

| 측정 항목                    | 값                                          |
| ---------------------------- | ------------------------------------------- |
| 가장 좁은 시각               | "1:11 PM" 37.97px                           |
| 가장 넓은 시각               | "10:00 AM" 53.69px                          |
| 최대 차이                    | 15.7px (수정 전 하루 동안 아이콘의 이동 폭) |
| 서로 다른 폭의 수            | 358가지 (분 단위로 이동한 원인)             |
| 예약 "12:00 AM" / "12:00 PM" | 52.45px / 51.78px → 칸 너비 52.45px         |

## 남은 것·정리

측정 결과 수정 방법에도 누락된 경우가 있었다. 이 측정은 Apple 글꼴이 없는 Linux의 Chromium에서 실행했고, `-apple-system` 대신 Liberation Sans로 렌더링됐다. 이 글꼴에서는 `tabular-nums` 적용 여부와 관계없이 폭이 같았고, "10:00 AM"이 예약한 "12:00 AM"보다 1.23px 넓었다. 그래서 10시대에는 칸이 1.23px 늘어나 아이콘이 그만큼 이동한다. E2E 시험은 1:11과 12:00만 비교해서 이 경우를 검출하지 못한다.

- 수정 시점에 전제한 것은 "12:00이 가장 넓다"는 가정이었는데, 글꼴이 바뀌면 이 가정이 성립하지 않을 수 있다. macOS 시스템 글꼴에서 하루 전체를 다시 측정하지는 않았다. 예약 문자열에 "10:00 AM"을 추가하거나, 시험이 하루 중 가장 넓은 시각도 비교하도록 하는 것이 다음 작업이다.
- "가장 넓은 값을 숨겨서 겹쳐 배치하기"는 숫자 카운터, 남은 시간, 텍스트가 바뀌는 버튼(재생/일시 정지)에도 그대로 적용할 수 있다. 다만 가장 넓은 문자열은 글꼴마다 측정해야 한다.

## 관련 글

- [창 순서와 분리한 활성 앱 상태로 메뉴 막대 앱 이름 맞추기](/memo/menu-bar-app-name)
- [앱이 등록한 메뉴를 공통 메뉴와 병합하는 메뉴 막대 구조](/memo/menubar-menus)
- [배경 이미지 픽셀 샘플링과 대비 계산으로 상태 표시줄 글자색 정하기](/memo/mobile-bars-contrast)

#MacFolio #데스크톱 #메뉴막대 #CSS
