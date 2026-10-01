import React, { useCallback, useEffect, useRef, useState } from 'react';
import Menu from '@/shared/ui/menu/Menu';
import {
	DEFAULT_FIND_OPTIONS,
	findInBlocks,
	loadRecentFinds,
	rememberFind,
	saveRecentFinds,
	stepMatch,
	type FindMode,
	type FindOptions,
} from '../find';
import { useEditorControls } from '../writer/editorControls';

/** 읽기 화면에서 찾을 곳: 글 제목과 본문 (댓글·단추 글자는 뺀다) */
const READER_TARGETS = '.memo-reader-body > h1, .memo-reader-body > .memo-markdown';
/** 한 덩어리로 보는 요소 (덩어리를 넘는 자리는 찾지 않는다) */
const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, td, th, pre, figcaption, .memo-caption, blockquote';

interface Segment {
	node: Text;
	/** 덩어리 글에서 이 글자 조각이 시작하는 자리 */
	start: number;
}

/** 읽기 화면의 글을 덩어리별로 모은다 (찾은 자리를 DOM 범위로 되돌리려고 글자 조각의 자리를 기억한다) */
function readerBlocks(root: HTMLElement) {
	const texts: string[] = [];
	const segments: Segment[][] = [];
	let current: Element | null = null;
	for (const target of root.querySelectorAll(READER_TARGETS)) {
		const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) =>
				node.parentElement?.closest('button, .memo-code-copy') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
		});
		for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
			const block = node.parentElement?.closest(BLOCKS) ?? target;
			if (block !== current) {
				current = block;
				texts.push('');
				segments.push([]);
			}
			const last = texts.length - 1;
			segments[last].push({ node, start: texts[last].length });
			texts[last] += node.data;
		}
	}
	return { texts, segments };
}

/** 덩어리 글의 자리 → DOM 범위 */
function toRange(segments: Segment[], start: number, end: number) {
	const at = (offset: number, isEnd: boolean) => {
		let segment = segments[0];
		for (const item of segments) if (isEnd ? item.start < offset : item.start <= offset) segment = item;
		return { node: segment.node, offset: Math.min(offset - segment.start, segment.node.data.length) };
	};
	const from = at(start, false);
	const to = at(end, true);
	const range = document.createRange();
	range.setStart(from.node, from.offset);
	range.setEnd(to.node, to.offset);
	return range;
}

/** CSS 강조(Custom Highlight API)가 있는 브라우저에서만 칠한다 */
const highlights = () =>
	typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined' ? CSS.highlights : null;

const clearHighlights = () => {
	highlights()?.delete('memo-find');
	highlights()?.delete('memo-find-current');
};

/**
 * 글 안에서 찾기 (macOS 메모의 찾기 막대: ⌘F). 옵션(대/소문자, 순환, 포함·시작·전체 단어), 최근 검색.
 * 관리자 편집기에서는 대치도 한다. 읽기 화면에서는 찾은 자리를 CSS 강조로 칠한다.
 */
