// dialogue 모양: 포켓몬 GBA 전투 화면 같은 밝은 고전 RPG 대화창. 페이지 가운데에 360×208 게임 화면 하나를 정수 배로 키워 띄운다
// (글자·테두리·픽셀 그림이 한 격자를 나눠 쓰게). 전체 화면 Safari에서 세 배가 되도록 해상도를 낮게 잡아 글자가 크다.
// 화면은 위에서부터 길잡이 줄(메뉴 ▸ 주제 ▸ n/N 항목, 단계 점, 메뉴로 단추), 무대, 이름표와 두 줄 대화 상자, 키 안내 줄.
// 프로젝트가 화자가 되어 소개를 대화로 들려주고, 메뉴는 번호 붙은 여정 목록(읽음 ✓, 다음 차례 NEXT)에서 주제를 고른다.
// 무대 뒤에는 주제마다 16×16 타일과 소품으로 칠한 픽셀 장면(sceneOf, dialogueScenes.ts)을 캔버스로 깔고(낮·밤 팔레트),
// 글은 장면 위에 바로 두지 않고 늘 단단한 창 안에 둔다. 무대에는 주제마다 게임 화면 하나(DialoguePanels.tsx)를 그려
// 대사가 말하는 항목을 짚고, 그 장에 그림이 있으면 그림을 액자에 원래 모습 그대로 띄우고 게임 화면은 옆에 작게 둔다
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Links } from '@/apps/safari/project/parts';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import type { TroubleStepKey } from '@/apps/safari/project/landing/content';
import { nextUnread, paginate, sceneOf, shorten, troubleKeys } from '@/apps/safari/project/dialogueStage';
import { TitleScreen, TopicPanel, type PanelFocus } from '@/apps/safari/project/DialoguePanels';
import { PixelImage, SceneBackdrop } from '@/apps/safari/project/DialoguePixels';
import '@/apps/safari/project/DialoguePage.css';

/** 무대에 띄우는 그림(또는 영상) 한 장. caption이 있으면 그림 아래에 작게 적는다 */
interface Slide {
	src: string;
	caption?: string;
	video?: boolean;
}

/** 대화 상자에 한 번에 보이는 한 장 */
interface Line {
	/** 이름표(대화 상자 위의 말하는 이)에 적는 제목 */
	title?: string;
	body: string;
	/** 이 장을 말하는 동안 무대에 띄울 그림들 (여러 장이면 그 자리에서 넘겨 본다) */
	media?: Slide[];
	/** 이 장이 말하는 항목: 주제 데이터의 몇 번째인지 (무대의 게임 화면이 그 항목을 짚는다) */
	item?: number;
	/** 트러블슈팅이면 이 장의 단계 */
	step?: TroubleStepKey;
	/** 대화 상자 왼쪽의 얼굴 칸에 띄울 사진 (팀원의 사진) */
	portrait?: string;
	/** 길잡이 줄의 마지막 칸에 적는 이 장의 이름 (항목 이름, 트러블슈팅은 단계). 없으면 title */
	crumb?: string;
	/** 묶음 (트러블슈팅의 버그 한 건): 길잡이 줄에 한 칸 더, 단계 점은 묶음 안에서 센다 */
	group?: string;
	/** 묶음 안에서 몇 번째 항목인지와 항목 수 (한 항목이 여러 장으로 나뉘어도 같다) */
	entry?: number;
	entries?: number;
}

/** 메뉴의 주제 하나: 고르면 lines를 '다음'으로 한 장씩 읽는다 */
interface Topic {
	id: string;
	/** 메뉴와 길잡이 줄에 적는 짧은 이름 */
	label: string;
	lines: Line[];
	/** 메뉴에서 커서가 올라오면 무대에 미리 보여 줄 그림 */
	thumb?: string;
}

/** greet·ending의 at은 그 글의 몇 번째 장. topic의 at이 lines.length이면 주제를 다 본 마지막 장(끝맺음) */
type Mode =
	| { kind: 'greet'; at: number }
	| { kind: 'menu'; sub: boolean }
	| { kind: 'topic'; id: string; at: number }
	| { kind: 'ending'; at: number };

const LINKS_TOPIC = 'links';
/** 장(chapters)들을 모아 둔 두 번째 메뉴로 들어가는 주제 */
const MORE_TOPIC = 'more';
/** 두 번째 메뉴에서 처음 메뉴로 돌아가는 줄 */
const BACK_TOPIC = 'back';
/** 읽음·NEXT를 세지 않는 줄 */
const UNCOUNTED = new Set([LINKS_TOPIC, BACK_TOPIC]);

