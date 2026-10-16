// keynote 템플릿의 강조색: 무대가 언제나 어두워서 아이콘 색의 밝은 값(--lk-dark-accent)을 쓴다. 노랑에서 연두 사이의 색상은
// 검은 무대에서 겨자색·국방색처럼 탁해 보여 키노트의 또렷한 한 점과 어울리지 않으므로, 그때는 이 템플릿의 기본값(남보라)으로 돌린다
import type React from 'react';

/** 'hsl(48 80% 38%)'에서 색상 각도 (못 읽으면 null) */
export const hueOf = (value: unknown): number | null => {
	if (typeof value !== 'string') return null;
	const match = /^hsl\(\s*(-?[\d.]+)/.exec(value);
	return match ? Number(match[1]) : null;
};

/** 탁해지는 색상 범위 (노랑에서 연두까지) */
const MUDDY = { from: 38, to: 95 };

export function keynoteAccent(vars: React.CSSProperties): React.CSSProperties {
	const hue = hueOf((vars as Record<string, unknown>)['--lk-accent']);
	if (hue === null) return vars;
	return hue >= MUDDY.from && hue <= MUDDY.to ? {} : vars;
}
