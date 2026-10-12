// 큰 숫자 띠: 숫자(facts)를 크게 한 줄로. 화면에 들어오면 세어 올라간다 (parts의 FactValue)
import React from 'react';
import type { ProjectFact } from '@/shared/profile';
import { FactValue } from '@/apps/safari/project/parts';
import './landing.css';

export interface StatBandProps {
	facts: ProjectFact[];
	/** dark 어두운 띠, light 밝은 띠, 없으면 페이지 테마를 따른다 */
	tone?: 'dark' | 'light';
	/** 숫자에 강조색 그라데이션 (기본 켬) */
	gradient?: boolean;
	/** 목록 이름 (보조 기술용, 기본 '한눈에') */
	label?: string;
	className?: string;
}

export const StatBand: React.FC<StatBandProps> = ({ facts, tone, gradient = true, label = '한눈에', className }) =>
	facts.length === 0 ? null : (
		<ul
			className={`lk-root lk-stats${className ? ` ${className}` : ''}`}
			data-lk-tone={tone}
			data-count={Math.min(facts.length, 4)}
			data-gradient={gradient ? '' : undefined}
			aria-label={label}
		>
			{facts.map((fact) => (
				<li key={`${fact.value}-${fact.label}`} className="lk-stat">
					<FactValue text={fact.value} />
					<span>{fact.label}</span>
				</li>
			))}
		</ul>
	);
