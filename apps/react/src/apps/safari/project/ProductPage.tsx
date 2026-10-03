// MacFolio: Apple 제품 페이지 흐름 그대로.
// 스크롤하면 커지는 노트북 → 숫자 띠 → 기능 타일 → 데스크톱·휴대폰 나란히 → 어두운 만든 방식(구조 그림) → 맡은 일 → 기술 사양 표
import React, { useEffect, useId, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Facts, Favicon, Links } from '@/apps/safari/project/parts';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import './ProductPage.css';

const VIEWS_DIR = '/imgs/projects/macfolio/views';

/** 데스크톱과 휴대폰에서 나란히 보여 줄 앱 */
const VIEWS = [
	{ id: 'memo', name: '메모', note: '블로그' },
	{ id: 'messages', name: '메시지', note: '방명록' },
	{ id: 'safari', name: 'Safari', note: '프로젝트' },
] as const;

type ViewId = (typeof VIEWS)[number]['id'];

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

const Headline: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
	<h2 className="sp-headline">
		{title}
		{sub && <span> {sub}</span>}
	</h2>
);

/** 화면 한 장을 담는 노트북 (이미지가 여러 장이면 겹쳐 두고 active만 보인다) */
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
					<img src={project.image} alt={`${project.name} 화면`} />
				</Laptop>
				<p className="pd-caption" aria-hidden="true">
					브라우저 안에, Mac 하나.
				</p>
			</div>
		</section>
	);
};

/** 같은 앱을 데스크톱과 휴대폰에서 나란히 */
const Devices: React.FC = () => {
	const [active, setActive] = useState<ViewId>('memo');
	const current = VIEWS.find((view) => view.id === active) ?? VIEWS[0];
	const shots = (kind: 'desktop' | 'mobile') =>
		VIEWS.map((view) => (
			<img
				key={view.id}
				src={`${VIEWS_DIR}/${view.id}-${kind}.jpg`}
				alt={view.id === active ? `${kind === 'desktop' ? '데스크톱' : '휴대폰'}에서 연 ${view.name}` : ''}
				aria-hidden={view.id === active ? undefined : true}
				className={view.id === active ? 'active' : undefined}
				loading="lazy"
			/>
		));
	return (
		<section className="sp-section pd-devices" aria-label="어디서 열어도">
			<div className="sp-inner">
				<Headline title="어디서 열어도." sub="큰 화면에서는 창으로, 휴대폰에서는 앱 하나가 화면 가득." />
				<div className="pd-switch" role="group" aria-label="보여 줄 앱">
					{VIEWS.map((view) => (
						<button key={view.id} type="button" aria-pressed={view.id === active} onClick={() => setActive(view.id)}>
							{view.name}
							<span>{view.note}</span>
						</button>
					))}
				</div>
				<div className="pd-pair">
					<Laptop>{shots('desktop')}</Laptop>
					<div className="pd-phone">
						<div className="pd-phone-screen">{shots('mobile')}</div>
					</div>
				</div>
				<p className="pd-pair-note" aria-live="polite">
					{current.name} 앱은 {current.note}가 됩니다.
				</p>
			</div>
		</section>
	);
};

/** 만든 방식: 요청이 지나는 길. 스크롤하면 상자가 차례로 켜지고 선이 그려진다 */
const Architecture: React.FC = () => {
	// 그림 윗변이 화면 아래쪽에 들어오면 시작해, 아랫변까지 다 보이면 끝난다
	const ref = useScrollProgress<HTMLElement>((box, view) => (view.top + view.height * 0.9 - box.top) / box.height);
	const id = useId().replace(/:/g, '');
	const step = (n: number) => ({ '--i': n, '--n': ARCH_STEPS }) as React.CSSProperties;
	return (
		<figure className="pd-arch" ref={ref}>
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

const ProductPage: React.FC<{ project: Project }> = ({ project }) => (
	<>
		<Hero project={project} />

		<section className="sp-band" aria-label="한눈에 보기">
			<div className="sp-inner">
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
				<ul className="sp-tiles">
					{project.highlights.map((point, i) => (
						// 개수가 홀수면 첫 타일을 넓게 해 빈칸을 없앤다
						<li key={point.title} className={i === 0 && project.highlights.length % 2 === 1 ? 'wide' : undefined}>
							<h3>{point.title}</h3>
							<p>{point.body}</p>
						</li>
					))}
				</ul>
			</div>
		</section>

		<Devices />

		<section className="sp-section sp-dark" aria-label="만든 방식">
			<div className="sp-inner">
				<Headline title="만든 방식." sub="보이지 않는 곳에서 신경 쓴 것들." />
				<Architecture />
				<ul className="sp-points">
					{project.build.map((point) => (
						<li key={point.title}>
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
					{project.contributions.map((item) => (
						<li key={item}>
							<i className="fa-solid fa-circle-check" aria-hidden="true" />
							{item}
						</li>
					))}
				</ul>
			</div>
		</section>

		<section className="sp-section" aria-label="기술 사양">
			<div className="sp-inner">
				<h2 className="sp-specs-title">기술 사양</h2>
				<dl className="sp-specs">
					{project.specs.map((spec) => (
						<div key={spec.label}>
							<dt>{spec.label}</dt>
							<dd>{spec.value}</dd>
						</div>
					))}
				</dl>
			</div>
		</section>

		<footer className="sp-cta">
			<p>{project.tagline}</p>
			<Links project={project} />
		</footer>
	</>
);

export default ProductPage;
