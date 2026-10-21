// 위젯이 그릴 값 계산 (달력 칸, 시계 바늘, 날짜 글자). React와 DOM에 의존하지 않는 순수 함수만 둔다 (model.test.ts)

/** 사이트의 시각은 서울 기준 (메뉴 막대의 시계와 같다) */
export const TIME_ZONE = 'Asia/Seoul';

/** 서울 기준 오늘: 연·월(1~12)·일·요일(0=일) */
export function seoulDate(now: Date) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: TIME_ZONE,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		weekday: 'short',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		hourCycle: 'h23',
	}).formatToParts(now);
	const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
		hour: Number(get('hour')),
		minute: Number(get('minute')),
		second: Number(get('second')),
	};
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 이달의 달력: 주(일요일 시작)마다 7칸, 이달이 아닌 칸은 null. 줄 수는 4~6
 * @param month 1~12
 */
export function monthGrid(year: number, month: number): (number | null)[][] {
	const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
	const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
	const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
	while (cells.length % 7) cells.push(null);
	return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** 시계 바늘의 각도 (12시 방향이 0도, 시계 방향) */
export function handAngles({ hour, minute, second }: { hour: number; minute: number; second: number }) {
	return {
		hour: ((hour % 12) + minute / 60) * 30,
		minute: (minute + second / 60) * 6,
		second: second * 6,
	};
}

/** 글 날짜(YYYY-MM-DD)를 짧게: 오늘·어제, 올해면 '10월 3일', 아니면 '2025. 10. 3.' */
export function shortDate(date: string, today: { year: number; month: number; day: number }): string {
	const [year, month, day] = date.split('-').map(Number);
	if (!year || !month || !day) return date;
	const days = (Date.UTC(today.year, today.month - 1, today.day) - Date.UTC(year, month - 1, day)) / 86_400_000;
	if (days === 0) return '오늘';
	if (days === 1) return '어제';
	return year === today.year ? `${month}월 ${day}일` : `${year}. ${month}. ${day}.`;
}

/** 위젯의 글 한 편 (본문 없이) */
export interface RecentPost {
	slug: string;
	title: string;
	date: string;
	category: string;
}

/**
 * 빌드한 저장소의 최근 글에 서버 글(관리자가 사이트에서 쓴 글)을 합친다. 메모 앱과 같은 규칙:
 * 같은 주소는 서버 글이 대신하고, 지운 글·예약 글(deleted)은 저장소 글까지 가린다. 최신 글이 먼저
 */
export function mergeRecentPosts(
	repo: readonly RecentPost[],
	server: readonly (RecentPost & { deleted: boolean })[],
	limit: number
): RecentPost[] {
	const bySlug = new Map(repo.map((post) => [post.slug, post]));
	for (const { deleted, slug, title, date, category } of server) {
		if (deleted) bySlug.delete(slug);
		else bySlug.set(slug, { slug, title, date, category });
	}
	return [...bySlug.values()]
		.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
		.slice(0, limit);
}
