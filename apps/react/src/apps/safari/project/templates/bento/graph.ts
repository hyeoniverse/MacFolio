// bento 진행 과정 타일의 날짜 칸 그래프 계산: 날짜 글자를 읽어 주 단위 칸으로 바꾼다 (charts.tsx가 그린다, 시험은 graph.test.ts)
/** 'YYYY.MM.DD'·'YYYY-MM-DD'·'YYYY/MM/DD'(일이 없으면 1일) → 날짜, 못 읽으면 null */
export function parseDate(text: string): Date | null {
	const match = /(\d{4})\D+(\d{1,2})(?:\D+(\d{1,2}))?/.exec(text);
	if (!match) return null;
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] ?? 1));
	return Number.isNaN(date.getTime()) ? null : date;
}

const DAY = 86400000;
const dayKey = (date: Date) => Math.round(date.getTime() / DAY);

/**
 * 진행 과정의 날짜 칸 그래프: 첫 날짜가 든 주부터 마지막 날짜가 든 주까지, 한 열이 한 주(일~토).
 * 기록이 있는 날은 진하게, 그 사이 기간은 옅게 칠한다. 날짜를 하나도 못 읽거나 너무 길면(80주 넘게) null
 */
export function graphOf(dates: string[]): { weeks: number[][]; marks: number } | null {
	const days = dates.map(parseDate).filter((date): date is Date => date !== null);
	if (days.length === 0) return null;
	const keys = days.map(dayKey).sort((a, b) => a - b);
	const marked = new Set(keys);
	const first = keys[0];
	const last = keys[keys.length - 1];
	// 1970-01-01은 목요일: (key + 4) % 7이 요일(일=0)
	const start = first - ((first + 4) % 7);
	const end = last + (6 - ((last + 4) % 7));
	const weekCount = (end - start + 1) / 7;
	if (weekCount > 80) return null;
	const weeks = Array.from({ length: weekCount }, (_, w) =>
		Array.from({ length: 7 }, (_, d) => {
			const key = start + w * 7 + d;
			if (marked.has(key)) return 2;
			return key > first && key < last ? 1 : 0;
		})
	);
	return { weeks, marks: marked.size };
}
