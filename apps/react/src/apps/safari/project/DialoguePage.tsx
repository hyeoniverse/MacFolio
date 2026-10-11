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

/** 화자: sproutfarm은 크게 서서 제자리걸음하는 캐릭터 스프라이트, 다른 프로젝트는 큰 둥근 아이콘 타일 */
const Speaker: React.FC<{ project: Project; talking: boolean }> = ({ project, talking }) => (
	<div className="dl-speaker" data-talking={talking || undefined} aria-hidden="true">
		{project.id === 'sproutfarm' ? (
			<i className="dl-sprite" />
		) : (
			<span className="dl-tile">
				<Favicon project={project} className="dl-favicon" />
			</span>
		)}
	</div>
);

/** HUD의 facts 아이콘: HP·골드처럼 */
const HUD_ICONS = ['fa-heart', 'fa-coins', 'fa-star', 'fa-bolt', 'fa-gem', 'fa-flag'];

const DialoguePage: React.FC<{ project: Project }> = ({ project }) => {
	const topics = useMemo(() => buildTopics(project), [project]);
	const [mode, setMode] = useState<Mode>({ kind: 'greet' });
	const [read, setRead] = useState<Set<string>>(() => new Set());
	// 선택지 메뉴의 ▶ 커서 (마우스를 올리거나 ↑·↓로 옮긴다)
	const [cursor, setCursor] = useState(0);
	const rootRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLOListElement>(null);

	const countable = topics.filter((t) => t.id !== LINKS_TOPIC);
	const allRead = countable.every((t) => read.has(t.id));
	const readCount = countable.filter((t) => read.has(t.id)).length;
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

	// 무대: 인사에서는 대표 화면, 주제를 읽는 중이면 지금 장까지 중 마지막 그림을 선명하게 액자에. 없으면 비운다
	const backdrop = project.art ?? project.image;
	const shot =
		mode.kind === 'greet'
			? line?.image
			: mode.kind === 'topic' && current
				? current.lines
						.slice(0, mode.at + 1)
						.reverse()
						.find((l) => l.image)?.image
				: undefined;

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

	/** 커서를 옮기고, 키보드로 옮겼으면 그 단추에 포커스 (메뉴가 길면 상자 안에서 굴러 보인다) */
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
	const meta = [project.period, project.language].filter(Boolean).join(' · ');
	// 장면 열쇠: 바뀔 때마다 무대가 새로 페이드·슬라이드로 들어온다
	const sceneKey = shot ?? `none-${mode.kind}`;

	return (
		<div className="dl" data-id={project.id} data-mode={mode.kind} ref={rootRef}>
			{/* 바탕: 단색 그라데이션과 패턴, 그 위에 대표 화면을 은은하게 */}
			<div className="dl-bg" aria-hidden="true">
				{backdrop && <img className="dl-backdrop" src={backdrop} alt="" data-dim={shot ? '' : undefined} />}
			</div>

			{/* HUD: 맨 위 한 줄 — 왼쪽 숫자, 오른쪽 읽은 주제와 기간·언어 */}
			<header className="dl-hud">
				{project.facts.length > 0 && (
					<ul className="dl-stats" aria-label="숫자">
						{project.facts.map((fact, i) => (
							<li key={fact.label} title={fact.label}>
								<i className={`fa-solid ${HUD_ICONS[i % HUD_ICONS.length]}`} aria-hidden="true" />
								<strong>{fact.value}</strong>
								<span className="dl-stat-label">{fact.label}</span>
							</li>
						))}
					</ul>
				)}
				<div className="dl-quest">
					{countable.length > 0 && (
						<span className="dl-progress">
							<span>
								읽은 주제 {readCount}/{countable.length}
							</span>
							<span className="dl-meter" aria-hidden="true">
								<span style={{ width: `${(readCount / countable.length) * 100}%` }} />
							</span>
						</span>
					)}
					{meta && <span className="dl-meta">{meta}</span>}
				</div>
			</header>

			{/* 무대: 지금 이야기하는 화면 */}
			<div className="dl-stage" aria-hidden="true">
				<div className="dl-scene" key={sceneKey}>
					{shot && (
						<figure className="dl-shot">
							<span className="dl-shot-bar">
								<i />
								<i />
								<i />
							</span>
							<img src={shot} alt="" />
						</figure>
					)}
				</div>
			</div>

			{/* 대화: 화자, 이름표, 선택지 메뉴, 대화 상자 */}
			<section className="dl-floor" role="dialog" aria-label="대화" aria-live="polite">
				<Speaker project={project} talking={!done && !inMenu} />
				<div className="dl-name">{project.name}</div>

				{inMenu && (
					<div className="dl-menu">
						<ol className="dl-choices" ref={menuRef}>
							{topics.map((topic, i) => {
								const isRead = read.has(topic.id);
								return (
									<li key={topic.id}>
										<button
											type="button"
											data-active={i === cursor || undefined}
											aria-pressed={topic.id === LINKS_TOPIC ? undefined : isRead}
											onClick={() => choose(topic)}
											onMouseEnter={() => setCursor(i)}
											onFocus={() => setCursor(i)}
										>
											<span className="dl-cursor" aria-hidden="true">
												▶
											</span>
											<span className="dl-label">{topic.label}</span>
											{isRead && <em aria-label="읽음">✓</em>}
											<kbd>{i + 1}</kbd>
										</button>
									</li>
								);
							})}
						</ol>
					</div>
				)}

				<div className="dl-box" onClick={inMenu ? undefined : next}>
					{inMenu ? (
						<div className="dl-text">
							<strong className="dl-title">무엇을 들어 볼까요?</strong>
							<p className="dl-body dl-body-menu">듣고 싶은 이야기를 목록에서 고르세요.</p>
							<div className="dl-foot">
								<span className="dl-hint">↑·↓ 키로 고르고 Enter를 누릅니다. 숫자 키로도 고를 수 있습니다.</span>
							</div>
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
								<span className="dl-hint">Space 또는 Enter를 누르면 다음으로 넘어갑니다.</span>
								<span className="dl-count">{progress}</span>
								<button
									type="button"
									className="dl-next"
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
					)}
				</div>
			</section>
		</div>
	);
};

export default DialoguePage;
