import IconButton from '@/shared/ui/button/IconButton';

/** 휴대폰 폴더 화면 아래 (iOS 메모처럼): 검색 알약(누르면 모든 글에서 찾기)과 새 메모 */
const PhoneFoldersBar = ({ onSearch, onNewNote }: { onSearch: () => void; onNewNote: (() => void) | null }) => (
	<div className="memo-phone-bottom memo-folders-bottom">
		<button type="button" className="memo-phone-search" onClick={onSearch}>
			<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
			검색
		</button>
		{onNewNote && (
			<IconButton
				className="memo-phone-compose"
				label="새 메모"
				onClick={onNewNote}
				icon="fa-regular fa-pen-to-square"
			/>
		)}
	</div>
);

export default PhoneFoldersBar;
