// MacFolio: Apple 제품 페이지 흐름 그대로.
// 스크롤하면 커지는 노트북 → 숫자 띠 → 기능 타일 → 화면 크기를 바꿔 보는 시뮬레이터 → 어두운 만든 방식(구조 그림) → 맡은 일 → 기술 사양 표
// 첫 화면 밖의 요소는 화면에 들어오면 나타나고 벗어나면 사라진다(data-reveal). 제목은 스크롤에 맞춰 낱말마다 밝아진다
import React, { useEffect, useId, useRef, useState } from 'react';
import type { Project, ProjectPoint } from '@/shared/profile';
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
		share: 0.92,
		ratio: 1080 / 1920,
		note: '넓은 화면에서는 창을 여러 개 띄워 두고 Dock에서 앱을 엽니다. 창은 끌어서 옮기고 모서리를 잡아 크기를 바꿉니다.',
	},
	{
		id: 'laptop',
		name: '노트북',
		px: 1440,
		share: 0.8,
		ratio: 900 / 1440,
		note: '같은 데스크톱입니다. 메뉴 막대와 Dock은 그대로이고, 창은 화면 안에 들어오는 크기로 열립니다.',
	},
	{
		id: 'tablet',
		name: '태블릿',
		px: 820,
		share: 0.42,
		ratio: 1180 / 820,
		note: '768px부터는 아직 데스크톱입니다. 화면이 좁으면 창이 화면 폭에 맞춰 열려 잘리지 않습니다.',
	},
	{
		id: 'phone',
		name: '휴대폰',
		px: 390,
		share: 0.27,
		ratio: 844 / 390,
		note: '767px 이하에서는 iOS 홈 화면이 되고, 앱은 화면을 가득 채웁니다. 가로로 눕혀 높이가 499px 이하인 휴대폰도 같습니다.',
	},
] as const;

/** 고정된 시뮬레이터가 스크롤로 넘기는 장면 수: 앱마다 모든 크기 */
const STEPS = APPS.length * SIZES.length;

/** 주요 기능 타일의 아이콘 (순서대로) */
/**
 * 주요 기능: Apple 페이지의 벤토 그리드처럼 크기가 다른 타일을 모자이크로 채운다.
 * 큰 타일 둘(검은 타일, 밝은 타일)과 작은 타일 둘이 엇갈리고, 타일마다 한 줄 제목과 설명, 아래로 걸친 실제 화면.
 * 화면에 들어오면 타일이 차례로 떠오르고, 마우스를 올리면 화면이 살짝 커진다
 */
const Bento: React.FC<{ points: ProjectPoint[] }> = ({ points }) => (
	<ul className="pd-bento">
		{points.map((point, i) => (
			<li
				key={point.title}
				className="pd-bento-tile"
				data-size={i === 0 || i === 3 ? 'large' : 'small'}
				data-tone={i === 0 ? 'dark' : undefined}
				data-reveal=""
				style={{ '--d': i % 2 } as React.CSSProperties}
			>
				<div className="pd-bento-text">
					<h3>{point.title}</h3>
					<p>{point.body}</p>
				</div>
				{point.image && (
					<figure className="pd-bento-media">
						<img src={point.image} alt={`${point.title} 화면`} loading="lazy" />
					</figure>
				)}
			</li>
		))}
	</ul>
);

/**
 * 구조 그림의 상자. step은 스크롤에 따라 켜지는 순서, icon은 Font Awesome 글자(brand면 브랜드 글꼴),
 * shape은 모양(브라우저 창, 데이터베이스 원통, 나머지는 둥근 상자)
 */
const NODES = [
	{ id: 'browser', label: '브라우저', x: 90, y: 200, w: 140, step: 0, icon: '\uf0ac', shape: 'window' },
	{ id: 'workers', label: 'Cloudflare Workers', x: 330, y: 80, w: 190, step: 2, icon: '\ue07d', brand: true },
	{ id: 'tunnel', label: 'Cloudflare Tunnel', x: 330, y: 250, w: 180, step: 4, icon: '\uf3ed' },
	{ id: 'api', label: 'NestJS · Oracle VM', x: 575, y: 250, w: 180, step: 6, icon: '\uf233' },
	{ id: 'db', label: 'PostgreSQL', x: 575, y: 380, w: 140, step: 7, icon: '\uf1c0', shape: 'cylinder' },
	{ id: 'github', label: 'GitHub OAuth·API', x: 780, y: 250, w: 150, step: 7, icon: '\uf09b', brand: true },
	{ id: 'actions', label: 'GitHub Actions', x: 650, y: 80, w: 170, step: 8, icon: '\uf085' },
] as const;

/** 상자 높이의 절반 */
const NODE_HALF = 32;

