// MacFolio: Apple 제품 페이지 흐름 그대로.
// 스크롤하면 커지는 노트북 → 숫자 띠 → 기능 타일 → 화면 크기를 바꿔 보는 시뮬레이터 → 어두운 만든 방식(구조 그림) → 맡은 일 → 기술 사양 표
// 첫 화면 밖의 요소는 화면에 들어오면 나타나고 벗어나면 사라진다(data-reveal). 제목은 스크롤에 맞춰 낱말마다 밝아진다
import React, { useEffect, useId, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Facts, Favicon, Links } from '@/apps/safari/project/parts';
import { onScrollFrame, scrollParent, viewOf } from '@/apps/safari/project/scroll';
import { prefersReducedMotion as reducedMotion, useReveal } from '@/apps/safari/project/reveal';
import './ProductPage.css';

const VIEWS_DIR = '/imgs/projects/macfolio/views';

/** 시뮬레이터에서 고를 앱 */
const APPS = [
	{ id: 'memo', name: '메모', note: '블로그' },
	{ id: 'messages', name: '메시지', note: '방명록' },
	{ id: 'safari', name: 'Safari', note: '프로젝트' },
] as const;

type AppId = (typeof APPS)[number]['id'];

/**
 * 시뮬레이터가 차례로 보여 주는 화면 크기. 그림은 그 크기의 실제 브라우저로 찍었다 (views/{앱}-{크기}.jpg).
 * share는 무대 폭에서 기기가 차지하는 비율, ratio는 화면의 세로/가로
 */
const SIZES = [
	{
		id: 'monitor',
		name: '모니터',
		px: 1920,
		share: 0.86,
		ratio: 1080 / 1920,
		note: '넓은 화면에서는 창을 여러 개 띄워 두고 Dock에서 앱을 엽니다. 창은 끌어서 옮기고 모서리를 잡아 크기를 바꿉니다.',
	},
	{
		id: 'laptop',
		name: '노트북',
		px: 1440,
		share: 0.72,
		ratio: 900 / 1440,
		note: '같은 데스크톱입니다. 메뉴 막대와 Dock은 그대로이고, 창은 화면 안에 들어오는 크기로 열립니다.',
	},
	{
		id: 'tablet',
		name: '태블릿',
		px: 820,
		share: 0.34,
		ratio: 1180 / 820,
		note: '768px부터는 아직 데스크톱입니다. 화면이 좁으면 창이 화면 폭에 맞춰 열려 잘리지 않습니다.',
	},
	{
		id: 'phone',
		name: '휴대폰',
		px: 390,
		share: 0.21,
		ratio: 844 / 390,
		note: '767px 이하에서는 iOS 홈 화면이 되고, 앱은 화면을 가득 채웁니다. 가로로 눕혀 높이가 499px 이하인 휴대폰도 같습니다.',
	},
] as const;

/** 시뮬레이터가 다음 크기로 넘어가는 간격 */
const SIM_STEP_MS = 3800;

/** 주요 기능 타일의 아이콘 (순서대로) */
const TILE_ICONS = ['fa-solid fa-display', 'fa-solid fa-note-sticky', 'fa-solid fa-comments', 'fa-solid fa-link'];

/** 구조 그림의 상자. step은 스크롤에 따라 켜지는 순서 */
const NODES = [
	{ id: 'browser', label: '브라우저', x: 90, y: 190, w: 130, step: 0 },
	{ id: 'workers', label: 'Cloudflare Workers', x: 330, y: 80, w: 170, step: 2 },
	{ id: 'tunnel', label: 'Cloudflare Tunnel', x: 330, y: 240, w: 150, step: 4 },
	{ id: 'api', label: 'NestJS · Oracle VM', x: 570, y: 240, w: 160, step: 6 },
	{ id: 'db', label: 'PostgreSQL', x: 570, y: 336, w: 130, step: 7 },
	{ id: 'github', label: 'GitHub OAuth·API', x: 770, y: 240, w: 150, step: 7 },
	{ id: 'actions', label: 'GitHub Actions', x: 640, y: 80, w: 150, step: 8 },
] as const;

