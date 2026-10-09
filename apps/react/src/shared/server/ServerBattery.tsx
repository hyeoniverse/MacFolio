import './ServerBattery.css';

/**
 * macOS 메뉴 막대의 배터리 모양: 옅은 테두리, 오른쪽 꼭지, 안쪽 막대가 fill(%)만큼 찬다.
 * tone이 있으면 막대만 그 색 (주의 = 주황, 위험 = 빨강)
 */
const ServerBattery = ({ fill, tone = null }: { fill: number; tone?: 'danger' | 'warning' | null }) => {
	const width = (19 * Math.min(100, Math.max(0, fill))) / 100;
	return (
		<svg className={`server-battery ${tone ?? ''}`} viewBox="0 0 26 12" aria-hidden="true" data-fill={fill}>
			<rect className="shell" x="0.6" y="0.6" width="22.3" height="10.8" rx="3.2" />
			<path className="cap" d="M24.2 4.1a1.6 1.6 0 0 1 1.3 1.6v0.6a1.6 1.6 0 0 1-1.3 1.6Z" />
			{width > 0 && <rect className="level" x="2.2" y="2.2" width={Math.max(width, 1.6)} height="7.6" rx="1.7" />}
		</svg>
	);
};

export default ServerBattery;
