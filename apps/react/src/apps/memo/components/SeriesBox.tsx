import { useId, useState } from 'react';
import type { Post, Series } from '@macfolio/desktop-core/memo';
import './SeriesBox.css';

/** 목록을 다 펼치지 않고 보일 편 수 (1편부터). 이보다 길면 아래에 '더보기' */
const PREVIEW = 5;

/** 제목 바로 위의 연재 표시: '트래픽 분석 3' (번호는 연재 안의 위치, 아이콘은 화면 낭독기에 '연재'로 읽힌다) */
export const SeriesKicker = ({ series }: { series: Series }) => (
	<p className="memo-series-kicker">
		<i className="fa-solid fa-layer-group" role="img" aria-label="연재" /> {series.name} {series.index + 1}
	</p>
);

/**
 * 글 제목 아래의 연재 블록: 머리 줄(연재 이름·순서)을 누르면 목록을 접고 펼친다 (펼친 채 시작).
 * 목록은 목차와 같은 모양(왼쪽 세로선, 지금 글은 강조색 막대)이고 연재 순서대로 늘어놓는다.
 * 길면 앞의 PREVIEW편만 보이고, 그 아래 한 자리의 단추가 '⋯ N편 더보기'와 '접기'를 오가며 나머지를 아코디언처럼 펼치고 접는다.
 * 맨 아래에 이전 편·다음 편 (그 편의 제목과 함께, 목록을 접어도 남는다)
 */
const SeriesBox = ({ series, onOpen }: { series: Series; compact?: boolean; onOpen: (post: Post) => void }) => {
	const [open, setOpen] = useState(true);
	const [all, setAll] = useState(false);
	const listId = useId();
	const restId = useId();
	const { name, posts, index } = series;
	const previous = posts[index - 1] ?? null;
	const next = posts[index + 1] ?? null;
	const ordered = posts.map((item, at) => ({ item, at }));
	const rest = ordered.slice(PREVIEW);
	const row = ({ item, at }: { item: Post; at: number }) => (
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
	);
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
						<ol className="memo-series-list">{ordered.slice(0, PREVIEW).map(row)}</ol>
						{rest.length > 0 && (
							<>
								{/* 나머지 편: 블록 접기와 같은 방식으로 목록 아래에 펼쳐지고 접힌다 */}
								<div className="memo-series-collapse" data-open={all}>
									<div id={restId} className="memo-series-collapse-inner">
										<ol className="memo-series-list">{rest.map(row)}</ol>
									</div>
								</div>
								<button
									type="button"
									className="memo-series-more"
									aria-expanded={all}
									aria-controls={restId}
									onClick={() => setAll(!all)}
								>
									<i className={`fa-solid ${all ? 'fa-chevron-up' : 'fa-ellipsis'}`} aria-hidden="true" />
									{all ? '접기' : `${rest.length}편 더보기`}
								</button>
							</>
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
