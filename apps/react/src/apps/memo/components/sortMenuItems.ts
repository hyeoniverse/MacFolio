import type { MenuItem } from '@/shared/ui/menu/Menu';
import {
	DEFAULT_ORDER,
	ORDER_LABELS,
	type Arrangement,
	type SortKey,
	type SortOrder,
} from '@macfolio/desktop-core/memo';

/** 정렬과 그룹화 메뉴 항목 (정렬 단추와, 검색 중 도구를 모은 ••• 메뉴가 함께 쓴다) */
export function sortMenuItems(arrangement: Arrangement, onChange: (arrangement: Arrangement) => void): MenuItem[] {
	const { sort, order, groupByDate } = arrangement;
	// 정렬 기준을 바꾸면 그 기준의 기본 순서로 (날짜는 최신 순, 제목은 가나다 순)
	const sortItem = (key: SortKey, label: string) => ({
		label,
		checked: sort === key,
		onSelect: () => onChange({ ...arrangement, sort: key, order: sort === key ? order : DEFAULT_ORDER[key] }),
	});
	const orderItem = (value: SortOrder) => ({
		label: ORDER_LABELS[sort][value],
		checked: order === value,
		onSelect: () => onChange({ ...arrangement, order: value }),
	});
	return [
		{ heading: '정렬 기준' },
		sortItem('date', '날짜'),
		sortItem('title', '제목'),
		'separator',
		{ heading: '순서' },
		orderItem(sort === 'date' ? 'desc' : 'asc'),
		orderItem(sort === 'date' ? 'asc' : 'desc'),
		'separator',
		{
			label: '날짜별로 그룹화',
			checked: groupByDate && sort === 'date',
			disabled: sort !== 'date',
			hint: sort === 'date' ? undefined : '날짜로 정렬할 때만 묶을 수 있습니다',
			onSelect: () => onChange({ ...arrangement, groupByDate: !groupByDate }),
		},
	];
}
