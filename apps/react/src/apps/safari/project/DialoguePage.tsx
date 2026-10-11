// dialogue 모양: RPG 대화창. 프로젝트가 화자가 되어 소개를 대화로 들려주고, 묻고 싶은 주제를 선택지로 고른다
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Favicon, Links } from '@/apps/safari/project/parts';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import '@/apps/safari/project/DialoguePage.css';

/** 대화 상자에 한 번에 보이는 한 장 */
interface Line {
	title?: string;
	body: string;
	/** 장면 그림: 있으면 위쪽 장면 액자에 이 그림을 띄운다 */
	image?: string;
}

/** 선택지 하나: 고르면 lines를 '다음'으로 한 장씩 읽는다 */
interface Topic {
	id: string;
	label: string;
	lines: Line[];
}

type Mode = { kind: 'greet' } | { kind: 'menu' } | { kind: 'topic'; id: string; at: number } | { kind: 'ending' };

const LINKS_TOPIC = 'links';

/** 프로젝트 데이터에서 선택지를 만든다. 비어 있는 주제는 선택지에 안 나온다 */
function buildTopics(project: Project): Topic[] {
	const points = (items: { title: string; body: string; image?: string; shots?: { src: string }[] }[]): Line[] =>
		items.map((p) => ({ title: p.title, body: p.body, image: p.image ?? p.shots?.[0]?.src }));
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
	];
	const filled = topics.filter((t) => t.lines.length > 0);
	// 링크는 항상 있다 (GitHub 주소는 필수). 읽음 표시·엔딩 셈에서는 뺀다
	filled.push({ id: LINKS_TOPIC, label: '링크 줘', lines: [{ title: project.name, body: '여기서 더 볼 수 있어요.' }] });
	return filled;
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
			setTyped({ text, count: shown });
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

/** HUD의 facts 아이콘: HP·골드처럼 */
const HUD_ICONS = ['fa-heart', 'fa-coins', 'fa-star', 'fa-bolt', 'fa-gem', 'fa-flag'];

const MENU_TITLE = '무엇을 들어 볼까요?';
const ENDING: Line = {
	title: '끝까지 들어줘서 고마워요!',
	body: '다 이야기했어요. 궁금한 게 더 있으면 다시 골라도 돼요.',
};

