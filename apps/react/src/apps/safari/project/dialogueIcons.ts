// RPG 대화창(DialoguePage)의 픽셀 아이콘: 12×12 칸 그림(안쪽 10×10을 그리고 짙은 외곽선 한 칸을 두른다)과 3×5 픽셀 글자.
// Font Awesome 대신 무대의 모든 아이콘(퀘스트, 전투 메뉴, 장비·기술 칸, 보물, 지도)을 이것으로 그린다.
// 아이콘 이름(fa-*)과 기술 이름을 가장 가까운 픽셀 아이콘으로 옮기고, 모르는 기술은 색 칸에 첫 글자를 픽셀 글자로 찍는다
import { outlined } from '@/apps/safari/project/dialogueStage';

/** 아이콘 칸의 색 (글자 하나가 한 칸, '.'은 빈칸). 빛은 왼쪽 위에서 온다: 밝은 칸은 왼쪽 위, 짙은 칸은 오른쪽 아래 */
export const ICON_COLORS: Record<string, string> = {
	k: '#1c1c28',
	w: '#ffffff',
	l: '#c8d0dc',
	g: '#8890a0',
	d: '#4c5468',
	r: '#e83c3c',
	R: '#a02434',
	o: '#f08c34',
	y: '#f8d040',
	Y: '#c88c1c',
	G: '#58c858',
	D: '#2c8040',
	b: '#4c8cf0',
	B: '#2c54b0',
	c: '#70dcf8',
	p: '#a070e8',
	P: '#6440b0',
	n: '#c07840',
	N: '#7c4424',
	s: '#f8c8a8',
	m: '#f070b0',
};

/** 아이콘 이름 */
export type IconName =
	| 'sword'
	| 'shield'
	| 'magnifier'
	| 'bag'
	| 'cross'
	| 'heart'
	| 'star'
	| 'scroll'
	| 'book'
	| 'gear'
	| 'hammer'
	| 'bug'
	| 'people'
	| 'globe'
	| 'rocket'
	| 'server'
	| 'database'
	| 'cloud'
	| 'phone'
	| 'key'
	| 'chest'
	| 'coin'
	| 'flag'
	| 'map'
	| 'clock'
	| 'check'
	| 'chat'
	| 'monitor'
	| 'palette'
	| 'bolt'
	| 'potion'
	| 'chart'
	| 'code'
	| 'eye'
	| 'lock'
	| 'react'
	| 'typescript'
	| 'javascript'
	| 'node'
	| 'python'
	| 'docker'
	| 'git'
	| 'github'
	| 'vercel'
	| 'firebase'
	| 'postgres'
	| 'figma'
	| 'vite'
	| 'nextjs'
	| 'supabase'
	| 'tailwind'
	| 'unity'
	| 'redis'
	| 'html'
	| 'css'
	| 'cloudflare'
	| 'appstore'
	| 'playstore'
	| 'npm';

