import { barsOf, type ServerStatus } from './serverStatus';
import './ServerSignal.css';

/**
 * 서버 상태를 macOS Wi-Fi 모양으로: 응답이 빠르면 막대 셋, 보통 둘, 느리거나 DB가 안 되면 하나.
 * 서버에 닿지 않으면 막대가 모두 흐리고 사선이 그어진다. 확인하는 중에는 막대가 차례로 깜빡인다.
 */
const ServerSignal = ({ status }: { status: Pick<ServerStatus, 'state' | 'latency'> }) => {
	const bars = barsOf(status);
	const down = status.state === 'offline' || status.state === 'no-network';
	return (
		<svg className={`server-signal state-${status.state}`} viewBox="0 0 20 15" aria-hidden="true" data-bars={bars}>
			{/* macOS Wi-Fi 모양: 아래 부채꼴, 가운데 호, 바깥 호 (막대 1·2·3) */}
			<path className={`wedge ${bars >= 1 ? 'on' : ''}`} d="M10 14.2L7.05 11.35A4.1 4.1 0 0 1 12.95 11.35Z" />
			<path className={`arc ${bars >= 2 ? 'on' : ''}`} d="M4.53 8.92A7.6 7.6 0 0 1 15.47 8.92" />
			<path className={`arc ${bars >= 3 ? 'on' : ''}`} d="M1.8 6.28A11.4 11.4 0 0 1 18.2 6.28" />
			{down && <line className="slash" x1="3.2" y1="1" x2="16.8" y2="14.6" />}
		</svg>
	);
};

export default ServerSignal;
