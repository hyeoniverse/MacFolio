---
title: 시간이 바뀔 때 움찔하던 메뉴 막대
date: 2026-10-03
category: 개발기/MacFolio/프론트엔드
summary: 메뉴 막대 오른쪽 끝의 시계 글자 너비가 바뀔 때마다 그 왼쪽의 재생·Wi-Fi·배터리 아이콘이 밀렸다. tabular-nums와, 보이지 않는 가장 넓은 시간을 같은 그리드 칸에 겹쳐 두는 방법으로 시계 칸 너비를 고정했다.
---

데스크톱 메뉴 막대의 오른쪽 묶음은 오른쪽 끝에 붙어 있고, 맨 끝이 시계다. 그래서 시계 글자가 넓어지거나 좁아지면 그 왼쪽의 재생 버튼, Wi-Fi, 배터리 아이콘이 모두 함께 움직였다.

## 배경

메뉴 막대를 띄워 두고 다른 일을 하다 보면 오른쪽 아이콘들이 가끔 옆으로 툭 움직였다. 처음에는 음악 재생 상태가 바뀌어서인 줄 알았는데, 시간을 보니 분이 바뀌는 순간이었다. "9:59 AM"이 "10:00 AM"이 되는 순간처럼 자릿수가 바뀔 때도 그렇고, 같은 자릿수여도 글꼴의 숫자 너비가 달라서(1은 좁고 0은 넓다) 1분마다 조금씩 움찔했다.

재현 방법도 단순하다. 시계를 1:11에서 12:00으로 바꾸고 Wi-Fi 아이콘의 x 좌표를 비교하면 된다. 오른쪽 정렬된 줄의 맨 끝 항목 너비가 바뀌면 그 왼쪽의 모든 항목이 같은 양만큼 밀린다.

![메뉴 막대 전후](./images/menubar-clock-width.jpg '위: 시간에 따라 아이콘이 밀림 / 아래: 같은 자리')

10월 3일 오후 메뉴 막대를 보다가 시간에 따라 아이콘 버튼들이 조금씩 움찔하는 것을 알아챘다. 어떤 시간을 표시하든 다른 요소의 자리가 바뀌지 않아야 한다는 것이 고칠 기준이었다.

## 원인

시계는 `apps/react/src/desktop/status-bar/StatusBar.tsx`가 1초마다 `Date`를 읽어 `h:mm AM` 꼴로 그린다. 시계 칸에는 정해진 너비가 없어서 글자 너비가 곧 칸 너비였다. 메뉴 막대 오른쪽 묶음은 flex로 오른쪽 끝에 붙어 있으니, 칸 너비가 바뀌면 그만큼 왼쪽 항목이 움직인다.

글자 너비가 바뀌는 이유는 두 가지다.

- **자릿수**: 시가 한 자리(1~9)일 때와 두 자리(10~12)일 때 글자 수가 다르다.
- **숫자 모양**: macOS의 기본 글꼴은 숫자마다 너비가 다른 비례 숫자다. 같은 글자 수라도 "1:11"과 "10:00"의 너비가 다르다.

## 고를 수 있는 방법

| 방법                                                 | 좋은 점                          | 문제                                                                        |
| ---------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| `min-width: 8ch`처럼 숫자로 칸 너비를 정한다         | 한 줄이면 된다                   | 글꼴이 바뀌면 다시 재야 한다. `ch`는 "0"의 너비라 글꼴마다 맞는 값이 다르다 |
| 자바스크립트로 가장 넓은 시간을 재서 너비를 넣는다   | 정확하다                         | 글꼴을 다 읽은 뒤에 재야 하고, 렌더링마다 측정이 필요하다                   |
| 보이지 않는 가장 넓은 시간을 같은 칸에 겹친다 (고름) | 글꼴과 상관없이 CSS만으로 맞는다 | 무엇이 가장 넓은지는 사람이 고른다                                          |

## 시계 칸을 고정

