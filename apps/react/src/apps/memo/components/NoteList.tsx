import React from 'react';
import {
	type Arrangement,
	daysUntilPurge,
	excerpt,
	firstImage,
	folderName,
	formatPostDate,
	groupPosts,
	type Post,
	resolveImageSrc,
} from '@macfolio/desktop-core/memo';
import { CONTENT_IMAGES } from '../contentImages';
import type { PostDraft } from '../postsApi';

/** 목록·카드를 끌 때 단추에 붙이는 속성 (관리자만) */
export type DragProps = {
	draggable?: boolean;
	onDragStart?: (event: React.DragEvent) => void;
	onDragEnd?: () => void;
};

/** 목록·카드 한 칸이 받는 것 */
interface NoteProps {
	post: Post;
	/** 메모 선택 중이면 고른 메모들, 아니면 null */
	picked: Set<string> | null;
	dragging: boolean;
	drag: DragProps;
	onContextMenu?: (event: React.MouseEvent) => void;
	/** 누르면 (메모 선택 중이면 넣고 빼기는 부르는 쪽이 한다) */
	onOpen: () => void;
}

/** 메모 선택 중의 동그라미 */
const PickMark = ({ on }: { on: boolean }) => (
	<i className={`memo-pick ${on ? 'fa-solid fa-circle-check on' : 'fa-regular fa-circle'}`} aria-hidden="true" />
);

/** 게시 상태 표시 (관리자 목록): 게시한 적 없음, 게시하지 않은 편집, 예약 */
export const StatusBadge = ({ post }: { post: Post }) =>
	post.status &&
	(post.status.draftOnly ? (
		<span className="memo-status-badge draft">임시 저장</span>
	) : post.status.scheduled ? (
		<span className="memo-status-badge scheduled" title={`${formatPostDate(post.status.scheduled)}에 공개`}>
			예약
		</span>
	) : post.status.changed ? (
		<span className="memo-status-dot" role="img" aria-label="게시하지 않은 변경" title="게시하지 않은 변경" />
	) : null);

/** 목록의 메모 한 줄: 제목, 날짜·요약, 폴더 (최근 삭제된 메모는 남은 날) */
export const NoteItem = ({
	post,
	picked,
	dragging,
	drag,
	onContextMenu,
	onOpen,
	active,
	today,
}: NoteProps & { active: boolean; today: Date }) => (
	<li>
		<button
			type="button"
			className={`memo-item ${active ? 'active' : ''} ${dragging ? 'dragging' : ''} ${picked ? 'picking' : ''}`}
			{...drag}
			aria-current={active || undefined}
			aria-pressed={picked ? picked.has(post.slug) : undefined}
			onContextMenu={onContextMenu}
			onClick={onOpen}
		>
			{picked && <PickMark on={picked.has(post.slug)} />}
			<strong>
				{post.locked && <i className="fa-solid fa-lock memo-item-lock" role="img" aria-label="잠김" />}
				{post.title}
				<StatusBadge post={post} />
			</strong>
			<span className="memo-item-meta">
				<time dateTime={post.date}>{formatPostDate(post.date)}</time> {post.summary}
			</span>
			<span className="memo-item-folder">
				<i className="fa-regular fa-folder" aria-hidden="true" /> {folderName(post.category)}
				{post.deletedAt && <span className="memo-item-purge">{daysUntilPurge(post.deletedAt, today)}일 남음</span>}
			</span>
		</button>
	</li>
);

/** 갤러리 카드의 미리보기: 첫 이미지, 없으면 본문 앞부분 */
const CardPreview = ({ post }: { post: Post }) => {
	const image = resolveImageSrc(firstImage(post.body) ?? undefined, CONTENT_IMAGES);
	return (
		<span className="memo-card-preview" aria-hidden="true">
			{image ? (
				<img src={image} alt="" loading="lazy" />
			) : (
				<span className="memo-card-text">
					<strong>{post.title}</strong>
					{post.summary}
				</span>
			)}
		</span>
	);
};

