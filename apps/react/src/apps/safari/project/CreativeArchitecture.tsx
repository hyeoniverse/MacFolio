import { cssVars } from '@/shared/lib/cssVars';
// HYEONIVERSE 구조도: MacFolio 페이지의 "요청이 지나는 길"처럼 SVG로 그린다. 그림이 화면에 고정된 채로
// 스크롤하는 만큼 상자가 차례로 켜지고 화살표가 이어진다. 좁은 창과 움직임 줄이기에서는 다 그려진 채로 둔다
import React, { useEffect, useId, useRef } from 'react';
import { onScrollFrame, viewOf } from '@/apps/safari/project/scroll';
import '@/apps/safari/project/CreativeArchitecture.css';

type Node = {
	id: string;
	label: string;
	sub?: string;
	x: number;
	y: number;
	w: number;
	step: number;
	/** Font Awesome 글자 (brand면 브랜드 글꼴) */
	icon: string;
	brand?: boolean;
	shape?: 'window' | 'cylinder';
	main?: boolean;
};

/** 상자 높이의 절반 */
const HALF = 38;

const NODES: Node[] = [
	{
		id: 'visitor',
		label: '방문자',
		sub: '한/영 · 댓글 · 좋아요',
		x: 95,
		y: 130,
		w: 160,
		step: 0,
		icon: '',
		shape: 'window',
	},
	{
		id: 'admin',
		label: '관리자 · 저자',
		sub: '글 · 작업물 · 설정',
		x: 95,
		y: 360,
		w: 160,
		step: 0,
		icon: '',
		shape: 'window',
	},
	{
		id: 'next',
		label: 'Next.js 16 · Vercel',
		sub: 'ISR 캐시 · API 113개',
		x: 380,
		y: 245,
		w: 210,
		step: 2,
		icon: '',
		main: true,
	},
	{
		id: 'auth',
		label: 'Supabase Auth',
		sub: 'GitHub OAuth · 초대',
		x: 705,
		y: 60,
		w: 200,
		step: 4,
		icon: '',
		brand: true,
	},
	{
		id: 'db',
		label: 'PostgreSQL',
		sub: 'RLS 정책 · Storage',
		x: 705,
		y: 185,
		w: 200,
		step: 5,
		icon: '',
		shape: 'cylinder',
		main: true,
	},
	{ id: 'ai', label: 'AI 공급자', sub: 'DeepL · Gemini · Fish …', x: 705, y: 310, w: 200, step: 6, icon: '' },
	{ id: 'mail', label: 'Resend 메일', sub: '답글 · 초대 · 예약 발행', x: 705, y: 435, w: 200, step: 7, icon: '' },
	{
		id: 'ci',
		label: 'GitHub Actions',
		sub: '타입 · 린트 · 시험 816개 · E2E',
		x: 380,
		y: 450,
		w: 230,
		step: 8,
		icon: '',
	},
];

type Edge = { d: string; label?: string; lx?: number; ly?: number; step: number; side?: boolean };

const EDGES: Edge[] = [
	{ d: 'M175 130 C 225 130 225 225 270 225', label: '페이지', lx: 232, ly: 152, step: 1 },
	{ d: 'M175 360 C 225 360 225 265 270 265', label: '편집 · 저장', lx: 212, ly: 398, step: 1 },
	{ d: 'M485 225 C 545 225 545 60 600 60', step: 3 },
	{ d: 'M485 237 C 545 237 545 185 600 185', step: 4.5 },
	{ d: 'M485 253 C 545 253 545 310 600 310', step: 5.5 },
	{ d: 'M485 265 C 545 265 545 435 600 435', step: 6.5 },
	{ d: 'M805 195 C 870 195 870 435 810 435', label: 'pg_cron', lx: 893, ly: 318, step: 7.5, side: true },
	{ d: 'M380 412 L 380 290', label: '통과하면 배포', lx: 435, ly: 356, step: 9, side: true },
];

/** 모든 단계가 다 켜지는 데 필요한 칸 수 */
const STEPS = 10;

