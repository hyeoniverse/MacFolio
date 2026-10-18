// 랜딩 페이지의 공통 내용: 어떤 프로젝트든 같은 짜임(첫 화면, 차례대로 놓이는 구역들, 마무리)으로 바꾼다.
// 템플릿(project/templates/*)은 이것만 읽어 자기 디자인으로 그린다. 값이 없는 구역은 아예 빠진다 (빈 구역을 그리지 않게).
// 화면에 기대지 않는 순수한 함수라 단위 시험으로 확인한다 (content.test.ts). 계약은 templates/README.md
import type {
	Project,
	ProjectDeployment,
	ProjectFact,
	ProjectMember,
	ProjectPoint,
	ProjectTrouble,
} from '@/shared/profile';

/** 그림이나 짧은 영상 한 장 */
export interface LandingMedia {
	kind: 'image' | 'video';
	src: string;
	/** 보조 기술이 읽는 설명 (비면 장식) */
	alt: string;
	/** 같은 화면의 다크 테마 그림 (있으면 다크 테마에서 이것을 쓴다) */
	dark?: string;
}

/** 제목과 설명 한 덩어리 (주요 기능, 쓰는 법, 구현 방법, 이야기 안의 항목) */
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
	| { kind: 'repo'; label: string; href: string }
	/**
	 * 발표 자료: Finder › 프로젝트 › <프로젝트> 폴더에 올린 PDF (이름순 첫 PDF)를 미리보기 앱에서 연다.
	 * 문서 목록을 보아야 알 수 있어 언제나 넣어 두고, 그릴 때 PDF가 없으면 뺀다 (slides.ts의 useShownLinks)
	 */
	| { kind: 'slides'; label: string; projectId: string };

/** 그릴 때 빠질 수 있는 발표 자료를 뺀 링크가 있는지 */
export const hasLinks = (links: LandingLink[]) => links.some((link) => link.kind !== 'slides');

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
	built: '구현 방법',
	troubleshooting: '트러블슈팅',
	stories: '더 들려줄 이야기',
	controls: '조작법',
	tech: '기술 사양',
	team: '팀원',
	role: '내 역할',
	timeline: '진행 과정',
	deployments: '배포 결과물',
	credits: '출처',
} as const;

export type LandingSectionKind = keyof typeof SECTION_LABELS;

/**
 * 구역 차례 (첫 화면 다음부터 마무리 앞까지). 포트폴리오를 읽는 차례를 따른다:
 * 무엇인지(숫자·기능·화면·쓰는 법) → 어떻게 만들었는지(구현 방법·트러블슈팅·이야기·조작법·기술) →
 * 누가 만들었는지(팀원·내 역할) → 언제(진행 과정) → 어디서 볼 수 있는지(배포 결과물) → 출처
 */
export const SECTION_ORDER: readonly LandingSectionKind[] = [
	'stats',
	'features',
	'screens',
	'steps',
	'built',
	'troubleshooting',
	'stories',
	'controls',
	'tech',
	'team',
	'role',
	'timeline',
	'deployments',
	'credits',
];

/** 트러블슈팅 한 건: 문제 → 원인 → 해결 → 결과 */
export interface LandingTrouble {
	title: string;
	problem: string;
	cause?: string;
	solution: string;
	result?: string;
	/** Font Awesome 이름. 없으면 템플릿이 fa-bug 같은 기본 아이콘을 쓴다 */
	icon?: string;
	image?: LandingMedia;
}

/** 팀원 한 사람 */
export interface LandingMember {
	name: string;
	role: string;
	url?: string;
	avatar?: string;
	/** 이름 첫 글자 (사진이 없을 때 그리는 동그라미) */
	initials: string;
	me: boolean;
}

/** 배포 결과물 한 곳 */
export interface LandingDeployment {
	label: string;
	url?: string;
	platform?: string;
	note?: string;
	/** 올린 곳에 맞는 아이콘 (Font Awesome) */
	icon: string;
	/** 주소에서 뽑은 짧은 호스트 이름 (예: bookclub.vercel.app) */
	host?: string;
	image?: LandingMedia;
}

type Section<K extends LandingSectionKind, T> = { kind: K; label: (typeof SECTION_LABELS)[K] } & T;

export type LandingSection =
	| Section<'stats', { facts: ProjectFact[] }>
	| Section<'features', { items: LandingPoint[] }>
	| Section<'screens', { shots: LandingShot[] }>
	| Section<'steps', { items: LandingPoint[] }>
	| Section<'built', { items: LandingPoint[] }>
	| Section<'troubleshooting', { items: LandingTrouble[] }>
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
	| Section<'team', { members: LandingMember[] }>
	| Section<'deployments', { items: LandingDeployment[] }>
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
	links.push({ kind: 'slides', label: '발표 자료 보기', projectId: project.id });
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

/** 이름의 첫 글자 (한글은 첫 글자, 영어는 두 낱말의 머리글자) */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (!words.length) return '?';
	if (/^[A-Za-z]/.test(words[0]) && words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
	return [...words[0]][0].toUpperCase();
}

/** 팀원 주소를 짧게: GitHub는 github.com/아이디, 다른 곳은 프로토콜과 www.를 뺀 주소 (끝의 /도 뺀다) */
export function shortLink(url: string): string {
	try {
		const parsed = new URL(url);
		const host = parsed.host.replace(/^www\./, '');
		const path = parsed.pathname.replace(/\/+$/, '');
		if (host === 'github.com') {
			const user = path.split('/').filter(Boolean)[0];
			return user ? `${host}/${user}` : host;
		}
		return `${host}${path}`;
	} catch {
		return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
	}
}

