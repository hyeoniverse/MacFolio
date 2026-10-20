import {
	blankProject,
	mergeProjects,
	overrideOf,
	parseProjects,
	type Project,
	type ProjectChapter,
	type ProjectPoint,
	type ProjectLook,
	type SiteProjects,
} from '@macfolio/desktop-core/site';
import { DEFAULT_PROJECTS, PROJECTS } from '@/shared/profile';
import { DEFAULT_PROFILE } from '@/shared/site/profileStore';
import { searchPackages } from '../packageSearch';
import { languageOptions, stackOptions } from '../projectInputs';
import { PARSE_OPTIONS } from '@/shared/site/siteContent';
import { captionOf, groupedImageFolders } from '@/shared/site/publicImages';
import { PROJECT_APPS } from '@/apps/manifest';
import { ALBUMS, albumsOf } from '@/apps/photos/albums';

/** 목록의 한 줄: 프로젝트 하나 (코드의 기본값에 덮어쓴 모습) */
export interface Row {
	id: string;
	hidden: boolean;
	project: Project;
	/** 코드에 없는, 관리자가 더한 프로젝트 (지울 수 있다) */
	isNew: boolean;
}

export const DEFAULTS = new Map(DEFAULT_PROJECTS.map((project) => [project.id, project]));

/** 그림 고르기 팝업의 폴더 묶음: 프로젝트 폴더(id)별로 묶고, 묶음 이름은 그 프로젝트의 이름 */
export const FOLDER_GROUPS = groupedImageFolders(
	(id) => [...PROJECTS, ...DEFAULT_PROJECTS].find((project) => project.id === id)?.name
);

/** 언어·기술 칸의 후보: 지금 보이는 프로젝트와 코드의 프로젝트, 사이트 주인의 기술 */
export const LANGUAGES = languageOptions([...PROJECTS, ...DEFAULT_PROJECTS]);
/** 기술 칸의 바깥 후보: npm 레지스트리 (코드의 목록에 없는 라이브러리) */
export const NPM = { name: 'npm', search: searchPackages };

export const STACKS = stackOptions(
	[...PROJECTS, ...DEFAULT_PROJECTS.filter((project) => !PROJECTS.some((shown) => shown.id === project.id))],
	[...Object.values(DEFAULT_PROFILE.skills).flat(), ...DEFAULT_PROFILE.siteStack]
);

/** 페이지 모양 카드의 이름과 짧은 설명 */
export const LOOKS: Record<ProjectLook, { name: string; note: string }> = {
	product: { name: '제품', note: '큰 화면과 큰 문장' },
	friendly: { name: '카드', note: '밝은 카드와 아이콘' },
	paper: { name: '문서', note: '토글과 알림 상자' },
	bento: { name: '벤토', note: '타일 격자' },
	keynote: { name: '키노트', note: '어두운 무대의 큰 장면' },
	magazine: { name: '매거진', note: '세리프와 큰 사진' },
	devtool: { name: '개발자 도구', note: '코드와 고정폭 글꼴' },
	repo: { name: '저장소', note: 'GitHub 저장소 화면' },
	playful: { name: '놀이', note: '또렷한 색과 둥근 도형' },
	custom: { name: '직접 짠 페이지', note: '코드' },
};

/** 앱이 쓰는 프로젝트 값 (Dock·Launchpad의 앱 목록은 시작할 때 한 번 정한다: apps/manifest.ts) */
const appSignature = (projects: readonly Project[]) =>
	JSON.stringify(
		projects.filter((project) => project.app && project.demo).map(({ id, demo, app }) => ({ id, demo, app }))
	);

/** 저장한 뒤 새로고침해야 하는지: 앱 목록이나 사진 앨범(시작할 때 한 번 정함)이 바뀌었을 때 */
export const needsReload = () =>
	appSignature(PROJECTS) !== appSignature(PROJECT_APPS) ||
	JSON.stringify(albumsOf(PROJECTS)) !== JSON.stringify(ALBUMS);

/** 서버에 둔 순서대로, 서버 목록에 없는 코드의 프로젝트는 끝에 (숨긴 것도 목록에는 보인다) */
export function rowsFrom(saved: SiteProjects | null): Row[] {
	const items = saved?.items ?? [];
	const rows: Row[] = items.map((entry) => ({
		id: entry.id,
		hidden: Boolean(entry.hidden),
		project: mergeProjects([DEFAULTS.get(entry.id) ?? blankProject(entry.id)], {
			items: [{ ...entry, hidden: false }],
		})[0],
		isNew: !DEFAULTS.has(entry.id),
	}));
	for (const project of DEFAULT_PROJECTS)
		if (!items.some((entry) => entry.id === project.id))
			rows.push({ id: project.id, hidden: false, project, isNew: false });
	return rows;
}

/** 저장할 내용: 줄마다 순서·숨김과, 코드의 기본값과 다른 필드만 */
export function contentFrom(rows: Row[]): SiteProjects {
	return {
		items: rows.map((row) => {
			const override = overrideOf(row.project, DEFAULTS.get(row.id)) ?? {};
			return {
				id: row.id,
				...(row.hidden ? { hidden: true } : {}),
				...(Object.keys(override).length ? { override } : {}),
			};
		}),
	};
}

export const withoutId = ({ id: _id, ...rest }: Project) => rest;

