// 기술 이름을 로고처럼 보이는 글자 칩 줄로 ("이런 회사들이 씁니다" 띠 자리). 흐르는 띠(marquee)로도
import React from 'react';
import { hashString } from './mock';
import './landing.css';

export interface LogoStripProps {
	items: string[];
	/** 오른쪽에서 왼쪽으로 천천히 흐른다 (마우스를 올리면 멈추고, 움직임 줄이기면 줄 바꿈한 칩 묶음) */
	marquee?: boolean;
	/** 띠 위 작은 글 (예: 만든 기술) */
	caption?: string;
	/** 목록 이름 (보조 기술용, 기본 '기술') */
	label?: string;
	className?: string;
}

/** 이름마다 글자 모양 하나: 굵게, 넓은 대문자, 기울임, 고정폭, 둥근 표시 + 이름 (같은 이름이면 늘 같은 모양) */
const STYLES = ['heavy', 'wide', 'italic', 'mono', 'mark'] as const;
const styleOf = (name: string) => STYLES[hashString(name) % STYLES.length];

const Logo: React.FC<{ name: string }> = ({ name }) => {
	const style = styleOf(name);
	return (
		<span className="lk-logo" data-style={style}>
			{style === 'mark' && <span className="lk-logo-mark" aria-hidden="true" />}
			{name}
		</span>
	);
};

export const LogoStrip: React.FC<LogoStripProps> = ({ items, marquee = false, caption, label = '기술', className }) => {
	const names = [...new Set(items.filter((item) => item.trim()))];
	if (names.length === 0) return null;
	return (
		<div className={`lk-root lk-logos${className ? ` ${className}` : ''}`} data-marquee={marquee ? '' : undefined}>
			{caption && <p className="lk-logos-caption">{caption}</p>}
			<div className="lk-logos-viewport">
				<ul className="lk-logos-track" aria-label={label}>
					{names.map((name) => (
						<li key={name}>
							<Logo name={name} />
						</li>
					))}
				</ul>
				{/* 흐르는 띠는 같은 줄을 한 번 더 이어 붙여 끊김 없이 돈다 (보조 기술에는 한 번만) */}
				{marquee && (
					<ul className="lk-logos-track lk-logos-clone" aria-hidden="true">
						{names.map((name) => (
							<li key={name}>
								<Logo name={name} />
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
};
