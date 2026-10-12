// 랜딩 페이지의 공통 내용: 어떤 프로젝트든 같은 짜임(첫 화면, 차례대로 놓이는 구역들, 마무리)으로 바꾼다.
// 템플릿(project/templates/*)은 이것만 읽어 자기 디자인으로 그린다. 값이 없는 구역은 아예 빠진다 (빈 구역을 그리지 않게).
// 화면에 기대지 않는 순수한 함수라 단위 시험으로 확인한다 (content.test.ts). 계약은 templates/README.md
import type { Project, ProjectFact, ProjectPoint } from '@/shared/profile';

/** 그림이나 짧은 영상 한 장 */
export interface LandingMedia {
	kind: 'image' | 'video';
	src: string;
	/** 보조 기술이 읽는 설명 (비면 장식) */
	alt: string;
	/** 같은 화면의 다크 테마 그림 (있으면 다크 테마에서 이것을 쓴다) */
	dark?: string;
}

/** 제목과 설명 한 덩어리 (주요 기능, 쓰는 법, 만든 방식, 이야기 안의 항목) */
export interface LandingPoint {
	title: string;
	body: string;
	/** 펼치거나 이어 읽는 긴 설명 */
	detail?: string;
	/** Font Awesome 이름 (예: fa-bolt). 없으면 템플릿이 fallbackIcon(차례)을 쓴다 */
	icon?: string;
	/** 같은 묶음 이름 (예: 쓰기, 운영) */
	group?: string;
	/** 보여 줄 그림·영상: 영상, 그림, 화면 여러 장 차례. 첫 장이 대표이고, 없으면 템플릿이 대신하는 비주얼(PointArt)을 그린다 */
	media: LandingMedia[];
}

/** 더 들려줄 이야기 한 장 (프로젝트의 chapters) */
export interface LandingStory {
	title: string;
	lead?: string;
	facts: ProjectFact[];
	points: LandingPoint[];
	image?: LandingMedia;
}

/** 화면 모음의 한 장 */
export interface LandingShot extends LandingMedia {
	caption: string;
}

/** 첫 화면과 마무리의 링크: 이 사이트 안에서 열기, 데모(새 탭), 저장소 */
export type LandingLink =
	| { kind: 'app'; label: string; app: string }
	| { kind: 'demo'; label: string; href: string }
	| { kind: 'repo'; label: string; href: string };

export interface LandingHero {
	name: string;
	/** 글자 로고 그림 (있으면 이름 대신) */
	logo?: string;
	icon?: string;
	/** 큰 제목 (tagline, 비면 이름) */
	headline: string;
	/** 한 줄 소개 (description) */
	subhead?: string;
	/** 어떤 프로젝트, 맡은 일, 기간 */
	meta: { context?: string; role?: string; period?: string };
	/** 대표 화면 (대표 화면이 없으면 화면 모음의 첫 그림) */
	image?: LandingMedia;
	links: LandingLink[];
}

/** 구역 이름: 화면의 구역(region) 이름이자 시험과 보조 기술이 찾는 이름 */
export const SECTION_LABELS = {
	stats: '한눈에 보는 숫자',
	features: '주요 기능',
	screens: '화면 모음',
	steps: '쓰는 법',
	built: '만든 방식',
	stories: '더 들려줄 이야기',
	controls: '조작법',
	timeline: '진행 과정',
	tech: '기술 사양',
	role: '맡은 일',
	credits: '출처',
} as const;

export type LandingSectionKind = keyof typeof SECTION_LABELS;

/** 구역 차례 (첫 화면 다음부터 마무리 앞까지) */
export const SECTION_ORDER: readonly LandingSectionKind[] = [
	'stats',
	'features',
	'screens',
	'steps',
	'built',
	'stories',
	'controls',
	'timeline',
	'tech',
	'role',
	'credits',
];

type Section<K extends LandingSectionKind, T> = { kind: K; label: (typeof SECTION_LABELS)[K] } & T;

export type LandingSection =
	| Section<'stats', { facts: ProjectFact[] }>
	| Section<'features', { items: LandingPoint[] }>
	| Section<'screens', { shots: LandingShot[] }>
	| Section<'steps', { items: LandingPoint[] }>
	| Section<'built', { items: LandingPoint[] }>
	| Section<'stories', { stories: LandingStory[] }>
	| Section<'controls', { controls: { keys: string[]; label: string }[] }>
	| Section<'timeline', { entries: { date: string; label: string }[] }>
	| Section<
			'tech',
			{
				/** 주 언어를 맨 앞에 둔 기술 이름 (겹치지 않게) */
				stack: string[];
				specs: { label: string; value: string }[];
				/** 폴더 구조 (고정폭 글꼴로 그대로) */
				structure?: string;
			}
	  >
	| Section<
			'role',
			{
				role?: string;
				period?: string;
				context?: string;
				contributions: string[];
			}
	  >
	| Section<'credits', { credits: { role: string; name: string; by: string; href?: string; note?: string }[] }>;