/**
 * 스크롤 상자(.safari-page) 높이가 모자라면 장면·HUD를 접는다. @container는 높이로 물을 수 없어 JS로 잰다.
 * 'compact': 장면 액자와 HUD의 숫자를 접는다, 'tiny': 대화 상자만 남긴다
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

const DialoguePage: React.FC<{ project: Project }> = ({ project }) => {
	const topics = useMemo(() => buildTopics(project), [project]);
	const [mode, setMode] = useState<Mode>({ kind: 'greet' });
	const [read, setRead] = useState<Set<string>>(() => new Set());
	// 선택지의 ▶ 커서 (마우스를 올리거나 ↑·↓로 옮긴다)
	const [cursor, setCursor] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLOListElement>(null);
	const fit = useFit(rootRef);

	const countable = topics.filter((t) => t.id !== LINKS_TOPIC);
	const allRead = countable.every((t) => read.has(t.id));
	const readCount = countable.filter((t) => read.has(t.id)).length;
	const current = mode.kind === 'topic' ? topics.find((t) => t.id === mode.id) : undefined;
	const cover = project.art ?? project.image;

	const greet: Line = useMemo(
		() => ({
			title: project.tagline,
			body: [project.description, project.context].filter(Boolean).join(' · '),
			image: project.art ?? project.image,
		}),
		[project]
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
	const ghosts = useMemo(() => [greet, ENDING, ...topics.flatMap((t) => t.lines)], [greet, topics]);

	const title = line?.title ?? '';
	const body = line?.body ?? '';
	const typedText = line ? `${title}\n${body}` : '';
	const { shown, done, finish } = useTyped(typedText);
	const titleCount = Math.min(shown.length, title.length);
	const bodyCount = Math.max(0, shown.length - title.length - 1);

	// 장면: 지금 장의 그림, 없으면 대표 화면, 그것도 없으면 간판
	const shot = mode.kind === 'topic' ? (line?.image ?? cover) : cover;

	/** 선택지로 돌아갈 때 커서는 아직 안 읽은 첫 주제에 */
	const backToMenu = useCallback(
		(nowRead: Set<string>) => {
			const unread = topics.findIndex((t) => t.id !== LINKS_TOPIC && !nowRead.has(t.id));
			setCursor(unread >= 0 ? unread : topics.length - 1);
			setMode({ kind: 'menu' });
		},
		[topics]
	);

	/** '다음': 찍히는 중이면 바로 다 보이고, 다 보였으면 다음 장으로 */
	const next = useCallback(() => {
		if (!done) {
			finish();
			return;
		}
		if (mode.kind === 'greet' || mode.kind === 'ending') backToMenu(read);
		else if (mode.kind === 'topic' && current) {
			if (mode.at + 1 < current.lines.length) setMode({ kind: 'topic', id: mode.id, at: mode.at + 1 });
			else {
				const nowRead = new Set(read).add(mode.id);
				setRead(nowRead);
				const finished = countable.every((t) => nowRead.has(t.id));
				// 마지막 주제를 다 읽은 순간에만 엔딩. 이미 엔딩을 본 뒤 다시 읽으면 바로 선택지
				if (finished && !allRead) setMode({ kind: 'ending' });
				else backToMenu(nowRead);
			}
		}
	}, [done, finish, mode, current, read, countable, allRead, backToMenu]);

	const choose = useCallback(
		(topic: Topic) => {
			setCursor(topics.indexOf(topic));
			setMode({ kind: 'topic', id: topic.id, at: 0 });
		},
		[topics]
	);

	/** 커서를 옮기고, 키보드로 옮겼으면 그 단추에 포커스 */
	const moveCursor = useCallback(
		(index: number) => {
			const wrapped = (index + topics.length) % topics.length;
			setCursor(wrapped);
			menuRef.current?.querySelectorAll('button')[wrapped]?.focus();
		},
		[topics.length]
	);

	// 키보드: Space·Enter는 다음(선택지에서는 커서 줄 고르기), ↑·↓는 커서, 숫자는 선택지. 글 상자 안에서는 안 받는다
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
			if (target && target !== document.body && !root.contains(target)) return;
			if (mode.kind === 'menu') {
				if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
					event.preventDefault();
					moveCursor(cursor + (event.key === 'ArrowDown' ? 1 : -1));
				} else if (event.key === ' ' || event.key === 'Enter') {
					// 다른 단추(링크 등)에 포커스가 있으면 그 단추가 받는다
					if (target && target.tagName === 'BUTTON' && !menuRef.current?.contains(target)) return;
					event.preventDefault();
					const topic = topics[cursor];
					if (topic) choose(topic);
				} else if (/^[1-9]$/.test(event.key)) {
					const topic = topics[Number(event.key) - 1];
					if (topic) {
						event.preventDefault();
						choose(topic);
					}
				}
			} else if (event.key === ' ' || event.key === 'Enter') {
				event.preventDefault();
				next();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [mode, next, choose, topics, cursor, moveCursor]);

	const inMenu = mode.kind === 'menu';
	const progress = mode.kind === 'topic' && current ? `${mode.at + 1} / ${current.lines.length}` : '';
	const showLinks = mode.kind === 'ending' || (mode.kind === 'topic' && mode.id === LINKS_TOPIC);
	const meta = [project.period, project.language].filter(Boolean).join(' · ');
	// 선택지가 다섯 개 이상이면 두 열 (위에서 아래로 채운다, ↑·↓가 눈으로 보는 순서와 같게)
	const menuRows = topics.length > 4 ? Math.ceil(topics.length / 2) : topics.length;

	return (
		<div className="dl" data-id={project.id} data-mode={mode.kind} data-fit={fit} ref={rootRef}>
			{/* 바탕: 하늘과 풀밭(sproutfarm) 또는 별이 뜬 밤 */}
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

			{/* HUD: 왼쪽 위 숫자 판, 오른쪽 위 읽은 주제 판 */}
			{project.facts.length > 0 && (
				<ul className="dl-hud dl-stats dl-frame" aria-label="숫자">
					{project.facts.slice(0, 3).map((fact, i) => (
						<li key={fact.label} title={fact.label}>
							<i className={`fa-solid ${HUD_ICONS[i % HUD_ICONS.length]}`} aria-hidden="true" />
							<strong>{fact.value}</strong>
							<span className="visually-hidden">{fact.label}</span>
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
			<div className="dl-stage" aria-hidden="true">
				<div className="dl-scene" key={shot ?? 'sign'}>
					{shot ? (
						<figure className="dl-shot dl-frame">
							<img src={shot} alt="" />
						</figure>
					) : (
						<div className="dl-sign dl-frame">
							<Favicon project={project} className="dl-sign-icon" />
							<span>{project.name}</span>
						</div>
					)}
				</div>
			</div>

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
						<div className="dl-menu" data-open={inMenu || undefined} inert={!inMenu}>
							<strong className="dl-title">{MENU_TITLE}</strong>
							<ol
								className="dl-choices"
								ref={menuRef}
								data-cols={menuRows < topics.length ? 2 : 1}
								style={{ ['--dl-rows' as string]: menuRows }}
							>
								{topics.map((topic, i) => {
									const isRead = read.has(topic.id);
									return (
										<li key={topic.id}>
											<button
												type="button"
												data-active={(inMenu && i === cursor) || undefined}
												data-read={isRead || undefined}
												aria-pressed={topic.id === LINKS_TOPIC ? undefined : isRead}
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
						? '↑·↓로 고르고 Enter를 누릅니다. 숫자 키로도 고를 수 있습니다.'
						: 'Space 또는 Enter를 누르면 다음으로 넘어갑니다.'}
				</span>
			</p>
		</div>
	);
};

export default DialoguePage;
