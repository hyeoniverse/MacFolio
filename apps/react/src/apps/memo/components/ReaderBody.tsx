import { useRef, type ReactNode } from 'react';
import Button from '@/shared/ui/button/Button';
import { daysUntilPurge, formatPostDate, type Post, type Series } from '@macfolio/desktop-core/memo';
import MemoMarkdown from './MemoMarkdown';
import SecretBadge from './SecretBadge';
import MemoToc from './MemoToc';
import SeriesBox, { SeriesKicker } from './SeriesBox';
import { useTocHeadings } from '../useTocHeadings';

/** 폴더 경로를 "개발기 › MacFolio"처럼 */
const folderLabel = (path: string) => path.split('/').join(' › ');

/**
 * 읽기 화면의 본문: 날짜·폴더·조회수, (최근 삭제된 메모면) 안내 상자, (잠긴 메모면) 잠금 안내, 제목, 목차, 본문, 글 아래.
 * 방문자, 그리고 관리자에게는 최근 삭제된 메모와 잠긴 메모가 이 화면이다
 */
const ReaderBody = ({
	post,
	today,
	views,
	editing,
	footer,
	compact,
	series,
	onOpenSeries,
	onRestore,
	onPurge,
	onUnlock,
}: {
	post: Post;
	today: Date;
	/** 글마다 조회수 (서버가 없으면 null: 감춘다) */
	views: Record<string, number> | null;
	/** 관리자 편집 중 (잠긴 메모면 잠금 풀기 안내) */
	editing: boolean;
	/** 글 아래 (이전·다음 글, 댓글). 최근 삭제된 메모는 없다 */
	footer: ReactNode;
	/** 한 칸씩 보는 좁은 화면 (목차를 접은 채 시작한다) */
	compact: boolean;
	/** 이 글이 속한 연재 (series 칸이 같은 글이 두 편 이상). 없으면 null */
	series: Series | null;
	onOpenSeries: (post: Post) => void;
	onRestore: () => void;
	onPurge: () => void;
	onUnlock: () => void;
}) => {
	const body = useRef<HTMLDivElement>(null);
	const revision = `${post.slug}\n${post.body}`;
	const toc = useTocHeadings(body, revision);
	return (
		<div className="memo-reader-body">
			{/* 날짜는 늘 맨 위 (최근 삭제·잠금 안내는 그 아래) */}
			<p className="memo-reader-date">
				<time dateTime={post.date}>{formatPostDate(post.date)}</time> · {folderLabel(post.category)}
				{views && <span className="memo-reader-views"> · 조회 {(views[post.slug] ?? 0).toLocaleString()}</span>}
				{post.status?.secret && <SecretBadge />}
			</p>
			{post.deletedAt && (
				// Finder의 휴지통 안내처럼: 왜 고칠 수 없는지, 어떻게 쓰는지, 그 아래 버튼
				<div className="memo-trash-note" role="note">
					<i className="fa-regular fa-trash-can" aria-hidden="true" />
					<div>
						<strong>최근 삭제된 메모</strong>
						<p>
							{daysUntilPurge(post.deletedAt, today)}일 뒤에 영구히 삭제됩니다. 원본 항목이 휴지통에 있기 때문에 수정할
							수 없습니다.
						</p>
						<p className="memo-trash-note-hint">이 항목을 사용하려면 휴지통 밖으로 드래그하거나 복구하십시오.</p>
						<div className="memo-trash-note-actions">
							<Button icon="fa-solid fa-rotate-left" onClick={onRestore}>
								되돌려 놓기
							</Button>
							<Button tone="danger" icon="fa-regular fa-trash-can" onClick={onPurge}>
								즉시 삭제
							</Button>
						</div>
					</div>
				</div>
			)}
			{editing && !post.deletedAt && (
				// 도구 막대는 편집 도구로 꽉 차서, 잠금은 메뉴로 걸고 여기서 푼다
				<p className="memo-locked-note">
					<i className="fa-solid fa-lock" aria-hidden="true" /> 잠긴 메모입니다.
					<Button onClick={onUnlock}>잠금 풀기</Button>
				</p>
			)}
			{series && !post.deletedAt && <SeriesKicker series={series} />}
			<h1>{post.title}</h1>
			{series && !post.deletedAt && <SeriesBox series={series} compact={compact} onOpen={onOpenSeries} />}
			<MemoToc toc={toc} bodyRef={body} revision={revision} compact={compact} />
			<div ref={body} className="prose memo-markdown" aria-busy={post.bodyPending ? true : undefined}>
				{/* 원문을 받는 동안(목록용 글)은 본문 자리를 비워 둔다. 목록용 본문은 그림·태그만 모은 것이라 보이지 않는다 */}
				{!post.bodyPending && <MemoMarkdown>{post.body}</MemoMarkdown>}
			</div>
			{footer}
		</div>
	);
};

export default ReaderBody;
