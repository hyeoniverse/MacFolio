// QRU (디지털 명함): 그 앱의 민트→분홍 바탕과 두툼한 그림자를 그대로 쓴다.
// 명함 앞뒤(앞면은 앱 첫 화면의 기울어진 로고 카드, 뒷면은 기술 사양) → 숫자 한 줄 → 명함이 오가는 순서(단계와 앱 화면) →
// 더 들려줄 장(데이터, 번호 직접 넣어 보기) → 묻고 답하기(만든 방식) → 화면 모음 → 맡은 일과 다음 단계.
// 순서와 묻고 답하기는 스크롤에 맞춰 위에서부터 차례로 펼쳐지고, 다시 올리면 아래부터 접힌다
import React, { useEffect, useRef, useState } from 'react';
import type { Project, ProjectChapter, ProjectPoint } from '@/shared/profile';
import { FactValue, Facts, Links, Shot } from '@/apps/safari/project/parts';
import '@/apps/safari/project/CardPage.css';
import { scrollParent } from '@/apps/safari/project/scroll';
import { prefersReducedMotion, useReveal } from '@/apps/safari/project/reveal';

/** 한 칸씩 펼치거나 접는 사이 간격 (ms). 빠르게 스크롤해도 한꺼번에가 아니라 차례로 */
const STEP = 220;
/** 칸의 머리가 화면 위에서 이 비율만큼 내려온 선을 지나면 펼친다 (읽는 눈높이쯤) */
const LINE = 0.6;

/** 앱 로고: 3×3 칸 가운데 청록으로 채운 다섯 칸 (앱의 LogoCard와 같은 자리) */
const LOGO_FILLED = [false, true, true, false, true, true, false, false, true];

/** 그 앱의 일련번호 글자: 헷갈리는 I, L, O, U를 뺀 32자 (Crockford Base32) */
const SERIAL_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SERIAL_LENGTH = 10;
const groupSerial = (chars: string) => `${chars.slice(0, 5)}-${chars.slice(5)}`;
const randomSerial = () => {
	const bytes = crypto.getRandomValues(new Uint8Array(SERIAL_LENGTH));
	return groupSerial(Array.from(bytes, (byte) => SERIAL_ALPHABET[byte % SERIAL_ALPHABET.length]).join(''));
};
/** 사람이 옮겨 적은 번호를 저장된 꼴로 (앱의 normalizeSerial과 같다). 10자리가 아니면 빈 문자열 */
const normalizeSerial = (value: string) => {
	const cleaned = value
		.toUpperCase()
		.replace(/O/g, '0')
		.replace(/[IL]/g, '1')
		.replace(/[^0-9A-Z]/g, '');
	return cleaned.length === SERIAL_LENGTH ? groupSerial(cleaned) : '';
};
/** 그 앱 README의 예시 명함 번호 */
const SAMPLE_SERIAL = '7K3FM-9P2XR';

/**
 * 스크롤에 맞춰 위 칸부터 차례로 펼치고, 다시 올리면 아래 칸부터 차례로 접는다.
 * 칸의 머리(`[data-index]`)가 기준선 위로 올라온 만큼이 목표이고, 지금 펼친 수를 한 칸씩 그 목표로 옮긴다.
 * 펼친 수를 돌려준다
 */
function useScrollUnfold(list: React.RefObject<HTMLElement | null>, count: number) {
	const supported = typeof window !== 'undefined' && 'requestAnimationFrame' in window;
	const [target, setTarget] = useState(supported ? 0 : count);
	const [opened, setOpened] = useState(supported ? 0 : count);

	useEffect(() => {
		const root = list.current;
		if (!root || !supported) return;
		const scroller = scrollParent(root);
		const source = scroller ?? window;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const view = scroller?.getBoundingClientRect();
			const line = view ? view.top + view.height * LINE : window.innerHeight * LINE;
			const heads = root.querySelectorAll<HTMLElement>('[data-index]');
			let reached = 0;
			for (const head of heads) {
				if (head.getBoundingClientRect().top > line) break;
				reached += 1;
			}
			setTarget(reached);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		source.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			source.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
			cancelAnimationFrame(frame);
		};
	}, [list, supported]);

	useEffect(() => {
		if (opened === target) return;
		const timer = window.setTimeout(() => setOpened((now) => now + Math.sign(target - now)), STEP);
		return () => window.clearTimeout(timer);
	}, [opened, target]);

	return opened;
}