const isVideo = (src: string) => /\.(mp4|webm|mov)(\?|#|$)/i.test(src);

/** 같은 그림을 두 번 넣지 않는다 */
function uniqueSlides(slides: (Slide | undefined | false)[]): Slide[] {
	const seen = new Set<string>();
	return slides.filter((slide): slide is Slide => {
		if (!slide || !slide.src || seen.has(slide.src)) return false;
		seen.add(slide.src);
		return true;
	});
}

/** 항목 하나의 장면: 대표 그림, 영상, 실제 화면 여러 장 */
const pointMedia = (point: ProjectPoint): Slide[] =>
	uniqueSlides([
		point.image ? { src: point.image } : undefined,
		point.video ? { src: point.video, video: true } : undefined,
		...(point.shots ?? []).map((shot) => ({ src: shot.src, caption: shot.alt, video: isVideo(shot.src) })),
	]);

/**
 * 화면 모음: 관리자가 넣은 gallery(폴더에서 모은 것 포함). 없으면 항목·장의 그림을 모아 대신 쓴다 (영상은 뺀다).
 * 메뉴 미리보기, 엔딩 앨범이 이것을 돌려 쓴다
 */
function buildAlbum(project: Project): { slides: Slide[]; fromGallery: boolean } {
	const gallery = (project.gallery ?? []).filter((item) => item.src);
	if (gallery.length > 0) {
		return {
			slides: uniqueSlides(gallery.map((item) => ({ src: item.src, caption: item.caption }))),
			fromGallery: true,
		};
	}
	const fromPoint = (point: ProjectPoint): Slide[] =>
		pointMedia(point)
			.filter((slide) => !slide.video)
			.map((slide) => ({ src: slide.src, caption: slide.caption ?? point.title }));
	const points = [...project.highlights, ...project.build, ...(project.usage ?? [])];
	return {
		slides: uniqueSlides([
			...points.flatMap(fromPoint),
			...(project.chapters ?? []).flatMap((chapter) => [
				...chapter.points.flatMap(fromPoint),
				chapter.image ? { src: chapter.image.src, caption: chapter.image.alt } : undefined,
			]),
		]),
		fromGallery: false,
	};
}

/** 게임 화면의 크기(CSS px). 모든 것을 이 칸 단위로 그리고, 화면 전체를 정수 배로 키운다 */
const SCREEN_W = 360;
const SCREEN_H = 208;
/** 대화 상자의 글 폭(게임 칸): 화면 360 − 양옆 여백 6·6 − 테두리 3·3 − 안쪽 여백 8(왼쪽)·16(오른쪽, ▼ 자리) */
const TEXT_W = 318;
/** 얼굴 칸(32)과 그 옆 틈: 얼굴이 있으면 글 왼쪽 여백이 8에서 42로 는다 (넉넉히 38을 뺀다) */
const PORTRAIT_W = 38;
/** 길잡이 줄의 단계 점은 이 수까지만 (더 많으면 n/N만) */
const MAX_PIPS = 12;

/** 긴 글은 두 줄씩 여러 장으로 (같은 제목과 장면을 이어 쓴다). 항목마다 묶음 안의 차례(entry)를 적는다 */
function paginateTopic(lines: Line[]): Line[] {
	const totals = new Map<string, number>();
	for (const line of lines) totals.set(line.group ?? '', (totals.get(line.group ?? '') ?? 0) + 1);
	const seen = new Map<string, number>();
	return lines.flatMap((line) => {
		const key = line.group ?? '';
		const entry = seen.get(key) ?? 0;
		seen.set(key, entry + 1);
		const pages = paginate(line.body, line.portrait ? TEXT_W - PORTRAIT_W : TEXT_W);
		return pages.map((body) => ({ ...line, body, entry, entries: totals.get(key) }));
	});
}

/** 프로젝트 데이터에서 메뉴의 주제를 만든다. 비어 있는 주제는 메뉴에 안 나온다. chapters는 두 번째 메뉴(sub)로 */
function buildTopics(project: Project, album: Slide[], fromGallery: boolean, cover: string | undefined) {
	// 항목 하나는 설명 한 장, 자세히가 있으면 이어서 한 장 더 (같은 제목과 장면)
	const points = (items: ProjectPoint[]): Line[] =>
		items.flatMap((p, item) => {
			const media = pointMedia(p);
			return [
				{ title: p.title, body: p.body, media, item },
				...(p.detail ? [{ title: p.title, crumb: `${p.title} 자세히`, body: p.detail, media, item }] : []),
			];
		});
	const chapters: Topic[] = (project.chapters ?? [])
		.map((chapter, i) => {
			const image = chapter.image ? [{ src: chapter.image.src, caption: chapter.image.alt }] : undefined;
			const lines = points(chapter.points);
			// 머리말이 없으면 장 그림은 첫 항목의 장면으로 (그 항목에 그림이 없을 때)
			if (!chapter.lead && image && lines[0] && !lines[0].media?.length) lines[0] = { ...lines[0], media: image };
			return {
				id: `chapter-${i}`,
				label: chapter.title,
				lines: [
					...(chapter.lead ? [{ title: chapter.title, crumb: '머리말', body: chapter.lead, media: image }] : []),
					...lines,
				],
			};
		})
		.filter((t) => t.lines.length > 0);
	const troubles = project.troubleshooting ?? [];
	const topics: Topic[] = [
		{ id: 'highlights', label: '주요 기능', lines: points(project.highlights) },
		{ id: 'build', label: '만든 방법', lines: points(project.build) },
		{
			id: 'troubleshooting',
			label: '트러블슈팅',
			// 한 건을 문제 → 원인 → 해결 → 결과 차례로 (그림은 그 건의 장면). 길잡이 줄은 '버그 2/3 ▸ 2/4 원인'
			lines: troubles.flatMap((trouble, item) => {
				const media = trouble.image ? [{ src: trouble.image }] : undefined;
				return troubleKeys(trouble).map((step) => ({
					title: trouble.title,
					crumb: TROUBLE_LABELS[step],
					group: troubles.length > 1 ? `버그 ${item + 1}/${troubles.length}` : undefined,
					body: trouble[step] ?? '',
					media,
					item,
					step,
				}));
			}),
		},
		{ id: 'usage', label: '쓰는 법', lines: points(project.usage ?? []) },
		{
			id: 'facts',
			label: '숫자로 보기',
			lines: project.facts.map((f, item) => ({ title: f.value, body: f.label, item })),
		},
		{
			id: 'controls',
			label: '조작법',
			// 한 줄의 키들은 같은 일을 하는 다른 키다 (Space 또는 ↑): 더하기가 아니라 빗금으로 잇는다
			lines: (project.controls ?? []).map((c, item) => ({ title: c.keys.join(' / '), body: c.label, item })),
		},
		{
			id: 'timeline',
			label: '진행 과정',
			lines: (project.timeline ?? []).map((t, item) => ({ title: t.date, body: t.label, item })),
		},
		{
			id: 'specs',
			label: '기술 사양',
			lines: [
				...project.specs.map((s, item) => ({ title: s.label, body: s.value, item })),
				// 쓴 기술 묶음은 사양 끝에 한 장으로 (게임 화면에서는 가방)
				...(project.stack.length > 0
					? [{ title: '쓴 기술', body: project.stack.join(', '), item: project.specs.length }]
					: []),
			],
		},
		{
			id: 'team',
			label: '함께한 사람',
			// 사진은 무대가 아니라 대화 상자의 얼굴 칸에, 그 사람의 장에서만 (무대에는 픽셀 사람이 선다)
			lines: (project.team ?? []).map((member, item) => ({
				title: member.me ? `${member.name} (나)` : member.name,
				crumb: member.name,
				body: member.role,
				item,
				portrait: member.avatar || undefined,
			})),
		},
		{
			id: 'contributions',
			label: '맡은 일',
			lines: [
				// 맡은 역할은 상태 창의 직업 칸(-1), 맡은 일은 특기 목록
				...(project.role ? [{ title: '맡은 역할', crumb: '역할', body: project.role, item: -1 }] : []),
				...project.contributions.map((c, i) => ({
					title: `맡은 일 ${i + 1}`,
					crumb: c,
					body: c,
					item: i,
				})),
			],
		},
		{
			id: 'deployments',
			label: '볼 수 있는 곳',
			lines: (project.deployments ?? []).map((place, item) => ({
				title: place.platform ? `${place.label} · ${place.platform}` : place.label,
				crumb: place.label,
				body: [place.note, place.url?.replace(/^https?:\/\//, '')].filter(Boolean).join(' ') || '링크는 아직 없습니다.',
				media: place.image ? [{ src: place.image }] : undefined,
				item,
			})),
		},
		{
			id: 'credits',
			label: '크레딧',
			// 빌려 쓴 에셋·글꼴의 출처: 맡은 부분과 이름, 만든 사람과 한 줄 설명
			lines: (project.credits ?? []).map((c, item) => ({
				title: `${c.role} · ${c.name}`,
				crumb: c.name,
				body: [`${c.by}의 것을 빌려 썼습니다.`, c.note].filter(Boolean).join(' '),
				item,
			})),
		},
		// 장 묶음: 고르면 장마다 하나씩 고르는 두 번째 메뉴가 열린다 (lines는 자리만)
		{ id: MORE_TOPIC, label: '더 많은 이야기', lines: chapters.length > 0 ? [{ body: '' }] : [] },
		// 화면 모음: 관리자가 넣은 그림을 한 장씩 캡션과 함께
		{
			id: 'gallery',
			label: '화면 모음',
			lines: fromGallery
				? album.map((slide, i) => ({
						title: slide.caption || `화면 ${i + 1}`,
						body:
							i === 0
								? `${album.length}장을 한 장씩 넘겨 보겠습니다.`
								: i === album.length - 1
									? '이것이 마지막 화면입니다.'
									: `${i + 1}번째 화면입니다.`,
						media: [{ src: slide.src }],
					}))
				: [],
		},
	];
	const filled = topics.filter((t) => t.lines.length > 0);
	// 링크는 항상 있다 (GitHub 주소는 필수). 읽음 표시·NEXT·엔딩 셈에서는 뺀다
	filled.push({
		id: LINKS_TOPIC,
		label: '링크',
		lines: [
			{
				title: project.name,
				crumb: '링크',
				body: '무대 아래 링크에서 더 볼 수 있습니다.',
				media: cover ? [{ src: cover }] : undefined,
			},
		],
	});

	for (const topic of [...filled, ...chapters]) topic.lines = paginateTopic(topic.lines);
	const thumbOf = (topic: Topic) => topic.lines.flatMap((l) => l.media ?? []).find((s) => !s.video)?.src;
	for (const topic of chapters) topic.thumb = thumbOf(topic);
	filled.forEach((topic) => {
		topic.thumb = topic.id === MORE_TOPIC ? chapters.find((c) => c.thumb)?.thumb : thumbOf(topic);
	});
	return { topics: filled, chapters };
}

/**
 * 글을 타자치듯 한 글자씩 보인다. 움직임 줄이기면 바로 다 보인다.
 * 돌려주는 것: 지금까지 찍힌 글자 수, 다 찍혔는지, 바로 끝내는 함수
 */
function useTyped(text: string, speed = 18) {
	// 어느 글을 몇 글자까지 찍었는지. 글이 바뀌면(다른 장) 0부터 다시 — 상태는 interval 안에서만 바꾼다
	const [typed, setTyped] = useState({ text: '', count: 0 });
	const reduced = prefersReducedMotion();
	const count = typed.text === text ? typed.count : reduced ? text.length : 0;
	useEffect(() => {
		if (reduced) return;
		let shown = 0;
		const timer = window.setInterval(() => {
			shown += 1;
			// 바로 끝내기(finish)로 이미 다 찍었으면 되돌리지 않는다
			setTyped((prev) => (prev.text === text && prev.count >= shown ? prev : { text, count: shown }));
			if (shown >= text.length) window.clearInterval(timer);
		}, speed);
		return () => window.clearInterval(timer);
	}, [text, speed, reduced]);
	const finish = useCallback(() => setTyped({ text, count: text.length }), [text]);
	return { count, done: count >= text.length, finish };
}

const TROUBLE_LABELS: Record<TroubleStepKey, string> = {
	problem: '문제',
	cause: '원인',
	solution: '해결',
	result: '결과',
};

/** 옆에 게임 화면을 두지 않는 주제: 화면 모음은 그림 자체가 이야기다 */
const NO_SIDE = new Set(['gallery']);

const MENU_TITLE = '어떤 주제를 볼까요?';
const SUB_TITLE = '어떤 이야기를 볼까요?';
const ENDING: Line = {
	title: '엔딩',
	body: '모든 주제를 다 봤습니다. 끝까지 들어 주셔서 고맙습니다. 메뉴에서 어떤 주제든 다시 볼 수 있습니다.',
};

/**
 * 스크롤 상자(.safari-page)의 크기에 맞춘다. @container는 높이로 물을 수 없어 JS로 잰다.
 * zoom: 360×208이 들어가는 가장 큰 정수 배 (모든 칸이 같은 배수로 커져 픽셀이 고르다).
 * 한 배도 안 들어가면(아주 좁거나 낮은 창) compact: 키우지 않고 창 폭에 맞춘 단순한 배치. stage는 그때 무대를 둘 높이가 되는지
 */
function useScreen(ref: React.RefObject<HTMLElement | null>) {
	const [screen, setScreen] = useState({ zoom: 1, compact: false, stage: true });
	useEffect(() => {
		const box = ref.current?.closest('.safari-page') ?? ref.current?.parentElement;
		if (!box || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const w = box.clientWidth;
			const h = box.clientHeight;
			const zoom = Math.floor(Math.min(w / SCREEN_W, h / SCREEN_H));
			const next = zoom >= 1 ? { zoom, compact: false, stage: true } : { zoom: 1, compact: true, stage: h >= 420 };
			setScreen((prev) =>
				prev.zoom === next.zoom && prev.compact === next.compact && prev.stage === next.stage ? prev : next
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(box);
		return () => observer.disconnect();
	}, [ref]);
	return screen;
}

/** 그림 한 장: 흰 테두리 액자에 원래 모습 그대로. 영상은 소리 없이 반복한다. 액자 아래 줄에 이름(caption)과 넘기기 단추 */
const Frame: React.FC<{ slide: Slide; caption?: string; children?: React.ReactNode }> = ({
	slide,
	caption,
	children,
}) => (
	<figure className="dl-shot">
		<div className="dl-shot-frame">
			{slide.video ? (
				<video
					src={slide.src}
					muted
					loop
					playsInline
					autoPlay={!prefersReducedMotion()}
					preload="metadata"
					aria-hidden="true"
				/>
			) : (
				<img src={slide.src} alt="" />
			)}
		</div>
		{(caption || children) && (
			<figcaption className="dl-shot-foot">
				{children}
				{caption && (
					<span className="dl-caption" aria-hidden="true">
						{caption}
					</span>
				)}
			</figcaption>
		)}
	</figure>
);

const DialoguePage: React.FC<{ project: Project }> = ({ project }) => {
	const { slides: album, fromGallery } = useMemo(() => buildAlbum(project), [project]);
	const cover = project.image || album[0]?.src;
	const { topics, chapters } = useMemo(
		() => buildTopics(project, album, fromGallery, cover),
		[project, album, fromGallery, cover]
	);
	const [mode, setMode] = useState<Mode>({ kind: 'greet', at: 0 });
	const [read, setRead] = useState<Set<string>>(() => new Set());
	// 엔딩을 이미 봤는지 (마지막 주제를 다 읽은 처음 한 번만 엔딩)
	const [endingSeen, setEndingSeen] = useState(false);
	// 메뉴의 ♥ 커서 (마우스를 올리거나 방향 키로 옮긴다). 지금 열린 메뉴(처음 또는 장 목록) 안의 차례
	const [cursor, setCursor] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const screen = useScreen(rootRef);

	const back: Topic = useMemo(() => ({ id: BACK_TOPIC, label: '처음 메뉴로', lines: [] }), []);
	const subList = useMemo(() => [...chapters, back], [chapters, back]);
	const inSub = mode.kind === 'menu' && mode.sub;
	const visible = inSub ? subList : topics;
	const isChapter = useCallback((id: string) => chapters.some((c) => c.id === id), [chapters]);

	const countable = topics.filter((t) => !UNCOUNTED.has(t.id));
	const readCount = countable.filter((t) => read.has(t.id)).length;
	const current = mode.kind === 'topic' ? [...topics, ...chapters].find((t) => t.id === mode.id) : undefined;

	const greetLines: Line[] = useMemo(() => {
		const body = [project.description, project.context].filter(Boolean).join(' · ');
		const media = cover ? [{ src: cover }] : undefined;
		return paginate(body, TEXT_W).map((page) => ({ title: project.tagline, body: page, media }));
	}, [project, cover]);
	const endingLines: Line[] = useMemo(
		() => paginate(ENDING.body, TEXT_W).map((page) => ({ title: ENDING.title, body: page })),
		[]
	);

	/** 메뉴 목록 안의 자리: 장은 처음 메뉴에서는 '더 많은 이야기' 줄 */
	const anchorIn = useCallback(
		(sub: boolean, id: string | undefined) => (!sub && id && isChapter(id) ? MORE_TOPIC : id),
		[isChapter]
	);
	/** NEXT: 여정 차례(메뉴 번호)대로 아직 안 읽은 첫 주제 */
	const nextIn = useCallback(
		(sub: boolean, nowRead: ReadonlySet<string>) => nextUnread(sub ? subList : topics, nowRead, undefined, UNCOUNTED),
		[subList, topics]
	);
	const nextTopic = mode.kind === 'menu' ? nextIn(mode.sub, read) : undefined;

	/** 주제를 다 본 끝맺음 장에서 갈 곳: 엔딩, 장 목록, 처음 메뉴. 그리고 메뉴에서 NEXT가 될 주제 */
	const afterTopic = useCallback(
		(id: string, nowRead: ReadonlySet<string>) => {
			const allDone = countable.every((t) => nowRead.has(t.id));
			if (allDone && !endingSeen) return { ending: true as const };
			const sub = isChapter(id) && !nowRead.has(MORE_TOPIC);
			return { ending: false as const, sub, next: nextIn(sub, nowRead) };
		},
		[countable, endingSeen, isChapter, nextIn]
	);

	/** 메뉴를 연다. 커서는 focus(돌아온 주제)가 있으면 그 줄, 없으면 NEXT, 그것도 없으면 첫 줄 */
	const openMenu = useCallback(
		(sub: boolean, options: { focus?: string } = {}) => {
			const list = sub ? subList : topics;
			const target = options.focus ?? nextIn(sub, read)?.id;
			const index = target ? list.findIndex((t) => t.id === anchorIn(sub, target)) : -1;
			setCursor(Math.max(0, index));
			setMode({ kind: 'menu', sub });
		},
		[subList, topics, nextIn, read, anchorIn]
	);

	// 지금 보이는 한 장. 메뉴 차례에는 질문을 대화 상자 첫 줄에 찍고, 메뉴는 그 아래에 연다
	const ended = mode.kind === 'topic' && current !== undefined && mode.at >= current.lines.length;
	const endLine: Line | null = useMemo(() => {
		if (mode.kind !== 'topic' || !current || mode.at < current.lines.length) return null;
		const after = afterTopic(current.id, read);
		const body = after.ending
			? '이 주제를 다 봤습니다. 모든 주제를 다 봤으니 엔딩으로 갑니다.'
			: after.next
				? `이 주제를 다 봤습니다. 메뉴로 돌아갑니다. 다음은 '${shorten(after.next.label, 12)}'입니다.`
				: '이 주제를 다 봤습니다. 메뉴로 돌아갑니다.';
		return { title: `${shorten(current.label, 12)} 완료`, body };
	}, [mode, current, read, afterTopic]);

	const line: Line | null =
		mode.kind === 'greet'
			? greetLines[mode.at]
			: mode.kind === 'ending'
				? endingLines[mode.at]
				: mode.kind === 'menu'
					? { body: mode.sub ? SUB_TITLE : MENU_TITLE }
					: current
						? (current.lines[mode.at] ?? endLine)
						: null;

	const title = line?.title ?? '';
	const body = line?.body ?? '';
	const { count: bodyCount, done, finish } = useTyped(body);

	// 그 자리에서 넘겨 보는 그림의 차례. 장이 바뀌면 처음부터
	const lineKey = mode.kind === 'topic' ? `${mode.id}:${line?.media?.[0]?.src ?? mode.at}` : mode.kind;
	const [slideAt, setSlideAt] = useState({ key: '', at: 0 });
	const slides = mode.kind === 'menu' || mode.kind === 'ending' || ended ? [] : (line?.media ?? []);
	const slideIndex = slideAt.key === lineKey ? Math.min(slideAt.at, Math.max(0, slides.length - 1)) : 0;
	const flip = useCallback(
		(step: number) => {
			if (slides.length < 2) return;
			setSlideAt({ key: lineKey, at: (slideIndex + step + slides.length) % slides.length });
		},
		[slides.length, lineKey, slideIndex]
	);

	/** '다음': 찍히는 중이면 바로 다 보이고, 다 보였으면 다음 장으로. 주제의 마지막 장 다음은 끝맺음 장, 그다음은 메뉴(또는 엔딩) */
	const next = useCallback(() => {
		if (!done) {
			finish();
			return;
		}
		if (mode.kind === 'greet' || mode.kind === 'ending') {
			const pages = mode.kind === 'greet' ? greetLines : endingLines;
			if (mode.at + 1 < pages.length) setMode({ ...mode, at: mode.at + 1 });
			else openMenu(false);
			return;
		}
		if (mode.kind !== 'topic' || !current) return;
		const total = current.lines.length;
		if (mode.at + 1 < total) {
			setMode({ kind: 'topic', id: mode.id, at: mode.at + 1 });
		} else if (mode.at + 1 === total) {
			// 링크는 셈에 넣지 않아 끝맺음 없이 바로 메뉴로
			if (UNCOUNTED.has(mode.id)) {
				openMenu(false, { focus: mode.id });
				return;
			}
			// 다 읽었다: 읽음 표시를 하고 끝맺음 장 (다음 주제를 알려 준다)
			const nowRead = new Set(read).add(mode.id);
			// 장을 모두 읽으면 장 묶음도 읽음
			if (isChapter(mode.id) && chapters.every((c) => nowRead.has(c.id))) nowRead.add(MORE_TOPIC);
			setRead(nowRead);
			setMode({ kind: 'topic', id: mode.id, at: total });
		} else {
			const after = afterTopic(mode.id, read);
			if (after.ending) {
				setEndingSeen(true);
				setMode({ kind: 'ending', at: 0 });
			} else openMenu(after.sub);
		}
	}, [done, finish, mode, current, greetLines, endingLines, openMenu, read, isChapter, chapters, afterTopic]);

	/** 메뉴로 (X·Esc, 길잡이 줄의 메뉴로 단추). 읽던 주제가 있으면 커서는 그 주제에, 장 목록에서는 처음 메뉴로 */
	const toMenu = useCallback(() => {
		if (mode.kind === 'topic') {
			const sub = isChapter(mode.id) && !read.has(MORE_TOPIC);
			openMenu(sub, ended ? {} : { focus: mode.id });
		} else if (mode.kind === 'menu' && mode.sub) openMenu(false, { focus: MORE_TOPIC });
		else if (mode.kind !== 'menu') openMenu(false);
	}, [mode, isChapter, read, openMenu, ended]);

	const choose = useCallback(
		(topic: Topic) => {
			if (topic.id === MORE_TOPIC) openMenu(true);
			else if (topic.id === BACK_TOPIC) openMenu(false, { focus: MORE_TOPIC });
			else {
				setCursor(Math.max(0, visible.indexOf(topic)));
				setMode({ kind: 'topic', id: topic.id, at: 0 });
			}
		},
		[openMenu, visible]
	);

	/** 커서를 옮기고, 키보드로 옮겼으면 그 단추에 포커스 (보이는 줄 밖이면 메뉴가 그 줄까지 넘어간다) */
	const moveCursor = useCallback(
		(index: number) => {
			const wrapped = (index + visible.length) % visible.length;
			setCursor(wrapped);
			rootRef.current?.querySelectorAll<HTMLButtonElement>('.dl-menu[data-open] .dl-choices button')[wrapped]?.focus();
		},
		[visible.length]
	);

	// 메뉴가 보이는 줄보다 길면 상자 안에서 줄 단위로 넘어간다: 커서 줄이 늘 보이게, 위·아래에 더 있으면 ▲·▼
	const [more, setMore] = useState({ up: false, down: false });
	const updateMore = useCallback(() => {
		const list = rootRef.current?.querySelector<HTMLElement>('.dl-menu[data-open] .dl-choices');
		if (!list) return;
		const up = list.scrollTop > 1;
		const down = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
		setMore((prev) => (prev.up === up && prev.down === down ? prev : { up, down }));
	}, []);
	useEffect(() => {
		if (mode.kind !== 'menu') return;
		const button = rootRef.current?.querySelectorAll<HTMLElement>('.dl-menu[data-open] .dl-choices button')[cursor];
		// 가장 가까운 만큼만 넘긴다 (화면이 창에 들어가 있으면 페이지는 움직이지 않는다)
		button?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
		updateMore();
	}, [mode, cursor, screen, updateMore]);

	// 키보드: Space·Enter·Z는 다음(메뉴에서는 커서 줄 고르기), ↑·↓(←·→)는 커서, 숫자는 그 번호의 주제,
	// X·Esc는 메뉴로(장 목록에서는 처음 메뉴로), 이야기 중 ←·→는 그림 넘기기. 글 상자 안에서는 안 받는다
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
			if (target && target !== document.body && !root.contains(target)) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			// 그림 넘기기 단추는 제 일을 한다
			if (target?.closest('.dl-flip')) return;
			const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
			const confirm = key === ' ' || key === 'Enter' || key === 'z';
			const leave = key === 'Escape' || key === 'x';
			if (mode.kind === 'menu') {
				if (key === 'ArrowDown' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowLeft') {
					event.preventDefault();
					moveCursor(cursor + (key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1));
				} else if (confirm) {
					// 다른 단추(메뉴로 등)에 포커스가 있으면 그 단추가 받는다
					const menu = root.querySelector('.dl-menu[data-open]');
					if (key !== 'z' && target && target.tagName === 'BUTTON' && !menu?.contains(target)) return;
					event.preventDefault();
					const topic = visible[cursor];
					if (topic) choose(topic);
				} else if (leave && mode.sub) {
					event.preventDefault();
					toMenu();
				} else if (/^[1-9]$/.test(key)) {
					const topic = visible[Number(key) - 1];
					if (topic) {
						event.preventDefault();
						choose(topic);
					}
				}
			} else if (confirm) {
				// 링크·단추(보물 상자의 링크, 메뉴로 단추 포함)에 포커스가 있으면 Space·Enter는 그 단추가 받는다
				if (key !== 'z' && target?.closest('.dl-linkbar, .dl-stage a, .dl-hud button')) return;
				event.preventDefault();
				next();
			} else if (leave) {
				event.preventDefault();
				toMenu();
			} else if ((key === 'ArrowLeft' || key === 'ArrowRight') && slides.length > 1) {
				event.preventDefault();
				flip(key === 'ArrowRight' ? 1 : -1);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [mode, next, choose, visible, cursor, moveCursor, toMenu, slides.length, flip]);

	const inMenu = mode.kind === 'menu';
	// 링크 단추: 첫 화면(인사)에서 바로 열 수 있게, 그리고 엔딩과 '링크' 주제에서 (무대 아래 창에)
	const showLinks =
		mode.kind === 'greet' || mode.kind === 'ending' || (mode.kind === 'topic' && mode.id === LINKS_TOPIC && !ended);

	// ─── 길잡이 줄: 메뉴 ▸ 주제 ▸ (버그 n/N ▸) n/N 항목. 단계 점은 지금 묶음의 항목 수 ───
	const crumbs: string[] = (() => {
		if (mode.kind === 'greet') return ['시작', project.name];
		if (mode.kind === 'ending') return ['엔딩'];
		const moreLabel = topics.find((t) => t.id === MORE_TOPIC)?.label ?? '';
		if (mode.kind === 'menu') return mode.sub ? ['메뉴', moreLabel] : ['메뉴'];
		if (!current) return ['메뉴'];
		const path = ['메뉴', ...(isChapter(current.id) ? [moreLabel] : []), current.label];
		if (ended) return [...path, '끝'];
		const at = line?.entry ?? 0;
		const of = line?.entries ?? 1;
		return [
			...path,
			...(line?.group ? [line.group] : []),
			`${at + 1}/${of} ${line?.crumb ?? line?.title ?? ''}`.trim(),
		];
	})();
	const pips =
		mode.kind === 'topic' && current && (line?.entries ?? 0) <= MAX_PIPS
			? Array.from({ length: ended ? (current.lines.at(-1)?.entries ?? 0) : (line?.entries ?? 0) }, (_, i) =>
					ended || i < (line?.entry ?? 0) ? 'done' : i === line?.entry ? 'now' : 'todo'
				)
			: [];
	const progressText = `읽은 주제 ${readCount}/${countable.length}`;
	// 읽은 주제 수와 막대: 메뉴에서는 길잡이 줄 오른쪽, 이야기 중에는 아래 줄 오른쪽
	const progress = countable.length > 0 && (
		<span className="dl-hp" aria-hidden="true">
			<span className="dl-hp-count">{progressText}</span>
			<span className="dl-hp-bar">
				<i style={{ width: `${(readCount / countable.length) * 100}%` }} />
			</span>
		</span>
	);

	const hint =
		mode.kind === 'menu'
			? mode.sub
				? '↑↓ 고르기 · Z/Enter 보기 · X 처음 메뉴로'
				: '↑↓ 고르기 · Z/Enter 보기 · 숫자 바로 가기'
			: ended || mode.kind === 'ending'
				? 'Z/Enter 메뉴로 돌아가기'
				: slides.length > 1
					? 'Z/Enter 다음 · ←→ 그림 넘기기 · X 메뉴로'
					: 'Z/Enter 다음 · X 메뉴로';

	/** 메뉴 한 벌: 번호 붙은 여정 목록. 읽은 주제는 ✓, 다음 차례는 NEXT. 처음 메뉴와 장 목록이 같은 자리에 있고 열린 쪽만 보인다 */
	const renderMenu = (list: Topic[], heading: string, open: boolean) => {
		const nextId = open ? nextTopic?.id : undefined;
		return (
			<div className="dl-menu" data-open={open || undefined} inert={!open}>
				<ol className="dl-choices" aria-label={heading} onScroll={open ? updateMore : undefined}>
					{list.map((topic, i) => {
						const isRead = read.has(topic.id);
						const plain = UNCOUNTED.has(topic.id);
						const isNext = topic.id === nextId;
						return (
							<li key={topic.id}>
								<button
									type="button"
									data-active={(open && i === cursor) || undefined}
									data-read={isRead || undefined}
									data-next={isNext || undefined}
									data-back={topic.id === BACK_TOPIC || undefined}
									aria-pressed={plain ? undefined : isRead}
									onClick={() => choose(topic)}
									onMouseMove={() => i !== cursor && setCursor(i)}
									onFocus={() => setCursor(i)}
								>
									<span className="dl-cursor" aria-hidden="true">
										♥
									</span>
									<span className="dl-num" aria-hidden="true">
										{i + 1}
									</span>
									<span className="dl-label">{topic.label}</span>
									<em className="dl-check">{isRead && <span aria-label="읽음">✓</span>}</em>
									{isNext && (
										<em className="dl-next-tag">
											<span aria-hidden="true">NEXT</span>
											<span className="visually-hidden">(추천)</span>
										</em>
									)}
								</button>
							</li>
						);
					})}
				</ol>
				{/* 위·아래에 더 있는 줄 */}
				<span className="dl-more" aria-hidden="true">
					<i data-on={(open && more.up) || undefined}>▲</i>
					<i data-on={(open && more.down) || undefined}>▼</i>
				</span>
			</div>
		);
	};

	/** 그림 옆(넓은 무대)이나 그림 대신(그림이 없을 때) 서는 게임 화면 */
	const panelOf = (focus: PanelFocus | 'title' | 'end', side: boolean) =>
		focus === 'title' || focus === 'end' ? (
			<TitleScreen project={project} side={side} end={focus === 'end'} />
		) : (
			<TopicPanel project={project} focus={focus} side={side} />
		);

	/** 액자 하나와 그 옆의 작은 게임 화면 */
	const framed = (frame: React.ReactNode, side: React.ReactNode | null) => (
		<>
			{frame}
			{side && <div className="dl-side">{side}</div>}
		</>
	);

	/** 무대: 메뉴면 커서 주제의 미리보기와 안내 창, 엔딩이면 앨범, 아니면 지금 장의 그림과 게임 화면 (그림이 없으면 게임 화면만 크게) */
	const renderScene = () => {
		if (mode.kind === 'menu') {
			const focus = visible[cursor];
			const id = focus?.id ?? '';
			const plain = !focus || UNCOUNTED.has(id) || id === MORE_TOPIC;
			const preview = focus?.thumb ?? (id === BACK_TOPIC ? cover : undefined);
			const state = UNCOUNTED.has(id)
				? id === BACK_TOPIC
					? '처음 메뉴'
					: '링크 모음'
				: read.has(id)
					? '읽음 ✓'
					: id === nextTopic?.id
						? '다음 차례'
						: '아직 안 읽음';
			const size =
				id === MORE_TOPIC
					? `이야기 ${chapters.length}개`
					: focus && !UNCOUNTED.has(id)
						? `${focus.lines.length}장`
						: '';
			return (
				<div className="dl-scene dl-preview" aria-hidden="true" inert key={preview ?? `panel-${id}`}>
					<div className="dl-preview-art">
						{preview ? <Frame slide={{ src: preview }} /> : panelOf(plain ? 'title' : { topic: id }, true)}
					</div>
					{focus && (
						<div className="dl-info dlp-win">
							<b>{`${cursor + 1}. ${focus.label}`}</b>
							<span>{[size, state].filter(Boolean).join(' · ')}</span>
						</div>
					)}
				</div>
			);
		}
		if (mode.kind === 'ending') {
			const shelf = album.slice(0, 4);
			return (
				<div className="dl-scene" aria-hidden="true">
					{shelf.length > 1 ? (
						<figure className="dl-shot">
							<div className="dl-album" data-count={shelf.length}>
								{shelf.map((slide) => (
									<img key={slide.src} src={slide.src} alt="" />
								))}
							</div>
						</figure>
					) : (
						panelOf('end', false)
					)}
				</div>
			);
		}
		if (ended) {
			return (
				<div className="dl-scene" aria-hidden="true" key="end">
					<TitleScreen project={project} badge="★ CLEAR ★" />
				</div>
			);
		}
		const slide = slides[slideIndex];
		const focus: PanelFocus | 'title' =
			mode.kind === 'topic' && mode.id !== LINKS_TOPIC
				? { topic: mode.id, item: line?.item, step: line?.step }
				: 'title';
		const topicId = mode.kind === 'topic' ? mode.id : '';
		const withSide = Boolean(slide) && !NO_SIDE.has(topicId);
		return (
			<div className="dl-scene" data-side={withSide || undefined} key={slide ? lineKey : `panel-${topicId}`}>
				{slide
					? framed(
							<Frame slide={slide} caption={NO_SIDE.has(topicId) ? undefined : slide.caption}>
								{slides.length > 1 && (
									<span className="dl-flip">
										<button type="button" aria-label="이전 그림" onClick={() => flip(-1)}>
											◀
										</button>
										<span className="dl-dots" aria-hidden="true">
											{slides.map((s, i) => (
												<i key={s.src} data-on={i === slideIndex || undefined} />
											))}
										</span>
										<span className="visually-hidden" aria-live="polite">
											{`그림 ${slideIndex + 1} / ${slides.length}`}
										</span>
										<button type="button" aria-label="다음 그림" onClick={() => flip(1)}>
											▶
										</button>
									</span>
								)}
							</Frame>,
							withSide ? panelOf(focus, true) : null
						)
					: panelOf(focus, false)}
			</div>
		);
	};

	const portrait = mode.kind === 'topic' && !ended ? line?.portrait : undefined;
	// 무대 뒤 장면: 메뉴에서는 커서 주제의 것, 엔딩은 밤하늘
	const scene =
		mode.kind === 'ending'
			? 'night'
			: sceneOf(mode.kind === 'topic' ? mode.id : mode.kind === 'menu' ? visible[cursor]?.id : undefined);

	return (
		<div
			className="dl"
			data-id={project.id}
			data-mode={mode.kind}
			data-ended={ended || undefined}
			data-fit={screen.compact ? 'compact' : 'screen'}
			data-stage={screen.stage || undefined}
			ref={rootRef}
		>
			{/* 게임 화면: 360×208을 정수 배(zoom)로 키운다. 안의 크기는 모두 게임 칸 */}
			<div className="dl-screen" style={screen.compact ? undefined : { zoom: screen.zoom }} data-zoom={screen.zoom}>
				<div className="dl-game" data-scene={scene}>
					{/* 무대 뒤의 타일 장면 (낮·밤 두 장 중 테마에 맞는 한 장) */}
					<SceneBackdrop scene={scene} />

					{/* 길잡이 줄: 지금 어디인지(메뉴 ▸ 주제 ▸ n/N 항목), 단계 점, 메뉴로 단추 */}
					<div className="dl-hud">
						<p className="dl-crumb" aria-hidden="true">
							{crumbs.map((crumb, i) => (
								<React.Fragment key={i}>
									{i > 0 && <i className="dl-crumb-sep">▸</i>}
									<span data-last={i === crumbs.length - 1 || undefined}>{crumb}</span>
								</React.Fragment>
							))}
						</p>
						{pips.length > 1 && (
							<span className="dl-pips" aria-hidden="true">
								{pips.map((state, i) => (
									<i key={i} data-state={state} />
								))}
							</span>
						)}
						{inMenu && progress}
						{!(mode.kind === 'menu' && !mode.sub) && (
							<button type="button" className="dl-tomenu" onClick={toMenu}>
								{mode.kind === 'menu' ? '처음 메뉴로' : '메뉴로'}
							</button>
						)}
					</div>
					{/* 읽기 프로그램에 알리는 지금 자리와 읽은 주제 수 */}
					<p className="visually-hidden" role="status">
						{`${crumbs.join(', ')}. ${progressText}.`}
					</p>

					{/* 무대: 지금 이야기하는 그림, 없으면 주제의 게임 화면. 링크 창은 무대 아래에 */}
					<div className="dl-stage">
						{renderScene()}
						{showLinks && (
							<div className="dl-linkbar dlp-win" data-shown={done || undefined}>
								<Links project={project} className="sp-links dl-links" />
							</div>
						)}
					</div>

					{/* 대화 상자: 위에 말하는 이(이름표), 아래 두 줄 대사와 ▼. 메뉴 차례에는 질문 아래에 여정 목록이 열린다 */}
					<section
						className="dl-talk"
						role="dialog"
						aria-label="대화"
						aria-live="polite"
						data-portrait={Boolean(portrait) || undefined}
					>
						<strong className="dl-name" data-empty={!title || undefined}>
							{title}
						</strong>
						<div className="dl-box" onClick={inMenu ? undefined : next}>
							{/* 얼굴 칸: 사진을 16×16 픽셀 초상으로 줄여 두 배 */}
							{portrait && <PixelImage src={portrait} size={16} scale={2} cover className="dl-portrait" />}
							{/* 찍힌 글 뒤에 아직 안 찍힌 글을 안 보이게 이어 두어 줄바꿈이 처음부터 끝 모양과 같다 */}
							<p className="dl-body">
								{body.slice(0, bodyCount)}
								<span className="dl-rest" data-text={body.slice(bodyCount)} aria-hidden="true" />
							</p>
							<button
								type="button"
								className="dl-next"
								data-hidden={inMenu || undefined}
								data-ready={done || undefined}
								onClick={(e) => {
									e.stopPropagation();
									next();
								}}
							>
								<span className="visually-hidden">다음</span>
								<i aria-hidden="true">▼</i>
							</button>
							{renderMenu(topics, MENU_TITLE, inMenu && !inSub)}
							{chapters.length > 0 && renderMenu(subList, SUB_TITLE, inSub)}
						</div>
					</section>

					{/* 아래 줄: 지금 누를 수 있는 키, 읽은 주제 수와 막대 */}
					<div className="dl-foot">
						<p className="dl-keys">{hint}</p>
						{!inMenu && progress}
					</div>
				</div>
			</div>
		</div>
	);
};

export default DialoguePage;