/** 구조 그림의 선. 앞 상자가 켜진 다음 그려진다 */
const EDGES = [
	{ d: 'M155 180 C 205 180 200 80 245 80', label: '화면', lx: 178, ly: 118, step: 1 },
	{ d: 'M155 200 C 205 200 205 240 255 240', label: 'API · 세션 쿠키', lx: 205, ly: 270, step: 3 },
	{ d: 'M405 240 L 490 240', label: '포트 없이', lx: 447, ly: 230, step: 5 },
	{ d: 'M570 262 L 570 314', label: 'Prisma', lx: 590, ly: 293, step: 6.5 },
	{ d: 'M650 240 L 695 240', label: '캐시', lx: 672, ly: 230, step: 6.5 },
	{ d: 'M565 80 L 415 80', label: '시험을 통과한 커밋만 배포', lx: 490, ly: 66, step: 9 },
] as const;

/** 모든 단계가 다 켜지는 데 필요한 칸 수 */
const ARCH_STEPS = 10;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * 스크롤 진행도를 요소의 --p(0~1)로 넣는다. 다시 그리지 않고 스타일만 바꾼다.
 * --view에는 스크롤 상자의 높이를 px로 넣는다 (멈춰 있는 첫 화면의 높이)
 */
function useScrollProgress<T extends HTMLElement>(
	measure: (box: DOMRect, view: { top: number; height: number }) => number
) {
	const ref = useRef<T>(null);
	const measureRef = useRef(measure);
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			node.style.setProperty('--view', `${view.height}px`);
			node.style.setProperty('--p', clamp(measureRef.current(node.getBoundingClientRect(), view)).toFixed(4));
		});
	}, []);
	return ref;
}

/** 섹션 제목: 스크롤에 맞춰 낱말이 하나씩 밝아지고, 올리면 다시 흐려진다 */
const Headline: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => {
	const ref = useScrollProgress<HTMLHeadingElement>(
		(box, view) => (view.top + view.height * 0.92 - box.top) / (view.height * 0.4)
	);
	const words = [
		...title.split(' ').map((word) => ({ word, sub: false })),
		...(sub ?? '')
			.split(' ')
			.filter(Boolean)
			.map((word) => ({ word, sub: true })),
	];
	return (
		<h2 className="sp-headline pd-scrub" ref={ref} style={{ '--n': words.length } as React.CSSProperties}>
			{words.map(({ word, sub: muted }, i) => (
				<React.Fragment key={i}>
					{i > 0 && ' '}
					<span className={muted ? 'pd-word sub' : 'pd-word'} style={{ '--i': i } as React.CSSProperties}>
						{word}
					</span>
				</React.Fragment>
			))}
		</h2>
	);
};

/** 화면 한 장을 담는 노트북 */
const Laptop: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
	<div className={`pd-laptop${className ? ` ${className}` : ''}`}>
		<div className="pd-screen">{children}</div>
		<div className="pd-base" aria-hidden="true" />
	</div>
);

/** 첫 화면: 제목 아래 작게 보이던 노트북이 스크롤하면 화면을 채운다 */
const Hero: React.FC<{ project: Project }> = ({ project }) => {
	const ref = useScrollProgress<HTMLElement>((box, view) => (view.top - box.top) / (box.height - view.height));
	return (
		<section className="sp-hero pd-hero" ref={ref}>
			<div className="pd-stage">
				<div className="pd-copy">
					<Favicon project={project} className="sp-app-icon" />
					<p className="sp-eyebrow">{project.name}</p>
					<h1>{project.tagline}</h1>
					<p className="sp-lead">{project.description}</p>
					<Links project={project} />
				</div>
				<Laptop className="pd-hero-device">
					<img src={`${VIEWS_DIR}/memo-laptop.jpg`} alt={`${project.name} 화면`} />
				</Laptop>
				<p className="pd-caption" aria-hidden="true">
					브라우저 안에, <strong>Mac 하나.</strong>
				</p>
			</div>
		</section>
	);
};

