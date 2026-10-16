// 구역을 차례대로 그린다: 구역마다 이름 붙은 <section>(aria-label = 구역 이름)으로 감싸고, 안은 템플릿의 렌더러가 그린다.
// 렌더러 묶음은 구역 종류를 하나도 빠짐없이 가져야 한다 (타입이 확인한다): 편집 화면에서 고친 칸이 어느 템플릿에서도 버려지지 않게
import React from 'react';
import type { Landing, LandingSection, LandingSectionKind, SectionOf } from './content';

export type SectionRenderer<K extends LandingSectionKind> = React.FC<{
	section: SectionOf<K>;
	landing: Landing;
	/** 이 구역이 몇 번째로 놓였는지 (0부터, 좌우 번갈이 등) */
	index: number;
}>;

export type SectionRenderers = { [K in LandingSectionKind]: SectionRenderer<K> };

export const LandingSections: React.FC<{
	landing: Landing;
	renderers: SectionRenderers;
	/** 모든 구역의 <section>에 붙일 클래스 */
	className?: string;
}> = ({ landing, renderers, className }) => (
	<>
		{landing.sections.map((section, index) => {
			const Render = renderers[section.kind] as SectionRenderer<LandingSection['kind']>;
			return (
				<section key={section.kind} aria-label={section.label} className={className} data-section={section.kind}>
					<Render section={section as never} landing={landing} index={index} />
				</section>
			);
		})}
	</>
);
