// 본문 편집기(InlineEditor)와 창 위 도구 막대(FormatTools)를 잇는 작은 저장소.
// 편집기는 커서 자리의 서식과 명령 실행 함수를 알리고, 도구 막대는 그걸 보고 그리고 누른다.
import { useSyncExternalStore } from 'react';
import { createStore } from '@/shared/lib/createStore';

/** 문단 모양 (macOS 메모의 서식 이름) */
export type BlockStyle = 'title' | 'heading' | 'subheading' | 'body' | 'mono';

/** 커서가 있는 표 */
export interface TableState {
	/** 커서가 머리글 줄에 있는지 */
	header: boolean;
	/** 머리글 줄을 뺀 줄 수 */
	rows: number;
	cols: number;
	align: TableAlign;
}

export type TableAlign = 'left' | 'center' | 'right';

export type TableOp =
	'rowBefore' | 'rowAfter' | 'colBefore' | 'colAfter' | 'deleteRow' | 'deleteCol' | 'deleteTable' | TableAlign;

export interface FormatState {
	block: BlockStyle;
	/** 커서가 있는 목록 */
	list: 'bullet' | 'ordered' | 'task' | null;
	quote: boolean;
	table: TableState | null;
	marks: { strong: boolean; emphasis: boolean; strike: boolean; code: boolean };
}

export type FormatAction =
	| { type: 'mark'; mark: keyof FormatState['marks'] }
	| { type: 'block'; block: BlockStyle }
	| { type: 'list'; list: 'bullet' | 'ordered' | 'task' }
	| { type: 'quote' }
	| { type: 'table' }
	| { type: 'tableOp'; op: TableOp }
	| { type: 'image'; src: string; alt: string }
	/** 첨부 파일: 파일 이름을 글자로 한 링크 */
	| { type: 'attachment'; href: string; name: string; size: number };

export const EMPTY_FORMAT: FormatState = {
	block: 'body',
	list: null,
	quote: false,
	table: null,
	marks: { strong: false, emphasis: false, strike: false, code: false },
};

export const editorControls = createStore<{
	state: FormatState;
	run: ((action: FormatAction) => void) | null;
	/** 올리고 있는 파일 수 */
	uploading: number;
}>({
	state: EMPTY_FORMAT,
	run: null,
	uploading: 0,
});

export function useEditorControls() {
	return useSyncExternalStore(editorControls.subscribe, editorControls.getState);
}

/** 헤딩 단계 ↔ 문단 모양 (제목 h2, 머리말 h3, 부머리말 h4. h1은 글 제목이라 본문에서는 쓰지 않는다) */
export const HEADING_LEVEL: Record<'title' | 'heading' | 'subheading', number> = {
	title: 2,
	heading: 3,
	subheading: 4,
};

export function blockOfHeading(level: number): BlockStyle {
	if (level <= 2) return 'title';
	if (level === 3) return 'heading';
	return 'subheading';
}
