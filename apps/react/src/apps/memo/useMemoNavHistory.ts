import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
	ALL_CATEGORY,
	folderLabelOf,
	folderName,
	TAG_VIEW,
	type Post,
	type TagSelection,
} from '@macfolio/desktop-core/memo';
import { readJson, STORAGE_KEYS, writeJson } from '@/shared/lib/storage';
import {
	parseNavHistory,
	pruneNavHistory,
	rememberScroll,
	sameEntry,
	serializeNavHistory,
	stepList,
	stepTarget,
	visit,
	type NavEntry,
	type NavHistory,
} from './navHistory';

/** 폴더 경로를 사이드바처럼 "개발 기록 › MacFolio › 기능"으로. 모든 글·태그·인기글 같은 보기는 그 이름으로 */
const pathLabel = (path: string) => (path.startsWith('\u0000') ? folderName(path) : folderLabelOf(path));

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
 * 지운 글처럼 지금 없는 글의 칸은 건너뛴다. 기록 규칙은 navHistory.ts.
 * 칸을 떠날 때 본문의 스크롤 위치를 그 칸에 적어 두고, 뒤로·앞으로 돌아오면 그 위치를 restoreScroll에 넘긴다
 */
export function useMemoNavHistory({
	category,
	tagSelection,
	slug,
	posts,
	folders,
	ready,
	open,
	scrollRef,
	restoreScroll,
}: {
	category: string;
	tagSelection: TagSelection;
	/** 지금 본문에 연 글 */
	slug: string | null;
	/** 지금 있는 글, 정리 내용을 적용한 것 (제목·폴더를 찾고, 지운 글을 거른다) */
	posts: Post[];
	/** 지금 있는 폴더 경로 (없어진 폴더의 칸을 거른다) */
	folders: readonly string[];
	/** 글을 다 불러왔는지. 불러오기 전에는 기록을 쌓거나 거르지 않는다 (처음 화면의 빈 칸이 저장한 앞쪽 칸을 지우지 않게) */
	ready: boolean;
	/** 기록의 한 칸을 연다 */
	open: (entry: { category: string; tagSelection: TagSelection | null; slug: string | null }) => void;
	/** 본문 스크롤 영역 (떠날 때의 위치를 적는다) */
	scrollRef: RefObject<HTMLElement | null>;
	/** 뒤로·앞으로로 다른 글을 열 때, 그 글을 그릴 다음에 맞출 스크롤 위치 */
	restoreScroll: (top: number) => void;
}) {
	// 새로 고쳐도 남게 이 탭의 sessionStorage에서 읽는다 (탭마다 따로, 탭을 닫으면 사라진다: 브라우저 기록과 같은 범위)
	const [history, setHistory] = useState<NavHistory>(() =>
		parseNavHistory(readJson(STORAGE_KEYS.memoHistory, 'session'))
	);
	/** 뒤로·앞으로로 연 동안에는 기록을 쌓지 않는다 (지금 칸만 옮긴다) */
	const stepping = useRef(false);
	const tags = category === TAG_VIEW ? JSON.stringify(tagSelection) : '';

	// 본문의 마지막 스크롤 위치. 다른 글을 열면 본문이 맨 위로 가므로, 그 전에 본 위치를 떠나는 칸에 적으려고 따로 둔다
	// (본문 영역은 글을 고를 때 생기고 바뀔 수 있어, 문서에서 스크롤 이벤트를 받아 그 영역의 것만 본다)
	const lastScroll = useRef(0);
	useEffect(() => {
		const onScroll = (event: Event) => {
			const scroller = scrollRef.current;
			if (scroller && event.target === scroller) lastScroll.current = scroller.scrollTop;
		};
		document.addEventListener('scroll', onScroll, { capture: true, passive: true });
		return () => document.removeEventListener('scroll', onScroll, { capture: true });
	}, [scrollRef]);

	const bySlug = useMemo(() => new Map(posts.map((post) => [post.slug as string, post])), [posts]);
	const folderSet = useMemo(() => new Set(folders), [folders]);
	/** 지금 갈 수 있는 칸: 있는 글(지운 글·볼 수 없는 비밀 글은 목록에 없다), 있는 폴더나 보기 */
	const usable = useCallback(
		(entry: NavEntry) =>
			entry.slug !== null
				? bySlug.has(entry.slug)
				: entry.category === ALL_CATEGORY || entry.category.startsWith('\u0000') || folderSet.has(entry.category),
		[bySlug, folderSet]
	);

	// 글을 다 불러온 시각에 한 번: 저장해 둔 기록에서 갈 수 없게 된 칸을 빼고 지금 칸을 맞춘다 (아래 쌓기보다 먼저)
	const pruned = useRef(false);
	useEffect(() => {
		if (!ready || pruned.current) return;
		pruned.current = true;
		setHistory((current) => pruneNavHistory(current, usable));
	}, [ready, usable]);

	useEffect(() => {
		if (!ready) return;
		if (stepping.current) {
			stepping.current = false;
			return;
		}
		setHistory((current) => visit(rememberScroll(current, lastScroll.current), { category, tags, slug }));
	}, [ready, category, tags, slug]);

	useEffect(() => {
		writeJson(STORAGE_KEYS.memoHistory, serializeNavHistory(history), 'session');
	}, [history]);

	const go = useCallback(
		(index: number) => {
			const entry = history.entries[index];
			if (!entry || index === history.index) return;
			// 지금 보이는 칸과 같으면 화면이 바뀌지 않아 기록 effect가 돌지 않는다. 그때는 표시만 옮긴다
			stepping.current = !sameEntry(entry, { category, tags, slug });
			setHistory((current) => ({ ...rememberScroll(current, lastScroll.current), index }));
			// 다른 글이면 그 글을 떠날 때의 위치에서 시작한다 (같은 글이면 본문이 바뀌지 않으니 그대로 둔다)
			if (entry.slug && entry.slug !== slug) restoreScroll(entry.scroll ?? 0);
			open({
				category: entry.category,
				tagSelection: entry.tags ? (JSON.parse(entry.tags) as TagSelection) : null,
				slug: entry.slug,
			});
		},
		[history, open, category, tags, slug, restoreScroll]
	);

	const back = stepTarget(history, -1, usable);
	const forward = stepTarget(history, 1, usable);
	const steps = (direction: -1 | 1): NavStep[] =>
		stepList(history, direction, usable).map(({ index, entry }) => {
			const post = entry.slug ? bySlug.get(entry.slug) : undefined;
			// 글은 그 글이 들어 있는 폴더(정리 내용으로 옮겼으면 옮긴 폴더), 글 없는 칸은 그때 연 폴더·보기를 사이드바처럼 적는다
			return post
				? { index, label: post.title, detail: pathLabel(post.category), post: true }
				: { index, label: folderName(entry.category), detail: pathLabel(entry.category), post: false };
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
