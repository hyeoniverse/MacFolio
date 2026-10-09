import React, { useEffect, useMemo, useState } from 'react';
import { daysUntilPurge, folderName, recentlyDeletedPosts, type Post } from '@macfolio/desktop-core/memo';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/AppStateContext';
import { notify } from '@/desktop/notifications/notificationStore';
import { getPostRepository } from '@/apps/memo/repository';
import { fetchAdminPosts, purgePost, restorePost } from '@/apps/memo/postsApi';
import { useCanEditMemo } from '@/apps/memo/admin';
import { announceMemoPostsChanged, useMemoPostsChangedBy } from '@/apps/memo/memoPostsSignal';
import { env } from '@/shared/config/env';
import { requestOpen } from '@/shared/lib/openRequest';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import Button from '@/shared/ui/button/Button';
import { REMOVED, type RemovedItem } from './removed';
import './Bin.css';

type Section = 'features' | 'memos';

const formatDate = (date: string) => {
	const [y, m, d] = date.slice(0, 10).split('-').map(Number);
	return `${y}. ${m}. ${d}.`;
};

/** 관리자가 지운 메모 (최근 삭제된 항목, 30일). 관리자가 아니면 읽지 않는다 */
function useDeletedMemos(enabled: boolean) {
	const [repoPosts, setRepoPosts] = useState<Post[]>([]);
	const [deleted, setDeleted] = useState<Post[] | null>(null);
	const [reloads, setReloads] = useState(0);
	// 메모 앱에서 지우거나 되살리면 다시 읽는다
	const memoChanges = useMemoPostsChangedBy('memo');

	useEffect(() => {
		let alive = true;
		getPostRepository()
			.list()
			.then((list) => alive && setRepoPosts(list))
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		if (!enabled) return;
		let alive = true;
		fetchAdminPosts(env.apiUrl).then((admin) => {
			// 읽지 못하면(세션이 끝났거나 서버가 없으면) 빈 휴지통으로
			if (alive) setDeleted(admin ? recentlyDeletedPosts(repoPosts, admin, new Date()) : []);
		});
		return () => {
			alive = false;
		};
	}, [enabled, repoPosts, memoChanges, reloads]);

	return { deleted: enabled ? deleted : null, reload: () => setReloads((count) => count + 1) };
}

/**
 * 휴지통: 이 사이트를 만들며 버린 기능을 모아 두고(왜 바꿨는지는 개발 일지로), 관리자에게는 지운 메모를 보여 준다.
 * 지운 메모는 메모 앱의 '최근 삭제된 항목'과 같다. 여기서 되살리거나 영구히 지울 수 있다
 */
const Bin: React.FC = () => {
	const canEdit = useCanEditMemo();
	const { openApp } = useAppState();
	const [section, setSection] = useState<Section>('features');
	const [selectedId, setSelectedId] = useState(REMOVED[0].id);
	const { deleted, reload } = useDeletedMemos(canEdit);
	const [purging, setPurging] = useState<Post[] | null>(null);
	const inMemos = section === 'memos' && canEdit;

	const openPost = (slug: string) => {
		requestOpen('memo', slug);
		openApp('memo');
	};

	const changed = () => {
		announceMemoPostsChanged('bin');
		reload();
	};
	const restore = async (post: Post) => {
		const result = await restorePost(env.apiUrl, post.slug);
		if (!result.ok)
			return notify({
				app: 'bin',
				title: '되돌려 놓지 못함',
				body: '관리자 로그인이 끝났거나 서버에 연결할 수 없습니다.',
			});
		changed();
	};
	const purge = async (posts: Post[]) => {
		setPurging(null);
		const results = await Promise.all(posts.map((post) => purgePost(env.apiUrl, post.slug)));
		if (results.some((ok) => !ok))
			notify({ app: 'bin', title: '영구히 지우지 못함', body: '관리자 로그인이 끝났거나 서버에 연결할 수 없습니다.' });
		changed();
	};

	const memoCount = deleted?.length ?? 0;
	const title = inMemos ? '지운 메모' : '지운 기능';
	const count = inMemos ? memoCount : REMOVED.length;

	return (
		<AppWindow title="휴지통" appName="bin" chrome="unified">
			<div className="bin">
				<div className="bin-body">
					<nav className="bin-sidebar" aria-label="휴지통">
						<div className="bin-lights-space" />
						<h2>휴지통</h2>
						<button
							type="button"
							className={`bin-location${inMemos ? '' : ' active'}`}
							aria-current={inMemos ? undefined : 'page'}
							onClick={() => setSection('features')}
						>
							<i className="fa-solid fa-box-archive" aria-hidden="true" />
							<span>지운 기능</span>
							<span className="bin-location-count">{REMOVED.length}</span>
						</button>
						{canEdit && (
							<button
								type="button"
								className={`bin-location${inMemos ? ' active' : ''}`}
								aria-current={inMemos ? 'page' : undefined}
								onClick={() => setSection('memos')}
							>
								<i className="fa-regular fa-note-sticky" aria-hidden="true" />
								<span>지운 메모</span>
								<span className="bin-location-count">{memoCount}</span>
							</button>
						)}
					</nav>

					<div className="bin-main">
						<div className="bin-toolbar">
							<h1 className="bin-title">{title}</h1>
							<span className="bin-count">{count}개의 항목</span>
							{inMemos && memoCount > 0 && (
								<Button className="bin-empty" tone="danger" onClick={() => setPurging(deleted)}>
									휴지통 비우기
								</Button>
							)}
						</div>
						{inMemos ? (
							<MemoList posts={deleted} onRestore={restore} onPurge={(post) => setPurging([post])} />
						) : (
							<FeatureView selectedId={selectedId} onSelect={setSelectedId} onOpenPost={openPost} />
						)}
					</div>
				</div>

				{purging && (
					<AlertDialog
						title={`${purging.length}개의 메모를 영구적으로 삭제하겠습니까?`}
						message="이 동작은 취소할 수 없습니다."
						confirmLabel="삭제"
						onConfirm={() => void purge(purging)}
						onCancel={() => setPurging(null)}
					/>
				)}
			</div>
		</AppWindow>
	);
};

