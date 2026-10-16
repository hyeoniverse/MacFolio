// dialogue 모양: 포켓몬 GBA 전투 화면 같은 밝은 고전 RPG 대화창. 페이지 가운데에 480×270 게임 화면 하나를 정수 배로 키워 띄운다
// (글자·테두리·픽셀 그림이 한 격자를 나눠 쓰게). 화면 위쪽은 무대, 아래 1/3은 두꺼운 테두리 대화 상자, 맨 아래 한 줄은 상태 줄.
// 프로젝트가 화자가 되어 소개를 대화로 들려주고, 묻고 싶은 주제를 선택지로 고른다. 무대 뒤에는 주제마다 16×16 타일과 소품으로 칠한
// 픽셀 장면(sceneOf, dialogueScenes.ts)을 캔버스로 깔고, 라이트는 낮 팔레트, 다크는 같은 그림의 밤 팔레트다.
// 무대에는 주제마다 게임 화면 하나(타이틀, 퀘스트, 전투, 파티, 장비...: DialoguePanels.tsx)를 데이터로 그려 대사가 말하는 항목을 짚는다.
// 그 장에 그림이 있으면 그림을 액자에 원래 모습 그대로 띄우고 게임 화면은 옆에 작게 둔다
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Links } from '@/apps/safari/project/parts';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import type { TroubleStepKey } from '@/apps/safari/project/landing/content';
import { sceneOf, troubleKeys } from '@/apps/safari/project/dialogueStage';
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
}

/** 선택지 하나: 고르면 lines를 '다음'으로 한 장씩 읽는다 */
interface Topic {
	id: string;
	label: string;
	lines: Line[];
	/** 선택지에서 커서가 올라오면 무대에 미리 보여 줄 그림 */
	thumb?: string;
}

type Mode =
	{ kind: 'greet' } | { kind: 'menu'; sub: boolean } | { kind: 'topic'; id: string; at: number } | { kind: 'ending' };

const LINKS_TOPIC = 'links';
/** 장(chapters)들을 모아 둔 두 번째 선택지로 들어가는 주제 */
const MORE_TOPIC = 'more';
/** 두 번째 선택지에서 처음 선택지로 돌아가는 줄 */
const BACK_TOPIC = 'back';

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
 * 그림이 없는 장면, 선택지 미리보기, 엔딩 앨범이 이것을 돌려 쓴다
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

/** 대화 상자 한 장에 담는 글의 길이(글자). 넘으면 문장 끝에서 나눠 여러 장으로 넘긴다 (상자가 가장 긴 글에 맞춰 커지지 않게) */
const PAGE_CHARS = 96;

/** 긴 글을 문장 단위로 PAGE_CHARS 안팎의 여러 장으로 나눈다. 한 문장이 길면 그 문장만 한 장 */
function splitBody(body: string): string[] {
	if (body.length <= PAGE_CHARS) return [body];
	// 문장 끝(마침표·물음표 뒤 공백)에서만 자른다 (Next.js, 0.7초 같은 점은 그대로)
	const sentences = body.split(/(?<=[.!?])\s+/);
	const pages: string[] = [];
	let page = '';
	for (const sentence of sentences) {
		if (page && page.length + 1 + sentence.length > PAGE_CHARS) {
			pages.push(page);
			page = '';
		}
		page = page ? `${page} ${sentence}` : sentence;
	}
	if (page) pages.push(page);
	return pages;
}