두 가지를 함께 했다([PR #80](https://github.com/hyeoniverse/MacFolio/pull/80)).

- **숫자 너비 맞추기**: `font-variant-numeric: tabular-nums`로 숫자를 모두 같은 너비로 그린다.
- **가장 넓은 시간만큼 자리 잡기**: 시계 칸을 한 칸짜리 그리드로 만들고, 보이지 않는 "12:00 AM"과 "12:00 PM"을 지금 시간과 같은 칸에 겹쳐 둔다. 칸 너비는 셋 중 가장 넓은 것을 따르므로 늘 같다. AM과 PM은 글자 너비가 달라서 둘 다 둔다.

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

`visibility: hidden`은 `display: none`과 달리 자리를 차지한다. 그래서 보이지 않는 두 시간이 칸 너비를 정하고, 지금 시간은 그 칸 오른쪽에 붙는다(`justify-items: end`, macOS 메뉴 막대처럼). 화면 읽기 프로그램이 시간을 세 번 읽지 않게 예약용 글자에는 `aria-hidden`을 달았다.

휴대폰 상태 표시줄은 시간이 왼쪽 끝, 아이콘이 오른쪽 끝에 따로 붙어 있어서 원래 움직이지 않았다.

## 확인

E2E `apps/react/e2e/desktop.spec.ts`의 "메뉴 막대의 시간이 바뀌어도 옆의 아이콘은 움직이지 않는다"는 Playwright의 `page.clock.setFixedTime`으로 시간을 1:11 AM에서 12:00 PM으로 바꾸고, 시계 바로 옆 서버 상태(Wi-Fi 자리) 버튼의 x 좌표가 같은지 본다.

```ts
await page.clock.setFixedTime(new Date(2026, 9, 3, 1, 11));
// ...
const before = (await wifi.boundingBox())!;
await page.clock.setFixedTime(new Date(2026, 9, 3, 12, 0));
await expect(clock).toHaveText('12:00 PM');
expect((await wifi.boundingBox())!.x).toBe(before.x);
```

이 글을 고치면서 미리보기 서버에서 하루 1,440개 시간을 모두 같은 글꼴로 그려 너비를 재 봤다.

![시간 글자 너비](./images/menubar-clock-width-measure.svg '가장 좁은 1:11 PM과 가장 넓은 10:00 AM은 15.7px 차이가 난다')

- 가장 좁은 시간은 "1:11 PM"(37.97px), 가장 넓은 시간은 "10:00 AM"(53.69px)으로 15.7px 차이가 난다. 고치기 전에는 하루에 이만큼 아이콘이 오갔다.
- 서로 다른 너비가 358가지였다. 1분마다 움찔한 것이 착각이 아니었다.
- 예약한 "12:00 AM"은 52.45px, "12:00 PM"은 51.78px이라 칸 너비는 52.45px이다.

## 남은 것·배운 것

재 보니 고친 방법에도 빈틈이 있었다. 이 측정은 Apple 글꼴이 없는 Linux의 Chromium에서 했고, `-apple-system` 대신 Liberation Sans가 쓰였다. 이 글꼴에서는 `tabular-nums`를 켜도 켜지 않아도 너비가 똑같았고, "10:00 AM"이 예약한 "12:00 AM"보다 1.23px 넓었다. 그래서 10시대에는 칸이 1.23px 늘어나 아이콘이 그만큼 밀린다. E2E 시험은 1:11과 12:00만 비교해서 이것을 잡지 못한다.

- 고칠 때 확인한 것은 "12:00이 가장 넓다"는 가정이었는데, 글꼴이 바뀌면 이 가정이 틀릴 수 있다. macOS의 시스템 글꼴에서 하루치를 다시 재 보지는 못했다. 예약 글자에 "10:00 AM"을 더하거나, 시험이 하루 중 가장 넓은 시간도 보게 하는 것이 다음 할 일이다.
- "가장 넓은 값을 보이지 않게 겹쳐 두기"는 숫자 카운터, 남은 시간, 버튼 글자가 바뀌는 곳(재생/일시 정지)에도 그대로 쓸 수 있다. 다만 무엇이 가장 넓은지는 글꼴마다 재 봐야 한다.

## 관련 글

- [메뉴 막대의 앱 이름이 맨 앞 창을 따른다](/memo/menu-bar-app-name)
- [메뉴 막대의 파일·보기·윈도우가 실제로 열린다](/memo/menubar-menus)
- [상태 표시줄과 홈 인디케이터를 어떤 배경에서도 보이게](/memo/mobile-bars-contrast)

#MacFolio #데스크톱 #메뉴막대 #CSS
