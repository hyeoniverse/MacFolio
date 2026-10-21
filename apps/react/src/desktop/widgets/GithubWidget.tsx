import { useEffect, useMemo, useState } from 'react';
import { loadActivity, toWeeks, useActivity } from '@/apps/github/githubActivityApi';
import type { WidgetSize } from './catalog';
import { streakOf } from './model';

/**
 * 기여 그래프, 잔디 (GitHub 앱과 같은 자료). 1년 치를 그리고, 칸 크기는 위젯 높이에 맞춰 7줄이 꼭 들어가게 한 뒤
 * 들어가는 만큼만 보인다 (가장 최근 주가 오른쪽 끝). 서버가 없으면 안내만
 */
const GithubWidget = ({ size }: { size: WidgetSize }) => {
	const activity = useActivity();
	// 서버가 없거나 답이 없으면 불러오는 중으로 남지 않게
	const [tried, setTried] = useState(false);
	useEffect(() => {
		if (!activity) void loadActivity().finally(() => setTried(true));
	}, [activity]);
	const contributions = activity?.contributions;
	const weeks = useMemo(() => (contributions ? toWeeks(contributions.days) : []), [contributions]);
	const streak = contributions ? streakOf(contributions.days) : 0;

	return (
		<div className="widget-github-body">
			<p className="widget-github-header">
				<i className="fa-solid fa-seedling" aria-hidden="true"></i>
				<span>{size === 'medium' ? 'GitHub 기여' : '기여'}</span>
				{contributions && (
					<span className="widget-note">
						{size === 'medium' ? '지난 1년 ' : ''}
						{contributions.total.toLocaleString('ko-KR')}회{size === 'medium' && streak > 0 && ` · 연속 ${streak}일`}
					</span>
				)}
			</p>
			{contributions ? (
				<div className="widget-github-graph" role="img" aria-label={`지난 1년 기여 ${contributions.total}회`}>
					{/* 최근 주가 먼저: 오른쪽부터 놓고, 다 들어가지 않는 옛 주는 다음 줄로 넘겨 가린다 (반쯤 잘린 열이 없게) */}
					<div className="widget-github-weeks">
						{[...weeks].reverse().map((week, index) => (
							<div key={index} className="widget-github-week">
								{week.map((day, row) => (
									<span key={row} className="widget-github-day" data-level={day?.level ?? 'none'}>
										{/* 가장 많이 한 날은 잔디에 새싹이 돋는다 (새싹 농장처럼) */}
										{day?.level === 4 && <i className="fa-solid fa-seedling" aria-hidden="true"></i>}
									</span>
								))}
							</div>
						))}
					</div>
				</div>
			) : (
				<p className="widget-note">{tried ? '기여 기록을 불러오지 못했습니다' : '기여 기록을 불러오는 중…'}</p>
			)}
		</div>
	);
};

export default GithubWidget;
