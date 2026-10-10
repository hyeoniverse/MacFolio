---
title: 시간이 바뀔 때 움찔하던 메뉴 막대
date: 2026-10-03
category: 개발기/MacFolio/프론트엔드
summary: 데스크톱 메뉴 막대는 오른쪽 끝에 시계가 있어서, 시간 글자의 너비가 바뀔 때마다 그 왼쪽의 재생·Wi-Fi·배터리 아이콘이 몇 px씩 밀렸다. 시계 칸이 가장 넓은 시간만큼 늘 자리를 차지하게 했다.
---

데스크톱 메뉴 막대의 오른쪽 묶음은 오른쪽 끝에 붙어 있고, 맨 끝이 시계다. 그래서 시계 글자가 넓어지거나 좁아지면 그 왼쪽의 재생 단추, Wi-Fi, 배터리 아이콘이 모두 함께 움직였다. "9:59 AM"이 "10:00 AM"이 되는 순간처럼 자릿수가 바뀔 때도 그렇고, 같은 자릿수여도 글꼴의 숫자 너비가 달라서(1은 좁고 0은 넓다) 1분마다 조금씩 움찔했다.

![메뉴 막대 전후](./images/menubar-clock-width.jpg '위: 시간에 따라 아이콘이 밀림 / 아래: 같은 자리')

## 시계 칸을 고정

두 가지를 함께 했다.

- **숫자 너비 맞추기**: `font-variant-numeric: tabular-nums`로 숫자를 모두 같은 너비로 그린다.
- **가장 넓은 시간만큼 자리 잡기**: 시계 칸을 한 칸짜리 그리드로 만들고, 보이지 않는 "12:00 AM"과 "12:00 PM"을 지금 시간과 같은 칸에 겹쳐 둔다. 칸 너비는 셋 중 가장 넓은 것을 따르므로 늘 같다. AM과 PM은 글자 너비가 달라서 둘 다 둔다.

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

`min-width: 8ch`처럼 숫자로 정할 수도 있지만, 글꼴이 바뀌면 다시 재야 한다. 실제 글자를 겹쳐 두면 글꼴과 상관없이 맞는다. 시간 글자는 칸 오른쪽에 붙인다 (macOS 메뉴 막대처럼).

휴대폰 상태 표시줄은 시간이 왼쪽 끝, 아이콘이 오른쪽 끝에 따로 붙어 있어서 원래 움직이지 않았다.

E2E 시험에서 Playwright의 `page.clock.setFixedTime`으로 시간을 1:11 AM에서 12:00 PM으로 바꾸고, Wi-Fi 아이콘의 위치가 같은지 확인한다.

#MacFolio #데스크톱 #메뉴막대 #CSS
