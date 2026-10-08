import type { CSSProperties } from 'react';

/**
 * CSS 변수를 style로 넘긴다: cssVars({ d: 2, fill: '40%' }) → { '--d': 2, '--fill': '40%' }.
 * 그때그때 바뀌는 값(순서, 비율, 색)은 이렇게 변수로만 넘기고, 그 값을 어떻게 쓸지는 CSS가 정한다.
 * React의 style 형식에 CSS 변수가 없어서 쓰는 곳마다 하던 형 변환을 여기 한 곳에 모았다
 */
export function cssVars(vars: Record<string, string | number | undefined>): CSSProperties {
	const style: Record<string, string | number> = {};
	for (const [name, value] of Object.entries(vars)) if (value !== undefined) style[`--${name}`] = value;
	return style as CSSProperties;
}
