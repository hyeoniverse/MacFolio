// 프로젝트: Safari의 프로젝트 페이지, 프로젝트 앱(데모를 창 안의 iframe으로), Finder·터미널·사진이 함께 쓰는 모양과 검사.
// 코드(apps/react/src/shared/profile.ts의 PROJECTS)가 기본값이고, 관리자가 시스템 설정에서 고친 것은 서버에 "덮어쓸 값"으로 둔다.
// 서버와 화면이 같은 규칙(parseProjects)으로 검사한다. 링크·iframe 주소는 https만, 그림 주소는 사이트 안 경로나 https만 받는다

/** 큰 글씨로 보여줄 숫자 한 줄 (예: 6주 / 개발 기간) */
export interface ProjectFact {
	value: string;
	label: string;
}

/** 그림 대신 직접 만져 보는 데모 (Safari 프로젝트 페이지에 만들어 둔 것) */
export const POINT_DEMOS = [
	'slides',
	'voice',
	'wave',
	'convert',
	'translate',
	'summary',
	'cover',
	'autosave',
	'lifecycle',
	'comments',
	'mailbox',
	'invite',
	'roles',
	'kitchen',
	'providers',
] as const;

/** 제목과 설명 한 덩어리 */
export interface ProjectPoint {
	title: string;
	body: string;
	/** 펼쳐 읽을 때 더 보여 줄 설명 */
	detail?: string;
	/** 곁들일 그림 (public/imgs/projects/{id}/…) */
	image?: string;
	/** 같은 화면의 다크 테마 그림: 있으면 밀대로 라이트와 나눠 비교한다 */
	imageDark?: string;
	/** 스크롤 장면: 페이지를 스크롤하는 만큼 차례로 넘어가는 화면들 (위에서 아래로 내려가며 찍은 캡처) */
	scrollFrames?: string[];
	/** 그림 대신 보여 줄 짧은 영상 (화면에 보일 때만 재생) */
	video?: string;
	/** 갈래 여러 개 (예: 레이아웃 여섯 가지): 이름과 한 줄 설명. 그림이 없으면 갈래마다 움직이는 도식으로 그린다 */
	variants?: { label: string; note: string }[];
	/** 그림 대신 직접 만져 보는 데모 (슬라이드 갤러리, 음성 만들기, 파형 편집, 문서 변환, 번역, AI 요약, AI 커버) */
	demo?: (typeof POINT_DEMOS)[number];
	/** 데모 아래나 글 옆에 붙일 실제 화면 여러 장 (.mp4는 화면에 보일 때만 도는 영상) */
	shots?: { src: string; alt: string }[];
	/** 카드에 붙일 아이콘 (Font Awesome 이름, 예: fa-lock) */
	icon?: string;
	/** 같은 장 안에서 묶는 이름 (예: 쓰기, 운영): 묶음마다 큰 칸 하나와 작은 칸들로 짠다 */
	group?: string;
}

/** 테마 하나를 이루는 다섯 색 (강조색, 라이트·다크의 바탕과 글자) */
export interface ThemeSwatch {
	name: string;
	accent: string;
	lightBg: string;
	lightText: string;
	darkBg: string;
	darkText: string;
}

export const CHAPTER_LOOKS = [
	'showcase',
	'stage',
	'bento',
	'dashboard',
	'gauges',
	'shield',
	'palette',
	'architecture',
] as const;

