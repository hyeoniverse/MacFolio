import Menu from '@/shared/ui/menu/Menu';
import { folderLabelOf, type FolderPath } from '@macfolio/desktop-core/memo';

/** 휴대폰 메모 선택의 '이동': 고른 메모들을 옮길 폴더 */
const FolderPickMenu = ({
	anchor,
	paths,
	onClose,
	onPick,
}: {
	anchor: { x: number; y: number };
	paths: FolderPath[];
	onClose: () => void;
	onPick: (path: FolderPath) => void;
}) => (
	<Menu
		label="옮길 폴더"
		className="touch"
		anchor={anchor}
		onClose={onClose}
		items={[
			{ heading: '옮길 폴더' },
			...paths.map((path) => ({
				label: folderLabelOf(path),
				icon: 'fa-regular fa-folder',
				onSelect: () => onPick(path),
			})),
		]}
	/>
);

export default FolderPickMenu;
