// product 템플릿의 강조색: 아이콘에서 뽑은 색(useLandingAccent)이 노랑·황토·연두 쪽이면 흰 바탕에서 읽히도록 어둡게 한 값이
// 탁한 겨자색이 되어 Apple 제품 페이지의 맑은 버튼과 어울리지 않는다. 그런 색상이면 키트 기본값(Apple 파랑)을 그대로 쓴다
import type React from 'react';

/** 'hsl(48 80% 38%)'에서 색상 각도 (못 읽으면 null) */
export const hueOf = (value: unknown): number | null => {
	if (typeof value !== 'string') return null;
	const match = /^hsl\(\s*(-?[\d.]+)/.exec(value);
	return match ? Number(match[1]) : null;
};

/** 탁해지는 색상 범위 (노랑에서 연두까지) */
const MUDDY = { from: 38, to: 95 };

export function productAccent(vars: React.CSSProperties): React.CSSProperties {
	const hue = hueOf((vars as Record<string, unknown>)['--lk-accent']);
	if (hue === null) return vars;
	return hue >= MUDDY.from && hue <= MUDDY.to ? {} : vars;
}
