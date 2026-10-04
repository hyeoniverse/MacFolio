import { barsOf, type ServerStatus } from './serverStatus';
import './ServerSignal.css';

/**
 * 서버 상태를 Wi-Fi 모양으로: 응답이 빠르면 막대 셋, 보통 둘, 느리거나 DB가 안 되면 하나.
 * 서버에 닿지 않으면 막대가 모두 흐리고 사선이 그어진다. 확인하는 중에는 막대가 차례로 깜빡인다.
 */
const ServerSignal = ({ status }: { status: Pick<ServerStatus, 'state' | 'latency'> }) => {
	const bars = barsOf(status);
	const down = status.state === 'offline' || status.state === 'no-network';
	return (
		<svg className={`server-signal state-${status.state}`} viewBox="0 0 20 16" aria-hidden="true" data-bars={bars}>
			{/* 아래 점, 작은 호, 중간 호, 큰 호 */}
			<circle className={bars >= 1 || status.state === 'checking' ? 'on' : ''} cx="10" cy="13.2" r="1.7" />
			<path className={bars >= 1 ? 'on' : ''} d="M6.6 9.9a4.8 4.8 0 0 1 6.8 0" />
			<path className={bars >= 2 ? 'on' : ''} d="M4 7.3a8.5 8.5 0 0 1 12 0" />
			<path className={bars >= 3 ? 'on' : ''} d="M1.4 4.7a12.2 12.2 0 0 1 17.2 0" />
			{down && <line className="slash" x1="3" y1="1.5" x2="17" y2="15" />}
		</svg>
	);
};

export default ServerSignal;
