import { Fragment, useId, useState } from 'react';
import type { Post, Series } from '@macfolio/desktop-core/memo';
import './SeriesBox.css';

/** 목록을 다 펼치지 않고 보일 편 수. 이보다 길면 아래에 '더보기' */
const PREVIEW = 5;

/** 제목 바로 위의 연재 표시: '트래픽 분석 3' (번호는 연재 안의 위치, 아이콘은 화면 낭독기에 '연재'로 읽힌다) */
export const SeriesKicker = ({ series }: { series: Series }) => (
	<p className="memo-series-kicker">
		<i className="fa-solid fa-layer-group" role="img" aria-label="연재" /> {series.name} {series.index + 1}
	</p>
);

/** 연재 안의 위치와 글 */
type Entry = { item: Post; at: number };

/**
 * 줄인 목록에 보일 편: 지금 글이 앞 PREVIEW편 안이면 앞 PREVIEW편.
 * 그보다 뒤면 이전 편과 지금 글, 그리고 남는 칸만큼 1편부터 순서대로. 한 편만 빠지는 자리는 그 편도 보인다
 */
function shownPosts(total: number, index: number): boolean[] {
	if (index < PREVIEW) return Array.from({ length: total }, (_, at) => at < PREVIEW);
	const head = PREVIEW - 2;
	const shown = Array.from({ length: total }, (_, at) => at < head || at === index - 1 || at === index);
	return shown.map((on, at) => on || (shown[at - 1] === true && shown[at + 1] === true));
}

/** 이어진 편끼리 묶는다: 보이는 묶음과 접어 둔 묶음이 번갈아 온다 */
function runs(posts: Post[], shown: boolean[]): { shown: boolean; entries: Entry[] }[] {
	const result: { shown: boolean; entries: Entry[] }[] = [];
	posts.forEach((item, at) => {
		const last = result.at(-1);
		if (last?.shown === shown[at]) last.entries.push({ item, at });
		else result.push({ shown: shown[at], entries: [{ item, at }] });
	});
	return result;
}

/**
 * 글 제목 아래의 연재 블록: 머리 줄(연재 이름·순서)과 그 아래 목록.
 * 목록은 목차와 같은 모양(왼쪽 세로선, 지금 글은 강조색 막대)이고 연재 순서대로 늘어놓는다.
 * 길면 앞 PREVIEW편만, 지금 글이 그보다 뒤면 '1, 2, 3 ⋯ 이전 편·지금 글'처럼 보이고(사이는 '⋯'),
 * 목록 아래 한 자리의 단추가 '⌄ N편 더보기'와 '⌃ 접기'를 오가며 접어 둔 편을 그 자리에서 아코디언처럼 펼치고 접는다.
 * 맨 아래에 이전 편·다음 편 (그 편의 제목과 함께)
 */
const SeriesBox = ({ series, onOpen }: { series: Series; compact?: boolean; onOpen: (post: Post) => void }) => {
	const [all, setAll] = useState(false);
	const listId = useId();
	const { name, posts, index } = series;
	const previous = posts[index - 1] ?? null;
	const next = posts[index + 1] ?? null;
	const shown = shownPosts(posts.length, index);
	const hidden = shown.filter((on) => !on).length;
	const groups = runs(posts, shown);
	const row = ({ item, at }: Entry) => (
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
			<p className="memo-series-head">
				<i className="fa-solid fa-layer-group memo-series-icon" aria-hidden="true" />
				<strong>{name}</strong>
				<span className="memo-series-count">
					{index + 1} / {posts.length}
				</span>
			</p>
			<div id={listId} className="memo-series-track">
				{groups.map((group, order) =>
					group.shown ? (
						<ol key={group.entries[0].at} className="memo-series-list">
							{group.entries.map(row)}
						</ol>
					) : (
						<Fragment key={group.entries[0].at}>
							{/* 사이에 접어 둔 자리의 '⋯' (펼치면 접혀 사라진다). 맨 끝 묶음은 아래 더보기 단추가 그 자리 */}
							{order < groups.length - 1 && (
								<div className="memo-series-collapse" data-open={!all} aria-hidden="true">
									<div className="memo-series-collapse-inner">
										<span className="memo-series-gap">
											<i className="fa-solid fa-ellipsis" />
										</span>
									</div>
								</div>
							)}
							{/* 접어 둔 편: 높이가 grid-template-rows 0fr ↔ 1fr로 늘고 줄며 그 자리에서 펼쳐지고 접힌다 (목차와 같은 방식) */}
							<div className="memo-series-collapse" data-open={all}>
								<div className="memo-series-collapse-inner">
									<ol className="memo-series-list">{group.entries.map(row)}</ol>
								</div>
							</div>
						</Fragment>
					)
				)}
				{hidden > 0 && (
					<button
						type="button"
						className="memo-series-more"
						aria-expanded={all}
						aria-controls={listId}
						onClick={() => setAll(!all)}
					>
						<i className={`fa-solid ${all ? 'fa-chevron-up' : 'fa-chevron-down'}`} aria-hidden="true" />
						{all ? '접기' : `${hidden}편 더보기`}
					</button>
				)}
			</div>
			{/* 이전 편·다음 편 */}
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
