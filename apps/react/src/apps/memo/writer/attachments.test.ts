import { describe, expect, it } from 'vitest';
import { attachmentTitle, baseName, formatBytes } from './attachments';
import { canRunTableOp } from './tableRules';

describe('첨부 파일', () => {
	it('크기를 읽기 쉽게', () => {
		expect(formatBytes(12)).toBe('12 B');
		expect(formatBytes(2048)).toBe('2 KB');
		expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
		expect(attachmentTitle(2048)).toBe('첨부 파일 · 2 KB');
	});

	it('이미지 설명의 기본값은 확장자를 뺀 파일 이름', () => {
		expect(baseName('스크린샷.png')).toBe('스크린샷');
		expect(baseName('a.b.jpg')).toBe('a.b');
		expect(baseName('.png')).toBe('.png');
	});
});

describe('표 편집 규칙', () => {
	const table = {
		header: false,
		rows: 2,
		cols: 3,
		align: 'left' as const,
		selectedRows: 1,
		selectedCols: 1,
		selecting: null,
	};

	it('머리글 행은 지우지 않고, 그 위에 행을 넣지 않는다', () => {
		expect(canRunTableOp({ ...table, header: true }, 'deleteRow')).toBe(false);
		expect(canRunTableOp({ ...table, header: true }, 'rowBefore')).toBe(false);
		expect(canRunTableOp({ ...table, header: true }, 'rowAfter')).toBe(true);
	});

	it('마지막 본문 행과 마지막 열은 지우지 않는다 (표 삭제로)', () => {
		expect(canRunTableOp(table, 'deleteRow')).toBe(true);
		expect(canRunTableOp({ ...table, rows: 1 }, 'deleteRow')).toBe(false);
		expect(canRunTableOp({ ...table, cols: 1 }, 'deleteCol')).toBe(false);
		expect(canRunTableOp({ ...table, rows: 1, cols: 1 }, 'deleteTable')).toBe(true);
	});

	it('행·열을 여러 개 고르면 남는 것이 있어야 지운다', () => {
		expect(canRunTableOp({ ...table, cols: 3, selectedCols: 2 }, 'deleteCol')).toBe(true);
		expect(canRunTableOp({ ...table, cols: 3, selectedCols: 3 }, 'deleteCol')).toBe(false);
		expect(canRunTableOp({ ...table, rows: 3, selectedRows: 2 }, 'deleteRow')).toBe(true);
		expect(canRunTableOp({ ...table, rows: 3, selectedRows: 3 }, 'deleteRow')).toBe(false);
	});
});