/** 안쪽 10×10 칸 그림 (외곽선은 outlined가 두른다) */
const RAW: Record<IconName, readonly string[]> = {
	sword: [
		'........ww',
		'.......wwl',
		'......wwl.',
		'.....wwl..',
		'....wwl...',
		'.y.wwl....',
		'..ywl.....',
		'..Nyy.....',
		'.nN..y....',
		'nN........',
	],
	shield: [
		'yyyyyyyyyy',
		'ycccbbbbBy',
		'ycbbwwbbBy',
		'ycbwwwwbBy',
		'ybbbwwbbBy',
		'ybbbwwbbBy',
		'.ybbbbbBy.',
		'.ybbbbBBy.',
		'..ybbBBy..',
		'...yyyy...',
	],
	magnifier: [
		'..dddd....',
		'.dwccbd...',
		'dwcccbbd..',
		'dcccccbd..',
		'dccccbbd..',
		'.dcbbbd...',
		'..ddddNn..',
		'......Nnn.',
		'.......Nnn',
		'........Nn',
	],
	bag: [
		'...N..N...',
		'....NN....',
		'...nyyn...',
		'..nnnnnn..',
		'.nonnnnnN.',
		'nonnnnnnNN',
		'nnnnnnnnNN',
		'nnnnnnnNNN',
		'nnnnnnNNNN',
		'.NNNNNNNN.',
	],
	cross: [
		'rr......rr',
		'rwr....rrR',
		'.rwr..rrR.',
		'..rrrrrR..',
		'...rrrR...',
		'...rrrR...',
		'..rrrRRR..',
		'.rrR..rRR.',
		'rrR....rRR',
		'rR......RR',
	],
	heart: [
		'..........',
		'.rrr..rrr.',
		'rwwrrrrrrr',
		'rwrrrrrrrR',
		'rrrrrrrrRR',
		'.rrrrrrRR.',
		'..rrrrRR..',
		'...rrRR...',
		'....RR....',
		'..........',
	],
	star: [
		'....yy....',
		'....wy....',
		'...wyyy...',
		'yyywyyyyyY',
		'.yyyyyyyY.',
		'..yyyyyY..',
		'..yyyyyY..',
		'.yyyYYyYY.',
		'.yyY..YYY.',
		'.yY....YY.',
	],
	scroll: [
		'.nnnnnnnn.',
		'nyyyyyyyyN',
		'.NnnnnnnN.',
		'.wwwwwwwl.',
		'.wggggwwl.',
		'.wwwwwwwl.',
		'.wgggggwl.',
		'.nnnnnnnn.',
		'nyyyyyyyyN',
		'.NNNNNNNN.',
	],
	book: [
		'.RRRRRRRR.',
		'Rrrrrrrrrw',
		'Rrwrrrrrrw',
		'Rrryyyyrrw',
		'Rrrrrrrrrw',
		'Rrrrrrrrrw',
		'Rrrrrrrrrw',
		'RrrrrrrrRw',
		'RRRRRRRRRw',
		'.wwwwwwwww',
	],
	gear: [
		'...ll.l...',
		'.l.lllll.d',
		'..lgggggd.',
		'.llg..ggdd',
		'llg....gd.',
		'.lg....gdd',
		'ddgg..ggd.',
		'..dgggggd.',
		'.d.ddddd.d',
		'...d.dd...',
	],
	hammer: [
		'.lllllll..',
		'lwwllllld.',
		'lllllllddd',
		'.ddddddd..',
		'...on.....',
		'...on.....',
		'...on.....',
		'...on.....',
		'...on.....',
		'...NN.....',
	],
	bug: [
		'..d....d..',
		'...d..d...',
		'...dddd...',
		'.rrrrdrrr.',
		'rwrrrdrrrR',
		'rrkrrdrkrR',
		'rrrrrdrrrR',
		'rkrrrdrrkR',
		'.rrrrdrRR.',
		'..RRRRRR..',
	],
	people: [
		'......NNN.',
		'..nnn.NssN',
		'.nsssnssss',
		'.nssssssss',
		'..ssss.GG.',
		'.bbbbbGGGG',
		'bbcbbbbGGD',
		'bcbbbbbbGD',
		'bbbbbbbBGD',
		'bbbbbbbB..',
	],
	globe: [
		'..bbbbbb..',
		'.bcGGbbbb.',
		'bcGGGGbbbB',
		'bGGGbbGGbB',
		'bbGbbbGGbB',
		'bbbbbGGGbB',
		'bbbbbGGbbB',
		'bbbbbGbbBB',
		'.bbbbbbBB.',
		'..BBBBBB..',
	],
	rocket: [
		'....rr....',
		'...rwlR...',
		'...wllg...',
		'...lccg...',
		'...lccg...',
		'...llgg...',
		'..rllggR..',
		'.rR.lg.RR.',
		'.R..oy..R.',
		'....yo....',
	],
	server: [
		'dddddddddd',
		'dwlllllGgd',
		'dlggggggdd',
		'dddddddddd',
		'dwllllyGgd',
		'dlggggggdd',
		'dddddddddd',
		'dwlllllGgd',
		'dlggggggdd',
		'dddddddddd',
	],
	database: [
		'..cccccc..',
		'.cwwccccb.',
		'.bccccccB.',
		'.cbbbbbbB.',
		'.cbbbbbbB.',
		'.bccccccB.',
		'.cbbbbbbB.',
		'.cbbbbbbB.',
		'.bccccccB.',
		'..BBBBBB..',
	],
	cloud: [
		'..........',
		'..........',
		'....www...',
		'..wwwwwwl.',
		'.wwwwwwwwl',
		'wwwwwwwwwl',
		'wwwwwwwwll',
		'.lllllllg.',
		'..........',
		'..........',
	],
	phone: [
		'..dddddd..',
		'..dccccd..',
		'..dcwccd..',
		'..dwcccd..',
		'..dccccd..',
		'..dccccd..',
		'..dccccd..',
		'..dddddd..',
		'..ddlldd..',
		'..dddddd..',
	],
	key: [
		'..........',
		'.yyy......',
		'ywwyY.....',
		'yw.yYyyyyY',
		'yy.yYYYyYY',
		'.yYY...yY.',
		'.......YY.',
		'..........',
		'..........',
		'..........',
	],
	chest: [
		'..........',
		'.NNNNNNNN.',
		'NnoooooonN',
		'NnnnnnnnnN',
		'yyyywyyyyY',
		'NnnnyYnnnN',
		'NnnnnnnnnN',
		'NnnnnnnnnN',
		'NNNNNNNNNN',
		'..........',
	],
	coin: [
		'...yyyy...',
		'..ywwyyY..',
		'.ywyyyyYY.',
		'.yyyYYyyY.',
		'.yyyYyyyY.',
		'.yyyYyyyY.',
		'.yyyYYyyY.',
		'.yyyyyyYY.',
		'..yYYYYY..',
		'...YYYY...',
	],
	flag: [
		'.lrrrrr...',
		'.lrwrrrrr.',
		'.lrrrrrrR.',
		'.lrrrrrRR.',
		'.lRRRRRRRR',
		'.l........',
		'.l........',
		'.g........',
		'.g........',
		'dddd......',
	],
	map: [
		'.yyy.ll.yy',
		'yyyylllyyY',
		'yGGYlbblyY',
		'yGGYlbblyY',
		'yyyyrlllyY',
		'yyyyllrlYY',
		'ydyYllllYY',
		'yyyylGGlyY',
		'yyyyllllyY',
		'.YYY.ll.YY',
	],
	clock: [
		'..llllll..',
		'.lwwwwwwl.',
		'lwwwkwwwwg',
		'lwwwkwwwwg',
		'lwwwkwwwwg',
		'lwwwkkkwwg',
		'lwwwwwwwwg',
		'lwwwwwwwwg',
		'.gwwwwwwg.',
		'..gggggg..',
	],
	check: [
		'..........',
		'........GG',
		'.......GGD',
		'......GGD.',
		'GG...GGD..',
		'GGG.GGD...',
		'.GGGGD....',
		'..GGD.....',
		'...D......',
		'..........',
	],
	chat: [
		'.wwwwwwww.',
		'wwwwwwwwwl',
		'wwgwwgwwgl',
		'wwwwwwwwwl',
		'wwwwwwwwll',
		'.wwlllllg.',
		'..wl......',
		'..l.......',
		'..........',
		'..........',
	],
	monitor: [
		'dddddddddd',
		'dccccccbbd',
		'dcwcccbbbd',
		'dccccbbbbd',
		'dcccbbbbbd',
		'dccbbbbbBd',
		'dddddddddd',
		'....dd....',
		'..dddddd..',
		'..........',
	],
	palette: [
		'..wwwwww..',
		'.wwrrwwwl.',
		'wwwrrwyywl',
		'wGGwwwyywl',
		'wGGwwwwwwl',
		'wwwwwlbbwl',
		'.wwwl.bbwl',
		'..wwl.lwl.',
		'...lllll..',
		'..........',
	],
	bolt: [
		'.....yyy..',
		'....yyyY..',
		'...yyyY...',
		'..yyyY....',
		'.yyyyyyyY.',
		'....yyyY..',
		'...yyyY...',
		'..yyYY....',
		'..yYY.....',
		'..Y.......',
	],
	potion: [
		'...nnnn...',
		'....ll....',
		'....ll....',
		'...lwwl...',
		'..lwrrrl..',
		'.lwrrrrrl.',
		'.lrrrrrRl.',
		'.lrrrrRRl.',
		'..lRRRRl..',
		'...llll...',
	],
	chart: [
		'..........',
		'.......GG.',
		'.......GD.',
		'....yy.GD.',
		'....yY.GD.',
		'.rr.yY.GD.',
		'.rR.yY.GD.',
		'.rR.yY.GD.',
		'dddddddddd',
		'..........',
	],
	code: [
		'......y...',
		'......y...',
		'..y..y.y..',
		'.y...y..y.',
		'y...y....y',
		'.y..y...y.',
		'..yy...y..',
		'...y......',
		'..........',
		'..........',
	],
	eye: [
		'..........',
		'...wwww...',
		'.wwwbbwwl.',
		'wwwbkkbwwl',
		'wwwbkkbwwl',
		'.wwwbbwwl.',
		'...llll...',
		'..........',
		'..........',
		'..........',
	],
	lock: [
		'...gggg...',
		'..g....g..',
		'..g....g..',
		'..g....g..',
		'.yyyyyyyy.',
		'.ywyyyyyY.',
		'.yyyNNyyY.',
		'.yyyNNyyY.',
		'.yyyyyyYY.',
		'.YYYYYYYY.',
	],
	react: [
		'ddcddddcdd',
		'dddcddcddd',
		'dccccccccd',
		'cddcddcddc',
		'cdddwwdddc',
		'cdddwwdddc',
		'cddcddcddc',
		'dccccccccd',
		'dddcddcddd',
		'ddcddddcdd',
	],
	typescript: [
		'bbbbbbbbbb',
		'bbbbbbbbbb',
		'bbbbbbbbbb',
		'bbbbbbbbbb',
		'bwwwbbwwbb',
		'bbwbbwbbbb',
		'bbwbbbwbbb',
		'bbwbbbbwbb',
		'bbwbbwwbbb',
		'bbbbbbbbbb',
	],
	javascript: [
		'yyyyyyyyyy',
		'yyyyyyyyyy',
		'yyyyyyyyyy',
		'yyyyyyyyyy',
		'yyykyykkyy',
		'yyykykyyyy',
		'yyykyykyyy',
		'ykykyyykyy',
		'yykyykkyyy',
		'yyyyyyyyyy',
	],
	node: [
		'....GG....',
		'..GGGGDD..',
		'GGGGwGDDDD',
		'GGGwGwDDDD',
		'GGGwGwDDDD',
		'GGGwGwDDDD',
		'GGGGGGDDDD',
		'GGGGGGDDDD',
		'..GGDDDD..',
		'....DD....',
	],
	python: [
		'...bbbb...',
		'..bwbbbb..',
		'..bbbbbb..',
		'bbbbbbbby.',
		'bbbbbbbyyy',
		'bbbyyyyyyy',
		'.byyyyyyyy',
		'..yyyyyy..',
		'..yyyywy..',
		'...yyyy...',
	],
	docker: [
		'..........',
		'....w.....',
		'..www.....',
		'..wwwwww..',
		'bbbbbbbbbw',
		'bwbbbbbbbB',
		'bbbbbbbbB.',
		'.bbbbbbB..',
		'..BBBB....',
		'..........',
	],
	git: [
		'....oo....',
		'...oooo...',
		'..oowooo..',
		'.ooowooo..',
		'oooowwooRo',
		'ooowooowoR',
		'.ooowooooR',
		'..oowooR..',
		'...ooRR...',
		'....RR....',
	],
	github: [
		'..dddddd..',
		'.dddddddd.',
		'ddwddddwdd',
		'ddwwwwwwdd',
		'ddwkwwkwdd',
		'ddwwwwwwdd',
		'dddwwwwddd',
		'.dddwwddd.',
		'..ddwwdd..',
		'...dwwd...',
	],
	vercel: [
		'dddddddddd',
		'ddddwddddd',
		'dddwwwdddd',
		'dddwwwdddd',
		'ddwwwwwddd',
		'ddwwwwwddd',
		'dwwwwwwwdd',
		'dwwwwwwwdd',
		'dddddddddd',
		'dddddddddd',
	],
	firebase: [
		'...y......',
		'...yy.....',
		'..yyy..o..',
		'..yyyy.oo.',
		'.yyyyoooo.',
		'.yyyoooooo',
		'yyyoorroo.',
		'yyorrrroo.',
		'.oorrrrro.',
		'..oooooo..',
	],
	postgres: [
		'..bbbbbb..',
		'.bbbbbbbb.',
		'bbbbbbbbbB',
		'bwwbbbwwbB',
		'bwbwbwbbbB',
		'bwwbbwbwbB',
		'bwbbbwbwbB',
		'bwbbbbwwbB',
		'.bbbbbbbB.',
		'..BBBBBB..',
	],
	figma: [
		'.rrrrmmmm.',
		'rrrrrmmmmm',
		'.rrrrmmmm.',
		'.PPPP.bb..',
		'PPPPPbbbbb',
		'.PPPP.bb..',
		'.GGGG.....',
		'GGGGG.....',
		'.GGG......',
		'..........',
	],
	vite: [
		'pppppppppp',
		'pbbbbbbbbp',
		'.pbbyybbp.',
		'.pbyyybbp.',
		'..pyyyyp..',
		'..pyyyyp..',
		'...pyyp...',
		'...pyyp...',
		'....pp....',
		'....pp....',
	],
	nextjs: [
		'..dddddd..',
		'.dddddddd.',
		'ddwwddwddd',
		'ddwdwdwddd',
		'ddwddwwddd',
		'ddwdddwddd',
		'ddwddddwdd',
		'.ddddddwd.',
		'..dddddd..',
		'..........',
	],
	supabase: [
		'dddddddddd',
		'ddddGGdddd',
		'dddGGDdddd',
		'ddGGGDdddd',
		'dGGGGGGGdd',
		'ddddGGGDdd',
		'ddddGGDddd',
		'ddddGDdddd',
		'ddddDddddd',
		'dddddddddd',
	],
	tailwind: [
		'..........',
		'....cccc..',
		'..cccbbcc.',
		'cccb....b.',
		'.b........',
		'....cccc..',
		'..cccbbcc.',
		'cccb....b.',
		'.b........',
		'..........',
	],
	unity: [
		'dddddddddd',
		'ddddwwdddd',
		'ddwwddwwdd',
		'dwddwwddwd',
		'dwdddwddwd',
		'dwdddwddwd',
		'dwdddwddwd',
		'ddwwdwwwdd',
		'ddddwwdddd',
		'dddddddddd',
	],
	redis: [
		'..rrrrrr..',
		'rrwwrrrrrR',
		'.RRRRRRRR.',
		'..rrrrrr..',
		'rrrrrrrrrR',
		'.RRRRRRRR.',
		'..rrrrrr..',
		'rrrrrrrrrR',
		'.RRRRRRRR.',
		'..........',
	],
	html: [
		'oooooooooo',
		'oooooooooo',
		'owwwwwwooo',
		'owwoooooo.',
		'owwwwwwoo.',
		'.oooowwoo.',
		'.owwwwwoo.',
		'..oooooo..',
		'...oooo...',
		'..........',
	],
	css: [
		'bbbbbbbbbb',
		'bbbbbbbbbb',
		'bwwwwwwbbb',
		'bbbbbwwbb.',
		'bbwwwwwbb.',
		'.bbbbwwbb.',
		'.bwwwwwbb.',
		'..bbbbbb..',
		'...bbbb...',
		'..........',
	],
	cloudflare: [
		'..........',
		'....oooo..',
		'..ooooooo.',
		'.ooowooooy',
		'oooooooooy',
		'ooooooooyy',
		'.oooooooy.',
		'..........',
		'..........',
		'..........',
	],
	appstore: [
		'bbbbbbbbbb',
		'bccbbbbbbb',
		'bcbbwbbbbb',
		'bbbbbwbbbb',
		'bbbbwbwbbb',
		'bbbwbbbwbb',
		'bwwwwwwwwb',
		'bbwbbbbbwb',
		'bbbbbbbbbb',
		'BBBBBBBBBB',
	],
	playstore: [
		'GG........',
		'GcGG......',
		'GccbGG....',
		'GcccbbGG..',
		'GccccbbyGG',
		'GccccbryyG',
		'GcccrrrGG.',
		'GcrrrGG...',
		'GrrGG.....',
		'GG........',
	],
	npm: [
		'..........',
		'rrrrrrrrrr',
		'rwwwrwwwrr',
		'rwrwrwrwrr',
		'rwrwrwwwrr',
		'rrrrrwrrrr',
		'..........',
		'..........',
		'..........',
		'..........',
	],
};

