// RPG 대화창(DialoguePage) 무대의 주제 그림판이 쓰는 순수한 계산: 버그 몬스터·사람·상자 그림, 발판, HP, 데이터에서 센 숫자.
// (픽셀 아이콘은 dialogueIcons.ts, 무대 뒤 타일 장면은 dialogueScenes.ts)
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

/** 버그 몬스터의 몸 색 (차례로 돌려 쓴다): 무당벌레 빨강, 슬라임 초록, 유령 보라. W 몸, G 무늬, K 눈·입, R 눈동자 */
const MONSTER_COLORS: readonly Record<string, string>[] = [
	{ W: '#f05a50', G: '#3a2a3a', K: '#282830', R: '#ffffff', X: '#282830' },
	{ W: '#6cc85a', G: '#b4ec98', K: '#204028', R: '#f04040', X: '#204028' },
	{ W: '#c4b0f8', G: '#8466d8', K: '#30205a', R: '#f04040', X: '#30205a' },
];

/** 차례(index)의 몬스터 색 */
export const monsterColors = (index: number) =>
	MONSTER_COLORS[((index % MONSTER_COLORS.length) + MONSTER_COLORS.length) % MONSTER_COLORS.length];

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

/**
 * 포켓몬 전투의 발판: width×height 칸의 납작한 흙 자리. A 외곽선, B 흙, C 왼쪽 위의 밝은 흙, D 위 가장자리의 풀,
 * E 오른쪽 아래 그늘(점 무늬로 섞는다)과 작은 자갈. 색은 장면이 정한다. 몬스터·파티원·상자·초상이 그 위에 선다
 */
