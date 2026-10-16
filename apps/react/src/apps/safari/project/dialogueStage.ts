// RPG 대화창(DialoguePage) 무대의 주제 그림판이 쓰는 순수한 계산: HP, 그림 크기, 데이터에서 센 숫자, 글 줄바꿈.
// (그림은 Ninja Adventure 묶음 dialogueNinja.ts, 픽셀 아이콘은 dialogueIcons.ts, 무대 뒤는 마을 dialogueVillage.ts)
// 그림판은 꾸밈이라 숫자는 데이터에 있는 것을 세기만 하고 이름을 그대로 붙인다 (지어낸 레벨·점수는 없다)
import type { Project, ProjectTrouble } from '@/shared/profile';
import type { TroubleStepKey } from '@/apps/safari/project/landing/content';

/**
 * 칸 그림의 색 (글자 하나가 한 칸, '.'은 빈칸). 밝은 하늘·풀밭 위에서도 읽히게 짙은 외곽선(X)을 두르고 색은 또렷하게.
 * W 하양, K 짙은 먹색(눈·입), R 빨강, Y 금색, G 회색, D 상자 안쪽, B 나무, O 짙은 나무, X 외곽선
 */
export const SPRITE_COLORS: Record<string, string> = {
	W: '#ffffff',
	K: '#282830',
	R: '#f04040',
	Y: '#f8c830',
	G: '#a0a0a8',
	D: '#6a4024',
	B: '#d08840',
	O: '#603418',
	X: '#282830',
};

/** 그림 둘레에 한 칸 외곽선(mark)을 두른다: 가장자리에 한 칸씩 늘리고, 칠한 칸과 위·아래·옆으로 닿은 빈칸을 mark로 */
export function outlined(rows: readonly string[], mark = 'X'): string[] {
	const width = (rows[0]?.length ?? 0) + 2;
	const grid = ['.'.repeat(width), ...rows.map((row) => `.${row}.`), '.'.repeat(width)];
	const filled = (x: number, y: number) => {
		const ch = grid[y]?.[x];
		return ch !== undefined && ch !== '.';
	};
	return grid.map((row, y) =>
		[...row]
			.map((ch, x) =>
				ch === '.' && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) ? mark : ch
			)
			.join('')
	);
}

/** HP 막대의 색 단계: 반이 넘으면 초록, 5분의 1이 넘으면 노랑, 그 아래는 빨강 (포켓몬처럼) */
export function hpLevel(hp: number): 'high' | 'mid' | 'low' {
	if (hp > 50) return 'high';
	if (hp > 20) return 'mid';
	return 'low';
}

/** 무대에 띄우는 그림(또는 영상) 한 장. caption이 있으면 그림 아래에 작게 적는다 */
export interface Slide {
	src: string;
	caption?: string;
	video?: boolean;
}

/** 페이지 위의 사각형 (실제 px) */
export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * 그림이 키울 수 있는 가장 큰 배: 그림은 게임 화면처럼 정수 배로 키우지 않고 실제 px로 띄우므로, 원래 크기보다 많이 키우면
 * 흐려진다. 작은 그림은 이만큼까지만 키운다
 */
export const PHOTO_MAX_UP = 1.5;

/**
 * 그림(원래 크기 nw×nh)을 maxW×maxH 안에 비율을 지켜 가장 크게 (원래 크기의 up배를 넘지 않는다). 정수 px, 한 변이 0이면 0×0
 */
export function fitPhoto(nw: number, nh: number, maxW: number, maxH: number, up = PHOTO_MAX_UP) {
	if (!(nw > 0 && nh > 0 && maxW > 0 && maxH > 0)) return { w: 0, h: 0 };
	const scale = Math.min(maxW / nw, maxH / nh, up);
	return { w: Math.max(1, Math.floor(nw * scale)), h: Math.max(1, Math.floor(nh * scale)) };
}

