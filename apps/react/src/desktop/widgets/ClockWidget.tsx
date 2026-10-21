import { cssVars } from '@/shared/lib/cssVars';
import { handAngles, seoulDate } from './model';
import { useNow } from './useNow';

/** 바늘 시계 (서울). 1초마다 바늘을 옮긴다 */
const ClockWidget = () => {
	const now = seoulDate(useNow(1000));
	const angles = handAngles(now);
	const time = `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;
	return (
		<div className="widget-clock-body">
			<div className="widget-clock-face" role="img" aria-label={`서울 ${time}`}>
				{Array.from({ length: 12 }, (_, index) => (
					<span key={index} className="widget-clock-number" style={cssVars({ n: index + 1 })}>
						{index + 1}
					</span>
				))}
				<span className="widget-clock-hand hour" style={cssVars({ angle: `${angles.hour}deg` })} />
				<span className="widget-clock-hand minute" style={cssVars({ angle: `${angles.minute}deg` })} />
				<span className="widget-clock-hand second" style={cssVars({ angle: `${angles.second}deg` })} />
			</div>
			<p className="widget-clock-city">서울</p>
		</div>
	);
};

export default ClockWidget;
