import type { WidgetSize } from './catalog';
import { monthGrid, seoulDate, WEEKDAYS } from './model';
import { useNow } from './useNow';

/** 이달 달력 (macOS 캘린더 위젯처럼 오늘은 동그라미). 중간은 왼쪽에 오늘 날짜를 크게. 서울 기준 */
const CalendarWidget = ({ size }: { size: WidgetSize }) => {
	const today = seoulDate(useNow(60_000));
	const weeks = monthGrid(today.year, today.month);
	return (
		<div className="widget-calendar-body">
			{size === 'medium' && (
				<div className="widget-calendar-today">
					<p className="widget-calendar-weekday">{WEEKDAYS[today.weekday]}요일</p>
					<p className="widget-calendar-day">{today.day}</p>
				</div>
			)}
			<div className="widget-calendar-month">
				<p className="widget-calendar-title">{today.month}월</p>
				<table aria-label={`${today.year}년 ${today.month}월`}>
					<thead>
						<tr>
							{WEEKDAYS.map((name) => (
								<th key={name} scope="col">
									{name}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{weeks.map((week, index) => (
							<tr key={index}>
								{week.map((day, column) => (
									<td key={column} aria-current={day === today.day ? 'date' : undefined}>
										{day && <span>{day}</span>}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default CalendarWidget;
