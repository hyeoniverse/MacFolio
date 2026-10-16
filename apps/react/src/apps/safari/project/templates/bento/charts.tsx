// bento 타일의 작은 그래프 (장식, aria-hidden): 숫자 타일의 꺾은선과 진행 과정 타일의 날짜 칸 그래프(칸 계산은 graph.ts).
// 꺾은선은 값이 아니라 숫자 이름에서 뽑은 고정된 모양이고(같은 숫자는 언제나 같은 모양), 날짜 칸은 진행 과정의 날짜를 그대로 칠한다
import React from 'react';

/** 글자에서 뽑는 고정된 수 */
function seeded(text: string) {
	let h = 2166136261;
	for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967296;
	};
}

/** 오른쪽으로 오르는 작은 꺾은선 */
export const Spark: React.FC<{ seed: string }> = ({ seed }) => {
	const rand = seeded(seed);
	const count = 14;
	const points = Array.from({ length: count }, (_, i) => {
		const trend = 30 - (i / (count - 1)) * 22;
		return [(i / (count - 1)) * 100, Math.max(3, Math.min(31, trend + (rand() - 0.5) * 10))] as const;
	});
	const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
	const [lastX, lastY] = points[points.length - 1];
	return (
		<svg className="bt-spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
			<polygon points={`0,34 ${line} 100,34`} />
			<polyline points={line} />
			<circle cx={lastX} cy={lastY} r="1.6" />
		</svg>
	);
};

export const Graph: React.FC<{ weeks: number[][] }> = ({ weeks }) => (
	<div className="bt-graph" style={{ '--weeks': weeks.length } as React.CSSProperties} aria-hidden="true">
		{weeks.map((week, w) =>
			week.map((level, d) => <i key={`${w}-${d}`} data-level={level} style={{ gridColumn: w + 1, gridRow: d + 1 }} />)
		)}
	</div>
);
