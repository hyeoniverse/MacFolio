// GitHub 앱의 기여 달력(잔디)과 최근 활동. Nest와 DB에 의존하지 않는다.

export interface ContributionDay {
	/** YYYY-MM-DD */
	date: string;
	count: number;
	/** 0(없음) ~ 4(많음). GitHub 달력의 색 단계 */
	level: number;
}

export interface Contributions {
	/** 지난 1년의 기여 수 */
	total: number;
	/** 날짜 순서. 첫날은 일요일이 아닐 수 있다 (주 묶음은 화면이 한다) */
	days: ContributionDay[];
}

export type ActivityKind = 'push' | 'create' | 'pull' | 'issue' | 'release' | 'star' | 'fork' | 'public';

export interface ActivityItem {
	id: string;
	kind: ActivityKind;
	/** owner/이름 */
	repo: string;
	createdAt: string;
	/** 누르면 갈 곳 (커밋 목록, PR, 이슈, 릴리스, 저장소) */
	url: string;
	/** pull·issue: opened | closed | reopened | merged */
	action: string | null;
	/** push: 브랜치, create: 만든 브랜치·태그, release: 태그 */
	ref: string | null;
	/** create: repository | branch | tag */
	refType: string | null;
	/** pull·issue 번호 */
	number: number | null;
	/** pull·issue·release 제목, push는 마지막 커밋 메시지 첫 줄 */
	title: string | null;
	/** push: 커밋 수 (GitHub가 알려 주지 않으면 null) */
	commits: number | null;
}

/** 보여 줄 활동 수 */
export const MAX_ACTIVITY = 30;

const decode = (value: string) =>
	value
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");

const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;

/**
 * github.com/users/<계정>/contributions 의 HTML → 기여 달력.
 * 날짜 칸(<td data-date data-level id>)과 그 칸의 설명(<tool-tip for="id">3 contributions on …</tool-tip>)을 읽는다.
 * 모양을 읽지 못하면 null (GitHub가 화면을 바꾼 경우. 화면은 달력을 숨긴다)
 */
export function parseContributions(html: string): Contributions | null {
	const counts = new Map<string, number>();
	for (const match of html.matchAll(/<tool-tip\b([^>]*)>([^<]*)<\/tool-tip>/g)) {
		const target = attribute(match[1], 'for');
		if (!target) continue;
		const number = decode(match[2])
			.trim()
			.match(/^([\d,]+) contributions?\b/);
		counts.set(target, number ? Number(number[1].replace(/,/g, '')) : 0);
	}

	const days: ContributionDay[] = [];
	for (const match of html.matchAll(/<td\b[^>]*\sdata-date="[^"]*"[^>]*>/g)) {
		const tag = match[0];
		const date = attribute(tag, 'data-date');
		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
		const level = Math.min(4, Math.max(0, Number(attribute(tag, 'data-level') ?? 0) || 0));
		const id = attribute(tag, 'id');
		days.push({ date, level, count: (id && counts.get(id)) || 0 });
	}
	if (days.length === 0) return null;
	days.sort((a, b) => a.date.localeCompare(b.date));

	const total = html.match(/([\d,]+)\s+contributions?\s+in the last year/);
	return {
		total: total ? Number(total[1].replace(/,/g, '')) : days.reduce((sum, day) => sum + day.count, 0),
		days,
	};
}

type Json = Record<string, unknown>;
const object = (value: unknown): Json => (value && typeof value === 'object' ? (value as Json) : {});
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const httpUrl = (value: unknown) => {
	const url = text(value);
	return url && /^https:\/\/github\.com\//.test(url) ? url : null;
};
const firstLine = (value: unknown) => text(value)?.split('\n')[0] ?? null;

/** GET /users/<계정>/events/public 의 이벤트 하나 → 활동. 보여 주지 않는 종류는 null */
export function toActivity(raw: Json): ActivityItem | null {
	const repo = text(object(raw.repo).name);
	const id = text(raw.id) ?? (number(raw.id) !== null ? String(raw.id) : null);
	const createdAt = text(raw.created_at);
	if (!repo || !id || !createdAt || raw.public === false) return null;
	const payload = object(raw.payload);
	const repoUrl = `https://github.com/${repo}`;
	const base = {
		id,
		repo,
		createdAt,
		url: repoUrl,
		action: null,
		ref: null,
		refType: null,
		number: null,
		title: null,
		commits: null,
	};

	switch (raw.type) {
		case 'PushEvent': {
			const branch = text(payload.ref)?.replace(/^refs\/heads\//, '') ?? null;
			const commits = Array.isArray(payload.commits) ? payload.commits : null;
			return {
				...base,
				kind: 'push',
				ref: branch,
				url: branch ? `${repoUrl}/commits/${encodeURIComponent(branch)}` : repoUrl,
				commits: number(payload.size) ?? commits?.length ?? null,
				title: commits?.length ? firstLine(object(commits[commits.length - 1]).message) : null,
			};
		}
		case 'CreateEvent': {
			const refType = text(payload.ref_type);
			const ref = text(payload.ref);
			return {
				...base,
				kind: 'create',
				refType,
				ref,
				url: ref && refType === 'branch' ? `${repoUrl}/tree/${encodeURIComponent(ref)}` : repoUrl,
			};
		}
		case 'PullRequestEvent':
		case 'IssuesEvent': {
			const pull = raw.type === 'PullRequestEvent';
			const target = object(pull ? payload.pull_request : payload.issue);
			const merged = pull && payload.action === 'closed' && target.merged === true;
			return {
				...base,
				kind: pull ? 'pull' : 'issue',
				action: merged ? 'merged' : text(payload.action),
				number: number(target.number) ?? number(payload.number),
				title: text(target.title),
				url: httpUrl(target.html_url) ?? repoUrl,
			};
		}
		case 'ReleaseEvent': {
			const release = object(payload.release);
			return {
				...base,
				kind: 'release',
				ref: text(release.tag_name),
				title: text(release.name) ?? text(release.tag_name),
				url: httpUrl(release.html_url) ?? repoUrl,
			};
		}
		case 'WatchEvent':
			return { ...base, kind: 'star' };
		case 'ForkEvent': {
			const forkee = object(payload.forkee);
			return { ...base, kind: 'fork', ref: text(forkee.full_name), url: httpUrl(forkee.html_url) ?? repoUrl };
		}
		case 'PublicEvent':
			return { ...base, kind: 'public' };
		default:
			return null;
	}
}

/** 이벤트 목록 → 보여 줄 활동 (최근 것부터, MAX_ACTIVITY개까지) */
export function toActivities(events: Json[]): ActivityItem[] {
	return events
		.map(toActivity)
		.filter((item): item is ActivityItem => item !== null)
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		.slice(0, MAX_ACTIVITY);
}