export type SectionOf<K extends LandingSectionKind> = Extract<LandingSection, { kind: K }>;

export interface Landing {
	id: string;
	hero: LandingHero;
	/** SECTION_ORDER 차례로, 값이 있는 구역만 */
	sections: LandingSection[];
	/** 마무리: 큰 문장과 링크 (언제나 있다) */
	closing: { title: string; lead?: string; links: LandingLink[] };
}

export interface LandingOptions {
	/** 이 사이트 안에서 창으로 여는 앱 이름 (apps/manifest.ts의 projectAppName). 없으면 '여기서 열기'가 없다 */
	app?: string | null;
}

export const isVideo = (src: string) => /\.(mp4|webm|mov)(\?|#|$)/i.test(src);

const clean = (value: string | undefined) => {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
};

const mediaOf = (src: string, alt: string, dark?: string): LandingMedia => ({
	kind: isVideo(src) ? 'video' : 'image',
	src,
	alt,
	...(dark && !isVideo(src) ? { dark } : {}),
});

/** 항목 하나 → 공통 항목. 그림 순서는 영상, 그림, 화면 여러 장 (같은 주소는 한 번만) */
export function pointOf(point: ProjectPoint): LandingPoint {
	const media: LandingMedia[] = [];
	const seen = new Set<string>();
	const add = (item: LandingMedia) => {
		if (!item.src || seen.has(item.src)) return;
		seen.add(item.src);
		media.push(item);
	};
	if (point.video) add(mediaOf(point.video, `${point.title} 영상`));
	if (point.image) add(mediaOf(point.image, `${point.title} 화면`, point.imageDark));
	for (const shot of point.shots ?? []) add(mediaOf(shot.src, shot.alt || point.title));
	return {
		title: point.title,
		body: point.body,
		...(clean(point.detail) ? { detail: point.detail } : {}),
		...(point.icon ? { icon: point.icon } : {}),
		...(clean(point.group) ? { group: point.group } : {}),
		media,
	};
}

/** 링크: 이 사이트 안에서 열기(앱이 있을 때), 데모, 저장소 */
export function linksOf(project: Project, app?: string | null): LandingLink[] {
	const links: LandingLink[] = [];
	if (app) links.push({ kind: 'app', label: project.app?.play ? '여기서 플레이' : '여기서 열기', app });
	if (project.demo) links.push({ kind: 'demo', label: app ? '새 탭에서 열기' : '데모 보기', href: project.demo });
	if (project.url) links.push({ kind: 'repo', label: 'GitHub에서 보기', href: project.url });
	return links;
}

/** 첫 화면의 그림: 대표 화면, 없으면 화면 모음의 첫 그림 (영상은 뺀다) */
export function heroImageOf(project: Project): LandingMedia | undefined {
	const src = clean(project.image) ?? project.gallery?.find((shot) => shot.src && !isVideo(shot.src))?.src;
	return src ? mediaOf(src, `${project.name} 화면`) : undefined;
}

/** 주 언어를 앞에 둔 기술 목록 (이미 있으면 한 번만) */
export const techOf = (project: Project) => {
	const stack = project.stack.filter((item) => item.trim());
	const language = clean(project.language);
	return language && !stack.includes(language) ? [language, ...stack] : stack;
};

/** 프로젝트 → 랜딩 페이지의 공통 내용 */
export function landingOf(project: Project, { app = null }: LandingOptions = {}): Landing {
	const links = linksOf(project, app);
	const heroImage = heroImageOf(project);
	const context = clean(project.context);
	const role = clean(project.role);
	const period = clean(project.period);
	const description = clean(project.description);

	const hero: LandingHero = {
		name: project.name,
		...(project.logo ? { logo: project.logo } : {}),
		...(project.icon ? { icon: project.icon } : {}),
		headline: clean(project.tagline) ?? project.name,
		...(description ? { subhead: description } : {}),
		meta: { ...(context ? { context } : {}), ...(role ? { role } : {}), ...(period ? { period } : {}) },
		...(heroImage ? { image: heroImage } : {}),
		links,
	};

	const gallery = (project.gallery ?? []).filter((shot) => shot.src);
	// 화면이 첫 화면의 그림 한 장뿐이면 다시 보여 주지 않는다
	const onlyHero = gallery.length === 1 && gallery[0].src === heroImage?.src;
	const tech = techOf(project);
	const structure = project.structure?.trim() ? project.structure : undefined;
	const contributions = project.contributions.filter((line) => line.trim());

	const candidates: { [K in LandingSectionKind]: SectionOf<K> | null } = {
		stats: project.facts.length ? { kind: 'stats', label: SECTION_LABELS.stats, facts: project.facts } : null,
		features: project.highlights.length
			? { kind: 'features', label: SECTION_LABELS.features, items: project.highlights.map(pointOf) }
			: null,
		screens:
			gallery.length && !onlyHero
				? {
						kind: 'screens',
						label: SECTION_LABELS.screens,
						shots: gallery.map((shot) => ({ ...mediaOf(shot.src, shot.caption), caption: shot.caption })),
					}
				: null,
		steps: project.usage?.length
			? { kind: 'steps', label: SECTION_LABELS.steps, items: project.usage.map(pointOf) }
			: null,
		built: project.build.length
			? { kind: 'built', label: SECTION_LABELS.built, items: project.build.map(pointOf) }
			: null,
		stories: project.chapters?.length
			? {
					kind: 'stories',
					label: SECTION_LABELS.stories,
					stories: project.chapters.map((chapter) => ({
						title: chapter.title,
						...(clean(chapter.lead) ? { lead: chapter.lead } : {}),
						facts: chapter.facts ?? [],
						points: chapter.points.map(pointOf),
						...(chapter.image
							? { image: mediaOf(chapter.image.src, chapter.image.alt || chapter.title, chapter.image.dark) }
							: {}),
					})),
				}
			: null,
		controls: project.controls?.length
			? { kind: 'controls', label: SECTION_LABELS.controls, controls: project.controls }
			: null,
		timeline: project.timeline?.length
			? { kind: 'timeline', label: SECTION_LABELS.timeline, entries: project.timeline }
			: null,
		tech:
			tech.length || project.specs.length || structure
				? {
						kind: 'tech',
						label: SECTION_LABELS.tech,
						stack: tech,
						specs: project.specs,
						...(structure ? { structure } : {}),
					}
				: null,
		role:
			contributions.length || role
				? {
						kind: 'role',
						label: SECTION_LABELS.role,
						...(role ? { role } : {}),
						...(period ? { period } : {}),
						...(context ? { context } : {}),
						contributions,
					}
				: null,
		credits: project.credits?.length
			? { kind: 'credits', label: SECTION_LABELS.credits, credits: project.credits }
			: null,
	};

	return {
		id: project.id,
		hero,
		sections: SECTION_ORDER.map((kind) => candidates[kind]).filter((section): section is LandingSection =>
			Boolean(section)
		),
		closing: { title: hero.headline, ...(description ? { lead: description } : {}), links },
	};
}

/** 그림이 없는 항목의 기본 아이콘 (차례대로 돌려 쓴다) */
const FALLBACK_ICONS = [
	'fa-wand-magic-sparkles',
	'fa-layer-group',
	'fa-bolt',
	'fa-shield-halved',
	'fa-chart-simple',
	'fa-comments',
	'fa-compass',
	'fa-puzzle-piece',
];

export const fallbackIcon = (index: number) => FALLBACK_ICONS[index % FALLBACK_ICONS.length];

/** 항목의 아이콘: 정해 둔 것, 없으면 차례에 맞는 기본 아이콘 */
export const iconOf = (point: Pick<LandingPoint, 'icon'>, index: number) => point.icon ?? fallbackIcon(index);

/** 구역의 기본 큰 제목 (템플릿이 eyebrow로 구역 이름을, 제목으로 이 문장을 쓸 수 있다) */
export function sectionTitle(section: LandingSection): string {
	switch (section.kind) {
		case 'stats':
			return '숫자로 먼저 보여 드립니다.';
		case 'features':
			return '필요한 것을 한곳에 담았습니다.';
		case 'screens':
			return '화면으로 먼저 둘러보세요.';
		case 'steps':
			return section.items.length > 1
				? `${section.items.length}단계면 시작할 수 있습니다.`
				: '이렇게 시작할 수 있습니다.';
		case 'built':
			return '보이지 않는 곳까지 다듬었습니다.';
		case 'stories':
			return '더 들려 드릴 이야기가 있습니다.';
		case 'controls':
			return '키보드로 이렇게 다룹니다.';
		case 'timeline':
			return '처음부터 마무리까지 이렇게 걸어왔습니다.';
		case 'tech':
			return '이런 기술로 만들었습니다.';
		case 'role':
			return '이 프로젝트에서 맡은 일입니다.';
		case 'credits':
			return '빌려 쓴 것들의 출처입니다.';
	}
}