/** 주요 기능과 만든 방식 말고 더 들려줄 이야기 한 장 (예: 관리자 화면, 테마, 성능) */
export interface ProjectChapter {
	title: string;
	/** 장 첫머리의 한두 문장 */
	lead?: string;
	/** 이 장에서 내세울 숫자 */
	facts?: ProjectFact[];
	points: ProjectPoint[];
	/** 장 끝에 둘 그림 (public/imgs/projects/{id}/…). dark가 있으면 밀대로 라이트와 나눠 비교한다 */
	image?: { src: string; alt: string; dark?: string };
	/** 전후 비교: 화면에 들어오면 막대가 전에서 후로 줄어든다 */
	compare?: { label: string; before: number; after: number; unit: string }[];
	/**
	 * 장 모양 (글 묶음의 짜임): showcase 항목을 고르면 큰 화면이 바뀜, stage 데모마다 큰 무대, bento 크기가 다른 타일,
	 * dashboard 숫자 타일과 큰 화면, gauges 점수 고리와 번호 목록, shield 겹겹이 쌓인 방어, palette 작은 타일. 없으면 두 칸 글 묶음
	 */
	look?: (typeof CHAPTER_LOOKS)[number];
	/** 테마 프리셋: 고르면 미리보기 화면의 색이 그 테마로 바뀐다 */
	palette?: ThemeSwatch[];
	/** 데이터베이스 구조: 문서(테이블) 경로, 누가 읽는지, 필드, 한 줄 설명. parent가 있으면 그 문서의 하위 문서 */
	schema?: { path: string; access: string; fields: string[]; note: string; parent?: string; locked?: boolean }[];
}

/**
 * 프로젝트 페이지 모양. 모양마다 페이지의 짜임과 읽는 순서가 다르다 (apps/safari/project/).
 * editorial 신문 1면(뉴스레터), playful 칸반 보드(할 일), minimal 명함 앞뒤와 단계(명함), game 타이틀 화면부터 크레딧까지(게임),
 * terminal 명령과 결과가 이어지는 터미널(학습 기록), product Apple 제품 페이지(이 사이트), creative 붙어 있는 차례와 장(포트폴리오)
 */
export const PROJECT_LOOKS = ['editorial', 'playful', 'minimal', 'game', 'terminal', 'product', 'creative'] as const;
export type ProjectLook = (typeof PROJECT_LOOKS)[number];

/** 프로젝트 앱의 모양 (Project.app) */
export interface ProjectAppInfo {
	/** Dock·Launchpad에 보일 짧은 이름 */
	label: string;
	/** 아이콘 (env.imageUrl 기준 경로, 예: projects/newpick/app-icon.png) */
	icon: string;
	/** Dock에 고정하지 않으려면 false (Launchpad에 두고 실행 중에만 Dock에 나타난다). 기본은 고정 */
	inDock?: boolean;
	/** 게임이면 "여기서 플레이", 아니면 "여기서 열기" */
	play?: boolean;
	/** 사이트가 뜨기 전 창 바탕 (게임은 검은 화면) */
	tone?: 'light' | 'dark';
	/**
	 * 사이트가 맨 위 색을 알려 주기 전까지(postMessage, shared/ui/web-frame/WebFrame.tsx의 BAR_COLOR_MESSAGE) 상태 표시줄 뒤에 칠할 색.
	 * 다른 도메인의 페이지라 iframe 안을 직접 읽을 수 없다. 사이트가 색을 보내면 그 색을 따른다
	 */
	barColor?: string;
	/** 처음 열 때 창 크기 */
	windowSize?: { width: number; height: number };
}

