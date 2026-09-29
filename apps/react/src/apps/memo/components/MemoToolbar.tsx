import React from 'react';

export type View = 'list' | 'gallery';

/** 사이드바 여닫기 (SF Symbols의 sidebar.left 모양) */
export const SidebarToggle: React.FC<{ open: boolean; onToggle: () => void }> = ({ open, onToggle }) => (
	<button
		type="button"
		className="memo-tool memo-sidebar-toggle"
		aria-label={open ? '사이드바 가리기' : '사이드바 보기'}
		aria-expanded={open}
		title={open ? '사이드바 가리기' : '사이드바 보기'}
		onClick={onToggle}
	>
		<svg viewBox="0 0 20 16" aria-hidden="true">
			<rect x="1" y="1" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
			<line x1="7.5" y1="1.5" x2="7.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" />
			<line x1="3.2" y1="5" x2="5.3" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="3.2" y1="7.5" x2="5.3" y2="7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
		</svg>
	</button>
);

/** 목록으로 보기 / 갤러리로 보기 */
export const ViewSwitch: React.FC<{ view: View; onChange: (view: View) => void }> = ({ view, onChange }) => (
	<div className="memo-view-switch" role="group" aria-label="보기 방식">
		<button
			type="button"
			aria-label="목록으로 보기"
			title="목록으로 보기"
			aria-pressed={view === 'list'}
			onClick={() => onChange('list')}
		>
			<i className="fa-solid fa-list-ul" aria-hidden="true" />
		</button>
		<button
			type="button"
			aria-label="갤러리로 보기"
			title="갤러리로 보기"
			aria-pressed={view === 'gallery'}
			onClick={() => onChange('gallery')}
		>
			<i className="fa-solid fa-table-cells-large" aria-hidden="true" />
		</button>
	</div>
);

/**
 * 도구 막대의 앞부분. 사이드바를 닫으면 신호등 버튼 자리를 비우고 그 옆에 여닫기 버튼을 둔다
 * (사이드바가 열려 있으면 여닫기 버튼은 사이드바 위에 있다).
 */
export const ToolbarLead: React.FC<{ sidebarOpen: boolean; onToggleSidebar: () => void }> = ({
	sidebarOpen,
	onToggleSidebar,
}) =>
	sidebarOpen ? null : (
		<>
			<span className="memo-lights-space" aria-hidden="true" />
			<SidebarToggle open={false} onToggle={onToggleSidebar} />
		</>
	);