/** 숫자가 목표값까지 굴러간다 (창 크기를 끌어 바꾸는 것처럼) */
function useRollingNumber(target: number, duration = 700) {
	const [value, setValue] = useState(target);
	const from = useRef(target);
	useEffect(() => {
		if (reducedMotion()) {
			from.current = target;
			setValue(target);
			return;
		}
		const start = performance.now();
		const begin = from.current;
		let frame = requestAnimationFrame(function tick(now) {
			const t = Math.min(1, (now - start) / duration);
			const eased = 1 - (1 - t) ** 3;
			const next = Math.round(begin + (target - begin) * eased);
			from.current = next;
			setValue(next);
			if (t < 1) frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	}, [target, duration]);
	return value;
}

/**
 * 어디서 열어도: 브라우저 크기를 바꿔 보는 시뮬레이터.
 * 화면에 보이는 동안 모니터 → 노트북 → 태블릿 → 휴대폰을 영상처럼 차례로 돌고, 기기 틀이 모양을 바꾸며 그 크기에서 찍은 화면이 나타난다
 */
const Simulator: React.FC = () => {
	const [app, setApp] = useState<AppId>('memo');
	const [index, setIndex] = useState(0);
	const [playing, setPlaying] = useState(() => !reducedMotion());
	const [visible, setVisible] = useState(false);
	const stage = useRef<HTMLDivElement>(null);
	const size = SIZES[index];
	const appInfo = APPS.find((item) => item.id === app) ?? APPS[0];
	const px = useRollingNumber(size.px);

	// 화면에 보일 때만 돈다
	useEffect(() => {
		const node = stage.current;
		if (!node) return;
		const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
			root: scrollParent(node),
			threshold: 0.4,
		});
		observer.observe(node);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!playing || !visible) return;
		const timer = window.setTimeout(() => setIndex((i) => (i + 1) % SIZES.length), SIM_STEP_MS);
		return () => window.clearTimeout(timer);
	}, [playing, visible, index]);

	const running = playing && visible;
	return (
		<section className="sp-section pd-devices" aria-label="어디서 열어도">
			<div className="sp-inner">
				<Headline title="어디서 열어도." sub="화면 크기에 따라 데스크톱이 되고, 휴대폰이 됩니다." />
				<div className="pd-sim-bar" data-reveal="">
					<div className="pd-switch" role="group" aria-label="보여 줄 앱">
						{APPS.map((item) => (
							<button key={item.id} type="button" aria-pressed={item.id === app} onClick={() => setApp(item.id)}>
								{item.name}
								<span>{item.note}</span>
							</button>
						))}
					</div>
					<button
						type="button"
						className="pd-sim-play"
						aria-label={playing ? '일시 정지' : '재생'}
						onClick={() => setPlaying((value) => !value)}
					>
						<i className={playing ? 'fa-solid fa-pause' : 'fa-solid fa-play'} aria-hidden="true" />
					</button>
				</div>

				<div
					className="pd-sim"
					ref={stage}
					data-reveal=""
					data-kind={size.id}
					style={{ '--share': size.share, '--ratio': size.ratio } as React.CSSProperties}
				>
					<div className="pd-sim-device">
						<div className="pd-sim-screen">
							{SIZES.map((item) => (
								<img
									key={item.id}
									src={`${VIEWS_DIR}/${app}-${item.id}.jpg`}
									alt={item.id === size.id ? `${item.name}에서 연 ${appInfo.name}` : ''}
									aria-hidden={item.id === size.id ? undefined : true}
									className={item.id === size.id ? 'active' : undefined}
									loading="lazy"
								/>
							))}
						</div>
						<span className="pd-sim-stand" aria-hidden="true" />
						<span className="pd-sim-base" aria-hidden="true" />
					</div>
					<div className="pd-sim-ruler" aria-hidden="true">
						<span>{px.toLocaleString('en-US')}px</span>
					</div>
				</div>

				<ol className="pd-sim-steps" data-reveal="">
					{SIZES.map((item, i) => (
						<li key={item.id}>
							<button
								type="button"
								aria-current={i === index ? 'step' : undefined}
								onClick={() => setIndex(i)}
								// 진행 막대는 지금 칸에서만, 돌고 있을 때만 찬다
								data-running={i === index && running ? '' : undefined}
								style={{ '--step': `${SIM_STEP_MS}ms` } as React.CSSProperties}
							>
								<strong>{item.name}</strong>
								<span>{item.px}px</span>
							</button>
						</li>
					))}
				</ol>
				<p className="pd-sim-note" aria-live="polite" key={size.id}>
					<strong>
						{size.name} · {size.px}px
					</strong>{' '}
					{size.note}
				</p>
			</div>
		</section>
	);
};