export interface Project {
	id: string;
	name: string;
	look: ProjectLook;
	/** 페이지 첫머리의 큰 제목 */
	tagline: string;
	/** 한 줄 소개 */
	description: string;
	/** 어떤 프로젝트인지 (팀·과정 등) */
	context: string;
	/** 맡은 일 한 줄 (팀 프로젝트) */
	role?: string;
	/** 개발 기간 */
	period?: string;
	/** 한눈에 보는 숫자 */
	facts: ProjectFact[];
	/** 주요 기능 (저장소 README에서) */
	highlights: ProjectPoint[];
	/** 어떻게 만들었는지: 구현에서 신경 쓴 점 */
	build: ProjectPoint[];
	/** 더 들려줄 이야기: 모양마다 그 페이지에 맞는 꼴로 그린다 */
	chapters?: ProjectChapter[];
	/** 내가 한 일 */
	contributions: string[];
	/** 진행 과정 (날짜, 한 일) */
	timeline?: { date: string; label: string }[];
	/** 쓰는 법: 상황마다 (예: 가입 없이, 로그인하면) */
	usage?: ProjectPoint[];
	/** 폴더 구조 (저장소 README의 트리) */
	structure?: string;
	/** 화면 모음 (차례대로 넘겨 본다) */
	gallery?: { src: string; caption: string }[];
	/** 빌려 쓴 에셋·글꼴 출처: 맡은 부분, 이름, 만든 사람, 주소, 한 줄 설명 */
	credits?: { role: string; name: string; by: string; href?: string; note?: string }[];
	/** 기술 사양: 분류별 기술 */
	specs: { label: string; value: string }[];
	/** 기술 이름만 (터미널 등 짧게 보여줄 때) */
	stack: string[];
	/** GitHub의 주 언어 */
	language: string;
	/** GitHub 저장소 */
	url: string;
	/** 실제로 써 볼 수 있는 주소 */
	demo?: string;
	/** 앱 아이콘 (public/imgs/projects/{id}/icon.png). 없으면 기본 모양을 쓴다 */
	icon?: string;
	/**
	 * 이 사이트 안에서 데모를 창으로 띄우는 앱 (apps/project/ProjectApp.tsx). 있으면 앱 목록(apps/manifest.ts)에 이 id로
	 * 들어가 Launchpad·터미널 open·Safari의 "여기서 열기"에 나온다. 데모 주소(demo)가 있어야 한다
	 */
	app?: ProjectAppInfo;
	/** 주요 기능 위에 둘 그림 (public/imgs/projects/{id}/scene.png) */
	art?: string;
	/** 글자 로고 (public/imgs/projects/{id}/logo.png) */
	logo?: string;
	/** 화면 캡처 (public/imgs/projects/{id}/screenshot.jpg) */
	image: string;
	/** 게임 조작법 */
	controls?: { keys: string[]; label: string }[];
	/** 첫 화면 터미널에 보일 줄. '$ '로 시작하면 명령 */
	terminal?: string[];
	/** 커밋 컨벤션 (타입, 설명) */
	conventions?: { type: string; description: string }[];
}

export type ProjectOverride = { [K in keyof Omit<Project, 'id'>]?: Project[K] | null };

/** 서버에 두는 것: 프로젝트마다 순서, 숨김, 코드의 기본값에 덮어쓸 필드. 기본값에 없는 id는 새 프로젝트다 */
export interface ProjectEntry {
	id: string;
	/** 목록·Dock·Safari 어디에도 보이지 않는다 */
	hidden?: boolean;
	/** 덮어쓸 필드 (맨 위 필드 단위로 통째로 바꾼다). null은 기본값에 있던 고를 수 있는 필드를 지운다 (예: 앱을 끈다) */
	override?: ProjectOverride;
}

export interface SiteProjects {
	/** 이 순서대로 보인다. 여기 없는 코드의 프로젝트는 끝에 붙는다 (나중에 코드에 더한 프로젝트도 보이게) */
	items: ProjectEntry[];
}

export const PROJECTS_LIMITS = {
	/** 프로젝트 수 */
	items: 40,
	/** 저장하는 JSON 전체 길이 (API 몸통 한도 100KB 안) */
	json: 90_000,
} as const;

/**
 * 프로젝트 id로 쓸 수 없는 이름: 프로젝트 앱의 이름이 곧 id라 이 사이트의 앱과 겹치면 안 된다
 * (apps/react/src/apps/manifest.ts의 BUILTIN_APP_NAMES와 같아야 한다. manifest.test.ts가 확인한다)
 */
export const RESERVED_PROJECT_IDS = [
	'finder',
	'music',
	'safari',
	'photos',
	'messages',
	'memo',
	'github',
	'mail',
	'share',
	'terminal',
	'settings',
	'passwords',
	'apidocs',
	'activity',
	'weather',
	'bin',
	'launchpad',
] as const;

const PROJECT_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

// --- 검사 규칙: 작은 스키마 ---------------------------------------------------------------