const NodeShape: React.FC<{ node: Node }> = ({ node }) => {
	const left = node.x - node.w / 2;
	const top = node.y - HALF;
	if (node.shape === 'cylinder') {
		const r = 9;
		const h = HALF * 2;
		return (
			<>
				<path
					className="cr-node-body"
					d={`M${left} ${top + r} a${node.w / 2} ${r} 0 0 1 ${node.w} 0 v${h - r * 2} a${node.w / 2} ${r} 0 0 1 ${-node.w} 0 z`}
				/>
				<path className="cr-node-line" d={`M${left} ${top + r} a${node.w / 2} ${r} 0 0 0 ${node.w} 0`} />
			</>
		);
	}
	return (
		<>
			<rect className="cr-node-body" x={left} y={top} width={node.w} height={HALF * 2} rx={14} />
			{node.shape === 'window' && (
				<>
					<path className="cr-node-line" d={`M${left} ${top + 14} h${node.w}`} />
					{[0, 1, 2].map((i) => (
						<circle key={i} className="cr-node-dot" cx={left + 12 + i * 9} cy={top + 7} r={2.5} />
					))}
				</>
			)}
		</>
	);
};

export const Architecture: React.FC = () => {
	const ref = useRef<HTMLDivElement>(null);
	const id = useId().replace(/:/g, '');

	// 트랙을 지나는 동안의 진행도를 --p(0~1)로. 다시 그리지 않고 스타일만 바꾼다
	useEffect(() => {
		const node = ref.current;
		if (!node) return;
		return onScrollFrame(node, (scroller) => {
			const view = viewOf(scroller);
			const box = node.getBoundingClientRect();
			node.style.setProperty('--view', `${view.height}px`);
			const p = (view.top - box.top) / Math.max(1, box.height - view.height);
			node.style.setProperty('--p', Math.min(1, Math.max(0, (p - 0.05) / 0.8)).toFixed(4));
		});
	}, []);

	const step = (n: number) => cssVars({ i: n, n: STEPS });
	return (
		<div className="cr-arch-track" ref={ref}>
			<div className="cr-arch-sticky">
				<figure className="cr-arch">
					<div className="cr-arch-scroll">
						<svg viewBox="0 0 930 500" role="img" aria-labelledby={`${id}-title`}>
							<title id={`${id}-title`}>
								방문자와 관리자는 Vercel의 Next.js 16 앱을 거칩니다. 앱은 Supabase Auth로 GitHub 로그인과 초대를
								확인하고, PostgreSQL은 RLS 정책으로 권한을 판정합니다. 번역·요약·음성은 AI 공급자에게 맡기고 실패하면
								다음 공급자로 넘어가며, 알림 메일은 Resend로 보냅니다. 예약 발행 메일은 DB가 pg_cron과 pg_net으로 직접
								보냅니다. GitHub Actions의 검사를 통과한 커밋만 배포됩니다.
							</title>
							{EDGES.map((edge, i) => (
								<g key={edge.d} className="cr-edge" data-side={edge.side || undefined} style={step(edge.step)}>
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
									{edge.label && (
										<text x={edge.lx} y={edge.ly}>
											{edge.label}
										</text>
									)}
								</g>
							))}
							{NODES.map((node) => (
								<g
									key={node.id}
									className="cr-node"
									data-main={node.main || undefined}
									data-node={node.id}
									style={step(node.step)}
								>
									<NodeShape node={node} />
									<text className={node.brand ? 'cr-node-icon brand' : 'cr-node-icon'} x={node.x} y={node.y - 6}>
										{node.icon}
									</text>
									<text className="cr-node-label" x={node.x} y={node.y + 14}>
										{node.label}
									</text>
									{node.sub && (
										<text className="cr-node-sub" x={node.x} y={node.y + 30}>
											{node.sub}
										</text>
									)}
								</g>
							))}
						</svg>
					</div>
					<figcaption>요청이 지나는 길. 권한은 앱이 아니라 DB가 마지막에 판정합니다.</figcaption>
				</figure>
			</div>
		</div>
	);
};