/** 12×12 아이콘 (외곽선 포함) */
export const ICONS: Record<IconName, readonly string[]> = Object.fromEntries(
	Object.entries(RAW).map(([name, rows]) => [name, outlined(rows, 'k')])
) as unknown as Record<IconName, readonly string[]>;

/** 3×5 픽셀 글자: 대문자, 숫자, # + (C#, C++) */
export const GLYPHS: Record<string, readonly string[]> = {
	A: ['.#.', '#.#', '###', '#.#', '#.#'],
	B: ['##.', '#.#', '##.', '#.#', '##.'],
	C: ['.##', '#..', '#..', '#..', '.##'],
	D: ['##.', '#.#', '#.#', '#.#', '##.'],
	E: ['###', '#..', '##.', '#..', '###'],
	F: ['###', '#..', '##.', '#..', '#..'],
	G: ['.##', '#..', '#.#', '#.#', '.##'],
	H: ['#.#', '#.#', '###', '#.#', '#.#'],
	I: ['###', '.#.', '.#.', '.#.', '###'],
	J: ['..#', '..#', '..#', '#.#', '.#.'],
	K: ['#.#', '#.#', '##.', '#.#', '#.#'],
	L: ['#..', '#..', '#..', '#..', '###'],
	M: ['#.#', '###', '###', '#.#', '#.#'],
	N: ['##.', '#.#', '#.#', '#.#', '#.#'],
	O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
	P: ['##.', '#.#', '##.', '#..', '#..'],
	Q: ['.#.', '#.#', '#.#', '##.', '.##'],
	R: ['##.', '#.#', '##.', '#.#', '#.#'],
	S: ['.##', '#..', '.#.', '..#', '##.'],
	T: ['###', '.#.', '.#.', '.#.', '.#.'],
	U: ['#.#', '#.#', '#.#', '#.#', '###'],
	V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
	W: ['#.#', '#.#', '###', '###', '#.#'],
	X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
	Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
	Z: ['###', '..#', '.#.', '#..', '###'],
	'0': ['###', '#.#', '#.#', '#.#', '###'],
	'1': ['.#.', '##.', '.#.', '.#.', '###'],
	'2': ['##.', '..#', '.#.', '#..', '###'],
	'3': ['##.', '..#', '.#.', '..#', '##.'],
	'4': ['#.#', '#.#', '###', '..#', '..#'],
	'5': ['###', '#..', '##.', '..#', '##.'],
	'6': ['.##', '#..', '###', '#.#', '###'],
	'7': ['###', '..#', '.#.', '.#.', '.#.'],
	'8': ['###', '#.#', '###', '#.#', '###'],
	'9': ['###', '#.#', '###', '..#', '##.'],
	'#': ['#.#', '###', '#.#', '###', '#.#'],
	'+': ['...', '.#.', '###', '.#.', '...'],
};

