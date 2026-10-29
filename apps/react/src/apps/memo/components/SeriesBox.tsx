import { useId, useState } from 'react';
import type { Post, Series } from '@macfolio/desktop-core/memo';
import './SeriesBox.css';

/** 목록을 다 펼치지 않고 보일 편 수 (최신 편들과 지금 글). 이보다 길면 '더보기' */
const PREVIEW = 5;

/** 제목 바로 위의 연재 표시: '트래픽 분석 3' (번호는 연재 안의 위치, 아이콘은 화면 낭독기에 '연재'로 읽힌다) */
export const SeriesKicker = ({ series }: { series: Series }) => (
	<p className="memo-series-kicker">
		<i className="fa-solid fa-layer-group" role="img" aria-label="연재" /> {series.name} {series.index + 1}
	</p>
);

/** 목록의 한 줄: 연재 글(위치 at) 또는 at부터 생략한 글 수 */
type Row = { at: number; hidden?: number };

/**
 * 목록의 줄: 접은 목록은 최신 PREVIEW편, 지금 글이 그보다 앞이면 지금 글과 최신 PREVIEW - 1편.
 * 사이에 생략한 글은 '⋯ N편 더보기' 줄 하나로 (한 편뿐이면 줄 대신 그 편을 보인다)
 */
function seriesRows(total: number, index: number, all: boolean): Row[] {
	const latest = total - PREVIEW;
	const shown = (at: number) => all || at === index || at >= (index < latest ? latest + 1 : latest);
	const rows: Row[] = [];
	for (let at = 0; at < total; at++) {
		const last = rows.at(-1);
		if (shown(at)) rows.push({ at });
		else if (last?.hidden) last.hidden++;
		else rows.push({ at, hidden: 1 });
	}
	return rows.map((row) => (row.hidden === 1 ? { at: row.at } : row));
}

/**
 * 글 제목 아래의 연재 블록: 머리 줄(연재 이름·순서)을 누르면 목록을 접고 펼친다 (펼친 채 시작).
 * 목록은 목차와 같은 모양(왼쪽 세로선, 지금 글은 강조색 막대)이고, 길면 최신 편들과 지금 글만 보이며
 * 생략한 자리에 '⋯ N편 더보기' 줄을 두어 누르면 모두 보이고, 모두 보일 때는 맨 아래 '접기'로 되돌린다.
 * 맨 아래에 이전 편·다음 편 (그 편의 제목과 함께, 목록을 접어도 남는다)
 */
const SeriesBox = ({ series, onOpen }: { series: Series; compact?: boolean; onOpen: (post: Post) => void }) => {
	const [open, setOpen] = useState(true);
	const [all, setAll] = useState(false);
	const listId = useId();
	const { name, posts, index } = series;
	const previous = posts[index - 1] ?? null;
	const next = posts[index + 1] ?? null;
	const rows = seriesRows(posts.length, index, all);
	return (
		<nav className="memo-series" aria-label={`연재: ${name}`}>
			<button
				type="button"
				className="memo-series-toggle"
				aria-expanded={open}
				aria-controls={listId}
				onClick={() => setOpen(!open)}
			>
				<i className="fa-solid fa-layer-group memo-series-icon" aria-hidden="true" />
				<strong>{name}</strong>
				<span className="memo-series-count">
					{index + 1} / {posts.length}
				</span>
				<i className="fa-solid fa-chevron-down memo-series-chevron" aria-hidden="true" />
			</button>
			{/* 접고 펼칠 때 높이가 grid-template-rows 0fr ↔ 1fr로 늘고 줄어든다 (목차와 같은 방식) */}
			<div className="memo-series-collapse" data-open={open}>
				<div id={listId} className="memo-series-collapse-inner">
					<div className="memo-series-track">
						<ol className="memo-series-list">
							{rows.map((row) =>
								row.hidden ? (
									// 생략한 자리: 목록 항목이 아닌 단추 한 줄 (항목 수에 넣지 않는다)
									<li key={`hidden-${row.at}`} role="none">
										<button type="button" className="memo-series-more" onClick={() => setAll(true)}>
											<i className="fa-solid fa-ellipsis" aria-hidden="true" />
											{row.hidden}편 더보기
										</button>
									</li>
								) : (
									<li key={posts[row.at].slug}>
										<button
											type="button"
											aria-current={row.at === index ? 'page' : undefined}
											onClick={() => row.at !== index && onOpen(posts[row.at])}
										>
											<span className="memo-series-number">{row.at + 1}</span>
											<span className="memo-series-title">{posts[row.at].title}</span>
										</button>
									</li>
								)
							)}
						</ol>
						{all && posts.length > PREVIEW && (
							<button type="button" className="memo-series-more" onClick={() => setAll(false)}>
								<i className="fa-solid fa-chevron-up" aria-hidden="true" />
								접기
							</button>
						)}
					</div>
				</div>
			</div>
			{/* 접어도 이전 편·다음 편은 남는다 */}
			{(previous || next) && (
				<div className="memo-series-steps">
					{previous ? (
						<button type="button" className="previous" onClick={() => onOpen(previous)}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" />
							<span className="memo-series-step-text">
								<span>이전 편</span>
								<strong>{previous.title}</strong>
							</span>
						</button>
					) : (
						<span />
					)}
					{next && (
						<button type="button" className="next" onClick={() => onOpen(next)}>
							<span className="memo-series-step-text">
								<span>다음 편</span>
								<strong>{next.title}</strong>
							</span>
							<i className="fa-solid fa-chevron-right" aria-hidden="true" />
						</button>
					)}
				</div>
			)}
		</nav>
	);
};

export default SeriesBox;
