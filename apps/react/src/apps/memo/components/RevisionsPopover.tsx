import type { CSSProperties, ReactNode, Ref } from 'react';
import { createPortal } from 'react-dom';

import type { PostContent } from '@macfolio/desktop-core/memo';
import RevisionsPanel from './RevisionsPanel';

interface RevisionsPopoverProps {
	slug: string;
	/** 저장소에 있는 처음 글 (없으면 관리자가 새로 쓴 글) */
	original: PostContent | null;
	panelRef: Ref<HTMLDivElement> | ((element: HTMLDivElement | null) => void);
	position: CSSProperties;
	renderMarkdown: (body: string) => ReactNode;
	onRestore: (content: PostContent) => void;
}

/** 버전 기록 팝오버: 도구 막대의 버튼 아래 body에 띄운다 (자리는 usePopover가 정한다) */
export default function RevisionsPopover({
	slug,
	original,
	panelRef,
	position,
	renderMarkdown,
	onRestore,
}: RevisionsPopoverProps) {
	return createPortal(
		<div
			ref={panelRef}
			className="memo-format-panel memo-format-panel-wide"
			role="dialog"
			aria-label="버전 기록"
			style={position}
		>
			<RevisionsPanel
				key={slug}
				slug={slug}
				original={original}
				renderMarkdown={renderMarkdown}
				onRestore={onRestore}
			/>
		</div>,
		document.body
	);
}
