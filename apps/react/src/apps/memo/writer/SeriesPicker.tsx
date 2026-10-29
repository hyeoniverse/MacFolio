import { useCallback, useState } from 'react';
import Menu from '@/shared/ui/menu/Menu';
import { POST_LIMITS } from '@macfolio/desktop-core/memo';

/**
 * 편집 화면의 연재 고르기 (날짜·폴더 옆): 누르면 연재 없음 / 글에 쓰인 연재 이름 / 새 연재… 메뉴.
 * '새 연재…'는 그 자리에 이름 칸을 열어 Enter로 정하고 Esc로 그만둔다.
 * 연재를 고르면 옆에 순서 번호 칸이 생긴다 (비우면 순서를 적은 글 뒤에 날짜 순)
 */
const SeriesPicker = ({
	value,
	order,
	names,
	onChange,
	onOrderChange,
}: {
	/** 지금 연재 이름. 연재가 아니면 undefined */
	value: string | undefined;
	order: number | undefined;
	/** 고를 수 있는 연재 이름 (series.ts의 seriesNames) */
	names: string[];
	onChange: (value: string | undefined) => void;
	onOrderChange: (order: number | undefined) => void;
}) => {
	const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
	const [naming, setNaming] = useState(false);
	const [name, setName] = useState('');
	const close = useCallback(() => setAnchor(null), []);
	const options = value && !names.includes(value) ? [value, ...names] : names;

	const submit = () => {
		setNaming(false);
		if (name.trim()) onChange(name.trim());
	};

	// 앞의 가운뎃점·이름·순서 칸을 한 덩어리로 (좁은 칸에서 줄을 바꿔도 순서 칸만 떨어지지 않게)
	return (
		<span className="memo-series-pick">
			<span aria-hidden="true">·</span>
			{naming ? (
				<input
					className="memo-meta-input"
					aria-label="새 연재 이름"
					placeholder="새 연재 이름"
					maxLength={POST_LIMITS.series}
					value={name}
					autoFocus
					onChange={(event) => setName(event.target.value)}
					onKeyDown={(event) => {
						if (event.nativeEvent.isComposing) return;
						if (event.key === 'Enter') submit();
						if (event.key === 'Escape') setNaming(false);
					}}
					onBlur={submit}
				/>
			) : (
				<button
					type="button"
					className="memo-meta-button"
					aria-label={value ? `연재 ${value}, 바꾸기` : '연재 없음, 바꾸기'}
					aria-haspopup="menu"
					aria-expanded={anchor !== null}
					onPointerDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						if (anchor) return close();
						const rect = event.currentTarget.getBoundingClientRect();
						setAnchor({ x: rect.left, y: rect.bottom + 6 });
					}}
				>
					{value ? `연재 · ${value}` : '연재 없음'}
				</button>
			)}
			{value && !naming && (
				<input
					className="memo-meta-input memo-series-order"
					type="number"
					inputMode="numeric"
					aria-label="연재 순서"
					title="연재 안의 순서. 비우면 순서를 적은 글 뒤에 날짜 순으로 둡니다"
					placeholder="순서"
					min={1}
					max={POST_LIMITS.seriesOrder}
					value={order ?? ''}
					onChange={(event) => {
						const next = event.target.valueAsNumber;
						onOrderChange(Number.isNaN(next) ? undefined : next);
					}}
				/>
			)}
			{anchor && (
				<Menu
					label="연재 고르기"
					anchor={anchor}
					onClose={close}
					items={[
						{ label: '연재 없음', checked: !value, onSelect: () => onChange(undefined) },
						...(options.length > 0 ? ['separator' as const] : []),
						...options.map((option) => ({
							label: option,
							checked: option === value,
							onSelect: () => onChange(option),
						})),
						'separator',
						{
							label: '새 연재…',
							icon: 'fa-solid fa-plus',
							onSelect: () => {
								setName('');
								setNaming(true);
							},
						},
					]}
				/>
			)}
		</span>
	);
};

export default SeriesPicker;
