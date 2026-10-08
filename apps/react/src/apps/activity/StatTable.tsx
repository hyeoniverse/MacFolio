import { useState } from 'react';
import { labelOf, type Breakdown, type Row } from './data';

type SortKey = 'name' | 'value';

/**
 * 활동 상태 보기의 표: 머리를 눌러 정렬하고(다시 누르면 반대로), 행마다 비율 막대를 그린다.
 * metric이 없으면 key를 그대로 이름으로 쓴다 (묶어 보기)
 */
const StatTable = ({
	title,
	rows,
	metric,
	valueLabel = '방문',
	limit,
	empty = '아직 없습니다',
	labelFor,
}: {
	title: string;
	rows: Row[];
	metric?: Breakdown;
	valueLabel?: string;
	limit?: number;
	empty?: string;
	/** 표에 보일 이름을 직접 정한다 (예: 글 주소 → 글 제목). 없으면 metric으로 정한다 */
	labelFor?: (key: string) => string;
}) => {
	const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'value', descending: true });
	const total = rows.reduce((sum, row) => sum + row.value, 0);
	const named = rows.map((row) => ({
		...row,
		name: labelFor ? labelFor(row.key) : metric ? labelOf(metric, row.key) : row.key || '알 수 없음',
	}));
	const sorted = [...named].sort((a, b) => {
		const order = sort.key === 'value' ? a.value - b.value : a.name.localeCompare(b.name, 'ko');
		return sort.descending ? -order : order;
	});
	const shown = limit ? sorted.slice(0, limit) : sorted;

	const header = (key: SortKey, label: string) => (
		<th
			scope="col"
			className={key}
			aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}
		>
			<button
				type="button"
				onClick={() =>
					setSort((current) =>
						current.key === key ? { key, descending: !current.descending } : { key, descending: key === 'value' }
					)
				}
			>
				{label}
				{sort.key === key && (
					<i className={`fa-solid fa-chevron-${sort.descending ? 'down' : 'up'}`} aria-hidden="true" />
				)}
			</button>
		</th>
	);

	return (
		<section className="activity-table">
			<h3>{title}</h3>
			{rows.length === 0 ? (
				<p className="activity-empty">{empty}</p>
			) : (
				<table aria-label={title}>
					<thead>
						<tr>
							{header('name', '이름')}
							{header('value', valueLabel)}
							<th scope="col" className="share">
								비율
							</th>
						</tr>
					</thead>
					{/* 정렬을 바꾸면 줄이 서서히 다시 놓인다 */}
					<tbody key={`${sort.key}-${sort.descending}`} className="motion-swap">
						{shown.map((row) => {
							const share = total ? row.value / total : 0;
							return (
								<tr key={row.key}>
									<td className="name" title={row.name}>
										{row.name}
									</td>
									<td className="value">{row.value.toLocaleString()}</td>
									<td className="share">
										<span className="share-cell">
											<span className="bar" aria-hidden="true">
												<span style={{ width: `${Math.round(share * 100)}%` }} />
											</span>
											{Math.round(share * 100)}%
										</span>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</section>
	);
};

export default StatTable;
