// HYEONIVERSE 구조도: 그림 파일 대신 상자와 선으로 직접 그린다. 사용자 → 앱(Next.js) → 데이터와 바깥 서비스 세 단에
// 상자를 두고, 상자 사이를 선으로 잇는다. 상자에 마우스를 올리거나 초점을 두면 이어진 선과 상자만 진해지고 선 위로 흐름이 지나간다
import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import '@/apps/safari/project/CreativeArchitecture.css';

type Node = { id: string; col: 0 | 1 | 2; title: string; body: string; chips?: string[]; main?: boolean };
/** 선: 어디서 어디로, 점선이면 요청이 아니라 배포·검사 같은 곁가지 */
type Edge = { from: string; to: string; side?: boolean };

const COLUMNS = ['사용자', '앱', '데이터와 바깥 서비스'];

const NODES: Node[] = [
	{ id: 'visitor', col: 0, title: '방문자', body: '공개 페이지 · 한/영 전환 · 댓글 · 좋아요' },
	{ id: 'admin', col: 0, title: '관리자 · 저자', body: '글 · 작업물 · 프로필 · 사이트 설정 편집' },
	{
		id: 'next',
		col: 1,
		main: true,
		title: 'Next.js 16 · App Router',
		body: '서버 렌더링과 ISR 캐시, API 라우트 113개',
		chips: ['React 19', 'TypeScript', 'CSS Modules', 'GSAP · Lenis', 'Three.js', 'Plate.js'],
	},
	{ id: 'vercel', col: 1, title: 'Vercel', body: '배포 · Analytics · Speed Insights' },
	{ id: 'quality', col: 1, title: '품질 관리', body: 'PR마다 타입 · 린트 · 단위 테스트 816개 · E2E · release-please' },
	{
		id: 'supabase',
		col: 2,
		main: true,
		title: 'Supabase',
		body: 'PostgreSQL과 행 단위 보안(4단계 권한)',
		chips: ['Auth', 'Storage', 'Realtime', 'pg_cron'],
	},
	{
		id: 'ai',
		col: 2,
		title: '번역 · 요약 · 음성',
		body: 'DeepL · Google · Gemini · Claude · OpenAI · Fish, 실패하면 다음으로',
	},
	{ id: 'mail', col: 2, title: '메일 · 댓글', body: 'Resend 알림 메일 · giscus 댓글' },
];

const EDGES: Edge[] = [
	{ from: 'visitor', to: 'next' },
	{ from: 'admin', to: 'next' },
	{ from: 'next', to: 'supabase' },
	{ from: 'next', to: 'ai' },
	{ from: 'next', to: 'mail' },
	{ from: 'next', to: 'vercel', side: true },
	{ from: 'quality', to: 'vercel', side: true },
];

/** 상자 둘 사이의 굽은 선: 옆 단이면 오른쪽 가운데 → 왼쪽 가운데, 같은 단이면 아래 가운데 → 위 가운데 */
const pathBetween = (a: DOMRect, b: DOMRect, origin: DOMRect) => {
	const x = (value: number) => value - origin.left;
	const y = (value: number) => value - origin.top;
	if (b.left > a.right - 1) {
		const x1 = x(a.right);
		const y1 = y(a.top + a.height / 2);
		const x2 = x(b.left);
		const y2 = y(b.top + b.height / 2);
		const mid = (x1 + x2) / 2;
		return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
	}
	const down = b.top > a.top;
	const x1 = x(a.left + a.width / 2);
	const y1 = y(down ? a.bottom : a.top);
	const x2 = x(b.left + b.width / 2);
	const y2 = y(down ? b.top : b.bottom);
	return `M${x1} ${y1} L${x2} ${y2}`;
};

export const Architecture: React.FC = () => {
	const box = useRef<HTMLDivElement>(null);
	// 선 끝의 화살촉 (페이지에 구조도가 여럿이어도 겹치지 않게 고유한 이름)
	const arrow = `cr-arch-arrow-${useId().replace(/:/g, '')}`;
	const [paths, setPaths] = useState<string[]>([]);
	const [active, setActive] = useState<string | null>(null);

	// 상자 자리가 바뀔 때마다(창 크기, 글자 줄바꿈) 선을 다시 긋는다
	useLayoutEffect(() => {
		const root = box.current;
		if (!root) return;
		const draw = () => {
			const origin = root.getBoundingClientRect();
			const rect = (id: string) => root.querySelector(`[data-node="${id}"]`)?.getBoundingClientRect();
			setPaths(
				EDGES.map((edge) => {
					const a = rect(edge.from);
					const b = rect(edge.to);
					return a && b ? pathBetween(a, b, origin) : '';
				})
			);
		};
		draw();
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
		observer?.observe(root);
		return () => observer?.disconnect();
	}, []);

	// 지금 강조할 상자와 선: 고른 상자, 그 상자와 이어진 선과 상자
	const linked = (edge: Edge) => active !== null && (edge.from === active || edge.to === active);
	const lit = new Set(EDGES.filter(linked).flatMap((edge) => [edge.from, edge.to]));

	return (
		<div className="cr-arch" ref={box} data-active={active ?? undefined} data-reveal="">
			<svg className="cr-arch-lines" aria-hidden="true">
				<defs>
					<marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
						<path d="M0 0L10 5L0 10z" />
					</marker>
				</defs>
				{EDGES.map((edge, i) => (
					<path
						key={`${edge.from}-${edge.to}`}
						d={paths[i] ?? ''}
						data-side={edge.side || undefined}
						data-lit={linked(edge) || undefined}
						markerEnd={`url(#${arrow})`}
					/>
				))}
			</svg>
			{COLUMNS.map((label, col) => (
				<div key={label} className="cr-arch-col">
					<p className="cr-arch-label">{label}</p>
					{NODES.filter((node) => node.col === col).map((node) => (
						<div
							key={node.id}
							className="cr-arch-node"
							data-node={node.id}
							data-main={node.main || undefined}
							data-lit={lit.has(node.id) || undefined}
							tabIndex={0}
							onPointerEnter={() => setActive(node.id)}
							onPointerLeave={() => setActive(null)}
							onFocus={() => setActive(node.id)}
							onBlur={() => setActive(null)}
						>
							<h3>{node.title}</h3>
							<p>{node.body}</p>
							{node.chips && (
								<ul>
									{node.chips.map((chip) => (
										<li key={chip}>{chip}</li>
									))}
								</ul>
							)}
						</div>
					))}
				</div>
			))}
		</div>
	);
};
