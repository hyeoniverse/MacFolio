// devtool 템플릿의 순수한 조각: 제목에서 뽑는 커밋 해시, 폴더 구조 글을 트리 줄로, 날짜로 짜는 기여 그래프, 기능 제목으로 만드는 작은 diff.
// 같은 내용이면 언제나 같은 결과가 나온다 (무작위 없이 제목·날짜의 해시만 쓴다). 단위 시험은 code.test.ts
import type React from 'react';

/** FNV-1a 32비트 해시 (같은 글이면 같은 값) */
export function hashOf(text: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i += 1) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** 커밋 해시처럼 보이는 일곱 자리 16진수 */
export const commitHash = (text: string) =>
	(hashOf(text).toString(16) + hashOf(`${text}#`).toString(16)).padStart(14, '0').slice(0, 7);

/** 저장소 주소 → git clone 명령 (GitHub 주소면 .git을 붙인다) */
export const cloneCommand = (href: string) => {
	const url = href.replace(/\/+$/, '');
	return `git clone ${/github\.com\/[^/]+\/[^/]+$/.test(url) && !url.endsWith('.git') ? `${url}.git` : url}`;
};

/* ─── 폴더 구조 ─── */

export interface TreeRow {
	/** 0부터 시작하는 깊이 */
	depth: number;
	name: string;
	/** `#` 또는 `//` 뒤의 설명 */
	note?: string;
	folder: boolean;
}

