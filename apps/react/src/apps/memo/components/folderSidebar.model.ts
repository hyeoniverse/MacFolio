// 폴더 사이드바(FolderSidebar)와 폴더 줄(FolderRow)이 함께 쓰는 타입. 둘이 서로 import하지 않게 여기에 둔다
import { type FolderNode, type FolderPath, MAX_FOLDER_DEPTH, type TagSelection } from '@macfolio/desktop-core/memo';

/** 끌고 있는 것: 글(slug) 또는 폴더(경로) */
/** 끄는 것: 글, 폴더, 최근 삭제된 항목의 글 (폴더에 놓으면 되살린다) */
export type DragItem = { type: 'post' | 'folder' | 'deleted'; id: string };

export interface FolderSidebarProps {
	/** 관리자만 편집(새로운 폴더, ••• 메뉴, 끌어 옮기기)할 수 있다 */
	canEdit: boolean;
	open: boolean;
	onToggle: () => void;
	folders: FolderNode[];
	total: number;
	/** 인기글에 보일 글 수. null이면 인기글을 감춘다 (서버가 없을 때) */
	popular?: number | null;
	current: string;
	onSelect: (path: string) => void;
	/** 새 폴더를 이 폴더 아래에 만든다 ('' = 맨 위) */
	onAddFolder: (parent: string, name: string) => void;
	/** 새 메모 (관리자). 사이드바 위쪽의 새로운 폴더 단추 왼쪽에 둔다 */
	onNewNote?: () => void;
	onRenameFolder: (path: FolderPath, name: string) => void;
	onRemoveFolder: (path: FolderPath) => void;
	/** 폴더를 target 폴더 안으로 옮긴다 (ALL_CATEGORY = 맨 위). 휴대폰 편집의 '이 폴더 이동' */
	onMoveFolder?: (path: FolderPath, target: string) => void;
	/** 같은 층 폴더의 순서를 바꾼다 (그 층의 경로를 새 순서대로). 휴대폰 편집의 ≡ 손잡이 */
	onReorderFolders?: (siblings: FolderPath[]) => void;
	dragging: DragItem | null;
	onDragFolder: (item: DragItem | null) => void;
	/** 끌고 있는 것을 target 폴더에 놓을 수 있는지 (ALL_CATEGORY = 맨 위) */
	canDrop: (target: string) => boolean;
	onDrop: (target: string) => void;
	/** '최근 삭제된 항목'의 글 수 (관리자). 1개 이상일 때만 폴더 목록 맨 아래에 보인다 */
	recentlyDeleted?: number;
	/** 휴지통 비우기 (최근 삭제된 항목의 ••• 메뉴) */
	onEmptyTrash?: () => void;
	/** 본문에 쓴 #태그와 글 수 (tags.ts). 있으면 폴더 아래에 태그 묶음이 보인다 */
	tags?: { name: string; count: number }[];
	/** 고른 태그 (태그마다 미선택 → 포함 → 제외), 바꾸기 */
	tagSelection?: TagSelection;
	onTagsChange?: (next: TagSelection) => void;
}

/** 폴더 깊이 상한 안내 (새 폴더 메뉴의 비활성 이유) */
export const DEPTH_LIMIT_HINT = `폴더는 ${MAX_FOLDER_DEPTH}단까지 만들 수 있어요`;
