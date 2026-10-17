import type { ReactNode } from 'react';
import IconButton from '@/shared/ui/button/IconButton';

/**
 * 본문 위 도구 막대 (넓은 창): 왼쪽에 (갤러리에서 연 글이면) 돌아가기와 관리자 표시, 오른쪽에 도구와 검색 칸.
 * 검색하는 동안 도구는 접히고(••• 메뉴로 모인다) 검색 칸이 왼쪽으로 넓어진다
 */
const ReaderToolbar = ({
	lead,
	admin,
	readerView,
	onToggleReaderView,
	searching,
	tools,
	moreOpen,
	onMore,
	search,
}: {
	/** 갤러리에서 연 글: 사이드바 버튼과 갤러리로 돌아가기 */
	lead: ReactNode;
	admin: boolean;
	/** 관리자가 읽기 화면으로 보는 중인지. 편집할 수 있을 때만 값이 있고(아니면 null), 관리자 표시를 누르면 바뀐다 */
	readerView: boolean | null;
	onToggleReaderView: () => void;
	searching: boolean;
	tools: ReactNode;
	moreOpen: boolean;
	/** ••• 를 누른 자리 (메뉴는 부르는 쪽이 연다) */
	onMore: (rect: DOMRect) => void;
	search: ReactNode;
}) => (
	<div className={`memo-toolbar memo-reader-toolbar ${searching ? 'searching' : ''}`}>
		{lead}
		{admin &&
			(readerView === null ? (
				<span className="memo-admin-chip" title="관리자로 로그인했습니다">
					<i className="fa-solid fa-key" aria-hidden="true" />
					<span>관리자</span>
				</span>
			) : (
				// 누르면 편집 화면과 방문자가 보는 읽기 화면을 오간다
				<button
					type="button"
					className={`memo-admin-chip ${readerView ? 'reading' : ''}`}
					aria-pressed={readerView}
					aria-label={readerView ? '읽기 화면으로 보는 중, 편집 화면으로 돌아가기' : '관리자, 읽기 화면으로 보기'}
					title={
						readerView
							? '방문자가 보는 읽기 화면입니다. 누르면 편집 화면으로 돌아갑니다.'
							: '관리자로 로그인했습니다. 누르면 방문자가 보는 읽기 화면으로 봅니다.'
					}
					onClick={onToggleReaderView}
				>
					<i className={readerView ? 'fa-regular fa-eye' : 'fa-solid fa-key'} aria-hidden="true" />
					<span>{readerView ? '읽기 화면' : '관리자'}</span>
				</button>
			))}
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