/** 묻고 답하기: 스크롤에 맞춰 펼치고 접는다. 누르면 그 칸만 직접 접고 펼 수 있다(그 칸을 스크롤이 다시 지나면 스크롤을 따른다) */
const Answers: React.FC<{ points: ProjectPoint[] }> = ({ points }) => {
	const list = useRef<HTMLDivElement>(null);
	const opened = useScrollUnfold(list, points.length);
	const [toggled, setToggled] = useState<Record<number, boolean>>({});
	const [lastOpened, setLastOpened] = useState(opened);
	// 스크롤이 지나간 칸은 누른 뜻을 잊는다
	if (lastOpened !== opened) {
		setLastOpened(opened);
		const [from, to] = [Math.min(lastOpened, opened), Math.max(lastOpened, opened)];
		setToggled((prev) => Object.fromEntries(Object.entries(prev).filter(([i]) => Number(i) < from || Number(i) >= to)));
	}

	return (
		<div ref={list}>
			{points.map((point, i) => {
				const open = toggled[i] ?? i < opened;
				return (
					<div key={point.title} className="qc-answer" data-index={i} data-open={open}>
						<button type="button" aria-expanded={open} onClick={() => setToggled((prev) => ({ ...prev, [i]: !open }))}>
							{point.title}
						</button>
						<div className="qc-answer-body">
							<p>{point.body}</p>
						</div>
					</div>
				);
			})}
		</div>
	);
};

/**
 * 명함 한 장이 오가는 순서: 단계마다 번호와 제목은 늘 보이고, 스크롤에 맞춰 설명이 차례로 펼쳐지며 다음 단계로 선이 이어진다.
 * 옆의 앱 창은 마지막으로 펼친 단계의 화면으로 바뀐다
 */
const Journey: React.FC<{ project: Project }> = ({ project }) => {
	const points = project.highlights;
	const list = useRef<HTMLOListElement>(null);
	const opened = useScrollUnfold(list, points.length);
	const current = Math.max(0, Math.min(opened, points.length) - 1);
	const screens = points.filter((point) => point.image);

	return (
		<div className="qc-journey-body">
			<ol className="qc-steps" ref={list}>
				{points.map((point, i) => (
					<li key={point.title} data-index={i} data-open={i < opened}>
						<span className="qc-step">{i + 1}</span>
						<h3>{point.title}</h3>
						<div className="qc-step-body">
							<p>{point.body}</p>
						</div>
					</li>
				))}
			</ol>
			{screens.length ? (
				<figure className="qc-screen">
					<div className="qc-screen-bar" aria-hidden="true">
						<i />
						<i />
						<i />
						<span>{project.demo?.replace(/^https?:\/\//, '')}</span>
					</div>
					<div className="qc-screen-view">
						{points.map(
							(point, i) =>
								point.image && (
									<img
										key={point.title}
										src={point.image}
										alt={`${project.name}: ${point.title}`}
										data-on={i === current}
										loading={i === 0 ? undefined : 'lazy'}
									/>
								)
						)}
					</div>
					<figcaption key={current}>{points[current].title}</figcaption>
				</figure>
			) : (
				<Shot project={project} className="qc-shot" />
			)}
		</div>
	);
};

/**
 * 명함을 손에 든 것처럼: 마우스를 올리면 그쪽으로 기울고, 빛이 마우스를 따라 비친다. 마우스를 떼면 제자리로 돌아온다
 */
const tilt = {
	onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
		if (event.pointerType !== 'mouse') return;
		const card = event.currentTarget;
		const box = card.getBoundingClientRect();
		const x = (event.clientX - box.left) / box.width;
		const y = (event.clientY - box.top) / box.height;
		card.style.setProperty('--rx', `${((0.5 - y) * 12).toFixed(2)}deg`);
		card.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
		card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
		card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
		card.dataset.tilt = '';
	},
	onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
		const card = event.currentTarget;
		card.style.removeProperty('--rx');
		card.style.removeProperty('--ry');
		delete card.dataset.tilt;
	},
};

