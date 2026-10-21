import type { WidgetSize } from './catalog';
import { monthGrid, seoulDate, WEEKDAYS } from './model';
import { useNow } from './useNow';

/** 오늘 날짜 (작게), 이달 달력 (중간). 서울 기준 */
const CalendarWidget = ({ size }: { size: WidgetSize }) => {
	const today = seoulDate(useNow(60_000));
	const weeks = monthGrid(today.year, today.month);
	return (
		<div className="widget-calendar-body">
			<div className="widget-calendar-today">
				<p className="widget-calendar-weekday">{WEEKDAYS[today.weekday]}요일</p>
				<p className="widget-calendar-day">{today.day}</p>
				<p className="widget-note">{today.month}월</p>
			</div>
			{size === 'medium' && (
				<table className="widget-calendar-month" aria-label={`${today.year}년 ${today.month}월`}>
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
										{day ?? ''}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
};

export default CalendarWidget;
