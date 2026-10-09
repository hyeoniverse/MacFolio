import React, { useEffect, useState } from 'react';
import { env } from '@/shared/config/env';
import { formatPostDate, type PostContent } from '@macfolio/desktop-core/memo';
import { fetchRevision, fetchRevisions, type RevisionSummary } from '../postsApi';

/** 버전을 남긴 때 (9월 30일 오후 3:04) */
const formatTime = (iso: string) =>
	new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
		new Date(iso)
	);

type Item = { kind: 'revision'; summary: RevisionSummary } | { kind: 'original' };

/**
 * 버전 기록: 게시할 때마다 남긴 버전 (최근 것부터), 저장소 글이면 맨 아래에 원본.
 * 고르면 미리 보고, '이 버전으로 되돌리기'를 누르면 그 내용이 임시 저장으로 들어간다 (게시는 따로).
 */
const RevisionsPanel = ({
	slug,
	original,
	renderMarkdown,
	onRestore,
}: {
	slug: string;
	/** 저장소의 원본 글 (서버에만 있는 글이면 null) */
	original: PostContent | null;
	renderMarkdown: (body: string) => React.ReactNode;
	onRestore: (content: PostContent) => void;
}) => {
	const [list, setList] = useState<RevisionSummary[] | null | 'error'>(null);
	const [preview, setPreview] = useState<{ label: string; content: PostContent } | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let alive = true;
		fetchRevisions(env.apiUrl, slug).then((loaded) => alive && setList(loaded ?? 'error'));
		return () => {
			alive = false;
		};
	}, [slug]);

	const open = async (item: Item) => {
		if (item.kind === 'original' && original) return setPreview({ label: '원본 (저장소 글)', content: original });
		if (item.kind !== 'revision') return;
		setLoading(true);
		const revision = await fetchRevision(env.apiUrl, slug, item.summary.id);
		setLoading(false);
		if (revision) setPreview({ label: formatTime(revision.createdAt), content: revision });
	};

	if (preview)
		return (
			<div className="memo-revision-preview">
				<div className="memo-revision-head">
					<button type="button" className="memo-revision-back" onClick={() => setPreview(null)}>
						<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 버전 목록
					</button>
					<span>{preview.label}</span>
				</div>
				<div className="memo-revision-body" role="document" aria-label={`${preview.label} 내용`}>
					<p className="memo-reader-date">
						<time dateTime={preview.content.date}>{formatPostDate(preview.content.date)}</time>
					</p>
					<h1>{preview.content.title}</h1>
					<div className="memo-markdown">{renderMarkdown(preview.content.body)}</div>
				</div>
				<button type="button" className="memo-revision-restore" onClick={() => onRestore(preview.content)}>
					이 버전으로 되돌리기
				</button>
			</div>
		);

	const items: Item[] = [
		...(Array.isArray(list) ? list.map((summary) => ({ kind: 'revision' as const, summary })) : []),
		...(original ? [{ kind: 'original' as const }] : []),
	];

	return (
		<div className="memo-revisions">
			<p className="memo-revisions-note">
				게시할 때마다 버전이 남습니다. 되돌리면 임시 저장으로 들어가고, 게시해야 공개됩니다.
			</p>
			{list === null && <p className="memo-image-note">불러오는 중…</p>}
			{list === 'error' && <p className="memo-image-note problem">버전을 불러오지 못했습니다.</p>}
			{list !== null && list !== 'error' && items.length === 0 && (
				<p className="memo-image-note">아직 게시한 버전이 없습니다.</p>
			)}
			{items.length > 0 && (
				<ul className="memo-revision-list" aria-label="버전">
					{items.map((item) => (
						<li key={item.kind === 'revision' ? item.summary.id : 'original'}>
							<button type="button" disabled={loading} onClick={() => void open(item)}>
								{item.kind === 'revision' ? (
									<>
										<strong>{formatTime(item.summary.createdAt)}</strong>
										<span>
											{item.summary.title} · {item.summary.createdBy}
										</span>
									</>
								) : (
									<>
										<strong>원본</strong>
										<span>저장소의 Markdown 글</span>
									</>
								)}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

export default RevisionsPanel;