/** 일련번호: 누르면 새 번호를 뽑는다. 글자가 잠깐 굴러가다 멈추는 슬롯처럼 */
const Serial: React.FC = () => {
	const [serial, setSerial] = useState(SAMPLE_SERIAL);
	const [rolling, setRolling] = useState(false);
	const timer = useRef(0);
	useEffect(() => () => window.clearInterval(timer.current), []);

	const roll = () => {
		const next = randomSerial();
		if (prefersReducedMotion()) {
			setSerial(next);
			return;
		}
		window.clearInterval(timer.current);
		setRolling(true);
		let tick = 0;
		// 앞 글자부터 하나씩 자리를 잡는다
		timer.current = window.setInterval(() => {
			tick += 1;
			const fixed = Math.floor(tick / 2);
			const chars = next
				.replace('-', '')
				.split('')
				.map((char, i) => (i < fixed ? char : SERIAL_ALPHABET[Math.floor(Math.random() * SERIAL_ALPHABET.length)]));
			setSerial(groupSerial(chars.join('')));
			if (fixed >= SERIAL_LENGTH) {
				window.clearInterval(timer.current);
				setRolling(false);
			}
		}, 34);
	};

	return (
		<p className="qc-serial">
			<span>일련번호</span>
			<code data-rolling={rolling || undefined}>{serial}</code>
			<button type="button" onClick={roll} aria-label="새 일련번호 뽑기">
				<i className="fa-solid fa-shuffle" aria-hidden="true" />
			</button>
		</p>
	);
};

/** 옮겨 적은 번호를 넣어 보면, 앱처럼 소문자·붙임표·헷갈리는 글자를 고쳐 같은 번호로 찾는다 */
const SerialTry: React.FC = () => {
	const [typed, setTyped] = useState('7k3fm 9p2xr');
	const found = normalizeSerial(typed);
	return (
		<div className="qc-try" data-reveal="">
			<label htmlFor="qc-try-input">번호를 옮겨 적듯 넣어 보세요</label>
			<div className="qc-try-row">
				<input
					id="qc-try-input"
					value={typed}
					onChange={(event) => setTyped(event.target.value)}
					spellCheck={false}
					autoComplete="off"
				/>
				<i className="fa-solid fa-arrow-right" aria-hidden="true" />
				<output htmlFor="qc-try-input" data-found={Boolean(found)} aria-live="polite">
					{found || '10자리가 되면 찾아요'}
				</output>
			</div>
		</div>
	);
};

/** 더 들려줄 장: 첫머리, 숫자 칩, 두툼한 타일, 그림 */
const Chapter: React.FC<{ chapter: ProjectChapter; first: boolean }> = ({ chapter, first }) => (
	<section className="qc-chapter" aria-label={chapter.title}>
		<h2 className="qc-title">{chapter.title}</h2>
		{chapter.lead && (
			<p className="qc-chapter-lead" data-reveal="">
				{chapter.lead}
			</p>
		)}
		{chapter.facts && (
			<ul className="qc-chips">
				{chapter.facts.map((fact, i) => (
					<li key={fact.label} data-reveal="" style={{ '--d': i } as React.CSSProperties}>
						<FactValue text={fact.value} />
						<span>{fact.label}</span>
					</li>
				))}
			</ul>
		)}
		{first && <SerialTry />}
		<div className="qc-tiles">
			{chapter.points.map((point, i) => (
				<article key={point.title} data-reveal="" style={{ '--d': i % 2 } as React.CSSProperties}>
					<h3>{point.title}</h3>
					<p>{point.body}</p>
				</article>
			))}
		</div>
		{chapter.image && (
			<figure className="qc-figure" data-reveal="">
				<img src={chapter.image.src} alt={chapter.image.alt} loading="lazy" />
			</figure>
		)}
	</section>
);

