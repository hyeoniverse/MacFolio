import { useState, type ReactNode } from 'react';
import IconButton from '@/shared/ui/button/IconButton';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import FormatTools from '../writer/FormatTools';
import { cssVars } from '@/shared/lib/cssVars';
import { useKeyboardInset } from '@/shared/hooks/useKeyboardInset';

/**
 * 휴대폰 본문의 떠 있는 단추 (iOS 메모): 오른쪽 위에 공유·••• 알약, 아래에 서식 알약(쓰는 중일 때)과 새 메모.
 * 쓰는 중에 화면 키보드가 올라오면 iOS 메모처럼 서식 알약이 키보드 바로 위에 폭 가득 뜨고, 새 메모 단추는 숨는다.
 * ••• 메뉴의 항목은 부르는 쪽이 정한다 (noteMenus.tsx의 phoneNoteItems)
 */
const PhoneReaderBars = ({
	hasNote,
	share,
	menuItems,
	canEdit,
	writing,
	onNewNote,
}: {
	/** 열린 글이 있는지 (없으면 위 알약을 그리지 않는다) */
	hasNote: boolean;
	share: ReactNode;
	menuItems: () => MenuItem[];
	canEdit: boolean;
	/** 편집기가 열려 있으면 서식 알약을 보인다 */
	writing: boolean;
	onNewNote: () => void;
}) => {
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const keyboard = useKeyboardInset(writing);
	return (
		<>
			{hasNote && (
				<div className="memo-phone-top">
					{share}
					<IconButton
						label="메모 동작"
						aria-haspopup="menu"
						aria-expanded={menu !== null}
						onClick={(event) => {
							const rect = event.currentTarget.getBoundingClientRect();
							setMenu(menu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
						}}
						icon="fa-solid fa-ellipsis"
					/>
				</div>
			)}
			{canEdit && (
				<div
					className={`memo-phone-bottom${keyboard ? ' above-keyboard' : ''}`}
					style={keyboard ? cssVars({ 'keyboard-inset': `${keyboard}px` }) : undefined}
				>
					{writing ? (
						<span className="memo-format-tools memo-phone-format">
							<FormatTools />
						</span>
					) : (
						<span />
					)}
					{!keyboard && (
						<IconButton
							className="memo-phone-compose"
							label="새 메모"
							onClick={onNewNote}
							icon="fa-regular fa-pen-to-square"
						/>
					)}
				</div>
			)}
			{menu && hasNote && (
				<Menu label="메모 동작" className="touch" anchor={menu} onClose={() => setMenu(null)} items={menuItems()} />
			)}
		</>
	);
};

export default PhoneReaderBars;