/** 글자 칸의 바탕색 (이름으로 고른다): 짙은 색 바탕에 흰 글자 */
const TILE_KEYS = ['b', 'r', 'G', 'p', 'o', 'B', 'D', 'P', 'R', 'N'] as const;

function hashOf(text: string): number {
	let hash = 7;
	for (const ch of text) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
	return hash;
}

/**
 * 글자 칸: 이름으로 고른 색의 둥근 칸에 흰 픽셀 글자 하나 또는 둘 (12×12, 외곽선 포함).
 * 글자가 픽셀 글자에 없으면(한글 등) null
 */
export function letterTile(text: string, seed = text): string[] | null {
	const chars = [...text.toUpperCase()].filter((ch) => GLYPHS[ch]).slice(0, 2);
	if (chars.length === 0 || [...text].some((ch) => !GLYPHS[ch.toUpperCase()])) return null;
	const key = TILE_KEYS[hashOf(seed) % TILE_KEYS.length];
	const rows: string[][] = Array.from({ length: 10 }, (_, y) =>
		Array.from({ length: 10 }, (_, x) => ((x === 0 || x === 9) && (y === 0 || y === 9) ? '.' : key))
	);
	// 왼쪽 위 밝은 점 (빛)
	rows[1][1] = 'w';
	const width = chars.length * 3 + (chars.length - 1);
	const left = Math.floor((10 - width) / 2);
	chars.forEach((ch, i) => {
		GLYPHS[ch].forEach((line, gy) => {
			[...line].forEach((cell, gx) => {
				if (cell === '#') rows[3 + gy][left + i * 4 + gx] = 'w';
			});
		});
	});
	return outlined(
		rows.map((row) => row.join('')),
		'k'
	);
}

