// 달력 계산. 순수 함수만 둔다.

/** YYYY-MM-DD */
export const toIso = (year: number, month: number, day: number) =>
	`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** YYYY-MM-DD → { year, month(0~11), day }. 잘못되면 null */
export function parseIso(value: string): { year: number; month: number; day: number } | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

/**
 * 한 달을 일요일부터 시작하는 주 단위 칸으로. 앞뒤 빈 칸은 null.
 * 예: 2026년 9월(1일이 화요일) → [[null, null, 1, 2, 3, 4, 5], [6, …], …]
 */
export function monthGrid(year: number, month: number): (number | null)[][] {
	const first = new Date(year, month, 1).getDay();
	const days = new Date(year, month + 1, 0).getDate();
	const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
	while (cells.length % 7 !== 0) cells.push(null);
	return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** 앞뒤 달로 (연도를 넘어간다) */
export function shiftMonth(year: number, month: number, offset: number) {
	const date = new Date(year, month + offset, 1);
	return { year: date.getFullYear(), month: date.getMonth() };
}

/** "2026. 9. 29." */
export function formatIso(value: string) {
	const parsed = parseIso(value);
	return parsed ? `${parsed.year}. ${parsed.month + 1}. ${parsed.day}.` : value;
}
