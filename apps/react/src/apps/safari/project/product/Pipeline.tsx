// MacFolio 전용 데모 "요청이 지나는 길": 브라우저 → Workers / Tunnel → NestJS → DB·GitHub, Actions가 배포하는 구조 그림.
// 그림이 화면에 고정된 채로, 스크롤하는 만큼 상자가 차례로 켜지고 화살표가 이어진다. 움직임 줄이기에서는 고정하지 않고 다 그려진 채로 둔다
import React, { useEffect, useId, useRef } from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import '@/apps/safari/project/product/Pipeline.css';

/**
 * 구조 그림의 상자. step은 스크롤에 따라 켜지는 순서, icon은 Font Awesome 글자(brand면 브랜드 글꼴),
 * shape은 모양(브라우저 창, 데이터베이스 원통, 나머지는 둥근 상자)
 */
const NODES = [
	{ id: 'browser', label: '브라우저', x: 90, y: 200, w: 140, step: 0, icon: '', shape: 'window' },
	{ id: 'workers', label: 'Cloudflare Workers', x: 330, y: 80, w: 190, step: 2, icon: '', brand: true },
	{ id: 'tunnel', label: 'Cloudflare Tunnel', x: 330, y: 250, w: 180, step: 4, icon: '' },
	{ id: 'api', label: 'NestJS · Oracle VM', x: 575, y: 250, w: 180, step: 6, icon: '' },
	{ id: 'db', label: 'PostgreSQL', x: 575, y: 380, w: 140, step: 7, icon: '', shape: 'cylinder' },
	{ id: 'github', label: 'GitHub OAuth·API', x: 780, y: 250, w: 150, step: 7, icon: '', brand: true },
	{ id: 'actions', label: 'GitHub Actions', x: 650, y: 80, w: 170, step: 8, icon: '' },
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
const STEPS = 10;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

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
					className="pdp-body"
					d={`M${left} ${top + r} a${node.w / 2} ${r} 0 0 1 ${node.w} 0 v${h - r * 2} a${node.w / 2} ${r} 0 0 1 ${-node.w} 0 z`}
				/>
				<path className="pdp-line" d={`M${left} ${top + r} a${node.w / 2} ${r} 0 0 0 ${node.w} 0`} />
			</>
		);
	}
	return (
		<>
			<rect className="pdp-body" x={left} y={top} width={node.w} height={NODE_HALF * 2} rx={12} />
			{shape === 'window' && (
				<>
					<path className="pdp-line" d={`M${left} ${top + 14} h${node.w}`} />
					{[0, 1, 2].map((i) => (
						<circle key={i} className="pdp-dot" cx={left + 12 + i * 9} cy={top + 7} r={2.5} />
					))}
				</>
			)}
		</>
	);
};

const Pipeline: React.FC = () => {
	const track = useRef<HTMLDivElement>(null);
	const id = useId().replace(/:/g, '');
	const step = (n: number) => cssVars({ i: n, n: STEPS });

	// 스크롤 진행도를 --p(0~1)로 넣는다. 다시 그리지 않고 스타일만 바꾼다. --view는 스크롤 상자의 높이(고정된 화면의 높이)
	useEffect(() => {
		const node = track.current;
		if (!node) return;
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			const box = node.getBoundingClientRect();
			// 고정된 동안(트랙을 지나는 동안) 앞뒤 조금씩은 여유로 두고 그 사이에 다 그린다
			const p = (view.top - box.top) / Math.max(1, box.height - view.height);
			node.style.setProperty('--view', `${view.height}px`);
			node.style.setProperty('--p', clamp((p - 0.08) / 0.8).toFixed(4));
		});
	}, []);

	return (
		<div className="pdp-track" ref={track}>
			<div className="pdp-sticky">
				<figure className="pdp">
					<div className="pdp-scroll">
						<svg viewBox="0 0 870 430" role="img" aria-labelledby={`${id}-title`}>
							<title id={`${id}-title`}>
								브라우저는 화면을 Cloudflare Workers에서 받고, API는 Cloudflare Tunnel을 지나 Oracle VM의 NestJS 서버로
								갑니다. 서버는 Prisma로 PostgreSQL을 쓰고 GitHub 응답을 캐시합니다. GitHub Actions는 시험을 통과한
								커밋만 Workers에 배포합니다.
							</title>
							{EDGES.map((edge, i) => (
								<g key={edge.label} className="pdp-edge" style={step(edge.step)}>
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
								<g key={node.id} className={`pdp-node pdp-node-${node.id}`} style={step(node.step)}>
									<NodeShape node={node} />
									<text
										className={'brand' in node ? 'pdp-icon brand' : 'pdp-icon'}
										x={node.x}
										y={node.y + ('shape' in node && node.shape !== 'cylinder' ? 4 : -2)}
									>
										{node.icon}
									</text>
									<text className="pdp-label" x={node.x} y={node.y + 22}>
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

export default Pipeline;
