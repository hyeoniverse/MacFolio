// 본문 편집기(InlineEditor)와 창 위 도구 막대(FormatTools)를 잇는 작은 저장소.
// 편집기는 커서 자리의 서식과 명령 실행 함수를 알리고, 도구 막대는 그걸 보고 그리고 누른다.
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';
import type { FindOptions } from '../find';

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
	/** 지금(고른 범위 첫) 행·열 번호. 행 0은 머리글 */
	row: number;
	col: number;
	/** 고른 행·열 수 (커서만 있으면 1) */
	selectedRows: number;
	selectedCols: number;
	/** 손잡이로 행 전체나 열 전체를 골랐는지 */
	selecting: 'row' | 'col' | null;
	/** 칸을 마우스로 끌어 골랐는지 (손잡이·테두리 없이 고른 칸만 보인다) */
	dragged: boolean;
}

export type TableAlign = 'left' | 'center' | 'right';

export type TableOp =
	| 'rowBefore'
	| 'rowAfter'
	| 'colBefore'
	| 'colAfter'
	| 'deleteRow'
	| 'deleteCol'
	| 'deleteTable'
	| 'selectRow'
	| 'selectCol'
	| TableAlign;

/** 고른 이미지 */
export interface ImageState {
	src: string;
	alt: string;
	/** 캡션 */
	title: string;
}

export interface FormatState {
	block: BlockStyle;
	/** 커서가 있는 목록 */
	list: 'bullet' | 'ordered' | 'task' | null;
	quote: boolean;
	table: TableState | null;
	image: ImageState | null;
	marks: { strong: boolean; emphasis: boolean; strike: boolean; code: boolean };
}

export type FormatAction =
	| { type: 'mark'; mark: keyof FormatState['marks'] }
	| { type: 'block'; block: BlockStyle }
	| { type: 'list'; list: 'bullet' | 'ordered' | 'task' }
	| { type: 'quote' }
	| { type: 'table' }
	| { type: 'tableOp'; op: TableOp }
	/** 칸 범위 고르기 [행, 열] (고른 테두리의 꼭짓점 점을 끌 때) */
	| {
			type: 'tableSelect';
			anchor: [number, number];
			head: [number, number];
			/** 손잡이로 고른 범위로 칠지 (false면 칸을 끌어 고른 것처럼 손잡이를 띄우지 않는다) */
			byHandle?: boolean;
	  }
	/** 고른 행·열을 끌어서 옮기기 */
	| { type: 'tableMove'; kind: 'row' | 'col'; from: number; to: number }
	| { type: 'image'; src: string; alt: string; title?: string }
	/** 고른 이미지의 설명·캡션 바꾸기 */
	| { type: 'imageAttrs'; alt: string; title: string }
	/** 글 안에서 찾기 (index: 지금 몇 번째, -1이면 아직 고르지 않음) */
	| { type: 'find'; query: string; options: FindOptions; index: number }
	| { type: 'findClear' }
	| { type: 'replace'; replacement: string; all: boolean }
	/** 첨부 파일: 파일 이름을 글자로 한 링크 */
	| { type: 'attachment'; href: string; name: string; size: number };

export const EMPTY_FORMAT: FormatState = {
	block: 'body',
	list: null,
	quote: false,
	table: null,
	image: null,
	marks: { strong: false, emphasis: false, strike: false, code: false },
};

/** 편집기(.memo-inline-editor) 기준 위치 */
export interface Box {
	left: number;
	top: number;
	width: number;
	height: number;
}

export const editorControls = createStore<{
	state: FormatState;
	/** 커서가 있는 표와 칸, 고른 칸들의 위치 (표 손잡이와 고른 테두리를 그린다) */
	tableBox: { table: Box; cell: Box; selection: Box | null } | null;
	run: ((action: FormatAction) => void) | null;
	/** 올리고 있는 파일 수 */
	uploading: number;
	/** 글 안에서 찾은 결과 (찾기 막대가 닫혀 있으면 null) */
	find: { count: number; index: number } | null;
}>({
	state: EMPTY_FORMAT,
	tableBox: null,
	run: null,
	uploading: 0,
	find: null,
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