/** 구조 그림이 그려지는 데 걸리는 시간 */
const ARCH_PLAY_MS = 2600;

/**
 * 구조 그림은 거의 다(85%) 화면에 들어온 다음에 처음부터 그려지고, 화면에서 거의 벗어나면 지워진다.
 * 스크롤 위치에 바로 묶으면 그림이 다 보이기 전에 지나가 버려서, 다 보일 때 시간에 맞춰 그린다
 */
function useArchPlayback() {
	const ref = useRef<HTMLElement>(null);
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		let frame = 0;
		let progress = 0;
		const set = (value: number) => {
			progress = value;
			node.style.setProperty('--p', value.toFixed(4));
		};
		const play = () => {
			cancelAnimationFrame(frame);
			if (reducedMotion()) return set(1);
			const start = performance.now() - progress * ARCH_PLAY_MS;
			frame = requestAnimationFrame(function tick(now) {
				set(clamp((now - start) / ARCH_PLAY_MS));
				if (progress < 1) frame = requestAnimationFrame(tick);
			});
		};
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.intersectionRatio >= 0.85) play();
				else if (entry.intersectionRatio < 0.15) {
					cancelAnimationFrame(frame);
					set(0);
				}
			},
			{ root: scrollParent(node), threshold: [0, 0.15, 0.85, 1] }
		);
		observer.observe(node);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, []);
	return ref;
}

/** 만든 방식: 요청이 지나는 길. 그림이 다 보이면 상자가 차례로 켜지고 선이 그려진다 */
const Architecture: React.FC = () => {
	const ref = useArchPlayback();
	const id = useId().replace(/:/g, '');
	const step = (n: number) => ({ '--i': n, '--n': ARCH_STEPS }) as React.CSSProperties;
	return (
		<figure className="pd-arch" ref={ref} data-reveal="">
			<div className="pd-arch-scroll">
				<svg viewBox="0 0 860 380" role="img" aria-labelledby={`${id}-title`}>
					<title id={`${id}-title`}>
						브라우저는 화면을 Cloudflare Workers에서 받고, API는 Cloudflare Tunnel을 지나 Oracle VM의 NestJS 서버로
						갑니다. 서버는 Prisma로 PostgreSQL을 쓰고 GitHub 응답을 캐시합니다. GitHub Actions는 시험을 통과한 커밋만
						Workers에 배포합니다.
					</title>
					{EDGES.map((edge, i) => (
						<g key={edge.label} className="pd-edge" style={step(edge.step)}>
							{/* 화살촉은 선마다 따로 둬야 그 선의 진행도를 따라 나타난다 */}
							<marker
								id={`${id}-arrow-${i}`}
								viewBox="0 0 10 10"
								refX="8"
								refY="5"
								markerWidth="7"
								markerHeight="7"
								orient="auto"
							>
								<path d="M0 0 L10 5 L0 10 z" />
							</marker>
							<path d={edge.d} pathLength={1} markerEnd={`url(#${id}-arrow-${i})`} />
							<text x={edge.lx} y={edge.ly}>
								{edge.label}
							</text>
						</g>
					))}
					{NODES.map((node) => (
						<g key={node.id} className={`pd-node pd-node-${node.id}`} style={step(node.step)}>
							<rect x={node.x - node.w / 2} y={node.y - 22} width={node.w} height={44} rx={12} />
							<text x={node.x} y={node.y + 5}>
								{node.label}
							</text>
						</g>
					))}
				</svg>
			</div>
			<figcaption>요청이 지나는 길. 바깥에 열린 서버 포트는 하나도 없습니다.</figcaption>
		</figure>
	);
};

