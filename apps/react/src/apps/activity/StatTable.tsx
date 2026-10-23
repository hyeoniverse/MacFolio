import { useState } from 'react';
import { type Breakdown, type Row } from './activityApi';
import { labelOf } from './model';
import EmptyState from '@/shared/ui/empty-state/EmptyState';

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
	note,
	onSelect,
	selected,
}: {
	title: string;
	rows: Row[];
	metric?: Breakdown;
	valueLabel?: string;
	limit?: number;
	empty?: string;
	/** 표에 보일 이름을 직접 정한다 (예: 글 주소 → 글 제목). 없으면 metric으로 정한다 */
	labelFor?: (key: string) => string;
	/** 제목 아래 작은 설명 (예: 언제부터 센 표인지) */
	note?: string;
	/** 있으면 이름을 눌러 줄 하나를 고른다 (다시 누르면 푼다). 고른 줄은 selected */
	onSelect?: (key: string | null) => void;
	selected?: string | null;
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
			{note && <p className="activity-table-note">{note}</p>}
			{rows.length === 0 ? (
				<EmptyState className="activity-empty">{empty}</EmptyState>
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
					{/* 정렬을 바꾸면 줄이 서서히 다시 놓인다. 이름이 버튼인 표는 빼는데, 맥 Safari에서 다시 그린 줄의
					    버튼 글자가 그려지지 않고 사라진다 */}
					<tbody
						key={onSelect ? undefined : `${sort.key}-${sort.descending}`}
						className={onSelect ? undefined : 'motion-swap'}
					>
						{shown.map((row) => {
							const share = total ? row.value / total : 0;
							return (
								<tr key={row.key} className={selected === row.key ? 'selected' : undefined}>
									<td className="name" title={row.name}>
										{onSelect ? (
											<button
												type="button"
												aria-pressed={selected === row.key}
												onClick={() => onSelect(selected === row.key ? null : row.key)}
											>
												{row.name}
											</button>
										) : (
											row.name
										)}
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