/** 아는 기술 이름 → 픽셀 로고. 앞에서부터 처음 맞는 것 */
const TECH_TABLE: [RegExp, IconName][] = [
	[/^react( native| query)?$|^react\b/, 'react'],
	[/^typescript$|^ts$/, 'typescript'],
	[/^javascript$|^js$|^es\d+$/, 'javascript'],
	[/^node(\.js)?$|^nodejs$|^express(\.js)?$|^nestjs$|^nest$/, 'node'],
	[/^python$|^django$|^fastapi$|^flask$/, 'python'],
	[/^docker( compose)?$|^kubernetes$|^k8s$/, 'docker'],
	[/^github( actions)?$/, 'github'],
	[/^git$/, 'git'],
	[/^vercel$/, 'vercel'],
	[/^firebase$|^firestore$/, 'firebase'],
	[/^postgres(ql)?$|^pg$/, 'postgres'],
	[/^figma$/, 'figma'],
	[/^vite$|^vitest$/, 'vite'],
	[/^next(\.js|js)?$/, 'nextjs'],
	[/^supabase$/, 'supabase'],
	[/^tailwind( css)?$|^tailwindcss$/, 'tailwind'],
	[/^unity$/, 'unity'],
	[/^redis$/, 'redis'],
	[/^html5?$/, 'html'],
	[/^css3?$|^sass$|^scss$|^styled-components$|^emotion$/, 'css'],
	[/^aws$|^amazon web services$|^s3$|^ec2$|^lambda$|^gcp$|^google cloud$/, 'cloud'],
	[/^cloudflare( workers| pages)?$/, 'cloudflare'],
	[/^npm$|^pnpm$|^yarn$/, 'npm'],
	[/^mysql$|^mongodb$|^sqlite$|^prisma$/, 'database'],
	[/^ios$|^swift(ui)?$/, 'appstore'],
	[/^android$|^kotlin$/, 'playstore'],
];

