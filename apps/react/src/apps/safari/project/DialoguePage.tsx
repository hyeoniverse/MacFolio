// dialogue 모양: RPG 대화창. 프로젝트가 화자가 되어 소개를 대화로 들려주고, 묻고 싶은 주제를 선택지로 고른다
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
import { Favicon, Links } from '@/apps/safari/project/parts';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/DialoguePage.css';

/** 장면 액자에 띄우는 그림(또는 영상) 한 장. caption이 있으면 액자 아래 나무 팻말에 적는다 */
interface Slide {
	src: string;
	caption?: string;
	video?: boolean;
}

/** 대화 상자에 한 번에 보이는 한 장 */
interface Line {
	title?: string;
	body: string;
	/** 장면: 이 장을 말하는 동안 액자에 띄울 그림들 (여러 장이면 액자 안에서 넘겨 본다) */
	media?: Slide[];
}

/** 선택지 하나: 고르면 lines를 '다음'으로 한 장씩 읽는다 */
interface Topic {
	id: string;
	label: string;
	lines: Line[];
	/** 선택지에서 커서가 올라오면 장면 액자에 미리 보여 줄 그림 */
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
 * 그림이 없는 장면, 선택지 미리보기, 벽에 건 액자, 엔딩 앨범이 이것을 돌려 쓴다
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
	const points = (items: ProjectPoint[]): Line[] =>
		items.map((p) => ({ title: p.title, body: p.body, media: pointMedia(p) }));
	const chapters: Topic[] = (project.chapters ?? [])
		.map((chapter, i) => ({
			id: `chapter-${i}`,
			label: chapter.title,
			lines: [
				...(chapter.lead
					? [
							{
								title: chapter.title,
								body: chapter.lead,
								media: chapter.image ? [{ src: chapter.image.src, caption: chapter.image.alt }] : undefined,
							},
						]
					: []),
				...points(chapter.points),
			],
		}))
		.filter((t) => t.lines.length > 0);
	const topics: Topic[] = [
		{ id: 'highlights', label: '주요 기능 알려줘', lines: points(project.highlights) },
		{ id: 'build', label: '어떻게 만들었어?', lines: points(project.build) },
		{ id: 'usage', label: '쓰는 법', lines: points(project.usage ?? []) },
		{
			id: 'facts',
			label: '숫자로 보여줘',
			lines: project.facts.map((f) => ({ title: f.value, body: f.label })),
		},
		{
			id: 'controls',
			label: '조작법',
			lines: (project.controls ?? []).map((c) => ({ title: c.keys.join(' + '), body: c.label })),
		},
		{
			id: 'timeline',
			label: '진행 과정',
			lines: (project.timeline ?? []).map((t) => ({ title: t.date, body: t.label })),
		},
		{
			id: 'specs',
			label: '기술 사양',
			lines: project.specs.map((s) => ({ title: s.label, body: s.value })),
		},
		{
			id: 'contributions',
			label: '맡은 일',
			lines: project.contributions.map((c, i) => ({
				title: `맡은 일 ${i + 1}/${project.contributions.length}`,
				body: c,
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

	// 그림이 없는 장은 같은 주제의 바로 앞 장 그림을 이어 쓴다 (그 이야기와 상관없는 그림을 끌어오지 않는다).
	// 주제에 그림이 하나도 없으면 장면 자리에는 프로젝트 간판이 선다
	for (const topic of [...filled, ...chapters]) {
		let last: Slide[] | undefined;
		for (const line of topic.lines) {
			if (line.media?.length) last = line.media;
			else if (last) line.media = last;
		}
	}
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

/** 초상: 대화 상자 오른쪽의 액자. sproutfarm은 풀밭 위 픽셀 캐릭터, 다른 프로젝트는 큰 아이콘. 말하는 동안 살짝 들썩인다 */
const Portrait: React.FC<{ project: Project; talking: boolean }> = ({ project, talking }) => (
	<div className="dl-portrait" aria-hidden="true">
		<div className="dl-face dl-frame" data-talking={talking || undefined}>
			{project.id === 'sproutfarm' ? <i className="dl-sprite" /> : <Favicon project={project} className="dl-icon" />}
		</div>
		<div className="dl-name">{project.name}</div>
	</div>
);

/** 장면 바닥의 장식 스프라이트 (sproutfarm). 왼쪽부터 자리(%)·크기 배율 */
const PROPS: { src: string; left: number; scale: number }[] = [
	{ src: 'tree', left: 2, scale: 5 },
	{ src: 'bush', left: 12, scale: 4 },
	{ src: 'flower-pink', left: 17, scale: 3 },
	{ src: 'sunflower', left: 21, scale: 4 },
	{ src: 'flower-blue', left: 77, scale: 3 },
	{ src: 'bush', left: 81, scale: 4 },
	{ src: 'fruit-tree', left: 88, scale: 5 },
];

const MENU_TITLE = '무엇을 들어 볼까요?';
const SUB_TITLE = '어떤 이야기를 더 들어 볼까요?';
const ENDING: Line = {
	title: '끝까지 들어줘서 고마워요!',
	body: '다 이야기했어요. 궁금한 게 더 있으면 다시 골라도 돼요.',
};

/**
 * 스크롤 상자(.safari-page) 높이가 모자라면 장면·HUD를 접는다. @container는 높이로 물을 수 없어 JS로 잰다.
 * 'compact': 숫자 판과 벽 액자를 접는다, 'tiny': 대화 상자만 남긴다
 */
function useFit(ref: React.RefObject<HTMLElement | null>) {
	const [fit, setFit] = useState<'full' | 'compact' | 'tiny'>('full');
	useEffect(() => {
		const box = ref.current?.closest('.safari-page') ?? ref.current?.parentElement;
		if (!box || typeof ResizeObserver === 'undefined') return;
		const measure = () => {
			const h = box.clientHeight;
			setFit(h < 400 ? 'tiny' : h < 580 ? 'compact' : 'full');
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(box);
		return () => observer.disconnect();
	}, [ref]);
	return fit;
}

/** 장면 액자 한 장: 그림이나 소리 없이 반복하는 영상, 아래에 나무 팻말 */
const Frame: React.FC<{ slide: Slide; plank?: string; children?: React.ReactNode }> = ({ slide, plank, children }) => (
	<figure className="dl-shot">
		<div className="dl-shot-frame dl-frame">
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
			{children}
		</div>
		{plank && (
			<figcaption className="dl-plank" aria-hidden="true">
				<span>{plank}</span>
			</figcaption>
		)}
	</figure>
);

const DialoguePage: React.FC<{ project: Project }> = ({ project }) => {
	const { slides: album, fromGallery } = useMemo(() => buildAlbum(project), [project]);
	const cover = project.art || project.image || album[0]?.src;
	const { topics, chapters } = useMemo(
		() => buildTopics(project, album, fromGallery, cover),
		[project, album, fromGallery, cover]
	);
	const [mode, setMode] = useState<Mode>({ kind: 'greet' });
	const [read, setRead] = useState<Set<string>>(() => new Set());
	// 선택지의 ▶ 커서 (마우스를 올리거나 ↑·↓로 옮긴다). 지금 열린 선택지(처음 또는 장 목록) 안의 차례
	const [cursor, setCursor] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const fit = useFit(rootRef);

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

	// 지금 보이는 한 장
	const line: Line | null =
		mode.kind === 'greet'
			? greet
			: mode.kind === 'ending'
				? ENDING
				: current
					? current.lines[mode.kind === 'topic' ? mode.at : 0]
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

	// 장면 안에서 넘겨 보는 그림의 차례. 장이 바뀌면 처음부터
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

	/** 커서를 옮기고, 키보드로 옮겼으면 그 단추에 포커스 */
	const moveCursor = useCallback(
		(index: number) => {
			const wrapped = (index + visible.length) % visible.length;
			setCursor(wrapped);
			rootRef.current?.querySelectorAll<HTMLButtonElement>('.dl-menu[data-open] .dl-choices button')[wrapped]?.focus();
		},
		[visible.length]
	);

	// 키보드: Space·Enter는 다음(선택지에서는 커서 줄 고르기), ↑·↓는 커서, 숫자는 선택지, ←·→는 장면의 그림 넘기기,
	// Esc는 장 목록에서 처음 선택지로. 글 상자 안에서는 안 받는다
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
			if (target && target !== document.body && !root.contains(target)) return;
			// 장면의 넘기기 단추는 제 일을 한다
			if (target?.closest('.dl-flip')) return;
			if (mode.kind === 'menu') {
				if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
					event.preventDefault();
					moveCursor(cursor + (event.key === 'ArrowDown' ? 1 : -1));
				} else if (event.key === ' ' || event.key === 'Enter') {
					// 다른 단추(링크 등)에 포커스가 있으면 그 단추가 받는다
					const menu = root.querySelector('.dl-menu[data-open]');
					if (target && target.tagName === 'BUTTON' && !menu?.contains(target)) return;
					event.preventDefault();
					const topic = visible[cursor];
					if (topic) choose(topic);
				} else if (event.key === 'Escape' && mode.sub) {
					event.preventDefault();
					choose(back);
				} else if (/^[1-9]$/.test(event.key)) {
					const topic = visible[Number(event.key) - 1];
					if (topic) {
						event.preventDefault();
						choose(topic);
					}
				}
			} else if (event.key === ' ' || event.key === 'Enter') {
				event.preventDefault();
				next();
			} else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && slides.length > 1) {
				event.preventDefault();
				flip(event.key === 'ArrowRight' ? 1 : -1);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [mode, next, choose, visible, cursor, moveCursor, back, slides.length, flip]);

	const inMenu = mode.kind === 'menu';
	const progress = mode.kind === 'topic' && current ? `${mode.at + 1} / ${current.lines.length}` : '';
	const showLinks = mode.kind === 'ending' || (mode.kind === 'topic' && mode.id === LINKS_TOPIC);
	const meta = [project.period, project.language].filter(Boolean).join(' · ');
	// 선택지가 다섯 개 이상이면 두 열 (위에서 아래로 채운다, ↑·↓가 눈으로 보는 순서와 같게)
	const rowsOf = (list: Topic[]) => (list.length > 4 ? Math.ceil(list.length / 2) : list.length);

	/** 선택지 한 벌 (처음 선택지와 장 목록이 같은 칸에 겹쳐 있고, 열린 쪽만 보인다) */
	const renderMenu = (list: Topic[], heading: string, open: boolean) => {
		const rows = rowsOf(list);
		return (
			<div className="dl-menu" data-open={open || undefined} inert={!open}>
				<strong className="dl-title">{heading}</strong>
				<ol className="dl-choices" data-cols={rows < list.length ? 2 : 1} style={{ ['--dl-rows' as string]: rows }}>
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
									onMouseEnter={() => setCursor(i)}
									onFocus={() => setCursor(i)}
								>
									<span className="dl-cursor" aria-hidden="true">
										▶
									</span>
									<span className="dl-label">{topic.label}</span>
									<em className="dl-check">{isRead && <span aria-label="읽음">✓</span>}</em>
									<kbd>{i + 1}</kbd>
								</button>
							</li>
						);
					})}
				</ol>
			</div>
		);
	};

	/** 장면: 선택지면 커서 주제의 미리보기와 주제 그림 줄, 엔딩이면 앨범, 아니면 지금 장의 그림 */
	const renderScene = () => {
		const sign = (
			<div className="dl-sign dl-frame">
				<Favicon project={project} className="dl-sign-icon" />
				<span>{project.name}</span>
			</div>
		);
		if (mode.kind === 'menu') {
			const focus = visible[cursor];
			const preview = focus?.thumb ?? (focus?.id === BACK_TOPIC ? cover : undefined);
			const strip = visible.filter((t) => t.thumb);
			return (
				<div className="dl-scene dl-preview" aria-hidden="true">
					<div className="dl-scene-main" key={preview ?? 'sign'}>
						{preview ? <Frame slide={{ src: preview }} plank={focus?.label} /> : sign}
					</div>
					{strip.length > 1 && (
						<ol className="dl-strip">
							{strip.map((topic) => (
								<li key={topic.id} data-active={topic === focus || undefined}>
									<img src={topic.thumb} alt="" />
								</li>
							))}
						</ol>
					)}
				</div>
			);
		}
		if (mode.kind === 'ending') {
			const shelf = album.slice(0, 6);
			return (
				<div className="dl-scene" aria-hidden="true">
					{shelf.length > 1 ? (
						<figure className="dl-shot">
							<div className="dl-album dl-frame" data-count={shelf.length}>
								{shelf.map((slide) => (
									<img key={slide.src} src={slide.src} alt="" />
								))}
							</div>
							<figcaption className="dl-plank">
								<span>{`${project.name} 앨범`}</span>
							</figcaption>
						</figure>
					) : cover ? (
						<Frame slide={{ src: cover }} />
					) : (
						sign
					)}
				</div>
			);
		}
		const slide = slides[slideIndex];
		return (
			<div className="dl-scene" key={slide ? `${lineKey}` : 'sign'}>
				{slide ? (
					<Frame slide={slide} plank={slide.caption}>
						{slides.length > 1 && (
							<div className="dl-flip">
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
							</div>
						)}
					</Frame>
				) : (
					<div aria-hidden="true">{sign}</div>
				)}
			</div>
		);
	};

	return (
		<div className="dl" data-id={project.id} data-mode={mode.kind} data-fit={fit} ref={rootRef}>
			{/* 바탕: 하늘과 풀밭(sproutfarm) 또는 낮 하늘과 마룻바닥 */}
			<div className="dl-sky" aria-hidden="true" />
			<div className="dl-ground" aria-hidden="true" />
			{project.id === 'sproutfarm' && (
				<div className="dl-props" aria-hidden="true">
					{PROPS.map((prop, i) => (
						<img
							key={i}
							src={`/imgs/projects/sproutfarm/sprites/${prop.src}.png`}
							alt=""
							style={{ left: `${prop.left}%`, ['--dl-scale' as string]: prop.scale }}
						/>
					))}
				</div>
			)}

			{/* HUD: 왼쪽 위 숫자 판(값과 무엇의 숫자인지), 오른쪽 위 읽은 주제 판 */}
			{project.facts.length > 0 && (
				<ul className="dl-hud dl-stats dl-frame" aria-label="숫자">
					{project.facts.slice(0, 3).map((fact) => (
						<li key={fact.label}>
							<strong>{fact.value}</strong>
							<span>{fact.label}</span>
						</li>
					))}
				</ul>
			)}
			<div className="dl-hud dl-quest dl-frame">
				{countable.length > 0 && (
					<>
						<span className="dl-quest-count">
							읽은 주제{' '}
							<b>
								{readCount} / {countable.length}
							</b>
						</span>
						<span className="dl-meter" aria-hidden="true">
							{countable.map((t) => (
								<i key={t.id} data-on={read.has(t.id) || undefined} />
							))}
						</span>
					</>
				)}
				{meta && <span className="dl-meta">{meta}</span>}
			</div>

			{/* 장면: 지금 이야기하는 화면을 액자에, 없으면 간판 */}
			<div className="dl-stage">{renderScene()}</div>

			{/* 대화 상자: 왼쪽 글(또는 선택지), 오른쪽 초상과 이름표 */}
			<section className="dl-box dl-frame" role="dialog" aria-label="대화" aria-live="polite">
				<div className="dl-text" onClick={inMenu ? undefined : next}>
					<div className="dl-cell">
						{ghosts.map((g, i) => (
							<div key={i} className="dl-ghost" aria-hidden="true">
								<strong className="dl-title" data-text={g.title ?? ''} />
								<p className="dl-body" data-text={g.body} />
							</div>
						))}

						{/* 선택지: 늘 같은 칸에 깔아 두고 선택지 차례에만 보인다 (상자 크기를 같이 잡는다) */}
						{renderMenu(topics, MENU_TITLE, inMenu && !inSub)}
						{chapters.length > 0 && renderMenu(subList, SUB_TITLE, inSub)}

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
							다음 <i aria-hidden="true">▼</i>
						</button>
					</div>
				</div>
				<Portrait project={project} talking={!done && !inMenu} />
			</section>

			<p className="dl-keys">
				<span>
					{inMenu
						? inSub
							? '↑·↓로 고르고 Enter를 누릅니다. Esc를 누르면 처음 선택지로 돌아갑니다.'
							: '↑·↓로 고르고 Enter를 누릅니다. 숫자 키로도 고를 수 있습니다.'
						: slides.length > 1
							? 'Space 또는 Enter를 누르면 다음으로 넘어갑니다. ←·→로 그림을 넘겨 봅니다.'
							: 'Space 또는 Enter를 누르면 다음으로 넘어갑니다.'}
				</span>
			</p>
		</div>
	);
};

export default DialoguePage;
