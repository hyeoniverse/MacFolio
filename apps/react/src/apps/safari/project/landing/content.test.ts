import { describe, expect, it } from 'vitest';
import { blankProject, type Project } from '@macfolio/desktop-core/site';
import { GENERAL_SAMPLE } from '@/apps/settings/lookSamples';
import {
	deploymentIcon,
	faClass,
	iconOf,
	initialsOf,
	landingOf,
	pointOf,
	SECTION_LABELS,
	SECTION_ORDER,
	shortLink,
	troubleSteps,
	type LandingSectionKind,
} from './content';

const empty = (extra: Partial<Project> = {}): Project => ({
	...blankProject('empty'),
	name: '빈 프로젝트',
	url: 'https://github.com/me/empty',
	...extra,
});

const sample: Project = { ...structuredClone(GENERAL_SAMPLE), id: 'sample', url: 'https://github.com/me/sample' };

const kinds = (project: Project) => landingOf(project).sections.map((section) => section.kind);

describe('landingOf', () => {
	it('비어 있는 구역은 모두 빠지고, 첫 화면과 마무리는 언제나 있다', () => {
		const landing = landingOf(empty());
		expect(landing.sections).toEqual([]);
		expect(landing.hero).toEqual({
			name: '빈 프로젝트',
			headline: '빈 프로젝트',
			meta: {},
			// 발표 자료는 언제나 끝에 두고, 그릴 때 프로젝트 폴더에 PDF가 없으면 뺀다
			links: [
				{ kind: 'repo', label: 'GitHub에서 보기', href: 'https://github.com/me/empty' },
				{ kind: 'slides', label: '발표 자료 보기', projectId: 'empty' },
			],
		});
		expect(landing.closing).toEqual({
			title: '코드와 기록을 살펴볼 수 있습니다.',
			lead: '빈 프로젝트',
			links: landing.hero.links,
		});
		// 공백만 적은 값도 빈 값으로 본다
		const blanks = landingOf(empty({ tagline: '  ', role: ' ', structure: '\n', contributions: [' '] }));
		expect(blanks.sections).toEqual([]);
		expect(blanks.hero.headline).toBe('빈 프로젝트');
	});

	it('구역은 정해진 차례로 놓이고, 이름은 화면의 구역 이름과 같다', () => {
		const landing = landingOf(sample);
		const present = landing.sections.map((section) => section.kind);
		expect(present).toEqual(SECTION_ORDER.filter((kind) => present.includes(kind)));
		// 예시는 모든 구역을 채운다
		expect(present).toEqual(SECTION_ORDER);
		for (const section of landing.sections) expect(section.label).toBe(SECTION_LABELS[section.kind]);
		expect(SECTION_LABELS).toMatchObject({
			features: '주요 기능',
			steps: '쓰는 법',
			built: '구현 방법',
			troubleshooting: '트러블슈팅',
			tech: '기술 사양',
			team: '팀원',
			role: '내 역할',
			screens: '화면 모음',
			timeline: '진행 과정',
			deployments: '배포 결과물',
		});
		// 포트폴리오를 읽는 차례: 무엇 → 어떻게 → 누가 → 언제 → 어디서
		expect(SECTION_ORDER).toEqual([
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
		]);
	});

	it('값이 있는 구역만 하나씩 생긴다', () => {
		const cases: [Partial<Project>, LandingSectionKind][] = [
			[{ facts: [{ value: '6주', label: '기간' }] }, 'stats'],
			[{ highlights: [{ title: '기능', body: '설명' }] }, 'features'],
			[
				{
					gallery: [
						{ src: '/imgs/a.jpg', caption: '가' },
						{ src: '/imgs/b.jpg', caption: '나' },
					],
				},
				'screens',
			],
			[{ usage: [{ title: '단계', body: '설명' }] }, 'steps'],
			[{ build: [{ title: '방식', body: '설명' }] }, 'built'],
			[{ chapters: [{ title: '장', points: [] }] }, 'stories'],
			[{ controls: [{ keys: ['Space'], label: '뛰기' }] }, 'controls'],
			[{ timeline: [{ date: '2025.01', label: '시작' }] }, 'timeline'],
			[{ stack: ['React'] }, 'tech'],
			[{ language: 'Go' }, 'tech'],
			[{ specs: [{ label: '서버', value: 'Go' }] }, 'tech'],
			[{ structure: 'src/' }, 'tech'],
			[{ contributions: ['화면'] }, 'role'],
			[{ role: '프론트엔드' }, 'role'],
			[{ credits: [{ role: '글꼴', name: 'Pretendard', by: '길형진' }] }, 'credits'],
			[{ troubleshooting: [{ title: '문제', problem: '느림', solution: '나눔' }] }, 'troubleshooting'],
			[{ team: [{ name: '김', role: '화면' }] }, 'team'],
			[{ deployments: [{ label: '웹' }] }, 'deployments'],
		];
		for (const [extra, kind] of cases) expect(kinds(empty(extra)), kind).toEqual([kind]);
	});

	it('첫 화면의 그림: 대표 화면, 없으면 화면 모음의 첫 그림(영상은 건너뛴다), 둘 다 없으면 없음', () => {
		const gallery = [
			{ src: '/imgs/clip.mp4', caption: '영상' },
			{ src: '/imgs/one.jpg', caption: '하나' },
			{ src: '/imgs/two.jpg', caption: '둘' },
		];
		expect(landingOf(empty({ image: '/imgs/hero.jpg', gallery })).hero.image).toEqual({
			kind: 'image',
			src: '/imgs/hero.jpg',
			alt: '빈 프로젝트 화면',
		});
		expect(landingOf(empty({ gallery })).hero.image?.src).toBe('/imgs/one.jpg');
		expect(landingOf(empty()).hero.image).toBeUndefined();
		// 화면 모음이 첫 화면의 그림 한 장뿐이면 화면 모음 구역은 없다 (같은 그림을 두 번 보이지 않게)
		expect(kinds(empty({ gallery: [gallery[1]] }))).toEqual([]);
		expect(kinds(empty({ image: '/imgs/hero.jpg', gallery: [gallery[1]] }))).toEqual(['screens']);
	});

	it('링크: 앱이 있으면 여기서 열기와 새 탭, 없으면 데모 보기, 저장소는 언제나', () => {
		const project = empty({ demo: 'https://demo.example' });
		expect(landingOf(project, { app: 'empty' }).hero.links).toEqual([
			{ kind: 'app', label: '여기서 열기', app: 'empty' },
			{ kind: 'demo', label: '새 탭에서 열기', href: 'https://demo.example' },
			{ kind: 'repo', label: 'GitHub에서 보기', href: 'https://github.com/me/empty' },
			{ kind: 'slides', label: '발표 자료 보기', projectId: 'empty' },
		]);
		expect(landingOf(project).hero.links.map((link) => link.label)).toEqual([
			'데모 보기',
			'GitHub에서 보기',
			'발표 자료 보기',
		]);
		const game = { ...project, app: { label: '게임', icon: 'projects/x/icon.png', play: true } };
		expect(landingOf(game, { app: 'empty' }).hero.links[0].label).toBe('여기서 플레이');
		// 저장소 주소가 비어 있는 새 프로젝트는 저장소 링크가 없다
		const bare = landingOf(empty({ url: '' }));
		expect(bare.hero.links).toEqual([{ kind: 'slides', label: '발표 자료 보기', projectId: 'empty' }]);
		expect(bare.closing).toEqual({ title: '빈 프로젝트', links: bare.hero.links });
	});

	it('항목의 그림은 영상, 그림(다크 짝과 함께), 화면 여러 장 차례이고 같은 주소는 한 번만', () => {
		expect(
			pointOf({
				title: '기능',
				body: '설명',
				image: '/imgs/a.jpg',
				imageDark: '/imgs/a-dark.jpg',
				video: '/imgs/a.mp4',
				shots: [
					{ src: '/imgs/a.jpg', alt: '같은 그림' },
					{ src: '/imgs/b.jpg', alt: '' },
				],
				icon: 'fa-bolt',
			})
		).toEqual({
			title: '기능',
			body: '설명',
			icon: 'fa-bolt',
			media: [
				{ kind: 'video', src: '/imgs/a.mp4', alt: '기능 영상' },
				{ kind: 'image', src: '/imgs/a.jpg', alt: '기능 화면', dark: '/imgs/a-dark.jpg' },
				{ kind: 'image', src: '/imgs/b.jpg', alt: '기능' },
			],
		});
		expect(iconOf({}, 2)).toMatch(/^fa-/);
		expect(iconOf({ icon: 'fa-lock' }, 2)).toBe('fa-lock');
	});

	it('편집 화면이 고치는 칸은 하나도 버리지 않는다 (예시의 값이 모두 랜딩 내용 어딘가에 있다)', () => {
		const landing = landingOf(sample, { app: 'sample' });
		const text = JSON.stringify(landing);
		const section = <K extends LandingSectionKind>(kind: K) =>
			landing.sections.find((item) => item.kind === kind) as Extract<(typeof landing.sections)[number], { kind: K }>;

		expect(landing.hero).toMatchObject({
			name: sample.name,
			icon: sample.icon,
			headline: sample.tagline,
			subhead: sample.description,
			meta: { context: sample.context, role: sample.role, period: sample.period },
			image: { src: sample.image },
		});
		expect(section('stats').facts).toEqual(sample.facts);
		expect(section('features').items.map((item) => item.title)).toEqual(sample.highlights.map((point) => point.title));
		expect(section('steps').items).toHaveLength(sample.usage?.length ?? 0);
		expect(section('built').items).toHaveLength(sample.build.length);
		expect(section('screens').shots.map((shot) => [shot.src, shot.caption])).toEqual(
			sample.gallery?.map((shot) => [shot.src, shot.caption])
		);
		expect(section('stories').stories.map((story) => story.title)).toEqual(
			sample.chapters?.map((chapter) => chapter.title)
		);
		expect(section('controls').controls).toEqual(sample.controls);
		expect(section('timeline').entries).toEqual(sample.timeline);
		expect(section('tech')).toMatchObject({ specs: sample.specs, structure: sample.structure });
		expect(section('tech').stack).toEqual(expect.arrayContaining([sample.language, ...sample.stack]));
		expect(section('role').contributions).toEqual(sample.contributions);
		expect(section('credits').credits).toEqual(sample.credits);
		expect(section('troubleshooting').items).toHaveLength(sample.troubleshooting?.length ?? 0);
		expect(section('team').members.map((member) => [member.name, member.role, member.url, member.avatar])).toEqual(
			sample.team?.map((member) => [member.name, member.role, member.url, member.avatar])
		);
		expect(section('team').members.filter((member) => member.me)).toHaveLength(1);
		expect(section('deployments').items.map((item) => [item.label, item.url, item.platform, item.note])).toEqual(
			sample.deployments?.map((item) => [item.label, item.url, item.platform, item.note])
		);
		for (const item of sample.troubleshooting ?? [])
			for (const value of [item.title, item.problem, item.cause, item.solution, item.result, item.image, item.icon])
				if (value) expect(text, value).toContain(JSON.stringify(value).slice(1, -1));
		for (const item of sample.deployments ?? []) if (item.image) expect(text).toContain(item.image);

		// 항목 안의 칸(설명·자세히·아이콘·그림·화면 여러 장)도 그대로
		const points = [
			...sample.highlights,
			...sample.build,
			...(sample.usage ?? []),
			...(sample.chapters ?? []).flatMap((chapter) => chapter.points),
		];
		for (const point of points) {
			for (const value of [point.title, point.body, point.detail, point.icon, point.image, point.video])
				if (value) expect(text, value).toContain(JSON.stringify(value).slice(1, -1));
			for (const shot of point.shots ?? []) expect(text).toContain(shot.src);
		}
		for (const chapter of sample.chapters ?? []) {
			if (chapter.lead) expect(text).toContain(chapter.lead);
			for (const fact of chapter.facts ?? []) expect(text).toContain(fact.label);
			if (chapter.image) expect(text).toContain(chapter.image.src);
		}
	});

	it('트러블슈팅은 문제 → 원인 → 해결 → 결과 차례로 빈 단계를 빼고, 팀원은 이름 첫 글자, 배포는 올린 곳의 아이콘과 호스트', () => {
		const landing = landingOf(
			empty({
				troubleshooting: [{ title: '느린 첫 화면', problem: '4초', solution: '나눠 불렀다', result: ' ' }],
				team: [
					{ name: '김현', role: '화면', me: true },
					{ name: 'Jane Doe', role: 'API' },
				],
				deployments: [
					{ label: '웹', url: 'https://www.bookclub.vercel.app/x', platform: 'Vercel' },
					{ label: '앱', url: 'https://apps.apple.com/app/1', platform: 'App Store' },
					{ label: '패키지', platform: 'npm' },
				],
			})
		);
		const trouble = landing.sections.find((section) => section.kind === 'troubleshooting');
		expect(trouble?.kind === 'troubleshooting' && troubleSteps(trouble.items[0]).map((step) => step.label)).toEqual([
			'문제',
			'해결',
		]);
		const team = landing.sections.find((section) => section.kind === 'team');
		expect(team?.kind === 'team' && team.members.map((member) => [member.initials, member.me])).toEqual([
			['김', true],
			['JD', false],
		]);
		expect(initialsOf('  ')).toBe('?');
		expect(shortLink('https://github.com/hyeoniverse/QRU/tree/main')).toBe('github.com/hyeoniverse');
		expect(shortLink('https://www.linkedin.com/in/someone/')).toBe('linkedin.com/in/someone');
		expect(shortLink('github.com/me')).toBe('github.com/me');
		const deployments = landing.sections.find((section) => section.kind === 'deployments');
		expect(deployments?.kind === 'deployments' && deployments.items.map((item) => [item.icon, item.host])).toEqual([
			['fa-globe', 'bookclub.vercel.app'],
			['fa-app-store-ios', 'apps.apple.com'],
			['fa-npm', undefined],
		]);
		expect(faClass('fa-npm')).toBe('fa-brands fa-npm');
		expect(faClass('fa-globe')).toBe('fa-solid fa-globe');
		expect(deploymentIcon('Docker · 클라우드 서버', undefined)).toBe('fa-docker');
	});

	it('마무리는 첫 화면의 제목을 되풀이하지 않고, 써 볼 곳이 있는지에 따라 권하는 문장을 고른다', () => {
		const base = { ...blankProject('p'), name: '북클럽', tagline: '같은 책을 읽습니다.' };
		const repoOnly = landingOf({ ...base, url: 'https://github.com/a/b' });
		expect(repoOnly.closing.title).toBe('코드와 기록을 살펴볼 수 있습니다.');
		expect(repoOnly.closing.lead).toBe('북클럽');
		const withDemo = landingOf({ ...base, url: 'https://github.com/a/b', demo: 'https://example.com' });
		expect(withDemo.closing.title).toBe('지금 바로 써 볼 수 있습니다.');
		expect(withDemo.closing.title).not.toBe(withDemo.hero.headline);
	});
});