type Rule =
	| { kind: 'text'; max: number; multiline?: boolean; pattern?: RegExp }
	| { kind: 'href' }
	| { kind: 'src' }
	| { kind: 'appIcon' }
	| { kind: 'color' }
	| { kind: 'enum'; values: readonly string[] }
	| { kind: 'number'; min: number; max: number }
	| { kind: 'bool' }
	| { kind: 'list'; of: Rule; max: number }
	| { kind: 'object'; fields: Record<string, Field> };

interface Field {
	rule: Rule;
	required?: boolean;
}

const text = (max: number, multiline = false): Rule => ({ kind: 'text', max, multiline });
const list = (of: Rule, max: number): Rule => ({ kind: 'list', of, max });
const object = (fields: Record<string, Field | Rule>): Rule => ({
	kind: 'object',
	fields: Object.fromEntries(
		Object.entries(fields).map(([key, value]) => [key, 'rule' in value ? value : { rule: value }])
	),
});
const req = (rule: Rule): Field => ({ rule, required: true });
const HREF: Rule = { kind: 'href' };
const SRC: Rule = { kind: 'src' };
const COLOR: Rule = { kind: 'color' };
const BOOL: Rule = { kind: 'bool' };

const FACT = object({ value: req(text(40)), label: req(text(80)) });
const POINT = object({
	title: req(text(120)),
	body: req(text(2000, true)),
	detail: text(4000, true),
	image: SRC,
	imageDark: SRC,
	scrollFrames: list(SRC, 30),
	video: SRC,
	variants: list(object({ label: req(text(60)), note: req(text(200)) }), 12),
	demo: { kind: 'enum', values: POINT_DEMOS },
	shots: list(object({ src: req(SRC), alt: req(text(200)) }), 20),
	icon: { kind: 'text', max: 40, pattern: /^fa-[a-z0-9-]+$/ },
	group: text(40),
});
const SWATCH = object({
	name: req(text(40)),
	accent: req(COLOR),
	lightBg: req(COLOR),
	lightText: req(COLOR),
	darkBg: req(COLOR),
	darkText: req(COLOR),
});
const CHAPTER = object({
	title: req(text(120)),
	lead: text(1000, true),
	facts: list(FACT, 12),
	points: req(list(POINT, 30)),
	image: object({ src: req(SRC), alt: req(text(200)), dark: SRC }),
	compare: list(
		object({
			label: req(text(80)),
			before: req({ kind: 'number', min: -1e9, max: 1e9 }),
			after: req({ kind: 'number', min: -1e9, max: 1e9 }),
			unit: req(text(20)),
		}),
		12
	),
	look: { kind: 'enum', values: CHAPTER_LOOKS },
	palette: list(SWATCH, 30),
	schema: list(
		object({
			path: req(text(120)),
			access: req(text(120)),
			fields: req(list(text(60), 40)),
			note: req(text(300)),
			parent: text(120),
			locked: BOOL,
		}),
		30
	),
});
const APP = object({
	label: req(text(40)),
	icon: req({ kind: 'appIcon' }),
	inDock: BOOL,
	play: BOOL,
	tone: { kind: 'enum', values: ['light', 'dark'] },
	barColor: COLOR,
	windowSize: object({
		width: req({ kind: 'number', min: 320, max: 2400 }),
		height: req({ kind: 'number', min: 240, max: 1600 }),
	}),
});