/** 적은 내용이 있는지 (예시로 채우기 전에 물어볼지): id·저장소·데모·앱·모양과 처음 이름은 내용으로 치지 않는다 */
export const hasContent = (project: Project) => {
	const { id: _id, url: _url, demo: _demo, app: _app, look: _look, name, ...rest } = project;
	const { id: _bid, url: _burl, look: _blook, name: _bname, ...blank } = blankProject('');
	return (name.trim() !== '' && name !== '새 프로젝트') || JSON.stringify(rest) !== JSON.stringify(blank);
};

/** 맨 위에서 꼭 있어야 하는 필드 (고급 JSON으로 통째로 바꿀 때 확인) */
export const REQUIRED: (keyof Project)[] = [
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
];

/** 프로젝트 하나를 검사한다 (서버와 같은 규칙). 앱은 데모 주소가 있어야 한다 */
/** 목록에서 비워 둔 줄은 뺀다 (더하기만 누르고 안 적은 것) */
function tidy(project: Project): Project {
	// 화면 여러 장: 그림을 고르지 않은 줄은 빼고, 설명을 비우면 항목 제목을 쓴다
	const point = (item: ProjectPoint): ProjectPoint => {
		const shots = item.shots
			?.filter((shot) => shot.src.trim())
			.map((shot) => ({ ...shot, alt: shot.alt.trim() || item.title }));
		const out = { ...item, shots };
		if (!shots?.length) delete out.shots;
		return out;
	};
	const points = (list?: ProjectPoint[]) => list?.filter((item) => item.title.trim() || item.body.trim()).map(point);
	const pairs = <T extends object>(list?: T[]) =>
		list?.filter((row) => Object.values(row as Record<string, unknown>).some((value) => String(value ?? '').trim()));
	const chapters = project.chapters
		?.filter((chapter) => chapter.title.trim() || chapter.lead?.trim() || chapter.points.length)
		.map((chapter) => {
			const out: ProjectChapter = { ...chapter, points: points(chapter.points) ?? [] };
			const facts = pairs(chapter.facts);
			if (facts?.length) out.facts = facts;
			else delete out.facts;
			// 장 그림의 설명을 비우면 장 제목을 쓴다 (설명은 꼭 있어야 한다)
			if (out.image?.src) out.image = { ...out.image, alt: out.image.alt.trim() || chapter.title };
			else delete out.image;
			return out;
		});
	const next: Project = {
		...project,
		facts: pairs(project.facts) ?? [],
		highlights: points(project.highlights) ?? [],
		build: points(project.build) ?? [],
		usage: points(project.usage),
		chapters,
		timeline: pairs(project.timeline),
		specs: pairs(project.specs) ?? [],
		contributions: project.contributions.map((line) => line.trim()).filter(Boolean),
		controls: project.controls
			?.map((control) => ({ ...control, keys: control.keys.map((key) => key.trim()).filter(Boolean) }))
			.filter((control) => control.keys.length || control.label.trim()),
		credits: pairs(project.credits),
		conventions: pairs(project.conventions),
		troubleshooting: project.troubleshooting?.filter(
			(item) => item.title.trim() || item.problem.trim() || item.solution.trim()
		),
		team: project.team?.filter((member) => member.name.trim() || member.role.trim()),
		deployments: project.deployments?.filter((item) => item.label.trim() || item.url?.trim()),
		// 화면 모음: 그림이 없는 줄은 빼고, 설명을 비우면 파일 이름에서 지은 설명을 쓴다
		gallery: project.gallery
			?.filter((shot) => shot.src.trim())
			.map((shot) => ({ ...shot, caption: shot.caption.trim() || captionOf(shot.src) })),
	};
	for (const key of [
		'usage',
		'chapters',
		'timeline',
		'controls',
		'credits',
		'conventions',
		'gallery',
		'troubleshooting',
		'team',
		'deployments',
	] as const)
		if (!next[key]?.length) delete next[key];
	return next;
}

export function validate(id: string, raw: Project): { value: Project } | { errors: string[] } {
	const project = tidy(raw);
	// 꼭 적어야 하는 칸 (화면에 '필수'로 표시한 칸)
	const missing = [
		!project.name.trim() && '이름을 입력해 주세요.',
		!project.url.trim() && '저장소 주소를 입력해 주세요.',
		project.app && !project.app.label.trim() && '앱 이름을 입력해 주세요.',
		project.app && !project.app.icon.trim() && '앱 아이콘을 입력해 주세요.',
	].filter((error): error is string => Boolean(error));
	if (missing.length) return { errors: missing };
	const parsed = parseProjects({ items: [{ id, override: withoutId(project) }] }, PARSE_OPTIONS);
	if ('errors' in parsed) return parsed;
	const value = { id, ...parsed.value.items[0].override } as Project;
	if (value.app && !value.demo) return { errors: ['앱으로 열려면 데모 주소가 있어야 합니다.'] };
	return { value };
}

/* ─── 편집 화면의 틀 (macOS 시스템 설정): 회색 바탕 위 둥근 묶음 상자, 상자 안의 줄은 왼쪽 이름 · 오른쪽 컨트롤 ─── */

/** 빈 글자는 필드를 지운다 (고를 수 있는 필드) */
export const optional = (value: string) => (value.trim() ? value : undefined);