const ProductPage: React.FC<{ project: Project }> = ({ project }) => {
	const ref = useReveal<HTMLDivElement>();
	return (
		<div className="pd" ref={ref}>
			<Hero project={project} />

			<section className="sp-band" aria-label="한눈에 보기">
				<div className="sp-inner pd-band" data-reveal="">
					<p className="sp-meta">
						{project.context}
						{project.period && ` · ${project.period}`}
					</p>
					<Facts project={project} />
				</div>
			</section>

			<section className="sp-section" aria-label="주요 기능">
				<div className="sp-inner">
					<Headline title="주요 기능." sub="지금 보고 있는 이 화면." />
					<ul className="sp-tiles pd-tiles">
						{project.highlights.map((point, i) => (
							<li
								key={point.title}
								// 개수가 홀수면 첫 타일을 넓게 해 빈칸을 없앤다
								className={i === 0 && project.highlights.length % 2 === 1 ? 'wide' : undefined}
								data-reveal=""
								data-tone={i % 4}
								style={{ '--d': i % 2 } as React.CSSProperties}
							>
								<span className="pd-tile-icon" aria-hidden="true">
									<i className={TILE_ICONS[i % TILE_ICONS.length]} />
								</span>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
								<i className={`pd-tile-mark ${TILE_ICONS[i % TILE_ICONS.length]}`} aria-hidden="true" />
							</li>
						))}
					</ul>
				</div>
			</section>

			<Simulator />

			<section className="sp-section sp-dark" aria-label="만든 방식">
				<div className="sp-inner">
					<Headline title="만든 방식." sub="보이지 않는 곳에서 신경 쓴 것들." />
					<Architecture />
					<ul className="sp-points">
						{project.build.map((point, i) => (
							<li key={point.title} data-reveal="" style={{ '--d': i % 2 } as React.CSSProperties}>
								<h3>{point.title}</h3>
								<p>{point.body}</p>
							</li>
						))}
					</ul>
				</div>
			</section>

			<section className="sp-section sp-alt" aria-label="맡은 일">
				<div className="sp-inner sp-split">
					<Headline title="맡은 일." sub={project.role} />
					<ul className="sp-checks">
						{project.contributions.map((item, i) => (
							<li key={item} data-reveal="" style={{ '--d': i } as React.CSSProperties}>
								<i className="fa-solid fa-circle-check" aria-hidden="true" />
								{item}
							</li>
						))}
					</ul>
				</div>
			</section>

			<section className="sp-section" aria-label="기술 사양">
				<div className="sp-inner">
					<h2 className="sp-specs-title" data-reveal="">
						기술 사양
					</h2>
					<dl className="sp-specs">
						{project.specs.map((spec) => (
							<div key={spec.label} data-reveal="">
								<dt>{spec.label}</dt>
								<dd>{spec.value}</dd>
							</div>
						))}
					</dl>
				</div>
			</section>

			<footer className="sp-cta" data-reveal="">
				<p>{project.tagline}</p>
				<Links project={project} />
			</footer>
		</div>
	);
};

export default ProductPage;