/** 프로젝트의 맨 위 필드. 덮어쓰기는 일부만 보내므로 맨 위는 모두 고를 수 있다 (안쪽 묶음의 필수는 그대로) */
const PROJECT_FIELDS: Record<keyof Omit<Project, 'id'>, Rule> = {
	name: text(80),
	look: { kind: 'enum', values: PROJECT_LOOKS },
	tagline: text(200),
	description: text(500, true),
	context: text(200),
	role: text(200),
	period: text(80),
	facts: list(FACT, 12),
	highlights: list(POINT, 30),
	build: list(POINT, 30),
	chapters: list(CHAPTER, 12),
	contributions: list(text(200), 30),
	timeline: list(object({ date: req(text(40)), label: req(text(200)) }), 40),
	usage: list(POINT, 20),
	structure: text(6000, true),
	gallery: list(object({ src: req(SRC), caption: req(text(200)) }), 40),
	credits: list(
		object({ role: req(text(80)), name: req(text(120)), by: req(text(120)), href: HREF, note: text(300) }),
		40
	),
	specs: list(object({ label: req(text(40)), value: req(text(300)) }), 20),
	stack: list(text(40), 20),
	language: text(40),
	url: HREF,
	demo: HREF,
	icon: SRC,
	app: APP,
	art: SRC,
	logo: SRC,
	image: SRC,
	controls: list(object({ keys: req(list(text(20), 8)), label: req(text(80)) }), 20),
	terminal: list(text(200), 40),
	conventions: list(object({ type: req(text(30)), description: req(text(200)) }), 20),
};

/** 꼭 있어야 하는 맨 위 필드 (지울 수 없다) */
const REQUIRED_FIELDS = new Set<string>([
	'name',
	'look',
	'tagline',
	'description',
	'context',
	'facts',
	'highlights',
	'build',
	'contributions',
	'specs',
	'stack',
	'language',
	'url',
	'image',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const hasControl = (value: string, multiline: boolean) =>
	[...value].some((char) => {
		const code = char.charCodeAt(0);
		if (multiline && (char === '\n' || char === '\t')) return false;
		return code < 0x20 || code === 0x7f;
	});

// URL은 브라우저와 Node 모두에 있다. 이 패키지는 DOM 타입을 넣지 않으므로 쓰는 만큼만 적는다
declare const URL: new (input: string) => { protocol: string; origin: string };

const isHttps = (value: string) => {
	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
};

/** 그림·영상 주소: 사이트 안의 경로(/imgs/…, 서버에 올린 파일은 https 주소) 또는 https. 따옴표·괄호·공백은 받지 않는다 */
const SITE_PATH = /^\/(?!\/)[^\s"'()<>\\]*$/;
/** 프로젝트 앱 아이콘: 이미지 폴더 기준 경로 (예: projects/newpick/app-icon.png) */
const IMAGE_PATH = /^(?!.*\.\.)[a-z0-9][a-z0-9/._-]*$/i;
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9.,%\s]+\))$/i;

