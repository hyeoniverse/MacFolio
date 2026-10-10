// GitHub 앱의 기여 달력과 활동 기록 (apps/api의 /github/activity). 서버에 닿지 않으면 두 부분을 숨긴다.
import { useSyncExternalStore } from 'react';
import { env } from '@/shared/config/env';
import { apiFetch } from '@/shared/api/client';
import { createStore } from '@macfolio/desktop-core';

export interface ContributionDay {
	/** YYYY-MM-DD */
	date: string;
	count: number;
	/** 0(없음) ~ 4(많음) */
	level: number;
}

export interface Contributions {
	total: number;
	days: ContributionDay[];
}

export type ActivityKind = 'push' | 'create' | 'pull' | 'issue' | 'release' | 'star' | 'fork' | 'public';

export interface ActivityItem {
	id: string;
	kind: ActivityKind;
	repo: string;
	createdAt: string;
	url: string;
	action: string | null;
	ref: string | null;
	refType: string | null;
	number: number | null;
	title: string | null;
	commits: number | null;
}

export interface Activity {
	contributions: Contributions | null;
	events: ActivityItem[];
}

export const activityStore = createStore<{ data: Activity | null }>({ data: null });

export function useActivity(): Activity | null {
	return useSyncExternalStore(activityStore.subscribe, () => activityStore.getState().data);
}

const KINDS = new Set<string>(['push', 'create', 'pull', 'issue', 'release', 'star', 'fork', 'public']);
const str = (value: unknown) => (typeof value === 'string' ? value : null);
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function toContributions(raw: unknown): Contributions | null {
	const value = raw as Partial<Contributions> | null;
	if (!value || !Array.isArray(value.days)) return null;
	const days = value.days
		.filter((day) => typeof day?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date))
		.map((day) => ({
			date: day.date,
			count: Math.max(0, num(day.count) ?? 0),
			level: Math.min(4, Math.max(0, num(day.level) ?? 0)),
		}));
	if (days.length === 0) return null;
	return { total: num(value.total) ?? days.reduce((sum, day) => sum + day.count, 0), days };
}

/** 서버가 준 활동 하나. 종류를 모르거나 GitHub 주소가 아니면 버린다 (링크로 그리므로) */
function toItem(raw: Partial<ActivityItem> | null): ActivityItem | null {
	if (!raw || !KINDS.has(String(raw.kind)) || typeof raw.repo !== 'string' || typeof raw.createdAt !== 'string')
		return null;
	if (typeof raw.url !== 'string' || !raw.url.startsWith('https://github.com/')) return null;
	return {
		id: String(raw.id),
		kind: raw.kind as ActivityKind,
		repo: raw.repo,
		createdAt: raw.createdAt,
		url: raw.url,
		action: str(raw.action),
		ref: str(raw.ref),
		refType: str(raw.refType),
		number: num(raw.number),
		title: str(raw.title),
		commits: num(raw.commits),
	};
}

/** 서버 응답 → 화면 값. 모양이 틀리면 null */
export function toActivity(raw: unknown): Activity | null {
	const value = raw as { contributions?: unknown; events?: unknown } | null;
	if (!value || !Array.isArray(value.events)) return null;
	return {
		contributions: toContributions(value.contributions),
		events: value.events.map(toItem).filter((item): item is ActivityItem => item !== null),
	};
}

/** 달력을 일요일부터 시작하는 주로 묶는다. 첫 주의 빈 날은 null */
export function toWeeks(days: ContributionDay[]): (ContributionDay | null)[][] {
	const weeks: (ContributionDay | null)[][] = [];
	let week: (ContributionDay | null)[] = [];
	if (days.length) week = Array<null>(new Date(`${days[0].date}T00:00:00Z`).getUTCDay()).fill(null);
	for (const day of days) {
		week.push(day);
		if (week.length === 7) {
			weeks.push(week);
			week = [];
		}
	}
	if (week.length) weeks.push(week);
	return weeks;
}

/**
 * 같은 날 같은 저장소에 여러 번 푸시했으면 하나로 합친다 (커밋 수를 더한다).
 * GitHub 프로필의 Contribution activity처럼 한 줄에 "커밋 N개"로 보인다
 */
export function mergePushes(events: ActivityItem[]): (ActivityItem & { pushes: number })[] {
	const result: (ActivityItem & { pushes: number })[] = [];
	for (const event of events) {
		const last = result[result.length - 1];
		if (
			event.kind === 'push' &&
			last?.kind === 'push' &&
			last.repo === event.repo &&
			last.ref === event.ref &&
			last.createdAt.slice(0, 10) === event.createdAt.slice(0, 10)
		) {
			last.pushes += 1;
			last.commits = last.commits !== null && event.commits !== null ? last.commits + event.commits : null;
			continue;
		}
		result.push({ ...event, pushes: 1 });
	}
	return result;
}

let pending: Promise<void> | null = null;

/** 서버 값을 받는다 (앱을 열 때마다. 실패하면 지금 값을 그대로 둔다) */
export function loadActivity(apiUrl = env.apiUrl, fetchImpl: typeof fetch = fetch): Promise<void> {
	if (!apiUrl) return Promise.resolve();
	pending ??= (async () => {
		try {
			const response = await apiFetch('/github/activity', { apiUrl, fetchImpl });
			if (!response.ok) return;
			const data = toActivity(await response.json());
			if (data) activityStore.setState({ data });
		} catch {
			// 서버에 닿지 않으면 달력과 활동을 보여 주지 않는다
		} finally {
			pending = null;
		}
	})();
	return pending;
}
