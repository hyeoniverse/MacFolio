import { useEffect, useMemo, useState } from 'react';
import {
	adjacentPosts,
	ALL_CATEGORY,
	buildFolderTree,
	filterPosts,
	folderName,
	recentlyDeletedPosts,
	RECENTLY_DELETED,
	TAG_VIEW,
	type AdminPost,
	type FolderNode,
	type Post,
	type PostFilter,
} from './posts';
import { splitPinned, type Organization } from './organize';
import { collectTags, tagsOf } from './tags';
import { EMPTY_TAG_SELECTION, matchesTags, tagSelectionTitle, type TagSelection } from './tagFilter';
import { loadArrangement, saveArrangement, sortBy, type Arrangement } from './arrange';
import { linkedId, setAppAddress } from '@/shared/lib/appLink';

/**
 * 지금 무엇을 보여 주는지: 폴더(또는 태그·최근 삭제된 항목), 검색어와 검색 조건, 정렬, 고른 글.
 * 이것으로 목록에 보일 글, 고정된 글과 나머지, 본문에 열 글, 그 옆의 이전·다음 글을 정한다.
 * 고른 글의 주소를 주소 막대에 둔다 (shared/lib/appLink.ts)
 */
export function useNoteView({
	organized,
	organization,
	repoPosts,
	adminPosts,
	editing,
	today,
	ready,
}: {
	organized: Post[];
	organization: Organization;
	repoPosts: Post[];
	adminPosts: AdminPost[] | null;
	editing: boolean;
	today: Date;
	/** 글을 다 읽어 왔는지 (그 전에는 주소 막대를 그대로 둔다) */
	ready: boolean;
}) {
	const [category, setCategory] = useState(ALL_CATEGORY);
	const [query, setQuery] = useState('');
	/** 검색 조건 (체크리스트가 있는 메모 등) */
	const [filter, setFilter] = useState<PostFilter | null>(null);
	/** 사이드바에서 고른 태그 (태그마다 미선택 → 포함 → 제외) */
	const [tagSelection, setTagSelection] = useState<TagSelection>(EMPTY_TAG_SELECTION);
	/** 정렬과 날짜별 묶기. 보기 설정이라 방문자도 바꾸고, 이 브라우저에 저장한다 (arrange.ts) */
	const [arrangement, setArrangementState] = useState<Arrangement>(loadArrangement);
	const setArrangement = (next: Arrangement) => {
		setArrangementState(next);
		saveArrangement(next);
	};
	// 글 주소(/memo/<글>)로 들어왔으면 그 글부터
	const [selectedSlug, setSelectedSlug] = useState<string | null>(() => linkedId('memo'));

	const folders = useMemo(
		() => buildFolderTree(organized, organization.folders, organization.order),
		[organized, organization.folders, organization.order]
	);
	// 모든 폴더 경로 (폴더를 옮길 때 하위 폴더까지 3단을 넘지 않는지 잰다)
	const folderPaths = useMemo(() => {
		const paths: string[] = [];
		const walk = (nodes: FolderNode[]) =>
			nodes.forEach((node) => {
				paths.push(node.path);
				walk(node.children);
			});
		walk(folders);
		return paths;
	}, [folders]);
	/** 최근 삭제된 항목 (관리자): 30일 동안 되살리거나 영구히 지울 수 있다 */
	const inTrash = category === RECENTLY_DELETED;
	const trash = useMemo(
		() => (editing && adminPosts ? recentlyDeletedPosts(repoPosts, adminPosts, today) : []),
		[editing, adminPosts, repoPosts, today]
	);
	/** 본문의 #태그 (사이드바의 태그 묶음, 태그로 보기) */
	const tags = useMemo(() => collectTags(organized), [organized]);
	const inTags = category === TAG_VIEW;
	/** 태그로 볼 때는 고른 태그에 맞는 글, 아니면 폴더의 글 */
	const inCategory = useMemo(
		() =>
			inTags
				? filterPosts(organized, ALL_CATEGORY, '').filter((post) => matchesTags(tagsOf(post.body), tagSelection))
				: filterPosts(organized, category, ''),
		[organized, category, inTags, tagSelection]
	);
	/** 목록 위 제목: 폴더 이름, 또는 #태그 / N개의 태그 / 모든 태그 */
	const categoryName = inTags ? tagSelectionTitle(tagSelection) : folderName(category);
	const visible = useMemo(
		() =>
			inTrash
				? filterPosts(trash, ALL_CATEGORY, query)
				: sortBy(
						filterPosts(
							inCategory,
							ALL_CATEGORY,
							query,
							editing ? filter : filter === 'draft' || filter === 'scheduled' ? null : filter
						),
						arrangement
					),
		[inTrash, trash, inCategory, query, filter, editing, arrangement]
	);
	const { pinned: pinnedPosts, others: otherPosts } = splitPinned(visible);
	// 고른 글이 목록에 없으면(카테고리·검색으로 걸러지면) 목록 맨 위의 글(고정된 글 먼저)을 보여준다
	const selected = visible.find((post) => post.slug === selectedSlug) ?? pinnedPosts[0] ?? otherPosts[0] ?? null;
	// 본문 아래의 이전 글·다음 글: 지금 폴더 안에서 날짜 순으로 옆 글 (검색어와 상관없이)
	const { older, newer } =
		selected && !inTrash ? adjacentPosts(inCategory, selected.slug) : { older: null, newer: null };

	// 주소 막대에 지금 글의 주소를 둔다 (새로 고침하거나 주소를 복사해도 그 글로). 게시하지 않은 글은 주소가 없다.
	// 글을 다 읽어 오기 전에는 그대로 둔다 (글 주소로 들어온 그 글이 아직 없을 수 있다)
	// 주소로 들어왔거나 직접 글을 고른 뒤부터 (처음 보이는 글로 사이트 주소를 덮지 않게)
	const address = selectedSlug !== null && selected && !inTrash && !selected.status?.draftOnly ? selected.slug : null;
	useEffect(() => {
		if (ready) setAppAddress('memo', address);
	}, [ready, address]);
	// 메모 앱을 닫으면 주소가 없다
	useEffect(() => () => setAppAddress('memo', null), []);

	return {
		category,
		setCategory,
		query,
		setQuery,
		filter,
		setFilter,
		tagSelection,
		setTagSelection,
		arrangement,
		setArrangement,
		setSelectedSlug,
		folders,
		folderPaths,
		inTrash,
		trash,
		tags,
		inTags,
		categoryName,
		visible,
		pinnedPosts,
		otherPosts,
		selected,
		older,
		newer,
	};
}
