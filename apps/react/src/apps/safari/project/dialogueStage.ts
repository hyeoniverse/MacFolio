// RPG 대화창(DialoguePage) 무대의 주제 그림판이 쓰는 순수한 계산: 기술 아이콘, 버그 몬스터 그림, HP, 데이터에서 센 숫자.
// 그림판은 꾸밈이라 숫자는 데이터에 있는 것을 세기만 하고 이름을 그대로 붙인다 (지어낸 레벨·점수는 없다)
import type { Project, ProjectTrouble } from '@/shared/profile';
import type { TroubleStepKey } from '@/apps/safari/project/landing/content';

/** 아는 기술 이름 → Font Awesome 브랜드 아이콘 (FA Free 6에 있는 것만). 앞에서부터 처음 맞는 것 */
const TECH_ICONS: [RegExp, string][] = [
	[/^react( native)?$|^react\b/, 'fa-react'],
	[/^node(\.js)?$|^nodejs$|^express$/, 'fa-node-js'],
	[/^npm$|^pnpm$/, 'fa-npm'],
	[/^yarn$/, 'fa-yarn'],
	[/^javascript$|^js$/, 'fa-js'],
	[/^python$|^django$|^fastapi$|^flask$/, 'fa-python'],
	[/^java$|^spring( boot)?$/, 'fa-java'],
	[/^docker( compose)?$/, 'fa-docker'],
	[/^aws$|^amazon web services$|^s3$|^ec2$|^lambda$/, 'fa-aws'],
	[/^github( actions)?$/, 'fa-github'],
	[/^git$/, 'fa-git-alt'],
	[/^unity$/, 'fa-unity'],
	[/^vue(\.js)?$|^nuxt$/, 'fa-vuejs'],
	[/^angular$/, 'fa-angular'],
	[/^html5?$/, 'fa-html5'],
	[/^css3?$/, 'fa-css3-alt'],
	[/^sass$|^scss$/, 'fa-sass'],
	[/^less$/, 'fa-less'],
	[/^figma$/, 'fa-figma'],
	[/^swift$|^swiftui$/, 'fa-swift'],
	[/^android$|^kotlin$/, 'fa-android'],
	[/^ios$/, 'fa-apple'],
	[/^go$|^golang$/, 'fa-golang'],
	[/^rust$/, 'fa-rust'],
	[/^php$/, 'fa-php'],
	[/^laravel$/, 'fa-laravel'],
	[/^bootstrap$/, 'fa-bootstrap'],
	[/^wordpress$/, 'fa-wordpress'],
	[/^flutter$/, 'fa-flutter'],
	[/^dart$/, 'fa-dart'],
	[/^linux$/, 'fa-linux'],
	[/^ubuntu$/, 'fa-ubuntu'],
	[/^cloudflare( workers| pages)?$/, 'fa-cloudflare'],
	[/^gulp$/, 'fa-gulp'],
	[/^stripe$/, 'fa-stripe'],
	[/^slack$/, 'fa-slack'],
	[/^discord(\.js)?$/, 'fa-discord'],
	[/^google( cloud)?$|^gcp$/, 'fa-google'],
];

/** 기술 이름을 견주기 좋게: 소문자, 버전 숫자와 괄호 설명은 뺀다 (Unity 6 → unity, React 19 → react) */
export const techKey = (name: string) =>
	name
		.toLowerCase()
		.replace(/\(.*?\)/g, '')
		.replace(/\s+v?\d+(\.\d+)*$/, '')
		.trim();

/** 기술의 브랜드 아이콘 (fa-brands와 함께 쓴다). 모르면 null: 그때는 첫 글자 칸을 그린다 */
export function techIcon(name: string): string | null {
	const key = techKey(name);
	if (!key) return null;
	return TECH_ICONS.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}

/** 첫 글자 칸에 쓸 글자 (영어는 대문자) */
export const letterOf = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

/** 사양 한 줄(분류, 값)의 장비 칸 아이콘: 값의 첫 기술이 아는 것이면 그 브랜드, 아니면 분류 이름으로 고른 기본 아이콘 */
export function slotIcon(label: string, value: string): { brand: boolean; icon: string } {
	const first = value.split(/[,·/]/)[0] ?? '';
	const brand = techIcon(first);
	if (brand) return { brand: true, icon: brand };
	const key = label.toLowerCase();
	const table: [RegExp, string][] = [
		[/화면|프론트|front|ui|입력/, 'fa-display'],
		[/서버|백엔드|back|api/, 'fa-server'],
		[/db|데이터|저장/, 'fa-database'],
		[/배포|deploy|호스팅/, 'fa-rocket'],
		[/상태|state/, 'fa-diagram-project'],
		[/인증|보안|auth/, 'fa-key'],
		[/스타일|디자인|style/, 'fa-palette'],
		[/엔진|engine|렌더/, 'fa-gear'],
		[/ai|인공지능/, 'fa-robot'],
		[/맵|지도|map/, 'fa-map'],
		[/언어|lang/, 'fa-code'],
		[/qr/, 'fa-qrcode'],
		[/시험|테스트|test/, 'fa-vial'],
	];
	return { brand: false, icon: table.find(([pattern]) => pattern.test(key))?.[1] ?? 'fa-cube' };
}