/** 화면 모음: 옆으로 넘겨 보는 띠. 지금 가운데 온 장이 커진다 */
const Gallery: React.FC<{ shots: NonNullable<Project['gallery']> }> = ({ shots }) => (
	<section className="qc-gallery" aria-label="화면 모음">
		<h2 className="qc-title">화면 모음</h2>
		<ul>
			{shots.map((shot, i) => (
				<li key={shot.src} data-reveal="" style={{ '--d': i } as React.CSSProperties}>
					<figure>
						<img src={shot.src} alt={shot.caption} loading="lazy" />
						<figcaption>{shot.caption}</figcaption>
					</figure>
				</li>
			))}
		</ul>
	</section>
);

const CardPage: React.FC<{ project: Project }> = ({ project }) => {
	const root = useReveal<HTMLDivElement>();
	return (
		<div className="qc" ref={root}>
			<header className="qc-hero">
				<div className="qc-cards">
					<div className="qc-card qc-front" {...tilt}>
						<div className="qc-brand">
							<span className="qc-logo" aria-hidden="true">
								{LOGO_FILLED.map((filled, i) => (
									<i key={i} data-filled={filled || undefined} style={{ '--i': i } as React.CSSProperties} />
								))}
							</span>
							<p className="qc-word">
								<strong>QRU</strong>
								<span>Your Digital Identity</span>
							</p>
						</div>
						<p className="qc-name">{project.name}</p>
						<h1>{project.tagline}</h1>
						<p className="qc-lead">{project.description}</p>
						<Serial />
					</div>
					<section className="qc-card qc-back" aria-label="기술 사양" {...tilt}>
						<h2>기술 사양</h2>
						<dl>
							{project.specs.map((spec) => (
								<div key={spec.label}>
									<dt>{spec.label}</dt>
									<dd>{spec.value}</dd>
								</div>
							))}
						</dl>
					</section>
				</div>
				<Links project={project} className="qc-links" />
			</header>

			<section className="qc-facts" aria-label="한눈에 보기" data-reveal="">
				<p>{project.context}</p>
				<Facts project={project} />
			</section>

			<section className="qc-journey" aria-label="주요 기능">
				<h2 className="qc-title">명함 한 장이 오가는 순서</h2>
				<Journey project={project} />
			</section>

			{project.chapters?.map((chapter, i) => (
				<Chapter key={chapter.title} chapter={chapter} first={i === 0} />
			))}

			<section className="qc-faq" aria-label="만든 방식">
				<h2 className="qc-title">어떻게 만들었나요?</h2>
				<Answers points={project.build} />
			</section>

			{project.gallery && <Gallery shots={project.gallery} />}

			<div className="qc-lists">
				<section aria-label="맡은 일" data-reveal="left">
					<h2 className="qc-title">맡은 일</h2>
					{project.role && <p className="qc-role">{project.role}</p>}
					<ul>
						{project.contributions.map((item) => (
							<li key={item}>
								<i className="fa-solid fa-circle-check" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				</section>
				{project.next && (
					<section aria-label="다음 단계" data-reveal="left" style={{ '--d': 2 } as React.CSSProperties}>
						<h2 className="qc-title">다음 단계</h2>
						<ul className="next">
							{project.next.map((item) => (
								<li key={item}>
									<i className="fa-regular fa-circle" aria-hidden="true" />
									{item}
								</li>
							))}
						</ul>
					</section>
				)}
			</div>

			<footer className="qc-foot" data-reveal="">
				<span className="qc-logo small" aria-hidden="true">
					{LOGO_FILLED.map((filled, i) => (
						<i key={i} data-filled={filled || undefined} style={{ '--i': i } as React.CSSProperties} />
					))}
				</span>
				<p>{project.tagline}</p>
				<Links project={project} className="qc-links" />
			</footer>
		</div>
	);
};

export default CardPage;