/** 칸 그림 한 줄을 같은 색끼리 이어진 칸(x, 너비, 색)으로 (SVG 사각형 수를 줄인다). 모르는 글자는 빈칸 */
export function pixelRuns(
	rows: readonly string[],
	colors: Record<string, string> = SPRITE_COLORS
): { x: number; y: number; w: number; color: string }[] {
	const runs: { x: number; y: number; w: number; color: string }[] = [];
	rows.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			const ch = row[x];
			let end = x + 1;
			while (end < row.length && row[end] === ch) end++;
			if (ch !== '.' && colors[ch]) runs.push({ x, y, w: end - x, color: colors[ch] });
			x = end;
		}
	});
	return runs;
}

/**
 * 트러블슈팅 한 건의 HP(0–100): 이 건에 있는 단계들 중 지금 단계의 차례로 줄어든다.
 * 첫 단계(문제)는 가득, 마지막 단계는 0. 단계가 하나뿐이면 가득. 모르는 단계면 가득
 */
export function battleHp(steps: readonly TroubleStepKey[], current: TroubleStepKey | undefined): number {
	const at = current ? steps.indexOf(current) : -1;
	if (at < 0 || steps.length < 2) return 100;
	return Math.round(100 * (1 - at / (steps.length - 1)));
}

/** 트러블슈팅 한 건에서 글이 있는 단계들 (문제 → 원인 → 해결 → 결과 차례, 빈 단계는 뺀다) */
export const troubleKeys = (item: ProjectTrouble): TroubleStepKey[] =>
	(['problem', 'cause', 'solution', 'result'] as const).filter((key) => Boolean(item[key]?.trim()));

/** 'YYYY.MM.DD – YYYY.MM.DD' 같은 기간의 날수 (첫날과 끝날 모두 센다). 읽을 수 없으면 null */
export function periodDays(period: string | undefined): number | null {
	const dates = (period ?? '').match(/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/g);
	if (!dates || dates.length < 2) return null;
	const toTime = (text: string) => {
		const [y, m, d] = text.split(/[.\-/]/).map(Number);
		return Date.UTC(y, m - 1, d);
	};
	const days = Math.round((toTime(dates[1]) - toTime(dates[0])) / 86_400_000) + 1;
	return days > 0 ? days : null;
}

/** 상태 창의 능력치: 데이터에 있는 것을 센 숫자만, 이름을 그대로 붙인다. 없는 것은 뺀다 */
export function statusStats(project: Project): { label: string; value: string }[] {
	const stats: { label: string; value: string }[] = [];
	const add = (label: string, count: number, unit: string) => {
		if (count > 0) stats.push({ label, value: `${count.toLocaleString('ko-KR')}${unit}` });
	};
	add('맡은 일', project.contributions.length, '가지');
	add('함께한 사람', project.team?.length ?? 0, '명');
	add('쓴 기술', project.stack.filter((s) => s.trim()).length, '개');
	add('해결한 문제', project.troubleshooting?.length ?? 0, '건');
	add('만든 기간', periodDays(project.period) ?? 0, '일');
	return stats;
}

/** 숫자 기록 하나를 앞말·숫자·뒷말로 (큰 숫자로 그리려고). 숫자가 없으면 null (약 18분 → 약 / 18 / 분) */
export function splitScore(value: string): { lead: string; num: string; tail: string } | null {
	const match = /^(\D*?)(\d[\d,.]*)(.*)$/.exec(value.trim());
	if (!match) return null;
	return { lead: match[1], num: match[2], tail: match[3] };
}

/** 목록이 길 때 지금 줄(at)이 보이게 size개만 보여 줄 범위 [start, end) */
export function windowAround(count: number, at: number, size: number): [number, number] {
	if (count <= size) return [0, count];
	const start = Math.min(Math.max(0, at - Math.floor((size - 1) / 2)), count - size);
	return [start, start + size];
}

// ─── 대화 상자의 글 나누기: 갈무리11 11px의 글자 폭으로 줄을 어림해, 한 장에 두 줄씩 넘긴다 ───