/** 갤러리의 카드: 미리보기, 고정 표시, 제목, 날짜 */
export const NoteCard = ({ post, picked, dragging, drag, onContextMenu, onOpen }: NoteProps) => (
	<li>
		<button
			type="button"
			className={`memo-card ${dragging ? 'dragging' : ''}`}
			{...drag}
			onContextMenu={onContextMenu}
			aria-pressed={picked ? picked.has(post.slug) : undefined}
			onClick={onOpen}
		>
			{picked && <PickMark on={picked.has(post.slug)} />}
			<span className="memo-card-frame">
				<CardPreview post={post} />
				{post.pinned && (
					<span className="memo-card-pin" aria-label="고정됨">
						<i className="fa-solid fa-thumbtack" aria-hidden="true" />
					</span>
				)}
			</span>
			<strong>{post.title}</strong>
			<time dateTime={post.date}>{formatPostDate(post.date)}</time>
		</button>
	</li>
);

/** 목록 맨 위의 새 메모 (macOS 메모의 '새로운 메모': 쓰는 대로 제목·본문이 보인다). 떠날 때는 접히며 사라진다 */
export const NewDraftItem = ({
	startedAt,
	preview,
	leaving,
	folder,
	onOpen,
}: {
	startedAt: number;
	preview: PostDraft | null;
	leaving: boolean;
	/** 아직 폴더를 고르지 않았으면 들어갈 폴더 */
	folder: string;
	onOpen: () => void;
}) => (
	<li className={`memo-new-item ${leaving ? 'leaving' : ''}`} aria-hidden={leaving || undefined}>
		<button
			type="button"
			className={`memo-item ${leaving ? '' : 'active'}`}
			aria-current={!leaving || undefined}
			tabIndex={leaving ? -1 : undefined}
			onClick={onOpen}
		>
			<strong>{preview?.title.trim() || '새로운 메모'}</strong>
			<span className="memo-item-meta">
				<time>{new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(startedAt)}</time>{' '}
				{(preview && excerpt(preview.body)) || '추가 텍스트 없음'}
			</span>
			<span className="memo-item-folder">
				<i className="fa-regular fa-folder" aria-hidden="true" /> {folderName(preview?.category ?? folder)}
			</span>
		</button>
	</li>
);

/**
 * 고정된 메모를 먼저, 그다음 나머지. 날짜별로 묶으면 나머지를 오늘·어제·지난 7일… 묶음으로 나눈다.
 * 묶지 않을 때는 고정된 메모가 있을 때만 '메모' 묶음 이름을 단다. 최근 삭제된 항목은 묶지 않고 최근에 지운 순서대로
 */
export const NoteSections = ({
	posts,
	pinned,
	others,
	flat,
	arrangement,
	today,
	pinnedTitle,
	className,
	render,
}: {
	posts: Post[];
	pinned: Post[];
	others: Post[];
	/** 묶지 않고 그대로 (최근 삭제된 항목) */
	flat: boolean;
	arrangement: Arrangement;
	today: Date;
	pinnedTitle: string;
	className: string;
	render: (post: Post) => React.ReactNode;
}) => {
	if (flat) return <ul className={className}>{posts.map(render)}</ul>;
	const groups = groupPosts(others, arrangement, today);
	const grouped = groups.some((group) => group.title !== null);
	return (
		<>
			{pinned.length > 0 && (
				<>
					<h3 className="memo-section-title motion-swap">
						<i className="fa-solid fa-thumbtack" aria-hidden="true" /> {pinnedTitle}
					</h3>
					<ul className={className} aria-label={pinnedTitle}>
						{pinned.map(render)}
					</ul>
				</>
			)}
			{grouped ? (
				groups.map((group) => (
					<React.Fragment key={group.title}>
						<h3 className="memo-section-title motion-swap">{group.title}</h3>
						<ul className={className} aria-label={group.title ?? undefined}>
							{group.posts.map(render)}
						</ul>
					</React.Fragment>
				))
			) : (
				<>
					{pinned.length > 0 && others.length > 0 && <h3 className="memo-section-title motion-swap">메모</h3>}
					{(pinned.length === 0 || others.length > 0) && <ul className={className}>{others.map(render)}</ul>}
				</>
			)}
		</>
	);
};
