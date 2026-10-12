// 마지막 행동 유도 띠: 단색 바탕에 큰 문장 하나와 링크(parts의 Links: 여기서 열기·데모·GitHub)
import React from 'react';
import type { Project } from '@/shared/profile';
import { Links } from '@/apps/safari/project/parts';
import { GlowBackdrop } from './GlowBackdrop';
import './landing.css';

export interface CtaBandProps {
	project: Project;
	/** 큰 문장 (기본: 프로젝트의 tagline) */
	title?: string;
	/** 그 아래 한 줄 (기본: description) */
	lead?: string;
	/** dark(기본) 어두운 띠, light 밝은 띠 */
	tone?: 'dark' | 'light';
	/** 아이콘 타일을 문장 위에 (기본 켬) */
	showIcon?: boolean;
	/** 바탕의 아주 옅은 무늬 (기본 none: 단색) */
	pattern?: 'grid' | 'dots' | 'none';
	className?: string;
}

export const CtaBand: React.FC<CtaBandProps> = ({
	project,
	title,
	lead,
	tone = 'dark',
	showIcon = true,
	pattern = 'none',
	className,
}) => {
	const heading = title ?? (project.tagline || project.name);
	const sub = lead ?? project.description;
	return (
		<section className={`lk-root lk-cta${className ? ` ${className}` : ''}`} data-lk-tone={tone} aria-label={heading}>
			{pattern !== 'none' && <GlowBackdrop tone={tone} pattern={pattern} focus="center" />}
			<div className="lk-cta-inner">
				{showIcon && project.icon && <img className="lk-cta-icon" src={project.icon} alt="" />}
				<h2 className="lk-cta-title">{heading}</h2>
				{sub && <p className="lk-cta-lead">{sub}</p>}
				<Links project={project} className="sp-links lk-cta-links" />
			</div>
		</section>
	);
};