/**
 * 버그 몬스터 그림 세 가지 (16×16 칸). 글자 하나가 한 칸: '.'은 빈칸, W 흰색, R 빨강, Y 노랑.
 * 트러블슈팅의 차례로 돌려 쓴다 (첫 건은 딱정벌레, 다음은 슬라임, 그다음은 유령)
 */
export const MONSTERS: readonly (readonly string[])[] = [
	[
		'................',
		'...W........W...',
		'....W......W....',
		'.....WWWWWW.....',
		'....WWWWWWWW....',
		'...WW..WW..WW...',
		'...WW.RWWR.WW...',
		'.W.WWWWWWWWWW.W.',
		'..WWWWWWWWWWWW..',
		'...WWWWW.WWWW...',
		'.W.WWWWW.WWWW.W.',
		'..WWWWWW.WWWWW..',
		'...WWWWW.WWWW...',
		'.W..WWWWWWWW..W.',
		'......WWWW......',
		'................',
	],
	[
		'................',
		'................',
		'.......YY.......',
		'......WWWW......',
		'.....WWWWWW.....',
		'....WWWWWWWW....',
		'...WWWWWWWWWW...',
		'...WW..WW..WW...',
		'..WWW..WW..WWW..',
		'..WWWWWWWWWWWW..',
		'.WWWWWRRRRWWWWW.',
		'.WWWWWWRRWWWWWW.',
		'WWWWWWWWWWWWWWWW',
		'WWWWWWWWWWWWWWWW',
		'.WW.WWWWWWWW.WW.',
		'................',
	],
	[
		'................',
		'.....WWWWWW.....',
		'...WWWWWWWWWW...',
		'..WWWWWWWWWWWW..',
		'..WW...WW...WW..',
		'.WWW.R.WW.R.WWW.',
		'.WWW...WW...WWW.',
		'.WWWWWWWWWWWWWW.',
		'.WWWWWWWWWWWWWW.',
		'.WWWW.W..W.WWWW.',
		'.WWWWW.WW.WWWWW.',
		'.WWWWWWWWWWWWWW.',
		'.WWWWWWWWWWWWWW.',
		'.WW.WWW..WWW.WW.',
		'.W...W....W...W.',
		'................',
	],
];

/** 몬스터 칸 색 */
export const MONSTER_COLORS: Record<string, string> = { W: '#ffffff', R: '#ff0000', Y: '#ffff00' };

/** 차례(index)의 몬스터 그림 */
export const monsterOf = (index: number) => MONSTERS[((index % MONSTERS.length) + MONSTERS.length) % MONSTERS.length];

/** 보물 상자 그림 (16×12 칸): 닫힌 것과 열린 것. 칸 글자는 몬스터와 같다 */
export const CHEST_CLOSED: readonly string[] = [
	'................',
	'................',
	'..YYYYYYYYYYYY..',
	'.YWWWWWWWWWWWWY.',
	'.YWWWWWWWWWWWWY.',
	'.YYYYYYYYYYYYYY.',
	'.YWWWWWYYWWWWWY.',
	'.YWWWWYRRYWWWWY.',
	'.YWWWWWYYWWWWWY.',
	'.YWWWWWWWWWWWWY.',
	'.YYYYYYYYYYYYYY.',
	'................',
];
export const CHEST_OPEN: readonly string[] = [
	'..YYYYYYYYYYYY..',
	'.YWWWWWWWWWWWWY.',
	'.YYYYYYYYYYYYYY.',
	'....Y......Y....',
	'..Y...Y..Y...Y..',
	'.YYYYYYYYYYYYYY.',
	'.Y............Y.',
	'.YYYYYYYYYYYYYY.',
	'.YWWWWWWWWWWWWY.',
	'.YWWWWWWWWWWWWY.',
	'.YYYYYYYYYYYYYY.',
	'................',
];

/** 칸 그림 한 줄을 같은 색끼리 이어진 칸(x, 너비, 색)으로 (SVG 사각형 수를 줄인다) */
export function pixelRuns(rows: readonly string[]): { x: number; y: number; w: number; color: string }[] {
	const runs: { x: number; y: number; w: number; color: string }[] = [];
	rows.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			const ch = row[x];
			let end = x + 1;
			while (end < row.length && row[end] === ch) end++;
			if (ch !== '.' && MONSTER_COLORS[ch]) runs.push({ x, y, w: end - x, color: MONSTER_COLORS[ch] });
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

/**
 * 무대 높이(room, px)에 들어가는 목록 줄 수: 창 머리줄과 여백(chrome)을 빼고 한 줄 높이(row)로 나눈다.
 * 적어도 한 줄, 많아야 max줄. 높이를 모르면 max
 */
export function rowsFor(room: number | undefined, row: number, chrome: number, max: number): number {
	if (!room || room <= 0) return max;
	return Math.max(1, Math.min(max, Math.floor((room - chrome) / row)));
}
