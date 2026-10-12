// 벤토 격자: 항목 수에 맞춰 큰 칸·넓은 칸·작은 칸을 섞는다 (2~8개, 그 이상도 빈 칸 없이: bento.ts)
import React from 'react';
import { cssVars } from '@/shared/lib/cssVars';
import { bentoLayout, type BentoCell } from './bento';
import './landing.css';

export interface BentoGridProps<T> {
	items: T[];
	/** 칸 하나의 내용. cell.size(lg·wide·sm)로 칸 크기에 맞는 꼴을 고른다 */
	render: (item: T, cell: BentoCell, index: number) => React.ReactNode;
	/** 항목의 key (기본: 차례) */
	itemKey?: (item: T, index: number) => string;
	/** 목록 이름 (보조 기술용) */
	label?: string;
	/** 칸을 카드 모양(테두리·바탕·둥근 모서리)으로 감싼다 (기본 켬). 끄면 render가 칸을 다 꾸민다 */
	framed?: boolean;
	className?: string;
}

/** 넓은 창은 6열, 좁으면(컨테이너 640px 아래) 한 열로 쌓는다 */
export function BentoGrid<T>({
	items,
	render,
	itemKey,
	label,
	framed = true,
	className,
}: BentoGridProps<T>): React.ReactElement | null {
	if (items.length === 0) return null;
	const cells = bentoLayout(items.length);
	return (
		<div className={`lk-root lk-bento-wrap${className ? ` ${className}` : ''}`}>
			<ul className="lk-bento" aria-label={label} data-framed={framed ? '' : undefined}>
				{items.map((item, index) => {
					const cell = cells[index];
					return (
						<li
							key={itemKey ? itemKey(item, index) : index}
							className="lk-bento-cell"
							data-size={cell.size}
							style={cssVars({ col: cell.col, row: cell.row })}
						>
							{render(item, cell, index)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
