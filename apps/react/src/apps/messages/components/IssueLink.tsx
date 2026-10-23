import React from 'react';
import { NEW_ISSUE_URL } from '@/apps/finder/repoDocs';

/**
 * 버그 제보용 GitHub 이슈 바깥 링크 (새 탭). 메시지는 자유롭게 남기는 글이고, 이 링크는 버그를 위한 보조 경로다. 새 피드백 화면과 빈 목록 안내에 둔다.
 * 누르면 analytics.ts의 문서 클릭 리스너가 바깥 링크로 집계한다
 */
const IssueLink: React.FC<{ className?: string }> = ({ className }) => (
	<a
		className={`messages-issue-link ${className ?? ''}`}
		href={NEW_ISSUE_URL}
		target="_blank"
		rel="noopener noreferrer"
	>
		버그는 GitHub 이슈로
		<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
		<span className="visually-hidden"> (새 탭)</span>
	</a>
);

export default IssueLink;