/** 올린 곳·주소에 맞는 아이콘 (모르면 지구본) */
export function deploymentIcon(platform: string | undefined, url: string | undefined): string {
	const key = `${platform ?? ''} ${url ?? ''}`.toLowerCase();
	const table: [RegExp, string][] = [
		[/app ?store|apps\.apple|testflight|ios/, 'fa-app-store-ios'],
		[/google ?play|play\.google|android/, 'fa-google-play'],
		[/npm/, 'fa-npm'],
		[/github|ghcr/, 'fa-github'],
		[/docker/, 'fa-docker'],
		[/figma/, 'fa-figma'],
		[/notion/, 'fa-book-open'],
		[/vercel|netlify|pages|firebase|web/, 'fa-globe'],
		[/aws|cloud|server|api|render|fly\.io|railway|ec2/, 'fa-server'],
		[/docs?|문서|swagger/, 'fa-book-open'],
	];
	return table.find(([pattern]) => pattern.test(key))?.[1] ?? 'fa-globe';
}

const BRAND_ICONS = new Set(['fa-app-store-ios', 'fa-google-play', 'fa-npm', 'fa-github', 'fa-docker', 'fa-figma']);

/** 아이콘 이름 → Font Awesome 클래스 (브랜드 아이콘은 fa-brands) */
export const faClass = (icon: string) => `${BRAND_ICONS.has(icon) ? 'fa-brands' : 'fa-solid'} ${icon}`;

/** 트러블슈팅의 단계: 문제 → 원인 → 해결 → 결과 (빈 단계는 뺀다) */
export type TroubleStepKey = 'problem' | 'cause' | 'solution' | 'result';
export const TROUBLE_STEP_LABELS: Record<TroubleStepKey, string> = {
	problem: '문제',
	cause: '원인',
	solution: '해결',
	result: '결과',
};
export function troubleSteps(item: LandingTrouble): { key: TroubleStepKey; label: string; text: string }[] {
	return (['problem', 'cause', 'solution', 'result'] as const).flatMap((key) => {
		const text = item[key];
		return text ? [{ key, label: TROUBLE_STEP_LABELS[key], text }] : [];
	});
}

/** 트러블슈팅의 아이콘: 정해 둔 것, 없으면 벌레 */
export const troubleIcon = (item: Pick<LandingTrouble, 'icon'>) => item.icon ?? 'fa-bug';

const hostOf = (url: string | undefined) => {
	if (!url) return undefined;
	try {
		return new URL(url).host.replace(/^www\./, '');
	} catch {
		return undefined;
	}
};

const troubleOf = (item: ProjectTrouble): LandingTrouble => ({
	title: item.title,
	problem: item.problem,
	...(clean(item.cause) ? { cause: item.cause } : {}),
	solution: item.solution,
	...(clean(item.result) ? { result: item.result } : {}),
	...(item.icon ? { icon: item.icon } : {}),
	...(item.image ? { image: mediaOf(item.image, `${item.title} 화면`) } : {}),
});

const memberOf = (member: ProjectMember): LandingMember => ({
	name: member.name,
	role: member.role,
	...(member.url ? { url: member.url } : {}),
	...(member.avatar ? { avatar: member.avatar } : {}),
	initials: initialsOf(member.name),
	me: Boolean(member.me),
});

const deploymentOf = (item: ProjectDeployment): LandingDeployment => {
	const host = hostOf(item.url);
	return {
		label: item.label,
		...(item.url ? { url: item.url } : {}),
		...(clean(item.platform) ? { platform: item.platform } : {}),
		...(clean(item.note) ? { note: item.note } : {}),
		icon: deploymentIcon(item.platform, item.url),
		...(host ? { host } : {}),
		...(item.image ? { image: mediaOf(item.image, `${item.label} 화면`) } : {}),
	};
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
		troubleshooting: project.troubleshooting?.length
			? {
					kind: 'troubleshooting',
					label: SECTION_LABELS.troubleshooting,
					items: project.troubleshooting.map(troubleOf),
				}
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
		team: project.team?.length
			? { kind: 'team', label: SECTION_LABELS.team, members: project.team.map(memberOf) }
			: null,
		deployments: project.deployments?.length
			? { kind: 'deployments', label: SECTION_LABELS.deployments, items: project.deployments.map(deploymentOf) }
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
		closing: closingOf(hero, links),
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
		case 'troubleshooting':
			return '부딪힌 문제를 이렇게 풀었습니다.';
		case 'team':
			return '함께 만든 사람들입니다.';
		case 'deployments':
			return '결과물은 이곳에서 확인할 수 있습니다.';
		case 'stories':
			return '더 들려 드릴 이야기가 있습니다.';
		case 'controls':
			return '키보드로 이렇게 다룹니다.';
		case 'timeline':
			return '처음부터 마무리까지 이렇게 걸어왔습니다.';
		case 'tech':
			return '이런 기술로 만들었습니다.';
		case 'role':
			return '이 프로젝트에서 제가 맡은 역할입니다.';
		case 'credits':
			return '빌려 쓴 것들의 출처입니다.';
	}
}

/**
 * 마무리: 첫 화면의 제목과 소개를 되풀이하지 않는다. 써 볼 곳이 있으면 써 보기를, 저장소만 있으면 살펴보기를 권하고
 * 이름을 덧붙인다. 링크가 하나도 없으면 이름만 둔다 (빈 프로젝트)
 */
function closingOf(hero: LandingHero, links: LandingLink[]): Landing['closing'] {
	if (!hasLinks(links)) return { title: hero.name, links };
	const tryable = links.some((link) => link.kind === 'app' || link.kind === 'demo');
	return {
		title: tryable ? '지금 바로 써 볼 수 있습니다.' : '코드와 기록을 살펴볼 수 있습니다.',
		lead: hero.name,
		links,
	};
}
