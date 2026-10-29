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

/**
 * 줄인 목록에서 접어 둘 편: 최신 PREVIEW편과 지금 글은 보이고(지금 글이 그보다 앞이면 최신 PREVIEW - 1편),
 * 나머지는 접는다. 한 편만 접히는 자리는 접지 않고 그 편을 보인다
 */
function foldedPosts(total: number, index: number): boolean[] {
	const latest = total - PREVIEW;
	const folded = Array.from({ length: total }, (_, at) => at !== index && at < (index < latest ? latest + 1 : latest));
	return folded.map((fold, at) => fold && (folded[at - 1] || folded[at + 1]));
}

/**
 * 글 제목 아래의 연재 블록: 머리 줄(연재 이름·순서)을 누르면 목록을 접고 펼친다 (펼친 채 시작).
 * 목록은 목차와 같은 모양(왼쪽 세로선, 지금 글은 강조색 막대)이고, 길면 최신 편들과 지금 글만 보이며
 * 머리 줄 오른쪽의 단추 하나가 'N편 더보기'와 '접기'를 오가며,
 * 접힌 편은 그 자리에서 높이가 늘고 줄어든다.
 * 맨 아래에 이전 편·다음 편 (그 편의 제목과 함께, 목록을 접어도 남는다)
 */
const SeriesBox = ({ series, onOpen }: { series: Series; compact?: boolean; onOpen: (post: Post) => void }) => {
	const [open, setOpen] = useState(true);
	const [all, setAll] = useState(false);
	const listId = useId();
	const { name, posts, index } = series;
	const previous = posts[index - 1] ?? null;
	const next = posts[index + 1] ?? null;
	const folded = foldedPosts(posts.length, index);
	const hidden = folded.filter(Boolean).length;
	return (
		<nav className="memo-series" aria-label={`연재: ${name}`}>
			<div className="memo-series-head">
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
				{/* 더보기·접기: 머리 줄 오른쪽 한 자리 (목록이 늘고 줄어도 움직이지 않는다). 블록을 접으면 감춘다 */}
				{open && hidden > 0 && (
					<button
						type="button"
						className="memo-series-more"
						aria-expanded={all}
						aria-controls={listId}
						onClick={() => setAll(!all)}
					>
						{all ? '접기' : `${hidden}편 더보기`}
					</button>
				)}
			</div>
			{/* 접고 펼칠 때 높이가 grid-template-rows 0fr ↔ 1fr로 늘고 줄어든다 (목차와 같은 방식) */}
			<div className="memo-series-collapse" data-open={open}>
				<div id={listId} className="memo-series-collapse-inner">
					<div className="memo-series-track">
						<ol className="memo-series-list">
							{posts.map((item, at) => (
								<li key={item.slug} className="memo-series-fold" data-folded={folded[at] && !all}>
									<div>
										<button
											type="button"
											aria-current={at === index ? 'page' : undefined}
											onClick={() => at !== index && onOpen(item)}
										>
											<span className="memo-series-number">{at + 1}</span>
											<span className="memo-series-title">{item.title}</span>
										</button>
									</div>
								</li>
							))}
						</ol>
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