/**
 * 글자 하나의 폭(게임 칸)을 넉넉하게 어림한다: 한글과 그 밖의 넓은 글자는 11, 빈칸은 4.6, 좁은 글자(.,:il 등)는 4.6,
 * 넓은 로마자(mwMW@%)는 9.2, 나머지 로마자·숫자는 7.4. 실제 폭보다 작게 잡지 않아 어림한 줄 수가 실제보다 적지 않다
 */
export function glyphWidth(ch: string): number {
	if (ch === ' ') return 4.6;
	if (ch.charCodeAt(0) > 0x7e) return 11;
	if (/[.,:;'!|il()[\]`]/.test(ch)) return 4.6;
	if (/[mwMW@%]/.test(ch)) return 9.2;
	return 7.4;
}

/** 글의 폭(게임 칸) */
export const textWidth = (text: string) => [...text].reduce((sum, ch) => sum + glyphWidth(ch), 0);

/**
 * 글을 width 칸 폭의 줄로 나눈다 (word-break: keep-all처럼 빈칸에서만 자르고, 한 낱말이 한 줄보다 길면 글자로 자른다).
 * 브라우저는 같은 자리나 더 뒤에서 줄을 바꾸므로 실제 줄 수는 이보다 많지 않다
 */
export function wrapText(text: string, width: number): string[] {
	const lines: string[] = [];
	let line = '';
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const joined = line ? `${line} ${word}` : word;
		if (textWidth(joined) <= width) {
			line = joined;
			continue;
		}
		if (line) lines.push(line);
		let rest = word;
		while (textWidth(rest) > width) {
			let cut = 1;
			while (cut < rest.length - 1 && textWidth(rest.slice(0, cut + 1)) <= width) cut++;
			lines.push(rest.slice(0, cut));
			rest = rest.slice(cut);
		}
		line = rest;
	}
	if (line || lines.length === 0) lines.push(line);
	return lines;
}

/**
 * 긴 글을 대화 상자 한 장(perPage줄)씩 나눈다. 문장(마침표·물음표 뒤 빈칸)은 되도록 한 장에 이어 담고,
 * 한 문장이 한 장보다 길면 줄 단위로 나눈다. 빈 글은 빈 장 하나
 */
export function paginate(body: string, width: number, perPage = 2): string[] {
	const text = body.replace(/\s+/g, ' ').trim();
	if (!text) return [''];
	const fits = (t: string) => wrapText(t, width).length <= perPage;
	const pages: string[] = [];
	let page = '';
	for (const sentence of text.split(/(?<=[.!?])\s+/)) {
		const joined = page ? `${page} ${sentence}` : sentence;
		if (fits(joined)) {
			page = joined;
			continue;
		}
		if (page) pages.push(page);
		if (fits(sentence)) {
			page = sentence;
			continue;
		}
		const lines = wrapText(sentence, width);
		for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage).join(' '));
		// 마지막 조각은 다음 문장과 한 장에 이어질 수 있다
		page = pages.pop() ?? '';
	}
	if (page) pages.push(page);
	return pages;
}

/** 길잡이·안내 글에 넣는 이름: max자보다 길면 줄임표 */
export const shorten = (text: string, max: number) =>
	[...text].length > max ? `${[...text].slice(0, max - 1).join('')}…` : text;

/**
 * 메뉴에서 다음에 읽을 주제(NEXT): after(방금 다 읽은 주제) 다음부터 차례로 돌아 아직 안 읽은 첫 주제.
 * after가 목록에 없으면 처음부터. 셀 수 없는 줄(링크, 돌아가기)은 건너뛴다
 */
export function nextUnread<T extends { id: string }>(
	list: readonly T[],
	read: ReadonlySet<string>,
	after?: string,
	skip: ReadonlySet<string> = new Set()
): T | undefined {
	const from = after ? list.findIndex((t) => t.id === after) + 1 : 0;
	for (let k = 0; k < list.length; k++) {
		const topic = list[(from + k) % list.length];
		if (!skip.has(topic.id) && !read.has(topic.id)) return topic;
	}
	return undefined;
}
