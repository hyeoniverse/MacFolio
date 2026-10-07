// 휴대폰 홈 화면의 페이지 나누기 (iOS처럼): 한 화면에 다 들어가지 않는 앱은 스크롤하지 않고 다음 페이지로 보낸다.
// 순수 함수만 둔다. 몇 칸이 들어가는지는 화면에서 재서 넘긴다 (MobileHome).

/** 높이 안에 들어가는 아이콘 줄 수 (줄 높이 + 줄 사이). 적어도 한 줄 */
export function rowsThatFit(height: number, rowHeight: number, rowGap: number): number {
	if (rowHeight <= 0) return 1;
	return Math.max(1, Math.floor((height + rowGap) / (rowHeight + rowGap)));
}

/** 앱을 페이지로 나눈다: 첫 페이지(위젯 아래)는 firstSlots칸, 그다음부터는 slotsPerPage칸씩 */
export function pageApps<T>(apps: readonly T[], firstSlots: number, slotsPerPage: number): T[][] {
	const first = Math.max(1, firstSlots);
	const rest = Math.max(1, slotsPerPage);
	const pages: T[][] = [apps.slice(0, first)];
	for (let start = first; start < apps.length; start += rest) pages.push(apps.slice(start, start + rest));
	return pages;
}
