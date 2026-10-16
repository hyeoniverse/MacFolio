// friendly의 위 막대: 이름, 구역으로 가는 단추 몇 개, 오른쪽 끝의 바로 가기 단추. 스크롤해도 맨 위에 붙어 있고,
// 첫 화면의 색 띠를 벗어나면 흰 바탕과 아래 선이 생긴다. 바로 가기 단추는 첫 링크와 같은 곳으로 가되 이름이 달라
// 첫 화면·마무리의 링크 묶음(data-link) 두 벌과 섞이지 않는다
import React, { useEffect, useRef, useState } from 'react';
import type { AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/useAppState';
import { prefersReducedMotion } from '@/apps/safari/project/reveal';
import { scrollParent } from '@/apps/safari/project/scroll';
import type { Landing, LandingLink, LandingSectionKind } from '@/apps/safari/project/landing';

/** 막대에 올리는 구역과 짧은 이름 (있는 것만, 차례대로 다섯까지) */
const NAV: [LandingSectionKind, string][] = [
	['features', '기능'],
	['steps', '시작하기'],
	['built', '구현'],
	['troubleshooting', '문제 해결'],
	['tech', '기술'],
	['team', '팀'],
	['timeline', '로드맵'],
	['deployments', '배포'],
];

const CTA_LABEL: Record<LandingLink['kind'], string> = {
	app: '바로 써 보기',
	demo: '데모 열기',
	repo: '코드 보기',
};

const Cta: React.FC<{ link: LandingLink }> = ({ link }) => {
	const { openApp } = useAppState();
	const label = (
		<>
			{CTA_LABEL[link.kind]}
			<i className="fa-solid fa-arrow-right" aria-hidden="true" />
		</>
	);
	return link.kind === 'app' ? (
		<button type="button" className="fr-nav-cta" onClick={() => openApp(link.app as AppName)}>
			{label}
		</button>
	) : (
		<a className="fr-nav-cta" href={link.href} target="_blank" rel="noopener noreferrer">
			{label}
		</a>
	);
};

export const Nav: React.FC<{ landing: Landing; sentinel: React.RefObject<HTMLElement | null> }> = ({
	landing,
	sentinel,
}) => {
	const nav = useRef<HTMLElement>(null);
	const [stuck, setStuck] = useState(false);
	const { hero, sections } = landing;
	const items = NAV.filter(([kind]) => sections.some((section) => section.kind === kind)).slice(0, 5);
	const primary = hero.links[0];

	// 첫 화면의 큰 제목이 막대 아래로 사라지면 막대에 바탕을 깐다
	useEffect(() => {
		const target = sentinel.current;
		if (!target || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
			root: scrollParent(target),
			rootMargin: '-64px 0px 0px 0px',
		});
		observer.observe(target);
		return () => observer.disconnect();
	}, [sentinel]);

	const go = (kind: LandingSectionKind) => {
		const target = nav.current?.parentElement?.querySelector<HTMLElement>(`[data-section="${kind}"]`);
		target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
		target?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
	};

	return (
		<nav ref={nav} className="fr-nav" aria-label="페이지 차례" data-stuck={stuck ? '' : undefined}>
			<div className="fr-nav-inner">
				<span className="fr-nav-brand">
					{hero.icon && <img className="fr-nav-icon" src={hero.icon} alt="" />}
					<span>{hero.name}</span>
				</span>
				{items.length > 0 && (
					<ul className="fr-nav-links">
						{items.map(([kind, label]) => (
							<li key={kind}>
								<button type="button" onClick={() => go(kind)}>
									{label}
								</button>
							</li>
						))}
					</ul>
				)}
				{primary && <Cta link={primary} />}
			</div>
		</nav>
	);
};
