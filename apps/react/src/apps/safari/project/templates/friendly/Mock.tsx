// friendly 첫 화면의 그림이 없을 때 창 틀 안에 그리는 앱 화면 모형: 프로젝트 내용으로 만든다 (장식).
// 왼쪽 막대는 주요 기능 제목, 위 카드는 숫자, 아래는 이름에서 뽑은 고정된 꺾은선 그래프. <img>는 쓰지 않는다
import React from 'react';
import { iconOf, type Landing } from '@/apps/safari/project/landing';
import { seeded } from './seeded';

/** 오른쪽 위로 오르는 꺾은선 (0~100 좌표) */
function chartPoints(seed: string, count = 12) {
	const rand = seeded(seed);
	return Array.from({ length: count }, (_, i) => {
		const trend = 78 - (i / (count - 1)) * 52;
		return [(i / (count - 1)) * 100, Math.max(8, Math.min(92, trend + (rand() - 0.5) * 22))] as const;
	});
}

export const HeroMock: React.FC<{ landing: Landing }> = ({ landing }) => {
	const { hero, sections } = landing;
	const features = sections.find((section) => section.kind === 'features')?.items ?? [];
	const facts = sections.find((section) => section.kind === 'stats')?.facts ?? [];
	// 막대 항목: 주요 기능, 없으면 이 페이지의 구역 이름
	const nav = features.length
		? features.slice(0, 5).map((point, i) => ({ label: point.title, icon: iconOf(point, i) }))
		: sections.slice(0, 5).map((section, i) => ({ label: section.label, icon: iconOf({}, i) }));
	// 위 카드: 숫자가 있으면 숫자, 없으면 주요 기능 카드
	const cards = facts.length
		? facts.slice(0, 3).map((fact) => ({ key: fact.label, value: fact.value, label: fact.label }))
		: features.slice(0, 3).map((point) => ({ key: point.title, value: undefined, label: point.title }));
	const points = chartPoints(hero.name);
	const line = points.map(([x, y]) => `${x},${y}`).join(' ');
	const area = `0,100 ${line} 100,100`;
	const initial = Array.from(hero.name.trim())[0] ?? '·';

	return (
		<div className="fr-mock" aria-hidden="true">
			<div className="fr-mock-side">
				<span className="fr-mock-brand">
					<b>{initial}</b>
					<span>{hero.name}</span>
				</span>
				<ul>
					{nav.length
						? nav.map((item, i) => (
								<li key={item.label} data-active={i === 0 ? '' : undefined}>
									<i className={`fa-solid ${item.icon}`} />
									<span>{item.label}</span>
								</li>
							))
						: [0, 1, 2, 3].map((i) => (
								<li key={i} data-active={i === 0 ? '' : undefined}>
									<i className="fr-mock-dot" />
									<span className="fr-mock-skel" style={{ width: `${70 - i * 10}%` }} />
								</li>
							))}
				</ul>
			</div>
			<div className="fr-mock-main">
				<div className="fr-mock-top">
					<span className="fr-mock-title">{nav[0]?.label ?? hero.name}</span>
					<span className="fr-mock-pill" />
				</div>
				{cards.length > 0 && (
					<div className="fr-mock-cards" data-count={cards.length}>
						{cards.map((card, i) => (
							<div key={card.key} className="fr-mock-card">
								{card.value ? (
									<>
										<span className="fr-mock-label">{card.label}</span>
										<strong>{card.value}</strong>
									</>
								) : (
									<>
										<i className={`fa-solid ${iconOf(features[i] ?? {}, i)}`} />
										<span className="fr-mock-card-title">{card.label}</span>
										<span className="fr-mock-skel" style={{ width: '80%' }} />
									</>
								)}
							</div>
						))}
					</div>
				)}
				<div className="fr-mock-chart">
					<div className="fr-mock-chart-head">
						<span className="fr-mock-skel" style={{ width: '28%' }} />
						<span className="fr-mock-skel fr-mock-skel-soft" style={{ width: '14%' }} />
					</div>
					<svg viewBox="0 0 100 100" preserveAspectRatio="none">
						<line x1="0" y1="25" x2="100" y2="25" />
						<line x1="0" y1="50" x2="100" y2="50" />
						<line x1="0" y1="75" x2="100" y2="75" />
						<polygon points={area} />
						<polyline points={line} />
					</svg>
				</div>
				<div className="fr-mock-rows">
					{[64, 48, 56].map((width, i) => (
						<div key={i} className="fr-mock-row">
							<i className="fr-mock-dot" />
							<span className="fr-mock-skel" style={{ width: `${width}%` }} />
							<span className="fr-mock-skel fr-mock-skel-soft" style={{ width: '12%' }} />
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
