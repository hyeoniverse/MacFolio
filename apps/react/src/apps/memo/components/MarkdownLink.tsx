import React from 'react';
import { useAppState } from '@/desktop/useAppState';
import { appLinkOf } from '@/shared/lib/appLink';
import { requestOpen } from '@/shared/lib/openRequest';

interface Props {
	href?: string;
	title?: string;
	children?: React.ReactNode;
}

/**
 * 글 본문의 링크. 이 사이트의 앱 항목(/memo/<글>, /safari/<프로젝트>)은 새 탭이 아니라 사이트 안에서 연다:
 * 메모 글은 지금 메모 앱에서 그 글로, 프로젝트는 Safari의 그 탭으로 (Finder가 여는 것과 같은 길, openRequest).
 * ⌘·Ctrl·Shift를 누르거나 가운데 단추로 누르면 브라우저 기본대로 (새 탭 등). 바깥 링크는 새 탭에서 연다
 */
const MarkdownLink: React.FC<Props> = ({ href, title, children }) => {
	const { openApp } = useAppState();
	const link = appLinkOf(href);

	if (!link) {
		return (
			<a href={href} title={title} target="_blank" rel="noopener noreferrer">
				{children}
			</a>
		);
	}

	return (
		<a
			href={href}
			title={title}
			onClick={(event) => {
				if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
				event.preventDefault();
				openApp(link.app);
				requestOpen(link.app, link.id);
			}}
		>
			{children}
		</a>
	);
};

export default MarkdownLink;
