import { useId, useState } from 'react';
import type { Post, Series } from '@macfolio/desktop-core/memo';
import './SeriesBox.css';

/** 제목 위의 작은 머리말: "연재 · 트래픽 분석 3" (번호는 연재 안의 위치) */
export const SeriesKicker = ({ series }: { series: Series }) => (
	<p className="memo-series-kicker">
		연재 · {series.name} {series.index + 1}
	</p>
);

/**
 * 글 제목 아래의 연재 상자: "연재 · 트래픽 분석 3/11"과 접고 펼치는 전체 목록, 이전 편·다음 편.
 * 목록은 넓은 화면에서 펼친 채, 좁은 화면(compact)에서는 접은 채 시작한다
 */
const SeriesBox = ({ series, compact, onOpen }: { series: Series; compact: boolean; onOpen: (post: Post) => void }) => {
	const [open, setOpen] = useState(!compact);
	const listId = useId();
	const { name, posts, index } = series;
	const previous = posts[index - 1] ?? null;
	const next = posts[index + 1] ?? null;
	return (
		<nav className="memo-series" aria-label={`연재: ${name}`}>
			<button
				type="button"
				className="memo-series-toggle"
				aria-expanded={open}
				aria-controls={listId}
				onClick={() => setOpen(!open)}
			>
				<i className="fa-solid fa-layer-group" aria-hidden="true" />
				<span className="memo-series-label">연재</span>
				<strong>{name}</strong>
				<span className="memo-series-count">
					{index + 1}/{posts.length}
				</span>
				<i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} memo-series-chevron`} aria-hidden="true" />
			</button>
			{open && (
				<ol id={listId} className="memo-series-list">
					{posts.map((item, at) => (
						<li key={item.slug}>
							<button
								type="button"
								aria-current={at === index ? 'page' : undefined}
								onClick={() => at !== index && onOpen(item)}
							>
								<span className="memo-series-number">{at + 1}</span>
								<span className="memo-series-title">{item.title}</span>
							</button>
						</li>
					))}
				</ol>
			)}
			{(previous || next) && (
				<div className="memo-series-steps">
					{previous ? (
						<button type="button" onClick={() => onOpen(previous)}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 이전 편
						</button>
					) : (
						<span />
					)}
					{next && (
						<button type="button" onClick={() => onOpen(next)}>
							다음 편 <i className="fa-solid fa-chevron-right" aria-hidden="true" />
						</button>
					)}
				</div>
			)}
		</nav>
	);
};

export default SeriesBox;