/** 프로젝트 데이터에서 선택지를 만든다. 비어 있는 주제는 선택지에 안 나온다. chapters는 두 번째 선택지(sub)로 */
function buildTopics(project: Project, album: Slide[], fromGallery: boolean, cover: string | undefined) {
	// 항목 하나는 설명 한 장, 자세히가 있으면 이어서 한 장 더 (같은 제목과 장면)
	const points = (items: ProjectPoint[]): Line[] =>
		items.flatMap((p, item) => {
			const media = pointMedia(p);
			return [
				{ title: p.title, body: p.body, media, item },
				...(p.detail ? [{ title: p.title, body: p.detail, media, item }] : []),
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
				lines: [...(chapter.lead ? [{ title: chapter.title, body: chapter.lead, media: image }] : []), ...lines],
			};
		})
		.filter((t) => t.lines.length > 0);
	const topics: Topic[] = [
		{ id: 'highlights', label: '주요 기능 알려줘', lines: points(project.highlights) },
		{ id: 'build', label: '어떻게 만들었어?', lines: points(project.build) },
		{
			id: 'troubleshooting',
			label: '어려웠던 문제는?',
			// 한 건을 문제 → 원인 → 해결 → 결과 차례로 한 장씩 (그림은 그 건의 장면)
			lines: (project.troubleshooting ?? []).flatMap((trouble, item) => {
				const media = trouble.image ? [{ src: trouble.image }] : undefined;
				return troubleKeys(trouble).map((step) => ({
					title: `${trouble.title} · ${TROUBLE_LABELS[step]}`,
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
			label: '숫자로 보여줘',
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
			label: '누구랑 만들었어?',
			// 사진은 무대가 아니라 대화 상자의 얼굴 칸에, 그 사람의 장에서만 (무대에는 픽셀 사람이 선다)
			lines: (project.team ?? []).map((member, item) => ({
				title: member.me ? `${member.name} (나)` : member.name,
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
				...(project.role ? [{ title: '맡은 역할', body: project.role, item: -1 }] : []),
				...project.contributions.map((c, i) => ({
					title: `맡은 일 ${i + 1}/${project.contributions.length}`,
					body: c,
					item: i,
				})),
			],
		},
		{
			id: 'deployments',
			label: '어디서 볼 수 있어?',
			lines: (project.deployments ?? []).map((place, item) => ({
				title: place.platform ? `${place.label} · ${place.platform}` : place.label,
				body: [place.note, place.url?.replace(/^https?:\/\//, '')].filter(Boolean).join(' ') || '링크는 아직 없어요.',
				media: place.image ? [{ src: place.image }] : undefined,
				item,
			})),
		},
		{
			id: 'credits',
			label: '누가 도와줬어?',
			// 빌려 쓴 에셋·글꼴의 출처: 맡은 부분과 이름, 만든 사람과 한 줄 설명
			lines: (project.credits ?? []).map((c, item) => ({
				title: `${c.role} · ${c.name}`,
				body: [`${c.by}의 것을 빌려 썼어요.`, c.note].filter(Boolean).join(' '),
				item,
			})),
		},
		// 장 묶음: 고르면 장마다 하나씩 고르는 두 번째 선택지가 열린다 (lines는 자리만)
		{ id: MORE_TOPIC, label: '더 들려줄 이야기 있어?', lines: chapters.length > 0 ? [{ body: '' }] : [] },
		// 화면 모음: 관리자가 넣은 그림을 한 장씩 캡션과 함께
		{
			id: 'gallery',
			label: '화면 모음 보여줘',
			lines: fromGallery
				? album.map((slide, i) => ({
						title: slide.caption || `화면 ${i + 1}`,
						body:
							i === 0
								? `${album.length}장을 한 장씩 넘겨 볼게요.`
								: i === album.length - 1
									? '이게 마지막 화면이에요.'
									: '',
						media: [{ src: slide.src }],
					}))
				: [],
		},
	];
	const filled = topics.filter((t) => t.lines.length > 0);
	// 링크는 항상 있다 (GitHub 주소는 필수). 읽음 표시·엔딩 셈에서는 뺀다
	filled.push({
		id: LINKS_TOPIC,
		label: '링크 줘',
		lines: [{ title: project.name, body: '여기서 더 볼 수 있어요.', media: cover ? [{ src: cover }] : undefined }],
	});

	// 그림이 없는 장은 앞 장의 그림을 이어 쓰지 않는다: 그 자리에는 주제의 게임 화면이 서서 지금 항목을 짚는다
	// 긴 글은 여러 장으로 (같은 제목과 장면을 이어 쓴다)
	for (const topic of [...filled, ...chapters]) {
		topic.lines = topic.lines.flatMap((line) => splitBody(line.body).map((body) => ({ ...line, body })));
	}
	const thumbOf = (topic: Topic) => topic.lines.flatMap((l) => l.media ?? []).find((s) => !s.video)?.src;
	for (const topic of chapters) topic.thumb = thumbOf(topic);
	filled.forEach((topic) => {
		topic.thumb = topic.id === MORE_TOPIC ? chapters.find((c) => c.thumb)?.thumb : thumbOf(topic);
	});
	return { topics: filled, chapters };
}

/**
 * 글을 타자치듯 한 글자씩 보인다. 움직임 줄이기면 바로 다 보인다.
 * 돌려주는 것: 지금까지 찍힌 글, 다 찍혔는지, 바로 끝내는 함수
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
	return { shown: text.slice(0, count), done: count >= text.length, finish };
}

const TROUBLE_LABELS: Record<TroubleStepKey, string> = {
	problem: '문제',
	cause: '원인',
	solution: '해결',
	result: '결과',
};

/** 옆에 게임 화면을 두지 않는 주제: 화면 모음은 그림 자체가 이야기다 */
const NO_SIDE = new Set(['gallery']);

const MENU_TITLE = '무엇을 들어 볼까요?';
const SUB_TITLE = '어떤 이야기를 더 들어 볼까요?';
const ENDING: Line = {
	title: '끝까지 들어줘서 고마워요!',
	body: '다 이야기했어요. 궁금한 게 더 있으면 다시 골라도 돼요.',
};

/** 게임 화면의 크기(CSS px). 모든 것을 이 칸 단위로 그리고, 화면 전체를 정수 배로 키운다 */
const SCREEN_W = 480;
const SCREEN_H = 270;
/** 화면 아래 키 안내 줄의 높이(게임 칸). 이만큼 더 들어갈 때만 보인다 */
const HINT_H = 18;

/**
 * 스크롤 상자(.safari-page)의 크기에 맞춘다. @container는 높이로 물을 수 없어 JS로 잰다.
 * zoom: 480×270이 들어가는 가장 큰 정수 배 (모든 칸이 같은 배수로 커져 픽셀이 고르다).
 * 한 배도 안 들어가면(아주 좁거나 낮은 창) compact: 키우지 않고 창 폭에 맞춘 단순한 배치. stage는 그때 무대를 둘 높이가 되는지
 */
function useScreen(ref: React.RefObject<HTMLElement | null>) {
	const [screen, setScreen] = useState({ zoom: 1, compact: false, hint: true, stage: true });
	useEffect(() => {
		const box = ref.current?.closest('.safari-page') ?? ref.current?.parentElement;
		if (!box || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const w = box.clientWidth;
			const h = box.clientHeight;
			const zoom = Math.floor(Math.min(w / SCREEN_W, h / SCREEN_H));
			const next =
				zoom >= 1
					? { zoom, compact: false, hint: h >= zoom * (SCREEN_H + HINT_H), stage: true }
					: { zoom: 1, compact: true, hint: false, stage: h >= 420 };
			setScreen((prev) =>
				prev.zoom === next.zoom && prev.compact === next.compact && prev.hint === next.hint && prev.stage === next.stage
					? prev
					: next
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(box);
		return () => observer.disconnect();
	}, [ref]);
	return screen;
}

/** 선택지 한 줄 글의 대략 폭(게임 칸): 갈무리11 11px에서 한글은 11칸, 빈칸은 4칸, 나머지는 7칸쯤 */
const labelWidth = (text: string) =>
	[...text].reduce((sum, ch) => sum + (/[가-힣ㄱ-ㅣ]/.test(ch) ? 11 : ch === ' ' ? 4 : 7), 0);

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
	const [mode, setMode] = useState<Mode>({ kind: 'greet' });
	const [read, setRead] = useState<Set<string>>(() => new Set());
	// 선택지의 ♥ 커서 (마우스를 올리거나 방향 키로 옮긴다). 지금 열린 선택지(처음 또는 장 목록) 안의 차례
	const [cursor, setCursor] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const screen = useScreen(rootRef);

	const back: Topic = useMemo(() => ({ id: BACK_TOPIC, label: '처음 선택지로', lines: [] }), []);
	const subList = useMemo(() => [...chapters, back], [chapters, back]);
	const inSub = mode.kind === 'menu' && mode.sub;
	const visible = inSub ? subList : topics;

	const countable = topics.filter((t) => t.id !== LINKS_TOPIC);
	const allRead = countable.every((t) => read.has(t.id));
	const readCount = countable.filter((t) => read.has(t.id)).length;
	const current = mode.kind === 'topic' ? [...topics, ...chapters].find((t) => t.id === mode.id) : undefined;

	const greet: Line = useMemo(
		() => ({
			title: project.tagline,
			body: [project.description, project.context].filter(Boolean).join(' · '),
			media: cover ? [{ src: cover }] : undefined,
		}),
		[project, cover]
	);

	// 지금 보이는 한 장. 선택지 차례에는 질문을 대화 상자 첫 줄에 찍고, 선택지는 그 아래에 연다
	const line: Line | null =
		mode.kind === 'greet'
			? greet
			: mode.kind === 'ending'
				? ENDING
				: mode.kind === 'menu'
					? { body: mode.sub ? SUB_TITLE : MENU_TITLE }
					: current
						? current.lines[mode.at]
						: null;

	// 대화 상자의 크기는 모든 장 중 가장 큰 것에 맞춘다: 모든 장을 같은 칸에 안 보이게 겹쳐 깔아 둔다 (장이 바뀌어도 상자가 튀지 않게)
	const ghosts = useMemo(
		() => [greet, ENDING, ...[...topics, ...chapters].flatMap((t) => t.lines)],
		[greet, topics, chapters]
	);

	const title = line?.title ?? '';
	const body = line?.body ?? '';
	const typedText = line ? `${title}\n${body}` : '';
	const { shown, done, finish } = useTyped(typedText);
	const titleCount = Math.min(shown.length, title.length);
	const bodyCount = Math.max(0, shown.length - title.length - 1);

	// 그 자리에서 넘겨 보는 그림의 차례. 장이 바뀌면 처음부터
	const lineKey = mode.kind === 'topic' ? `${mode.id}:${line?.media?.[0]?.src ?? mode.at}` : mode.kind;
	const [slideAt, setSlideAt] = useState({ key: '', at: 0 });
	const slides = mode.kind === 'menu' || mode.kind === 'ending' ? [] : (line?.media ?? []);
	const slideIndex = slideAt.key === lineKey ? Math.min(slideAt.at, Math.max(0, slides.length - 1)) : 0;
	const flip = useCallback(
		(step: number) => {
			if (slides.length < 2) return;
			setSlideAt({ key: lineKey, at: (slideIndex + step + slides.length) % slides.length });
		},
		[slides.length, lineKey, slideIndex]
	);

	/** 선택지로 돌아갈 때 커서는 아직 안 읽은 첫 주제에 */
	const backToMenu = useCallback(
		(nowRead: Set<string>, sub: boolean) => {
			const list = sub ? subList : topics;
			const unread = list.findIndex((t) => t.id !== LINKS_TOPIC && t.id !== BACK_TOPIC && !nowRead.has(t.id));
			setCursor(unread >= 0 ? unread : list.length - 1);
			setMode({ kind: 'menu', sub });
		},
		[topics, subList]
	);

	/** '다음': 찍히는 중이면 바로 다 보이고, 다 보였으면 다음 장으로 */
	const next = useCallback(() => {
		if (!done) {
			finish();
			return;
		}
		if (mode.kind === 'greet' || mode.kind === 'ending') backToMenu(read, false);
		else if (mode.kind === 'topic' && current) {
			if (mode.at + 1 < current.lines.length) setMode({ kind: 'topic', id: mode.id, at: mode.at + 1 });
			else {
				const nowRead = new Set(read).add(mode.id);
				const isChapter = chapters.some((c) => c.id === mode.id);
				// 장을 모두 읽으면 장 묶음도 읽음
				if (isChapter && chapters.every((c) => nowRead.has(c.id))) nowRead.add(MORE_TOPIC);
				setRead(nowRead);
				const finished = countable.every((t) => nowRead.has(t.id));
				// 마지막 주제를 다 읽은 순간에만 엔딩. 이미 엔딩을 본 뒤 다시 읽으면 바로 선택지
				if (finished && !allRead) setMode({ kind: 'ending' });
				else backToMenu(nowRead, isChapter && !nowRead.has(MORE_TOPIC));
			}
		}
	}, [done, finish, mode, current, read, chapters, countable, allRead, backToMenu]);

	const choose = useCallback(
		(topic: Topic) => {
			if (topic.id === MORE_TOPIC) backToMenu(read, true);
			else if (topic.id === BACK_TOPIC) {
				setCursor(
					Math.max(
						0,
						topics.findIndex((t) => t.id === MORE_TOPIC)
					)
				);
				setMode({ kind: 'menu', sub: false });
			} else {
				setCursor(Math.max(0, visible.indexOf(topic)));
				setMode({ kind: 'topic', id: topic.id, at: 0 });
			}
		},
		[backToMenu, read, topics, visible]
	);

	// 선택지는 여러 열 (언더테일처럼 왼쪽에서 오른쪽으로 채운다). 열 수는 가장 긴 줄이 들어가는 만큼: 세 열, 두 열, 한 열.
	// 좁은 창(compact)은 늘 한 열
	const colsOf = (list: Topic[]) => {
		if (screen.compact) return 1;
		const widest = Math.max(0, ...list.map((t) => labelWidth(t.label)));
		return widest <= 120 ? 3 : widest <= 190 ? 2 : 1;
	};
	const cols = colsOf(visible);

	/** 커서를 옮기고, 키보드로 옮겼으면 그 단추에 포커스 (보이는 줄 밖이면 선택지가 그 줄까지 넘어간다) */
	const moveCursor = useCallback(
		(index: number) => {
			const wrapped = (index + visible.length) % visible.length;
			setCursor(wrapped);
			rootRef.current?.querySelectorAll<HTMLButtonElement>('.dl-menu[data-open] .dl-choices button')[wrapped]?.focus();
		},
		[visible.length]
	);

	/** 방향 키로 갈 곳: ↑·↓는 같은 열의 윗줄·아랫줄(끝에서는 반대 끝으로), ←·→는 앞뒤 칸 */
	const stepFrom = useCallback(
		(from: number, key: string) => {
			const n = visible.length;
			if (key === 'ArrowLeft') return from - 1;
			if (key === 'ArrowRight') return from + 1;
			const col = from % cols;
			if (key === 'ArrowDown') return from + cols < n ? from + cols : col;
			return from - cols >= 0 ? from - cols : col + cols * Math.floor((n - 1 - col) / cols);
		},
		[visible.length, cols]
	);

	// 선택지가 보이는 줄보다 길면 상자 안에서 줄 단위로 넘어간다: 커서 줄이 늘 보이게, 위·아래에 더 있으면 ▲·▼
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
	}, [mode, cursor, cols, screen, updateMore]);

	// 키보드: Space·Enter·Z는 다음(선택지에서는 커서 줄 고르기), ↑·↓·←·→는 커서, 숫자는 선택지,
	// X·Esc는 장 목록에서 처음 선택지로, 이야기 중 ←·→는 그림 넘기기. 글 상자 안에서는 안 받는다
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
			if (mode.kind === 'menu') {
				if (key === 'ArrowDown' || key === 'ArrowUp' || ((key === 'ArrowRight' || key === 'ArrowLeft') && cols > 1)) {
					event.preventDefault();
					moveCursor(stepFrom(cursor, key));
				} else if (confirm) {
					// 다른 단추(링크 등)에 포커스가 있으면 그 단추가 받는다
					const menu = root.querySelector('.dl-menu[data-open]');
					if (key !== 'z' && target && target.tagName === 'BUTTON' && !menu?.contains(target)) return;
					event.preventDefault();
					const topic = visible[cursor];
					if (topic) choose(topic);
				} else if ((key === 'Escape' || key === 'x') && mode.sub) {
					event.preventDefault();
					choose(back);
				} else if (/^[1-9]$/.test(key)) {
					const topic = visible[Number(key) - 1];
					if (topic) {
						event.preventDefault();
						choose(topic);
					}
				}
			} else if (confirm) {
				// 링크 단추(보물 상자의 링크 포함)에 포커스가 있으면 Space·Enter는 그 단추가 받는다
				if (key !== 'z' && target?.closest('.dl-links-slot, .dl-stage a')) return;
				event.preventDefault();
				next();
			} else if ((key === 'ArrowLeft' || key === 'ArrowRight') && slides.length > 1) {
				event.preventDefault();
				flip(key === 'ArrowRight' ? 1 : -1);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [mode, next, choose, visible, cols, stepFrom, cursor, moveCursor, back, slides.length, flip]);

	const inMenu = mode.kind === 'menu';
	const progress = mode.kind === 'topic' && current ? `${mode.at + 1} / ${current.lines.length}` : '';
	// 링크 단추: 첫 화면(인사)에서 바로 열 수 있게, 그리고 엔딩과 '링크 줘' 주제에서
	const showLinks =
		mode.kind === 'greet' || mode.kind === 'ending' || (mode.kind === 'topic' && mode.id === LINKS_TOPIC);
	const meta = [project.period, project.language].filter(Boolean).join(' · ');

	/** 선택지 한 벌: 대화 상자 안, 질문 줄 아래에 연다. 처음 선택지와 장 목록이 같은 자리에 있고 열린 쪽만 보인다 */
	const renderMenu = (list: Topic[], heading: string, open: boolean) => (
		<div className="dl-menu" data-open={open || undefined} inert={!open}>
			<ol
				className="dl-choices"
				aria-label={heading}
				data-cols={colsOf(list)}
				style={{ ['--dl-cols' as string]: colsOf(list) }}
				onScroll={open ? updateMore : undefined}
			>
				{list.map((topic, i) => {
					const isRead = read.has(topic.id);
					const plain = topic.id === LINKS_TOPIC || topic.id === BACK_TOPIC;
					return (
						<li key={topic.id}>
							<button
								type="button"
								data-active={(open && i === cursor) || undefined}
								data-read={isRead || undefined}
								data-back={topic.id === BACK_TOPIC || undefined}
								aria-pressed={plain ? undefined : isRead}
								onClick={() => choose(topic)}
								onMouseMove={() => i !== cursor && setCursor(i)}
								onFocus={() => setCursor(i)}
							>
								<span className="dl-cursor" aria-hidden="true">
									♥
								</span>
								<span className="dl-label">{topic.label}</span>
								<em className="dl-check">{isRead && <span aria-label="읽음">✓</span>}</em>
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

	/** 그림 옆(넓은 무대)이나 그림 대신(그림이 없을 때) 서는 게임 화면 */
	const panelOf = (focus: PanelFocus | 'title' | 'end', side: boolean) =>
		focus === 'title' || focus === 'end' ? (
			<TitleScreen project={project} side={side} end={focus === 'end'} />
		) : (
			<TopicPanel project={project} focus={focus} side={side} />
		);

	/** 액자 하나와 그 옆의 작은 게임 화면 (옆 화면은 무대가 좁으면 CSS가 접는다) */
	const framed = (frame: React.ReactNode, side: React.ReactNode | null) => (
		<>
			{frame}
			{side && <div className="dl-side">{side}</div>}
		</>
	);

	/** 무대: 선택지면 커서 주제의 미리보기, 엔딩이면 앨범, 아니면 지금 장의 그림과 게임 화면 (그림이 없으면 게임 화면만 크게) */
	const renderScene = () => {
		if (mode.kind === 'menu') {
			const focus = visible[cursor];
			const id = focus?.id ?? '';
			const plain = !focus || id === LINKS_TOPIC || id === BACK_TOPIC || id === MORE_TOPIC;
			const preview = focus?.thumb ?? (id === BACK_TOPIC ? cover : undefined);
			const panel = panelOf(plain ? 'title' : { topic: id }, Boolean(preview));
			return (
				<div
					className="dl-scene dl-preview"
					aria-hidden="true"
					inert
					data-side={(preview && !NO_SIDE.has(id)) || undefined}
					key={preview ?? `panel-${id}`}
				>
					{preview
						? framed(<Frame slide={{ src: preview }} caption={focus?.label} />, NO_SIDE.has(id) ? null : panel)
						: panel}
				</div>
			);
		}
		if (mode.kind === 'ending') {
			const shelf = album.slice(0, 6);
			return (
				<div className="dl-scene" aria-hidden="true">
					{shelf.length > 1 ? (
						<figure className="dl-shot">
							<div className="dl-album" data-count={shelf.length}>
								{shelf.map((slide) => (
									<img key={slide.src} src={slide.src} alt="" />
								))}
							</div>
							<figcaption className="dl-shot-foot">
								<span className="dl-caption">{`${project.name} 앨범`}</span>
							</figcaption>
						</figure>
					) : (
						panelOf('end', false)
					)}
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
							<Frame slide={slide} caption={slide.caption}>
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

	const portrait = mode.kind === 'topic' ? line?.portrait : undefined;
	// 무대 뒤 장면: 선택지에서는 커서 주제의 것, 엔딩은 밤하늘
	const scene =
		mode.kind === 'ending'
			? 'night'
			: sceneOf(mode.kind === 'topic' ? mode.id : mode.kind === 'menu' ? visible[cursor]?.id : undefined);
	const hint = inMenu
		? inSub
			? '방향 키로 고르고 Enter나 Z를 누릅니다. X나 Esc를 누르면 처음 선택지로 돌아갑니다.'
			: '방향 키로 고르고 Enter나 Z를 누릅니다. 숫자 키로도 고를 수 있습니다.'
		: slides.length > 1
			? 'Space, Enter, Z를 누르면 다음으로 넘어갑니다. ←·→로 그림을 넘겨 봅니다.'
			: 'Space, Enter, Z를 누르면 다음으로 넘어갑니다.';

	return (
		<div
			className="dl"
			data-id={project.id}
			data-mode={mode.kind}
			data-fit={screen.compact ? 'compact' : 'screen'}
			data-stage={screen.stage || undefined}
			ref={rootRef}
		>
			{/* 게임 화면: 480×270을 정수 배(zoom)로 키운다. 안의 크기는 모두 게임 칸 */}
			<div className="dl-screen" style={screen.compact ? undefined : { zoom: screen.zoom }} data-zoom={screen.zoom}>
				<div className="dl-game" data-scene={scene}>
					{/* 무대 뒤의 타일 장면 (낮·밤 두 장 중 테마에 맞는 한 장) */}
					<SceneBackdrop scene={scene} />
					{/* 무대: 지금 이야기하는 그림, 없으면 주제의 게임 화면 */}
					<div className="dl-stage">{renderScene()}</div>

					{/* 대화 상자: * 대사. 선택지 차례에는 질문 아래에 선택지가 열린다. 팀원의 장이면 왼쪽에 얼굴 칸 */}
					<section
						className="dl-box"
						role="dialog"
						aria-label="대화"
						aria-live="polite"
						data-portrait={Boolean(portrait) || undefined}
					>
						{/* 얼굴 칸: 사진을 24×24 픽셀 초상으로 줄여 두 배 */}
						{portrait && <PixelImage src={portrait} size={24} scale={2} cover className="dl-portrait" />}
						<div className="dl-text" onClick={inMenu ? undefined : next}>
							<div className="dl-cell">
								{ghosts.map((g, i) => (
									<div key={i} className="dl-ghost" aria-hidden="true">
										<strong className="dl-title" data-text={g.title ?? ''} />
										<p className="dl-body" data-text={g.body} />
									</div>
								))}

								{/* 지금 장: 찍힌 글 뒤에 아직 안 찍힌 글을 안 보이게 이어 두어 줄바꿈이 처음부터 끝 모양과 같다 */}
								{line && (
									<div className="dl-line">
										{title && (
											<strong className="dl-title">
												{title.slice(0, titleCount)}
												<span className="dl-rest" data-text={title.slice(titleCount)} aria-hidden="true" />
											</strong>
										)}
										<p className="dl-body">
											{body.slice(0, bodyCount)}
											<span className="dl-rest" data-text={body.slice(bodyCount)} aria-hidden="true" />
										</p>
									</div>
								)}
							</div>

							<div className="dl-foot">
								{showLinks ? (
									<div className="dl-links-slot" data-shown={done || undefined} onClick={(e) => e.stopPropagation()}>
										<Links project={project} className="sp-links dl-links" />
									</div>
								) : (
									<span className="dl-count">{progress}</span>
								)}
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
							</div>
						</div>

						{renderMenu(topics, MENU_TITLE, inMenu && !inSub)}
						{chapters.length > 0 && renderMenu(subList, SUB_TITLE, inSub)}
					</section>

					{/* 상태 줄: 이름과 기간, 읽은 주제 막대 (HP 막대처럼) */}
					<div className="dl-status">
						<span className="dl-status-name">
							<b>{project.name}</b>
							{meta && <small>{meta}</small>}
						</span>
						{countable.length > 0 && (
							<span className="dl-hp">
								<em aria-hidden="true">읽음</em>
								<span className="dl-hp-bar" aria-hidden="true">
									<i style={{ width: `${(readCount / countable.length) * 100}%` }} />
								</span>
								<span className="dl-hp-count">
									<span className="visually-hidden">읽은 주제 </span>
									{readCount} / {countable.length}
								</span>
							</span>
						)}
					</div>
				</div>

				{/* 키 안내: 화면 아래 한 줄 (자리가 모자라면 읽기 프로그램에만) */}
				<p className="dl-keys" data-shown={screen.hint || undefined}>
					{hint}
				</p>
			</div>
		</div>
	);
};

export default DialoguePage;
