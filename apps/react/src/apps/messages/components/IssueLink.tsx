import React from 'react';
import { NEW_ISSUE_URL } from '@/apps/finder/repoDocs';

/**
 * GitHub 이슈로 남기는 바깥 링크 (새 탭). 새 피드백 화면과 빈 목록 안내에 둔다.
 * 누르면 analytics.ts의 문서 클릭 리스너가 바깥 링크로 집계한다
 */
const IssueLink: React.FC<{ className?: string }> = ({ className }) => (
	<a
		className={`messages-issue-link ${className ?? ''}`}
		href={NEW_ISSUE_URL}
		target="_blank"
		rel="noopener noreferrer"
	>
		GitHub 이슈로 남기기
		<i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
		<span className="visually-hidden"> (새 탭)</span>
	</a>
);

export default IssueLink;