/** 구조 그림의 선. 앞 상자가 켜진 다음 그려진다 */
const EDGES = [
	{ d: 'M160 186 C 215 186 205 80 235 80', label: '화면', lx: 182, ly: 120, step: 1 },
	{ d: 'M160 214 C 205 214 205 250 240 250', label: 'API · 세션 쿠키', lx: 200, ly: 282, step: 3 },
	{ d: 'M420 250 L 485 250', label: '포트 없이', lx: 452, ly: 238, step: 5 },
	{ d: 'M575 282 L 575 342', label: 'Prisma', lx: 597, ly: 318, step: 6.5 },
	{ d: 'M665 250 L 705 250', label: '캐시', lx: 685, ly: 238, step: 6.5 },
	{ d: 'M565 80 L 425 80', label: '시험을 통과한 커밋만 배포', lx: 495, ly: 66, step: 9 },
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
	const group = useRef<HTMLDivElement>(null);
	// 노트북과 한 줄이 끝에 화면 높이 안에 다 들어오도록 줄일 비율 (창이 낮으면 아래 한 줄이 잘렸다)
	useEffect(() => {
		const hero = ref.current;
		const node = group.current;
		if (!hero || !node) return;
		const copy = hero.querySelector<HTMLElement>('.pd-copy');
		const laptop = node.querySelector<HTMLElement>('.pd-hero-device');
		const caption = node.querySelector<HTMLElement>('.pd-caption');
		return onScrollFrame(hero, (scroller) => {
			const view = viewOf(scroller).height;
			// 끝에 노트북과 한 줄 아래로도 숨 쉴 자리(160px)를 남긴다
			const fit = Math.min(0.9, (view - 160) / Math.max(1, node.offsetHeight));
			hero.style.setProperty('--fit', fit.toFixed(3));
			// 처음 자리: 제목·링크 아래로 24px 떨어져서 시작한다 (창이 낮아도 GitHub 링크를 가리지 않게)
			const copyBottom = copy ? copy.offsetTop + copy.offsetHeight : 0;
			const startHeight = node.offsetHeight * fit * 0.66;
			const start = Math.max(view * 0.42, copyBottom + 24 - view / 2 + startHeight / 2 + view * 0.04);
			hero.style.setProperty('--start', `${start.toFixed(1)}px`);
			// 한 줄이 노트북 화면 가운데에서 튀어나오도록, 화면 가운데까지의 거리
			if (laptop && caption) {
				const rise = laptop.offsetHeight / 2 + caption.offsetTop - laptop.offsetHeight + caption.offsetHeight / 2;
				node.style.setProperty('--rise', `${rise.toFixed(1)}px`);
			}
		});
	}, [ref]);
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
				{/* 노트북과 한 줄이 한 덩어리로 올라오며 커진다. 한 줄은 노트북이 자리를 잡을 때쯤 화면 속에서 튀어나온다 */}
				<div className="pd-hero-group" ref={group}>
					<Laptop className="pd-hero-device">
						<img src={`${VIEWS_DIR}/memo-laptop.jpg`} alt={`${project.name} 화면`} />
					</Laptop>
					<p className="pd-caption" aria-hidden="true">
						브라우저 안에, <strong>Mac 하나.</strong>
					</p>
				</div>
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
 * 이 구역에 들어오면 화면에 고정된 채로, 스크롤하는 만큼 모니터 → 노트북 → 태블릿 → 휴대폰으로 넘어가고, 휴대폰까지 보면 다음 앱(메시지, Safari)으로 이어진다.
 * 기기 틀이 모양을 바꾸며 그 크기에서 찍은 화면이 나타난다. 좁은 창이나 움직임 줄이기에서는 고정하지 않고 눌러서 고른다
 */
const Simulator: React.FC = () => {
	const [app, setApp] = useState<AppId>('memo');
	const [index, setIndex] = useState(0);
	const track = useRef<HTMLDivElement>(null);
	const sticky = useRef<HTMLDivElement>(null);
	const size = SIZES[index];
	const appInfo = APPS.find((item) => item.id === app) ?? APPS[0];
	const px = useRollingNumber(size.px);
	const pinned = () => !!sticky.current && getComputedStyle(sticky.current).position === 'sticky';

	// 고정되어 있을 때는 지나온 만큼이 지금 앱과 크기다: 메모의 모니터 → … → 휴대폰, 이어서 메시지, Safari 차례로
	useEffect(() => {
		const node = track.current;
		if (!node) return;
		node.style.setProperty('--steps', String(STEPS));
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			node.style.setProperty('--view', `${view.height}px`);
			if (!pinned()) return;
			const box = node.getBoundingClientRect();
			const p = clamp((view.top - box.top) / Math.max(1, box.height - view.height));
			const step = Math.min(STEPS - 1, Math.floor(p * STEPS));
			const appIndex = Math.floor(step / SIZES.length);
			// 단계 막대는 지금 앱 안에서 지나온 만큼 찬다
			node.style.setProperty('--sp', clamp(p * APPS.length - appIndex).toFixed(4));
			setApp(APPS[appIndex].id);
			setIndex(step % SIZES.length);
		});
	}, []);

	/** 앱과 단계를 고르면: 고정된 동안에는 그 자리로 스크롤하고, 아니면 바로 바꾼다 */
	const choose = (appId: AppId, i: number) => {
		const node = track.current;
		const scroller = node && scrollParent(node);
		if (!node || !pinned() || !scroller) {
			setApp(appId);
			setIndex(i);
			return;
		}
		const step = APPS.findIndex((item) => item.id === appId) * SIZES.length + i;
		const view = viewOf(scroller);
		const box = node.getBoundingClientRect();
		const span = box.height - view.height;
		scroller.scrollTo({
			top: scroller.scrollTop + box.top - view.top + ((step + 0.5) / STEPS) * span,
			behavior: 'smooth',
		});
	};

	return (
		<section className="sp-section pd-devices" aria-label="어디서 열어도">
			<div className="pd-sim-track" ref={track}>
				<div className="pd-sim-sticky" ref={sticky}>
					<div className="pd-sim-layout">
						<div className="pd-sim-copy">
							<Headline title="어디서 열어도." sub="화면 크기에 따라 데스크톱이 되고, 휴대폰이 됩니다." />
							<div className="pd-switch" role="group" aria-label="보여 줄 앱">
								{APPS.map((item) => (
									<button key={item.id} type="button" aria-pressed={item.id === app} onClick={() => choose(item.id, 0)}>
										{item.name}
										<span>{item.note}</span>
									</button>
								))}
							</div>
							<ol className="pd-sim-steps">
								{SIZES.map((item, i) => (
									<li key={item.id}>
										<button
											type="button"
											aria-current={i === index ? 'step' : undefined}
											onClick={() => choose(app, i)}
											style={{ '--i': i } as React.CSSProperties}
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

						<div
							className="pd-sim"
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
					</div>
				</div>
			</div>
		</section>
	);
};

/** 상자 모양: 브라우저는 위에 점 세 개가 있는 창, 데이터베이스는 원통, 나머지는 둥근 상자 */
const NodeShape: React.FC<{ node: (typeof NODES)[number] }> = ({ node }) => {
	const left = node.x - node.w / 2;
	const top = node.y - NODE_HALF;
	const shape = 'shape' in node ? node.shape : undefined;
	if (shape === 'cylinder') {
		const r = 9;
		const h = NODE_HALF * 2;
		return (
			<>
				<path
					className="pd-node-body"
					d={`M${left} ${top + r} a${node.w / 2} ${r} 0 0 1 ${node.w} 0 v${h - r * 2} a${node.w / 2} ${r} 0 0 1 ${-node.w} 0 z`}
				/>
				<path className="pd-node-line" d={`M${left} ${top + r} a${node.w / 2} ${r} 0 0 0 ${node.w} 0`} />
			</>
		);
	}
	return (
		<>
			<rect className="pd-node-body" x={left} y={top} width={node.w} height={NODE_HALF * 2} rx={12} />
			{shape === 'window' && (
				<>
					<path className="pd-node-line" d={`M${left} ${top + 14} h${node.w}`} />
					{[0, 1, 2].map((i) => (
						<circle key={i} className="pd-node-dot" cx={left + 12 + i * 9} cy={top + 7} r={2.5} />
					))}
				</>
			)}
		</>
	);
};

/**
 * 만든 방식: 요청이 지나는 길. 그림이 화면에 고정된 채로, 스크롤하는 만큼 상자가 차례로 켜지고 화살표가 이어진다.
 * 움직임 줄이기에서는 고정하지 않고 다 그려진 채로 둔다
 */
const Architecture: React.FC = () => {
	const ref = useScrollProgress<HTMLDivElement>((box, view) => {
		// 고정된 동안(트랙을 지나는 동안) 앞뒤 조금씩은 여유로 두고 그 사이에 다 그린다
		const p = (view.top - box.top) / Math.max(1, box.height - view.height);
		return (p - 0.08) / 0.8;
	});
	const id = useId().replace(/:/g, '');
	const step = (n: number) => ({ '--i': n, '--n': ARCH_STEPS }) as React.CSSProperties;
	return (
		<div className="pd-arch-track" ref={ref}>
			<div className="pd-arch-sticky">
				<figure className="pd-arch">
					<div className="pd-arch-scroll">
						<svg viewBox="0 0 870 430" role="img" aria-labelledby={`${id}-title`}>
							<title id={`${id}-title`}>
								브라우저는 화면을 Cloudflare Workers에서 받고, API는 Cloudflare Tunnel을 지나 Oracle VM의 NestJS 서버로
								갑니다. 서버는 Prisma로 PostgreSQL을 쓰고 GitHub 응답을 캐시합니다. GitHub Actions는 시험을 통과한
								커밋만 Workers에 배포합니다.
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
									<NodeShape node={node} />
									<text
										className={'brand' in node ? 'pd-node-icon brand' : 'pd-node-icon'}
										x={node.x}
										y={node.y + ('shape' in node && node.shape !== 'cylinder' ? 4 : -2)}
									>
										{node.icon}
									</text>
									<text className="pd-node-label" x={node.x} y={node.y + 22}>
										{node.label}
									</text>
								</g>
							))}
						</svg>
					</div>
					<figcaption>요청이 지나는 길. 바깥에 열린 서버 포트는 하나도 없습니다.</figcaption>
				</figure>
			</div>
		</div>
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
					<Bento points={project.highlights} />
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