/** 기술 이름을 견주기 좋게: 소문자, 버전 숫자와 괄호 설명은 뺀다 (Unity 6 → unity) */
const techKeyOf = (name: string) =>
	name
		.toLowerCase()
		.replace(/\(.*?\)/g, '')
		.replace(/\s+v?\d+(\.\d+)*$/, '')
		.trim();

/** 기술 이름의 픽셀 로고. 모르면 null (그때는 글자 칸) */
export function techPixelIcon(name: string): IconName | null {
	const key = techKeyOf(name);
	if (!key) return null;
	return TECH_TABLE.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}

/** 기술 칸 그림: 아는 기술은 로고, 아니면 첫 글자(영어·숫자) 칸, 그것도 아니면 톱니 */
export function techTile(name: string): readonly string[] {
	const icon = techPixelIcon(name);
	if (icon) return ICONS[icon];
	const first = [...name.trim()][0] ?? '';
	return letterTile(first, name) ?? ICONS.gear;
}

/** Font Awesome 아이콘 이름(fa-*) → 가장 가까운 픽셀 아이콘. 앞에서부터 처음 맞는 것, 모르면 별 */
const FA_TABLE: [RegExp, IconName][] = [
	[/hand-fist|sword|khanda|gavel|crosshairs|bullseye/, 'sword'],
	[/shield|user-shield/, 'shield'],
	[/magnifying|search|filter|binoculars/, 'magnifier'],
	[/eye/, 'eye'],
	[/bag|basket|cart|store|shop/, 'bag'],
	[/xmark|trash|ban|circle-xmark|eraser/, 'cross'],
	[/heart|hand-holding-heart/, 'heart'],
	[/wand|sparkles|star|sun|crown|trophy|award|medal/, 'star'],
	[/scroll|list|clipboard|paste|copy|note|file|scissors|crop|pen|pencil|tag/, 'scroll'],
	[/book|newspaper|graduation/, 'book'],
	[/gear|cog|sliders|puzzle|robot|microchip|rotate|arrows|repeat|sync/, 'gear'],
	[/hammer|wrench|screwdriver|toolbox|tools/, 'hammer'],
	[/bug|virus/, 'bug'],
	[/user|users|people|person|id-badge|id-card|handshake|children/, 'people'],
	[/globe|earth|language|wifi|link|network/, 'globe'],
	[/rocket|plane|paper-plane/, 'rocket'],
	[/server|hard-drive/, 'server'],
	[/database|layer-group|boxes|cubes|box-archive/, 'database'],
	[/cloud/, 'cloud'],
	[/mobile|phone|tablet/, 'phone'],
	[/key|right-to-bracket|sign-in|fingerprint/, 'key'],
	[/^(un)?lock|-lock/, 'lock'],
	[/chest|box-open|gift/, 'chest'],
	[/coins?|money|dollar|won|wallet|credit/, 'coin'],
	[/flag/, 'flag'],
	[/map|route|compass|location|signs-post|road/, 'map'],
	[/clock|calendar|hourglass|stopwatch|timer/, 'clock'],
	[/check|circle-check|square-check/, 'check'],
	[/comment|message|envelope|reply|bell|bullhorn|inbox|at/, 'chat'],
	[/desktop|laptop|display|tv|table|window|table-columns|image|photo|camera|film|video/, 'monitor'],
	[/palette|swatch|brush|paint|droplet|eye-dropper|circle-half|fill/, 'palette'],
	[/bolt|lightning|fire|flame/, 'bolt'],
	[/flask|vial|potion|prescription|syringe/, 'potion'],
	[/chart|poll|square-poll|gauge|signal/, 'chart'],
	[/code|terminal|brackets/, 'code'],
	[/cube|shapes|layer/, 'chest'],
];

