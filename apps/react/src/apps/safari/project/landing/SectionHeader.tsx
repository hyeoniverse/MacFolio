// 랜딩 페이지 구역 머리: 작은 라벨(eyebrow) + 큰 제목 + 부제
import React from 'react';
import './landing.css';

export interface SectionHeaderProps {
	/** 제목 위 작은 라벨 (예: 주요 기능) */
	eyebrow?: string;
	title: string;
	/** 제목 아래 한두 문장 */
	lead?: string;
	/** center 가운데(기본), start 왼쪽 */
	align?: 'center' | 'start';
	/** 제목 태그 (구역 안의 작은 머리면 h3) */
	as?: 'h2' | 'h3';
	/** 제목 글자에 강조색 그라데이션 */
	gradient?: boolean;
	/** dark·light: 페이지 테마와 상관없이 그 톤의 글자색 (어두운 히어로 위 등). 없으면 바깥 톤을 따른다 */
	tone?: 'dark' | 'light';
	/** 제목의 id (구역을 aria-labelledby로 이름 붙일 때) */
	id?: string;
	className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
	eyebrow,
	title,
	lead,
	align = 'center',
	as: Heading = 'h2',
	gradient = false,
	tone,
	id,
	className,
}) => (
	<header
		className={`lk-root lk-section-head${className ? ` ${className}` : ''}`}
		data-align={align}
		data-lk-tone={tone}
	>
		{eyebrow && <p className="lk-eyebrow">{eyebrow}</p>}
		<Heading id={id} className={`lk-section-title${gradient ? ' lk-gradient-text' : ''}`}>
			{title}
		</Heading>
		{lead && <p className="lk-section-lead">{lead}</p>}
	</header>
);
