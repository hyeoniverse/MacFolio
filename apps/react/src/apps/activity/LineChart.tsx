/**
 * 일별 방문 선 그래프 (라이브러리 없이 SVG). 방문은 채운 선, 순방문자는 점선.
 * 화면 폭에 맞게 늘어나도 선 두께가 그대로이게 vector-effect를 쓴다
 */
const HEIGHT = 140;
const WIDTH = 600;

const LineChart = ({ days }: { days: { day: string; visits: number; visitors: number }[] }) => {
	const max = Math.max(1, ...days.map((day) => day.visits));
	const x = (index: number) => (days.length === 1 ? WIDTH / 2 : (index / (days.length - 1)) * WIDTH);
	const y = (value: number) => HEIGHT - (value / max) * (HEIGHT - 12) - 2;
	const line = (pick: (day: (typeof days)[number]) => number) =>
		days.map((day, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(pick(day)).toFixed(1)}`).join(' ');
	const visits = line((day) => day.visits);
	const total = days.reduce((sum, day) => sum + day.visits, 0);

	return (
		<figure className="activity-chart">
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				preserveAspectRatio="none"
				role="img"
				aria-label={`일별 방문: ${days.map((day) => `${day.day} ${day.visits}회`).join(', ')}`}
			>
				{[0.25, 0.5, 0.75].map((ratio) => (
					<line key={ratio} className="grid" x1="0" x2={WIDTH} y1={HEIGHT * ratio} y2={HEIGHT * ratio} />
				))}
				{total > 0 && (
					<>
						<path className="area" d={`${visits} L${x(days.length - 1)} ${HEIGHT} L${x(0)} ${HEIGHT} Z`} />
						<path className="visits" d={visits} />
						<path className="visitors" d={line((day) => day.visitors)} />
					</>
				)}
			</svg>
			<figcaption>
				<span>{days[0]?.day.slice(5).replace('-', '/')}</span>
				<span className="legend">
					<i className="visits" /> 방문 <i className="visitors" /> 순방문자 · 최대 {max.toLocaleString()}
				</span>
				<span>{days.at(-1)?.day.slice(5).replace('-', '/')}</span>
			</figcaption>
		</figure>
	);
};

export default LineChart;