export function faPixelIcon(fa: string | undefined): IconName {
	if (!fa) return 'star';
	const key = fa.replace(/^fa-(solid|regular|brands)\s+/, '').replace(/^fa-/, '');
	const brand = techPixelIcon(key);
	if (brand) return brand;
	return FA_TABLE.find(([pattern]) => pattern.test(key))?.[1] ?? 'star';
}

/** 사양의 분류 이름 → 기본 아이콘 (값의 첫 기술을 모를 때) */
const SLOT_TABLE: [RegExp, IconName][] = [
	[/화면|프론트|front|ui|입력/, 'monitor'],
	[/서버|백엔드|back|api/, 'server'],
	[/db|데이터|저장/, 'database'],
	[/배포|deploy|호스팅/, 'rocket'],
	[/상태|state/, 'gear'],
	[/인증|보안|auth/, 'key'],
	[/스타일|디자인|style/, 'palette'],
	[/엔진|engine|렌더/, 'gear'],
	[/ai|인공지능/, 'gear'],
	[/맵|지도|map/, 'map'],
	[/언어|lang/, 'code'],
	[/시험|테스트|test/, 'potion'],
];

/** 사양 한 줄(분류, 값)의 장비 칸 그림: 값의 첫 기술이 아는 것이면 그 로고, 아니면 분류로 고른 아이콘, 그것도 아니면 상자 */
export function slotTile(label: string, value: string): readonly string[] {
	const first = value.split(/[,·/]/)[0] ?? '';
	const brand = techPixelIcon(first);
	if (brand) return ICONS[brand];
	const key = label.toLowerCase();
	return ICONS[SLOT_TABLE.find(([pattern]) => pattern.test(key))?.[1] ?? 'chest'];
}

/** 배포 결과물(올린 곳·주소) → 픽셀 아이콘. 모르면 지구본 */
export function deployPixelIcon(platform: string | undefined, url: string | undefined): IconName {
	const key = `${platform ?? ''} ${url ?? ''}`.toLowerCase();
	const table: [RegExp, IconName][] = [
		[/app ?store|apps\.apple|testflight|ios/, 'appstore'],
		[/google ?play|play\.google|android/, 'playstore'],
		[/npm/, 'npm'],
		[/github|ghcr/, 'github'],
		[/docker/, 'docker'],
		[/figma/, 'figma'],
		[/vercel/, 'vercel'],
		[/firebase/, 'firebase'],
		[/notion|docs?|문서|swagger/, 'book'],
		[/netlify|pages|web/, 'globe'],
		[/aws|cloud|server|api|render|fly\.io|railway|ec2/, 'server'],
	];
	return table.find(([pattern]) => pattern.test(key))?.[1] ?? 'globe';
}

// ─── 사진·아이콘을 픽셀 아이콘으로: 작게 줄이고 색을 몇 개로 줄인다 ───

/** RGBA 한 칸 */
type Rgb = [number, number, number];

/**
 * 색 줄이기 (median cut): 불투명한 칸들의 색을 상자로 반씩 나눠 많아야 count개의 색으로.
 * pixels는 RGBA가 이어진 배열. 돌려주는 색은 상자 안 평균
 */
