import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { folderName, TAG_VIEW, type Post, type TagSelection } from '@macfolio/desktop-core/memo';
import {
	EMPTY_NAV_HISTORY,
	sameEntry,
	stepList,
	stepTarget,
	visit,
	type NavEntry,
	type NavHistory,
} from './navHistory';

/** 기록 목록의 한 줄 (메뉴 항목) */
export interface NavStep {
	index: number;
	label: string;
	detail: string;
	/** 글이면 true, 글 없는 폴더·보기면 false */
	post: boolean;
}

/**
 * 메모의 뒤로·앞으로 (Finder·Safari의 ‹ ›). 연 폴더와 본 글이 바뀔 때마다 기록에 쌓고,
 * 뒤로·앞으로 가면 그 폴더와 글을 다시 연다 (검색어와 조건은 비운다: 그 글이 목록에 보이게).
 * 지운 글처럼 지금 없는 글의 칸은 건너뛴다. 기록 규칙은 navHistory.ts
 */
export function useMemoNavHistory({
	category,
	tagSelection,
	slug,
	posts,
	open,
}: {
	category: string;
	tagSelection: TagSelection;
	/** 지금 본문에 연 글 */
	slug: string | null;
	/** 지금 있는 글 (제목을 찾고, 지운 글을 거른다) */
	posts: Post[];
	/** 기록의 한 칸을 연다 */
	open: (entry: { category: string; tagSelection: TagSelection | null; slug: string | null }) => void;
}) {
	const [history, setHistory] = useState<NavHistory>(EMPTY_NAV_HISTORY);
	/** 뒤로·앞으로로 연 동안에는 기록을 쌓지 않는다 (지금 칸만 옮긴다) */
	const stepping = useRef(false);
	const tags = category === TAG_VIEW ? JSON.stringify(tagSelection) : '';

	useEffect(() => {
		if (stepping.current) {
			stepping.current = false;
			return;
		}
		setHistory((current) => visit(current, { category, tags, slug }));
	}, [category, tags, slug]);

	const bySlug = useMemo(() => new Map(posts.map((post) => [post.slug as string, post])), [posts]);
	const usable = useCallback((entry: NavEntry) => entry.slug === null || bySlug.has(entry.slug), [bySlug]);

	const go = useCallback(
		(index: number) => {
			const entry = history.entries[index];
			if (!entry || index === history.index) return;
			// 지금 보이는 칸과 같으면 화면이 바뀌지 않아 기록 effect가 돌지 않는다. 그때는 표시만 옮긴다
			stepping.current = !sameEntry(entry, { category, tags, slug });
			setHistory((current) => ({ ...current, index }));
			open({
				category: entry.category,
				tagSelection: entry.tags ? (JSON.parse(entry.tags) as TagSelection) : null,
				slug: entry.slug,
			});
		},
		[history, open, category, tags, slug]
	);

	const back = stepTarget(history, -1, usable);
	const forward = stepTarget(history, 1, usable);
	const steps = (direction: -1 | 1): NavStep[] =>
		stepList(history, direction, usable).map(({ index, entry }) => {
			const post = entry.slug ? bySlug.get(entry.slug) : undefined;
			const where = entry.category === TAG_VIEW ? '태그' : folderName(entry.category);
			return post
				? { index, label: post.title, detail: where, post: true }
				: { index, label: where, detail: '', post: false };
		});

	return {
		canBack: back !== null,
		canForward: forward !== null,
		goBack: () => back !== null && go(back),
		goForward: () => forward !== null && go(forward),
		go,
		backSteps: () => steps(-1),
		forwardSteps: () => steps(1),
	};
}
