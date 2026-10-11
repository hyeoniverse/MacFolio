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
	/** 장면 그림: 있으면 뒤 배경이 이 그림으로 바뀐다 */
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

/** 화자 초상: sproutfarm은 걷는 캐릭터 스프라이트(액자 안), 다른 프로젝트는 아이콘 */
const Portrait: React.FC<{ project: Project }> = ({ project }) =>
	project.id === 'sproutfarm' ? (
		<span className="dl-portrait dl-portrait-sprite" aria-hidden="true">
			<i className="dl-sprite" />
		</span>
	) : (
		<span className="dl-portrait" aria-hidden="true">
			<Favicon project={project} className="dl-favicon" />
		</span>
	);

/** 왼쪽 위 HUD: facts를 HP·골드처럼 아이콘과 값으로 */
const HUD_ICONS = ['fa-heart', 'fa-coins', 'fa-star', 'fa-bolt', 'fa-gem', 'fa-flag'];

const DialoguePage: React.FC<{ project: Project }> = ({ project }) => {
	const topics = useMemo(() => buildTopics(project), [project]);
	const [mode, setMode] = useState<Mode>({ kind: 'greet' });
	const [read, setRead] = useState<Set<string>>(() => new Set());
	const rootRef = useRef<HTMLDivElement>(null);

	const countable = topics.filter((t) => t.id !== LINKS_TOPIC);
	const allRead = countable.every((t) => read.has(t.id));
	const current = mode.kind === 'topic' ? topics.find((t) => t.id === mode.id) : undefined;

	// 지금 보이는 한 장
	const line: Line | null =
		mode.kind === 'greet'
			? {
					title: project.tagline,
					body: [project.description, project.context].filter(Boolean).join(' · '),
					image: project.art ?? project.image,
				}
			: mode.kind === 'ending'
				? { title: '끝까지 들어줘서 고마워요!', body: '다 이야기했어요. 궁금한 게 더 있으면 다시 골라도 돼요.' }
				: current
					? current.lines[mode.kind === 'topic' ? mode.at : 0]
					: null;

	const typedText = line ? `${line.title ?? ''}\n${line.body}` : '';
	const { shown, done, finish } = useTyped(typedText);
	const shownTitle = line?.title ? shown.split('\n')[0] : '';
	const shownBody = shown.includes('\n') ? shown.slice(shown.indexOf('\n') + 1) : '';

	// 배경 장면: 주제를 읽는 중이면 지금 장까지 중 마지막 그림, 아니면 대표 그림
	const fallbackScene = project.art ?? project.image;
	const scene =
		mode.kind === 'topic' && current
			? (current.lines
					.slice(0, mode.at + 1)
					.reverse()
					.find((l) => l.image)?.image ?? fallbackScene)
			: fallbackScene;

	/** '다음': 찍히는 중이면 바로 다 보이고, 다 보였으면 다음 장으로 */
	const next = useCallback(() => {
		if (!done) {
			finish();
			return;
		}
		if (mode.kind === 'greet' || mode.kind === 'ending') setMode({ kind: 'menu' });
		else if (mode.kind === 'topic' && current) {
			if (mode.at + 1 < current.lines.length) setMode({ kind: 'topic', id: mode.id, at: mode.at + 1 });
			else {
				const nowRead = new Set(read).add(mode.id);
				setRead(nowRead);
				const finished = countable.every((t) => nowRead.has(t.id));
				// 마지막 주제를 다 읽은 순간에만 엔딩. 이미 엔딩을 본 뒤 다시 읽으면 바로 선택지
				setMode(finished && !allRead ? { kind: 'ending' } : { kind: 'menu' });
			}
		}
	}, [done, finish, mode, current, read, countable, allRead]);

	const choose = useCallback((topic: Topic) => setMode({ kind: 'topic', id: topic.id, at: 0 }), []);

	// 키보드: Space·Enter는 다음, 숫자는 선택지. 글 상자 안에서는 안 받는다
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
			if (target && target !== document.body && !root.contains(target)) return;
			if (event.key === ' ' || event.key === 'Enter') {
				if (mode.kind === 'menu') return;
				event.preventDefault();
				next();
			} else if (mode.kind === 'menu' && /^[1-9]$/.test(event.key)) {
				const topic = topics[Number(event.key) - 1];
				if (topic) {
					event.preventDefault();
					choose(topic);
				}
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [mode, next, choose, topics]);

	// 마우스: 배경이 마우스 반대쪽으로 살짝 밀린다 (줄이기면 가만히)
	const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
		const root = rootRef.current;
		if (!root || prefersReducedMotion()) return;
		const box = root.getBoundingClientRect();
		root.style.setProperty('--dl-mx', String((event.clientX - box.left) / box.width - 0.5));
		root.style.setProperty('--dl-my', String((event.clientY - box.top) / box.height - 0.5));
	};

	const inMenu = mode.kind === 'menu';
	const progress = mode.kind === 'topic' && current ? `${mode.at + 1} / ${current.lines.length}` : '';

	return (
		<div className="dl" data-id={project.id} ref={rootRef} onMouseMove={onMove}>
			{/* 배경: 장면 그림이 흐릿하게 천천히 움직인다 */}
			<div className="dl-bg" aria-hidden="true">
				{scene && <img key={scene} className="dl-scene" src={scene} alt="" />}
				<div className="dl-vignette" />
			</div>

			{/* HUD: 숫자(HP·골드처럼)와 짧은 정보 */}
			<header className="dl-hud">
				{project.facts.length > 0 && (
					<ul className="dl-stats" aria-label="숫자">
						{project.facts.map((fact, i) => (
							<li key={fact.label} title={fact.label}>
								<i className={`fa-solid ${HUD_ICONS[i % HUD_ICONS.length]}`} aria-hidden="true" />
								<strong>{fact.value}</strong>
								<span className="visually-hidden">{fact.label}</span>
							</li>
						))}
					</ul>
				)}
				<p className="dl-quest">
					{[project.period, project.language].filter(Boolean).join(' · ')}
					{countable.length > 0 && (
						<span className="dl-progress">
							{' '}
							읽은 주제 {countable.filter((t) => read.has(t.id)).length}/{countable.length}
						</span>
					)}
				</p>
			</header>

			{/* 대화 상자 */}
			<section
				className="dl-box"
				role="dialog"
				aria-label="대화"
				aria-live="polite"
				onClick={inMenu ? undefined : next}
			>
				<Portrait project={project} />
				<div className="dl-name">{project.name}</div>

				{inMenu ? (
					<div className="dl-menu">
						<p className="dl-ask">무엇을 들어 볼까요?</p>
						<ol className="dl-choices">
							{topics.map((topic, i) => {
								const isRead = read.has(topic.id);
								return (
									<li key={topic.id}>
										<button
											type="button"
											aria-pressed={topic.id === LINKS_TOPIC ? undefined : isRead}
											onClick={() => choose(topic)}
										>
											<kbd>{i + 1}</kbd>
											<span>{topic.label}</span>
											{isRead && <em aria-label="읽음">✓</em>}
										</button>
									</li>
								);
							})}
						</ol>
					</div>
				) : (
					<div className="dl-text">
						{line?.title && <strong className="dl-title">{shownTitle}</strong>}
						<p className="dl-body">
							{shownBody}
							{!done && <span className="dl-caret" aria-hidden="true" />}
						</p>
						{done && (mode.kind === 'ending' || (mode.kind === 'topic' && mode.id === LINKS_TOPIC)) && (
							<div onClick={(e) => e.stopPropagation()}>
								<Links project={project} className="sp-links dl-links" />
							</div>
						)}
						<div className="dl-foot">
							<span className="dl-count">{progress}</span>
							<button
								type="button"
								className="dl-next"
								onClick={(e) => {
									e.stopPropagation();
									next();
								}}
							>
								다음 <i aria-hidden="true">▸</i>
							</button>
						</div>
					</div>
				)}
			</section>
			<p className="dl-hint" aria-hidden="true">
				Space·Enter 다음 · 숫자 키로 고르기
			</p>
		</div>
	);
};

export default DialoguePage;
