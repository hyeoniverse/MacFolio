import { useEffect, useMemo, useState } from 'react';
import { loadActivity, toWeeks, useActivity } from '@/apps/github/githubActivityApi';
import type { WidgetSize } from './catalog';

/** 보여 줄 주 수 (위젯 폭에 맞춘다: 한 주가 한 열) */
const WEEKS: Record<WidgetSize, number> = { small: 8, medium: 20 };

/** 기여 그래프, 잔디 (GitHub 앱과 같은 자료). 서버가 없으면 안내만 */
const GithubWidget = ({ size }: { size: WidgetSize }) => {
	const activity = useActivity();
	// 서버가 없거나 답이 없으면 불러오는 중으로 남지 않게
	const [tried, setTried] = useState(false);
	useEffect(() => {
		if (!activity) void loadActivity().finally(() => setTried(true));
	}, [activity]);
	const count = WEEKS[size];
	const contributions = activity?.contributions;
	const weeks = useMemo(() => (contributions ? toWeeks(contributions.days).slice(-count) : []), [contributions, count]);
	const total = weeks.flat().reduce((sum, day) => sum + (day?.count ?? 0), 0);

	return (
		<div className="widget-github-body">
			<p className="widget-github-header">
				<i className="fa-brands fa-github" aria-hidden="true"></i> GitHub
				{contributions && (
					<span className="widget-note">
						{size === 'medium' ? `최근 ${count}주 기여 ` : ''}
						{total.toLocaleString('ko-KR')}회
					</span>
				)}
			</p>
			{contributions ? (
				<div className="widget-github-graph" role="img" aria-label={`최근 ${count}주 기여 ${total}회`}>
					{weeks.map((week, index) => (
						<div key={index} className="widget-github-week">
							{week.map((day, row) => (
								<span key={row} className="widget-github-day" data-level={day?.level ?? 'none'} />
							))}
						</div>
					))}
				</div>
			) : (
				<p className="widget-note">{tried ? '기여 기록을 불러오지 못했습니다' : '기여 기록을 불러오는 중…'}</p>
			)}
		</div>
	);
};

export default GithubWidget;