/** 지운 기능: 왼쪽 목록에서 고르면 오른쪽에 무엇으로 바꿨고 왜 바꿨는지 */
const FeatureView = ({
	selectedId,
	onSelect,
	onOpenPost,
}: {
	selectedId: string;
	onSelect: (id: string) => void;
	onOpenPost: (slug: string) => void;
}) => {
	// 최근에 버린 것이 위로
	const items = useMemo(() => [...REMOVED].sort((a, b) => b.date.localeCompare(a.date)), []);
	const selected = items.find((item) => item.id === selectedId) ?? items[0];

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const index = items.indexOf(selected) + (event.key === 'ArrowDown' ? 1 : -1);
		const next = items[Math.min(items.length - 1, Math.max(0, index))];
		onSelect(next.id);
		document.getElementById(`bin-item-${next.id}`)?.scrollIntoView({ block: 'nearest' });
	};

	return (
		<div className="bin-features">
			<div
				className="bin-list"
				role="listbox"
				aria-label="지운 기능"
				aria-activedescendant={`bin-item-${selected.id}`}
				tabIndex={0}
				onKeyDown={onKeyDown}
			>
				{items.map((item) => (
					<div
						key={item.id}
						id={`bin-item-${item.id}`}
						role="option"
						aria-selected={item.id === selected.id}
						className={`bin-item${item.id === selected.id ? ' selected' : ''}`}
						onClick={() => onSelect(item.id)}
						onDoubleClick={() => item.post && onOpenPost(item.post)}
					>
						<i className={`bin-item-icon ${item.icon}`} aria-hidden="true" />
						<span className="bin-item-name">{item.name}</span>
						<span className="bin-item-date">{formatDate(item.date)}</span>
					</div>
				))}
			</div>
			<FeatureInfo item={selected} onOpenPost={onOpenPost} />
		</div>
	);
};

const FeatureInfo = ({ item, onOpenPost }: { item: RemovedItem; onOpenPost: (slug: string) => void }) => (
	<section className="bin-info" aria-label={`${item.name} 정보`}>
		<i className={`bin-info-icon ${item.icon}`} aria-hidden="true" />
		<h2>{item.name}</h2>
		<dl>
			<dt>대신</dt>
			<dd>{item.replacedBy}</dd>
			<dt>바꾼 날</dt>
			<dd>{formatDate(item.date)}</dd>
		</dl>
		<p>{item.why}</p>
		{item.post && (
			<Button icon="fa-regular fa-pen-to-square" onClick={() => onOpenPost(item.post!)}>
				개발 일지 읽기
			</Button>
		)}
	</section>
);

/** 지운 메모 (관리자): 되돌려 놓기, 즉시 삭제 */
const MemoList = ({
	posts,
	onRestore,
	onPurge,
}: {
	posts: Post[] | null;
	onRestore: (post: Post) => void;
	onPurge: (post: Post) => void;
}) => {
	const today = useMemo(() => new Date(), []);
	if (posts === null) return <p className="bin-empty-note">불러오는 중…</p>;
	if (posts.length === 0) return <p className="bin-empty-note">지운 메모가 없습니다.</p>;
	return (
		<ul className="bin-memos" aria-label="지운 메모">
			{posts.map((post) => (
				<li key={post.slug} className="bin-memo">
					<span className="bin-memo-title">{post.title}</span>
					<span className="bin-memo-meta">
						{folderName(post.category)} · {daysUntilPurge(post.deletedAt!, today)}일 남음
					</span>
					<span className="bin-memo-actions">
						<Button onClick={() => onRestore(post)}>되돌려 놓기</Button>
						<Button tone="danger" onClick={() => onPurge(post)}>
							즉시 삭제
						</Button>
					</span>
				</li>
			))}
		</ul>
	);
};

export default Bin;