/** 줄 앞의 트리 그림 글자 (├── │ └──)와 공백 */
const PREFIX = /^[\s│├└─|`+\\-]*/;

/**
 * `tree` 명령 모양의 글 → 줄 목록. 앞의 그림 글자 너비(4칸에 한 단계)로 깊이를 정하고, 이름 뒤의 `#`·`//` 설명을 떼어 낸다.
 * 이름이 `/`로 끝나거나 다음 줄이 더 깊으면 폴더다. 빈 줄은 건너뛴다
 */
export function parseTree(text: string): TreeRow[] {
	const rows = text
		.split('\n')
		.map((line) => line.replace(/\s+$/, ''))
		.filter((line) => line.trim())
		.map((line) => {
			const prefix = PREFIX.exec(line)?.[0] ?? '';
			const rest = line.slice(prefix.length);
			const split = /\s+(#|\/\/)\s?(.*)$/.exec(rest);
			const name = (split ? rest.slice(0, split.index) : rest).trim();
			const note = split?.[2]?.trim();
			return { depth: Math.round(prefix.length / 4), name, ...(note ? { note } : {}), folder: name.endsWith('/') };
		});
	return rows.map((row, i) => (rows[i + 1] && rows[i + 1].depth > row.depth ? { ...row, folder: true } : row));
}

/* ─── 기여 그래프 ─── */

/** 'YYYY.MM.DD'·'YYYY-MM-DD'·'YYYY/MM/DD' (달·해만 있어도 첫날로) → 날짜. 못 읽으면 null */
export function parseDate(text: string): Date | null {
	const match = /(\d{4})[.\-/년\s]*(\d{1,2})?(?:[.\-/월\s]*(\d{1,2}))?/.exec(text);
	if (!match) return null;
	const date = new Date(Date.UTC(Number(match[1]), Number(match[2] ?? 1) - 1, Number(match[3] ?? 1)));
	return Number.isNaN(date.getTime()) ? null : date;
}

const DAY = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);

export interface GraphCell {
	date: string;
	/** 0(없음)~4(가장 많음) */
	level: number;
	/** 진행 과정의 한 걸음이 있는 날 */
	milestone: boolean;
}

export interface Graph {
	/** 주마다 일곱 칸 (일요일부터) */
	weeks: GraphCell[][];
	/** 달이 바뀌는 주의 자리와 달 이름 */
	months: { week: number; label: string }[];
	/** 기간 안의 기여 수 (보이는 숫자) */
	total: number;
}

/**
 * 진행 과정의 날짜로 짜는 GitHub식 기여 그래프. 첫 날짜가 든 주부터 마지막 날짜가 든 주까지(적어도 minWeeks주, 많아야 53주)
 * 칸마다 날짜 해시로 정한 옅은 기여를 깔고, 걸음이 있는 날과 그 앞 며칠은 진하게 한다. 날짜를 하나도 못 읽으면 null
 */
export function contributionGraph(entries: { date: string; label: string }[], minWeeks = 24): Graph | null {
	const dates = entries.map((entry) => parseDate(entry.date)).filter((date): date is Date => Boolean(date));
	if (!dates.length) return null;
	const times = dates.map((date) => date.getTime());
	const first = Math.min(...times);
	const last = Math.max(...times);
	const milestones = new Set(dates.map(iso));
	const startOfWeek = (time: number) => time - new Date(time).getUTCDay() * DAY;
	let start = startOfWeek(first);
	const span = Math.round((startOfWeek(last) - start) / DAY / 7) + 1;
	const count = Math.min(53, Math.max(minWeeks, span));
	// 짧은 기간은 앞뒤로 고르게 여유를 둔다
	start -= Math.floor((count - Math.min(span, count)) / 2) * 7 * DAY;
	const weeks: GraphCell[][] = [];
	const months: Graph['months'] = [];
	let total = 0;
	let month = -1;
	for (let w = 0; w < count; w += 1) {
		const week: GraphCell[] = [];
		for (let d = 0; d < 7; d += 1) {
			const time = start + (w * 7 + d) * DAY;
			const date = new Date(time);
			const key = iso(date);
			const inside = time >= first - 3 * DAY && time <= last;
			const milestone = milestones.has(key);
			const near = [1, 2, 3].some((back) => milestones.has(iso(new Date(time + back * DAY))));
			const noise = hashOf(key) % 20;
			let level = 0;
			if (milestone) level = 4;
			else if (inside && near) level = 2 + (noise % 2);
			else if (inside) level = noise < 9 ? 0 : noise < 15 ? 1 : noise < 19 ? 2 : 3;
			// 주말은 한 단계 옅게
			if (!milestone && (d === 0 || d === 6)) level = Math.max(0, level - 1);
			total += level ? level * 2 - 1 : 0;
			week.push({ date: key, level, milestone });
		}
		const firstDay = new Date(start + w * 7 * DAY);
		if (firstDay.getUTCMonth() !== month) {
			month = firstDay.getUTCMonth();
			// 앞 이름과 세 주 안으로 붙으면 앞 것을 지운다 (글자가 겹치지 않게), 맨 끝 두 주에는 새 이름을 두지 않는다
			const previous = months[months.length - 1];
			if (previous && w - previous.week < 3) months.pop();
			if (w < count - 2) months.push({ week: w, label: `${month + 1}월` });
		}
		weeks.push(week);
	}
	return { weeks, months, total };
}

/* ─── 기능 diff ─── */

export interface DiffLine {
	sign: ' ' | '+' | '-' | '@';
	text: string;
}

/** 제목 → 코드 이름 (영문 낱말이면 camelCase, 아니면 차례 번호) */
function identifierOf(title: string, index: number): string {
	const words = title.match(/[A-Za-z][A-Za-z0-9]*/g);
	if (!words) return `feature${String(index + 1).padStart(2, '0')}`;
	return words.map((word, i) => (i ? word[0].toUpperCase() + word.slice(1) : word.toLowerCase())).join('');
}

/** 따옴표 안에 넣을 수 있게 줄인 글 */
const quote = (text: string, max = 28) => {
	const flat = text.replace(/\s+/g, ' ').replace(/'/g, '’').trim();
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/**
 * 그림이 없는 기능 카드의 작은 diff: 그 기능을 켜는 설정 한 덩어리가 더해진 모양. 줄 번호와 바뀐 줄 수는 제목의 해시로 정한다 (장식)
 */
export function featureDiff(point: { title: string; body: string; icon?: string }, index: number): DiffLine[] {
	const hash = hashOf(point.title);
	const line = 8 + (hash % 90);
	const name = identifierOf(point.title, index);
	return [
		{ sign: '@', text: `@@ -${line},3 +${line},6 @@` },
		{ sign: ' ', text: 'export const features = {' },
		{ sign: '-', text: `  ${name}: false,` },
		{ sign: '+', text: `  ${name}: {` },
		{ sign: '+', text: `    title: '${quote(point.title, 22)}',` },
		{ sign: '+', text: `    note: '${quote(point.body)}',` },
		{ sign: '+', text: '  },' },
		{ sign: ' ', text: '};' },
	];
}

/** CSS 변수 묶음 (style에 단다) */
export const vars = (values: Record<string, string | number>) => values as React.CSSProperties;