const FindBar = ({
	editing,
	readerRoot,
	onClose,
}: {
	/** 편집기(관리자)면 편집기에서 찾고 대치할 수 있다 */
	editing: boolean;
	/** 읽기 화면 (방문자) */
	readerRoot: React.RefObject<HTMLElement | null>;
	onClose: () => void;
}) => {
	const { run, find: editorResult } = useEditorControls();
	const [query, setQuery] = useState('');
	const [options, setOptions] = useState<FindOptions>(DEFAULT_FIND_OPTIONS);
	const [replacing, setReplacing] = useState(false);
	const [replacement, setReplacement] = useState('');
	const [recent, setRecent] = useState(loadRecentFinds);
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	/** 읽기 화면에서 찾은 결과 */
	const [readerResult, setReaderResult] = useState({ count: 0, index: -1 });
	const input = useRef<HTMLInputElement>(null);

	const useEditor = editing && run !== null;
	const result = useEditor ? (editorResult ?? { count: 0, index: -1 }) : readerResult;

	/** 읽기 화면에서 찾고 칠한다 */
	const findInReader = (nextQuery: string, nextOptions: FindOptions, index: number) => {
		const root = readerRoot.current;
		if (!root) return;
		const { texts, segments } = readerBlocks(root);
		const ranges = findInBlocks(texts, nextQuery, nextOptions).map(([block, start, end]) =>
			toRange(segments[block], start, end)
		);
		const current = ranges.length ? Math.min(index, ranges.length - 1) : -1;
		setReaderResult({ count: ranges.length, index: current });
		const registry = highlights();
		if (registry) {
			registry.set('memo-find', new Highlight(...ranges.filter((_, i) => i !== current)));
			registry.set('memo-find-current', new Highlight(...(current >= 0 ? [ranges[current]] : [])));
		}
		if (current >= 0) ranges[current].startContainer.parentElement?.scrollIntoView({ block: 'center' });
	};

	/** 찾기 (index: 몇 번째를 고를지) */
	const search = (nextQuery: string, nextOptions: FindOptions, index: number) => {
		if (useEditor) run({ type: 'find', query: nextQuery, options: nextOptions, index });
		else findInReader(nextQuery, nextOptions, index);
	};

	const step = (direction: 1 | -1) => {
		if (!query) return;
		search(query, options, stepMatch(result.index, result.count, direction, options.wrap));
		setRecent((list) => rememberFind(list, query));
	};

	const close = useCallback(() => {
		clearHighlights();
		if (run) run({ type: 'findClear' });
		onClose();
	}, [run, onClose]);

	// 닫히면(다른 글로 옮겨 가는 등) 칠한 것을 지운다
	useEffect(() => () => clearHighlights(), []);

	const setOption = (patch: Partial<FindOptions>) => {
		const next = { ...options, ...patch };
		setOptions(next);
		search(query, next, 0);
	};

	const modes: { mode: FindMode; label: string }[] = [
		{ mode: 'contains', label: '다음을 포함' },
		{ mode: 'startsWith', label: '다음으로 시작' },
		{ mode: 'wholeWord', label: '전체 단어' },
	];

	return (
		<div className="memo-find" role="search" aria-label="메모에서 찾기">
			<div className="memo-find-row">
				<div className="memo-find-field">
					<button
						type="button"
						className="memo-find-options"
						aria-label="찾기 옵션"
						aria-haspopup="menu"
						aria-expanded={menu !== null}
						onClick={(event) => {
							const rect = event.currentTarget.getBoundingClientRect();
							setMenu(menu ? null : { x: rect.left, y: rect.bottom + 6 });
						}}
					>
						<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
						<i className="fa-solid fa-chevron-down" aria-hidden="true" />
					</button>
					<input
						ref={input}
						type="text"
						aria-label="찾기"
						placeholder="찾기"
						value={query}
						autoFocus
						onChange={(event) => {
							setQuery(event.target.value);
							search(event.target.value, options, 0);
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
								event.preventDefault();
								step(event.shiftKey ? -1 : 1);
							} else if (event.key === 'Escape') close();
						}}
					/>
					{query && (
						<span className="memo-find-count" role="status">
							{result.count === 0 ? '없음' : `${result.index + 1}/${result.count}`}
						</span>
					)}
				</div>
				<div className="memo-find-steps" role="group" aria-label="찾은 곳 옮겨 가기">
					<button type="button" aria-label="이전 찾기" disabled={result.count === 0} onClick={() => step(-1)}>
						<i className="fa-solid fa-chevron-left" aria-hidden="true" />
					</button>
					<button type="button" aria-label="다음 찾기" disabled={result.count === 0} onClick={() => step(1)}>
						<i className="fa-solid fa-chevron-right" aria-hidden="true" />
					</button>
				</div>
				<button type="button" className="memo-find-done" onClick={close}>
					완료
				</button>
				{useEditor && (
					<label className="memo-find-replace-toggle">
						<input type="checkbox" checked={replacing} onChange={(event) => setReplacing(event.target.checked)} />
						대치
					</label>
				)}
			</div>
			{useEditor && replacing && (
				<div className="memo-find-row">
					<div className="memo-find-field">
						<input
							type="text"
							aria-label="대치할 글"
							placeholder="대치"
							value={replacement}
							onChange={(event) => setReplacement(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
									event.preventDefault();
									run({ type: 'replace', replacement, all: false });
								} else if (event.key === 'Escape') close();
							}}
						/>
					</div>
					<button
						type="button"
						className="memo-find-done"
						disabled={result.count === 0}
						onClick={() => run({ type: 'replace', replacement, all: true })}
					>
						모두
					</button>
					<button
						type="button"
						className="memo-find-done"
						disabled={result.count === 0}
						onClick={() => run({ type: 'replace', replacement, all: false })}
					>
						대치
					</button>
				</div>
			)}
			{menu && (
				<Menu
					label="찾기 옵션"
					anchor={menu}
					onClose={() => setMenu(null)}
					items={[
						{
							label: '영문 대/소문자 무시',
							checked: options.ignoreCase,
							onSelect: () => setOption({ ignoreCase: !options.ignoreCase }),
						},
						{ label: '순환 검색', checked: options.wrap, onSelect: () => setOption({ wrap: !options.wrap }) },
						'separator',
						...modes.map(({ mode, label }) => ({
							label,
							checked: options.mode === mode,
							onSelect: () => setOption({ mode }),
						})),
						'separator',
						{ heading: '최근 검색' },
						...(recent.length
							? recent.map((word) => ({
									label: word,
									onSelect: () => {
										setQuery(word);
										search(word, options, 0);
									},
								}))
							: [{ label: '없음', disabled: true, onSelect: () => undefined }]),
						'separator',
						{
							label: '최근 검색 지우기',
							disabled: recent.length === 0,
							onSelect: () => {
								saveRecentFinds([]);
								setRecent([]);
							},
						},
					]}
				/>
			)}
		</div>
	);
};

export default FindBar;