export function platformRows(width: number, height: number): string[] {
	const rx = width / 2;
	const ry = height / 2;
	const inside = (x: number, y: number) => ((x + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2 <= 1;
	return Array.from({ length: height }, (_, y) =>
		Array.from({ length: width }, (_, x) => {
			if (!inside(x, y)) return '.';
			const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
			if (edge) return 'A';
			// 위 가장자리 두 줄은 풀 (톱니처럼 들쭉날쭉)
			if (!inside(x, y - 2) || (!inside(x, y - 3) && x % 3 !== 1)) return 'D';
			const lx = (x + 0.5 - rx) / rx;
			const ly = (y + 0.5 - ry) / ry;
			const shade = lx * 0.6 + ly;
			if (shade > 0.75) return 'E';
			if (shade > 0.45) return (x + y) % 2 === 0 ? 'E' : 'B';
			if ((lx + 0.35) ** 2 * 1.4 + (ly + 0.1) ** 2 < 0.12) return 'C';
			return (x * 7 + y * 13) % 23 === 0 ? 'E' : 'B';
		}).join('')
	);
}

/** 발판의 색: 장면의 CSS 변수를 그대로 칠한다 (라이트·다크와 장면마다 바뀐다) */
export const PLATFORM_COLORS: Record<string, string> = {
	A: 'var(--dl-plat-rim)',
	B: 'var(--dl-plat)',
	C: 'var(--dl-plat-hi)',
	D: 'var(--dl-plat-grass)',
	E: 'var(--dl-plat-shade)',
};

/** HP 막대의 색 단계: 반이 넘으면 초록, 5분의 1이 넘으면 노랑, 그 아래는 빨강 (포켓몬처럼) */
export function hpLevel(hp: number): 'high' | 'mid' | 'low' {
	if (hp > 50) return 'high';
	if (hp > 20) return 'mid';
	return 'low';
}

/** 무대 뒤의 장면(색 띠): 주제마다 하나. 해 질 녘, 풀밭, 전투 들판, 마을 광장, 상점, 상태 창, 지도, 동굴, 오락실, 밤하늘 */
export type SceneKind = 'sunset' | 'meadow' | 'field' | 'plaza' | 'shop' | 'menu' | 'map' | 'cave' | 'arcade' | 'night';

const SCENES: Record<string, SceneKind> = {
	highlights: 'meadow',
	build: 'meadow',
	usage: 'meadow',
	troubleshooting: 'field',
	team: 'plaza',
	specs: 'shop',
	contributions: 'menu',
	controls: 'menu',
	timeline: 'map',
	deployments: 'cave',
	facts: 'arcade',
	credits: 'night',
};

/** 주제 id의 장면. 장(chapter-n)은 풀밭, 그 밖(인사, 링크, 화면 모음...)은 해 질 녘의 타이틀 */
export function sceneOf(topic: string | undefined): SceneKind {
	if (!topic) return 'sunset';
	if (/^chapter-\d+$/.test(topic)) return 'meadow';
	return SCENES[topic] ?? 'sunset';
}

/** 왼쪽 반만 그린 줄을 좌우로 접어 펼친다 (몬스터·상자·사람은 좌우가 같다) */
export const mirror = (half: readonly string[]): string[] => half.map((row) => row + [...row].reverse().join(''));

/**
 * 버그 몬스터 그림 세 가지 (32×32 칸, 왼쪽 반 16칸을 접어 펼친다). 트러블슈팅의 차례로 돌려 쓴다:
 * 첫 건은 딱정벌레, 다음은 이빨 난 슬라임, 그다음은 줄무늬 유령
 */
export const MONSTERS: readonly (readonly string[])[] = [
	mirror([
		'................',
		'................',
		'....W...........',
		'.....W..........',
		'......W.........',
		'.......W........',
		'........W.......',
		'.........W.WWWWW',
		'..........WWWWWW',
		'.........WWWWWWW',
		'........WWKKWWWW',
		'........WKRRKWWW',
		'........WKRRKWWW',
		'.........WKKWWWW',
		'..........WWWWWW',
		'...........WWWWW',
		'................',
		'........WWWWWWWK',
		'......WWWWWWWWWK',
		'.....WWWWWGGWWWK',
		'W...WWWWWGGGGWWK',
		'.W.WWWWWWWGGWWWK',
		'..WWWWWWWWWWWWWK',
		'...WWWGGWWWWWWWK',
		'W..WWGGGGWWWWWWK',
		'.WWWWWGGWWWWWWWK',
		'...WWWWWWWWGGWWK',
		'...WWWWWWWGGGGWK',
		'W...WWWWWWWGGWWK',
		'.WW..WWWWWWWWWWK',
		'.....WWWWWWWWWWW',
		'........WWWWWWWW',
	]),
	mirror([
		'................',
		'................',
		'................',
		'..............WW',
		'...........WWWWW',
		'.........WWWWWWW',
		'........WWWWWWWW',
		'.......WWWWWWWWW',
		'......WWWWWWWWWW',
		'.....WWWWWWWWWWW',
		'.....WWWWWKKKWWW',
		'....WWWWWKKRKKWW',
		'....WWWWWKRRRKWW',
		'...WWWWWWKKRKKWW',
		'...WWWWWWWKKKWWW',
		'...WWWWWWWWWWWWW',
		'..WWWWWWWWWWWWWW',
		'..WWWWWWWWKKKKKK',
		'..WWWWWWWWKWKKWK',
		'.WWWWWWWWWWKKKKK',
		'.WWWWWWWWWWWWWWW',
		'WWWWWWWWWWWWWWWW',
		'WWWWWWWWWWWWWWWW',
		'WWGWWWWWWWWWWWWW',
		'WGGWWWWWWWWWWWWW',
		'WWWWWWWWWWWWWWWW',
		'.WWWWWWWWWWWWWWW',
		'..WWW.WWWWWW.WWW',
		'..WWW..WWWW...WW',
		'...W....WW.....W',
		'...W............',
		'................',
	]),
	mirror([
		'................',
		'................',
		'..........WWWWWW',
		'.......WWWWWWWWW',
		'.....WWWWWWWWWWW',
		'....WWWWWWWWWWWW',
		'...WWWWWWWWWWWWW',
		'...WWWWWWWWWWWWW',
		'..WWWWKKKWWWWWWW',
		'..WWWKKKKKWWWWWW',
		'..WWWKKRKKWWWWWW',
		'..WWWKKKKKWWWWWW',
		'..WWWWKKKWWWWWWW',
		'..WWWWWWWWWWWWWW',
		'..WWWWWWWWWWKKKK',
		'..WWWWWWWWWKWWWW',
		'..WWWWWWWWWWWWWW',
		'..GGGGGGGGGGGGGG',
		'..WWWWWWWWWWWWWW',
		'..WWWWWWWWWWWWWW',
		'..GGGGGGGGGGGGGG',
		'..WWWWWWWWWWWWWW',
		'..WWWWWWWWWWWWWW',
		'..WWWWWWWWWWWWWW',
		'..WWWWWWWWWWWWWW',
		'..WWWWWWWWWWWWWW',
		'..WWW.WWWWW.WWWW',
		'..WW...WWW...WWW',
		'..W.....W.....WW',
		'...............W',
		'................',
		'................',
	]),
];

/** 차례(index)의 몬스터 그림 */
export const monsterOf = (index: number) => MONSTERS[((index % MONSTERS.length) + MONSTERS.length) % MONSTERS.length];

/** 보물 상자 그림 (20×16 칸): 닫힌 것과 열린 것 (열린 상자는 뚜껑이 뒤로 젖혀지고 안이 빛난다) */
export const CHEST_CLOSED: readonly string[] = mirror([
	'..........',
	'..........',
	'..........',
	'..OOOOOOOO',
	'.OBBBBBBBB',
	'.OBWBBBBBB',
	'.OBBBBBBBB',
	'.OBBBBBBBB',
	'.OYYYYYYYY',
	'.OYYYYYYYK',
	'.OBBBBBBYK',
	'.OBBBBBBYY',
	'.OBBBBBBBB',
	'.OYYBBBBBB',
	'.OOOOOOOOO',
	'..........',
]);
export const CHEST_OPEN: readonly string[] = mirror([
	'..OOOOOOOO',
	'.ODDDDDDDD',
	'.ODDDDDDDD',
	'.ODDDDDDDD',
	'.OOOOOOOOO',
	'.OKKKKKKKK',
	'.OKKYKKKKY',
	'.OKYYYKYYY',
	'.OYYYYYYYY',
	'.OYYYYYYYK',
	'.OBBBBBBYK',
	'.OBBBBBBYY',
	'.OBBBBBBBB',
	'.OYYBBBBBB',
	'.OOOOOOOOO',
	'..........',
]);

/**
 * 사람 그림 (16×24 칸, 왼쪽 반 8칸을 펼친다): H 머리카락, S 피부, E 눈, T 옷, P 바지, F 신발.
 * 색은 이름으로 정해(personColors) 같은 사람은 늘 같은 모습이다
 */
export const PERSON: readonly string[] = mirror([
	'........',
	'....HHHH',
	'..HHHHHH',
	'.HHHHHHH',
	'.HHHHHHH',
	'.HHHHHHH',
	'.HHSHHHS',
	'.HSSSSSS',
	'.HSSESSS',
	'.HSSESSS',
	'.HSSSSSS',
	'..SSSSSS',
	'....SSSS',
	'......SS',
	'...TTTTT',
	'..TTTTTT',
	'.STTTTTT',
	'.STTTTTT',
	'.STTTTTT',
	'..TTTTTT',
	'...PPPPP',
	'...PPPP.',
	'...PPPP.',
	'..FFFFF.',
]);

const HAIRS = ['#a0643c', '#e8c35a', '#d9703a', '#c0c0c0', '#6f8fd8', '#e889b8'];
const SKINS = ['#f6d1b0', '#e9b48a', '#c98d5e'];
const SHIRTS = ['#4f9de8', '#5bc06a', '#e86fae', '#f0a030', '#9b72e8', '#f05a50'];
const PANTS = ['#3c4a8c', '#6e6e6e', '#7a5232'];

/** 이름의 간단한 해시 (같은 이름은 같은 수) */
function hashOf(text: string): number {
	let hash = 7;
	for (const ch of text) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
	return hash;
}

/** 사람 그림의 색: 이름으로 머리·피부·옷·바지 색을 고른다 (사진이 없어도 사람마다 다르게) */
export function personColors(name: string): Record<string, string> {
	const hash = hashOf(name.trim() || '?');
	const pick = (list: readonly string[], shift: number) => list[Math.floor(hash / shift) % list.length];
	return {
		H: pick(HAIRS, 1),
		S: pick(SKINS, 7),
		E: '#282830',
		T: pick(SHIRTS, 23),
		P: pick(PANTS, 101),
		F: '#5a4a48',
		X: '#282830',
	};
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
