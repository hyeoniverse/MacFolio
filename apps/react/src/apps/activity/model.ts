// '활동 상태 보기'의 순수 계산: 기간, 비교, 표에 보이는 이름. 서버 호출은 activityApi.ts
import { APP_MANIFEST, type AppName } from '@/apps/manifest';
import { cleanUtm, splitUtmKey } from '@macfolio/contracts';
import type { Breakdown, LiveVisit } from './activityApi';

export const PERIODS = [
	{ id: 'today', label: '오늘', days: 1 },
	{ id: '7d', label: '7일', days: 7 },
	{ id: '30d', label: '30일', days: 30 },
	{ id: '90d', label: '90일', days: 90 },
] as const;
export type Period = (typeof PERIODS)[number]['id'];

/** 한국 시간의 오늘 (서버의 날짜와 같은 기준) */
export const kstToday = (now = new Date()) => new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);

/** 기간의 첫날과 끝날 (끝날은 오늘) */
export function periodRange(period: Period, today: string): { from: string; to: string } {
	const days = PERIODS.find((entry) => entry.id === period)!.days;
	const from = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
	return { from, to: today };
}

/** 앞 기간과 비교: +12% ▲, -5% ▼. 앞 기간이 0이면 비교하지 않는다 */
export function change(
	current: number | null,
	previous: number | null
): { text: string; direction: 'up' | 'down' | 'same' } | null {
	if (current === null || previous === null || previous === 0) return null;
	const percent = Math.round(((current - previous) / previous) * 100);
	if (percent === 0) return { text: '0%', direction: 'same' };
	return { text: `${percent > 0 ? '+' : ''}${percent}%`, direction: percent > 0 ? 'up' : 'down' };
}

/** 2분 41초 */
export function formatDuration(seconds: number | null): string {
	if (seconds === null) return '–';
	const minutes = Math.floor(seconds / 60);
	return minutes ? `${minutes}분 ${seconds % 60}초` : `${seconds}초`;
}

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['ko'], { type: 'region' }) : null;

/** 표에 보이는 이름 */
export function labelOf(metric: Breakdown, key: string): string {
	if (key === '') return metric === 'referrer' ? '직접 들어옴' : '알 수 없음';
	if (metric === 'country') {
		try {
			return `${regionNames?.of(key) ?? key} (${key})`;
		} catch {
			return key;
		}
	}
	if (metric === 'app') return APP_MANIFEST[key as AppName]?.label ?? key;
	if (metric === 'device') return key === 'mobile' ? '모바일' : key === 'desktop' ? '데스크톱' : key;
	if (metric === 'utm') return utmLabel(key);
	if (metric === 'item') {
		const [app, ...rest] = key.split('/');
		return `${APP_MANIFEST[app as AppName]?.label ?? app} › ${rest.join('/')}`;
	}
	return key;
}

/** 실시간 흐름의 한 줄: "메모 열기", "메모 › hello 보기" */
export function eventLabel(event: LiveVisit['events'][number]): string {
	const app = event.app ? (APP_MANIFEST[event.app as AppName]?.label ?? event.app) : '';
	switch (event.type) {
		case 'visit':
			return '들어옴';
		case 'app':
			return `${app} 열기`;
		case 'item':
			return `${app} › ${event.item} 보기`;
		case 'link':
			return `${event.item} 누름`;
		default:
			return event.type;
	}
}

/** 조합 표의 이름: linkedin / social / resume-2026. 빈 칸은 - */
export const utmLabel = (key: string) =>
	splitUtmKey(key)
		.map((part) => part || '-')
		.join(' / ');

/** 링크 생성기의 칸 (utm_ 뒤 이름 → 값) */
export const UTM_FIELDS = ['source', 'medium', 'campaign', 'term', 'content'] as const;
export type UtmFields = Record<(typeof UTM_FIELDS)[number], string>;

/** 자주 쓰는 출처·매체 (링크 생성기의 후보) */
export const UTM_SOURCES = ['linkedin', 'github', 'velog', 'email', 'resume'] as const;
export const UTM_MEDIUMS = ['social', 'referral', 'email', 'recruit', 'cpc'] as const;

/**
 * 링크 생성기: 대상(사이트 안 경로나 전체 주소)에 utm_* 를 붙인 주소. 값은 받는 쪽과 같은 규칙(cleanUtm)으로 다듬고
 * 빈 칸은 붙이지 않는다. 대상에 이미 있던 utm_*는 바꾼다. 대상이 주소가 아니면 null
 */
export function buildUtmUrl(target: string, fields: UtmFields, origin: string): string | null {
	let url: URL;
	try {
		url = new URL(target.trim() || '/', origin);
	} catch {
		return null;
	}
	if (!/^https?:$/.test(url.protocol)) return null;
	for (const name of UTM_FIELDS) {
		const value = cleanUtm(fields[name]);
		if (value) url.searchParams.set(`utm_${name}`, value);
		else url.searchParams.delete(`utm_${name}`);
	}
	return url.toString();
}
