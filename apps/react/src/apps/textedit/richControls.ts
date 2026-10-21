// 이력서 편집기(Milkdown)와 서식 막대·제목 줄 버튼 사이의 약속. Milkdown은 편집기 쪽(ResumeRichEditor)에서만 불러온다.
import type { MarkdownFormat } from './markdownFormat';

/** 커서 자리의 서식 (서식 막대가 켜진 버튼을 고른다) */
export interface RichState {
	/** 문단 스타일: 0 본문, 1~3 제목 */
	level: number;
	/** 커서가 있는 줄의 종류 */
	kind: 'list' | 'ordered' | 'quote' | null;
	marks: { bold: boolean; italic: boolean; strike: boolean; code: boolean; link: boolean };
}

export const EMPTY_RICH_STATE: RichState = {
	level: 0,
	kind: null,
	marks: { bold: false, italic: false, strike: false, code: false, link: false },
};

/** 편집기에 보내는 명령 */
export interface RichControls {
	format: (format: MarkdownFormat) => void;
	heading: (level: number) => void;
	/** 글 전체를 바꾼다 (불러오기, 변경 취소). 실행 취소로 되돌릴 수 있다 */
	replace: (markdown: string) => void;
	undo: () => void;
	redo: () => void;
	focus: () => void;
}
