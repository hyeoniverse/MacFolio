// friendly 첫 화면에서 큰 창 위에 겹쳐 놓는 작은 UI 카드 둘: 숫자 카드(첫 숫자와 막대그래프, 둘째 숫자)와 기능 목록 카드.
// 프로젝트 내용으로만 만들고, 내용이 없으면 그 카드는 그리지 않는다. 같은 내용이 아래 구역에 있으므로 장식으로 숨긴다 (aria-hidden)
import React from 'react';
import { iconOf, type Landing } from '@/apps/safari/project/landing';
import { seeded } from './seeded';

/** 오른쪽으로 갈수록 높아지는 막대 높이 (같은 숫자는 언제나 같은 모양) */
function barsOf(seed: string, count = 9) {
	const rand = seeded(seed);
	return Array.from({ length: count }, (_, i) => Math.round(30 + (i / (count - 1)) * 55 + (rand() - 0.5) * 18));
}

export const HeroCards: React.FC<{ landing: Landing }> = ({ landing }) => {
	const facts = landing.sections.find((section) => section.kind === 'stats')?.facts ?? [];
	const features = landing.sections.find((section) => section.kind === 'features')?.items ?? [];
	const [first, second] = facts;
	return (
		<>
			{first && (
				<div className="fr-card fr-card-stat" aria-hidden="true">
					<span className="fr-card-label">{first.label}</span>
					<strong className="fr-card-value">{first.value}</strong>
					<span className="fr-card-bars">
						{barsOf(first.label).map((height, i, all) => (
							<i
								key={i}
								style={{ height: `${Math.min(100, height)}%` }}
								data-last={i === all.length - 1 ? '' : undefined}
							/>
						))}
					</span>
					{second && (
						<span className="fr-card-foot">
							<b>{second.value}</b>
							<span>{second.label}</span>
						</span>
					)}
				</div>
			)}
			{features.length > 0 && (
				<div className="fr-card fr-card-list" aria-hidden="true" data-solo={first ? undefined : ''}>
					<span className="fr-card-label">{landing.hero.name}</span>
					<ul>
						{features.slice(0, 3).map((point, i) => (
							<li key={point.title}>
								<span className="fr-card-icon">
									<i className={`fa-solid ${iconOf(point, i)}`} />
								</span>
								<span className="fr-card-title">{point.title}</span>
								<i className="fa-solid fa-circle-check fr-card-check" />
							</li>
						))}
					</ul>
				</div>
			)}
		</>
	);
};