export function quantize(pixels: ArrayLike<number>, count: number): Rgb[] {
	const colors: Rgb[] = [];
	for (let i = 0; i + 3 < pixels.length; i += 4) {
		if (pixels[i + 3] >= 128) colors.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
	}
	if (colors.length === 0) return [];
	let boxes: Rgb[][] = [colors];
	while (boxes.length < count) {
		// 가장 넓은 상자를 가장 넓은 축으로 반 나눈다
		let best = -1;
		let bestRange = 0;
		let bestAxis = 0;
		boxes.forEach((box, b) => {
			if (box.length < 2) return;
			for (let axis = 0; axis < 3; axis++) {
				let lo = 255;
				let hi = 0;
				for (const c of box) {
					lo = Math.min(lo, c[axis]);
					hi = Math.max(hi, c[axis]);
				}
				if (hi - lo > bestRange) {
					bestRange = hi - lo;
					best = b;
					bestAxis = axis;
				}
			}
		});
		if (best < 0 || bestRange === 0) break;
		const box = [...boxes[best]].sort((a, b) => a[bestAxis] - b[bestAxis]);
		const half = Math.floor(box.length / 2);
		boxes = [...boxes.slice(0, best), box.slice(0, half), box.slice(half), ...boxes.slice(best + 1)];
	}
	return boxes.map((box) => {
		const sum = box.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]);
		return sum.map((v) => Math.round(v / box.length)) as Rgb;
	});
}

const nearest = (palette: readonly Rgb[], r: number, g: number, b: number) => {
	let best = 0;
	let bestDist = Infinity;
	palette.forEach((c, i) => {
		const dist = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
		if (dist < bestDist) {
			bestDist = dist;
			best = i;
		}
	});
	return best;
};

/**
 * 픽셀 아이콘 만들기: source는 (size·block)×(size·block) RGBA. 색을 colors개로 줄이고,
 * block×block 칸마다 가장 많은 색 하나만 고른다 (섞인 색을 만들지 않는다). 칸의 반 넘게 비면 빈칸.
 * outline이면 투명한 둘레에 짙은 외곽선 한 칸. 돌려주는 것은 size×size RGBA
 */
export function pixelate(
	source: ArrayLike<number>,
	size: number,
	block: number,
	colors = 16,
	outline = false
): Uint8ClampedArray<ArrayBuffer> {
	const width = size * block;
	const palette = quantize(source, colors);
	const out = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));
	for (let ty = 0; ty < size; ty++) {
		for (let tx = 0; tx < size; tx++) {
			const votes = new Map<number, number>();
			let opaque = 0;
			for (let y = 0; y < block; y++) {
				for (let x = 0; x < block; x++) {
					const i = ((ty * block + y) * width + tx * block + x) * 4;
					if (source[i + 3] < 128) continue;
					opaque++;
					const c = nearest(palette, source[i], source[i + 1], source[i + 2]);
					votes.set(c, (votes.get(c) ?? 0) + 1);
				}
			}
			const o = (ty * size + tx) * 4;
			if (opaque * 2 < block * block || palette.length === 0) continue;
			let pick = 0;
			let most = -1;
			votes.forEach((n, c) => {
				if (n > most) {
					most = n;
					pick = c;
				}
			});
			out[o] = palette[pick][0];
			out[o + 1] = palette[pick][1];
			out[o + 2] = palette[pick][2];
			out[o + 3] = 255;
		}
	}
	return outline ? outlineRgba(out, size) : out;
}

/**
 * 빈칸 중 위·아래·옆으로 칠한 칸에 닿은 곳을 짙은 외곽선 색으로 (투명한 아이콘이 밝은 장면에서도 읽히게).
 * 네 귀퉁이가 다 칠해진 네모 아이콘은 가장자리 한 줄을 외곽선으로 바꾸고 귀퉁이 칸은 비운다 (둥근 앱 아이콘처럼)
 */
export function outlineRgba(pixels: Uint8ClampedArray<ArrayBuffer>, size: number): Uint8ClampedArray<ArrayBuffer> {
	const out = new Uint8ClampedArray(pixels);
	const opaque = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < size && y < size && pixels[(y * size + x) * 4 + 3] > 0;
	const last = size - 1;
	if (opaque(0, 0) && opaque(last, 0) && opaque(0, last) && opaque(last, last)) {
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				if (x !== 0 && y !== 0 && x !== last && y !== last) continue;
				const o = (y * size + x) * 4;
				const corner = (x === 0 || x === last) && (y === 0 || y === last);
				out.set(corner ? [0, 0, 0, 0] : [0x1c, 0x1c, 0x28, 255], o);
			}
		}
		return out;
	}
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			if (opaque(x, y)) continue;
			if (!(opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1))) continue;
			const o = (y * size + x) * 4;
			out[o] = 0x1c;
			out[o + 1] = 0x1c;
			out[o + 2] = 0x28;
			out[o + 3] = 255;
		}
	}
	return out;
}
