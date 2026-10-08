import type { ReactNode } from 'react';
import IconButton from '@/shared/ui/button/IconButton';

/**
 * 본문 위 도구 막대 (넓은 창): 왼쪽에 (갤러리에서 연 글이면) 돌아가기와 관리자 표시, 오른쪽에 도구와 검색 칸.
 * 검색하는 동안 도구는 접히고(••• 메뉴로 모인다) 검색 칸이 왼쪽으로 넓어진다
 */
const ReaderToolbar = ({
	lead,
	admin,
	searching,
	tools,
	moreOpen,
	onMore,
	search,
}: {
	/** 갤러리에서 연 글: 사이드바 단추와 갤러리로 돌아가기 */
	lead: ReactNode;
	admin: boolean;
	searching: boolean;
	tools: ReactNode;
	moreOpen: boolean;
	/** ••• 를 누른 자리 (메뉴는 부르는 쪽이 연다) */
	onMore: (rect: DOMRect) => void;
	search: ReactNode;
}) => (
	<div className={`memo-toolbar memo-reader-toolbar ${searching ? 'searching' : ''}`}>
		{lead}
		{admin && (
			<span className="memo-admin-chip" title="관리자로 로그인했습니다">
				<i className="fa-solid fa-key" aria-hidden="true" />
				<span>관리자</span>
			</span>
		)}
		<span className="memo-toolbar-spacer" />
		<span className="memo-toolbar-tools" inert={searching || undefined}>
			<span className="memo-toolbar-tools-inner">{tools}</span>
		</span>
		<IconButton
			className="memo-toolbar-more"
			label="도구 더 보기"
			aria-haspopup="menu"
			aria-expanded={moreOpen}
			tabIndex={searching ? undefined : -1}
			// 검색 칸의 초점을 빼앗지 않는다 (누르는 순간 검색 칸이 접히지 않게)
			onPointerDown={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			onClick={(event) => onMore(event.currentTarget.getBoundingClientRect())}
			icon="fa-solid fa-ellipsis"
		/>
		{search}
	</div>
);

export default ReaderToolbar;