/** 값을 규칙으로 검사한다. 틀린 곳은 errors에 경로와 함께 적고 undefined를 돌려준다 */
function check(value: unknown, rule: Rule, path: string, errors: string[]): unknown {
	const fail = (message: string) => {
		errors.push(`${path}: ${message}`);
		return undefined;
	};
	switch (rule.kind) {
		case 'text': {
			if (typeof value !== 'string') return fail('글자여야 합니다.');
			const trimmed = value.trim();
			if (trimmed.length > rule.max) return fail(`${rule.max}자까지입니다.`);
			if (hasControl(trimmed, rule.multiline ?? false))
				return fail(rule.multiline ? '쓸 수 없는 글자가 있습니다.' : '한 줄로 써 주세요.');
			if (rule.pattern && trimmed && !rule.pattern.test(trimmed)) return fail('모양이 맞지 않습니다.');
			return trimmed;
		}
		case 'href':
			if (typeof value !== 'string' || !isHttps(value.trim())) return fail('https:// 주소여야 합니다.');
			return value.trim();
		case 'src': {
			if (typeof value !== 'string') return fail('주소여야 합니다.');
			const trimmed = value.trim();
			if (!(SITE_PATH.test(trimmed) || (isHttps(trimmed) && !/[\s"'()<>\\]/.test(trimmed))))
				return fail('사이트 안 경로(/imgs/…)나 https:// 주소여야 합니다.');
			return trimmed;
		}
		case 'appIcon': {
			if (typeof value !== 'string') return fail('주소여야 합니다.');
			const trimmed = value.trim();
			if (!(IMAGE_PATH.test(trimmed) || (isHttps(trimmed) && !/[\s"'()<>\\]/.test(trimmed))))
				return fail('이미지 폴더 기준 경로(projects/…/icon.png)나 https:// 주소여야 합니다.');
			return trimmed;
		}
		case 'color':
			if (typeof value !== 'string' || !COLOR_VALUE.test(value.trim())) return fail('색(#rrggbb, rgb())이어야 합니다.');
			return value.trim();
		case 'enum':
			if (typeof value !== 'string' || !rule.values.includes(value))
				return fail(`${rule.values.join(', ')} 가운데 하나여야 합니다.`);
			return value;
		case 'number':
			if (typeof value !== 'number' || !Number.isFinite(value) || value < rule.min || value > rule.max)
				return fail(`${rule.min}~${rule.max} 사이의 숫자여야 합니다.`);
			return value;
		case 'bool':
			if (typeof value !== 'boolean') return fail('true나 false여야 합니다.');
			return value;
		case 'list': {
			if (!Array.isArray(value)) return fail('목록이어야 합니다.');
			if (value.length > rule.max) return fail(`${rule.max}개까지입니다.`);
			const items = value.map((item, index) => check(item, rule.of, `${path}[${index}]`, errors));
			return items.some((item) => item === undefined) ? undefined : items;
		}
		case 'object': {
			if (!isRecord(value)) return fail('묶음({ })이어야 합니다.');
			const out: Record<string, unknown> = {};
			let ok = true;
			for (const [key, field] of Object.entries(rule.fields)) {
				const raw = value[key];
				if (raw === undefined || raw === null) {
					if (field.required) {
						errors.push(`${path}.${key}: 꼭 있어야 합니다.`);
						ok = false;
					}
					continue;
				}
				const checked = check(raw, field.rule, `${path}.${key}`, errors);
				if (checked === undefined) ok = false;
				else out[key] = checked;
			}
			return ok ? out : undefined;
		}
	}
}

/**
 * 요청 본문을 검사해 저장할 값으로 바꾼다. 문제가 있으면 어디가 왜 틀렸는지 모두 모아 돌려준다.
 * 모르는 필드는 버리고, 글자는 앞뒤 공백을 지운다
 */
export function parseProjects(input: unknown): { value: SiteProjects } | { errors: string[] } {
	if (!isRecord(input) || !Array.isArray(input.items)) return { errors: ['items 목록을 보내 주세요.'] };
	if (JSON.stringify(input).length > PROJECTS_LIMITS.json)
		return { errors: [`프로젝트 내용이 너무 깁니다 (${PROJECTS_LIMITS.json.toLocaleString()}자까지).`] };
	if (input.items.length > PROJECTS_LIMITS.items)
		return { errors: [`프로젝트는 ${PROJECTS_LIMITS.items}개까지입니다.`] };

	const errors: string[] = [];
	const seen = new Set<string>();
	const items: ProjectEntry[] = [];
	input.items.forEach((raw, index) => {
		if (!isRecord(raw)) return void errors.push(`items[${index}]: 묶음이어야 합니다.`);
		const id = typeof raw.id === 'string' ? raw.id.trim() : '';
		const where = id ? `프로젝트 ${id}` : `items[${index}]`;
		if (!PROJECT_ID.test(id))
			return void errors.push(`${where}: id는 영어 소문자·숫자·-로 40자까지입니다 (첫 글자는 영어나 숫자).`);
		if ((RESERVED_PROJECT_IDS as readonly string[]).includes(id))
			return void errors.push(`${where}: '${id}'는 이 사이트의 앱 이름이라 쓸 수 없습니다.`);
		if (seen.has(id)) return void errors.push(`${where}: 같은 id가 두 번 있습니다.`);
		seen.add(id);

		const entry: ProjectEntry = { id };
		if (raw.hidden !== undefined) {
			if (typeof raw.hidden !== 'boolean') errors.push(`${where}.hidden: true나 false여야 합니다.`);
			else if (raw.hidden) entry.hidden = true;
		}
		if (raw.override !== undefined) {
			if (!isRecord(raw.override)) errors.push(`${where}.override: 묶음이어야 합니다.`);
			else {
				const override: Record<string, unknown> = {};
				for (const [key, rule] of Object.entries(PROJECT_FIELDS)) {
					const value = raw.override[key];
					if (value === undefined) continue;
					if (value === null) {
						if (REQUIRED_FIELDS.has(key)) errors.push(`${where}.${key}: 지울 수 없는 필드입니다.`);
						else override[key] = null;
						continue;
					}
					const checked = check(value, rule, `${where}.${key}`, errors);
					if (checked !== undefined) override[key] = checked;
				}
				if (Object.keys(override).length > 0) entry.override = override as ProjectOverride;
			}
		}
		items.push(entry);
	});

	if (errors.length) return { errors: errors.slice(0, 30) };
	return { value: { items } };
}

/** 저장해 둔 값(DB)을 읽을 때: 규칙에 맞으면 그 값, 아니면 null (코드의 기본값을 쓴다) */
export function readProjects(stored: unknown): SiteProjects | null {
	if (stored === null || stored === undefined) return null;
	const parsed = parseProjects(stored);
	return 'value' in parsed ? parsed.value : null;
}

/** 코드에 없는 새 프로젝트의 빈 바탕 (덮어쓸 값으로 채운다) */
export const blankProject = (id: string): Project => ({
	id,
	name: id,
	look: 'minimal',
	tagline: '',
	description: '',
	context: '',
	facts: [],
	highlights: [],
	build: [],
	contributions: [],
	specs: [],
	stack: [],
	language: '',
	url: '',
	image: '',
});

/**
 * 보일 프로젝트 목록: 서버에 둔 순서대로 코드의 기본값에 덮어쓰고, 숨긴 것은 빼고, 서버 목록에 없는 코드의 프로젝트는 끝에 붙인다.
 * 서버에 둔 것이 없으면 코드 그대로
 */
export function mergeProjects(defaults: readonly Project[], content: SiteProjects | null): Project[] {
	if (!content) return [...defaults];
	const byId = new Map(defaults.map((project) => [project.id, project]));
	const listed = new Set(content.items.map((entry) => entry.id));
	const merged: Project[] = [];
	for (const entry of content.items) {
		if (entry.hidden) continue;
		const project: Record<string, unknown> = { ...(byId.get(entry.id) ?? blankProject(entry.id)) };
		for (const [key, value] of Object.entries(entry.override ?? {})) {
			if (value === null) delete project[key];
			else project[key] = value;
		}
		merged.push({ ...(project as unknown as Project), id: entry.id });
	}
	return [...merged, ...defaults.filter((project) => !listed.has(project.id))];
}

/**
 * 코드의 기본값과 다른 맨 위 필드만 (저장할 덮어쓰기). 새 프로젝트면 id를 뺀 전부
 */
export function overrideOf(project: Project, base: Project | undefined): ProjectOverride {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(project)) {
		if (key === 'id' || value === undefined) continue;
		if (base && JSON.stringify(value) === JSON.stringify(base[key as keyof Project])) continue;
		out[key] = value;
	}
	// 기본값에 있던 필드를 지웠으면(예: 앱을 끔) null로 지운다고 적는다
	if (base)
		for (const key of Object.keys(base) as (keyof Project)[])
			if (key !== 'id' && project[key] === undefined && base[key] !== undefined) out[key] = null;
	return out as ProjectOverride;
}

/** iframe으로 띄울 수 있어야 하는 출처 (데모 주소): CSP의 frame-src에 넣는다 */
export function demoOrigins(projects: readonly Pick<Project, 'demo'>[]): string[] {
	const origins = new Set<string>();
	for (const { demo } of projects) {
		if (!demo) continue;
		try {
			const url = new URL(demo);
			if (url.protocol === 'https:') origins.add(url.origin);
		} catch {
			// 주소가 아니면 넣지 않는다
		}
	}
	return [...origins].sort();
}
