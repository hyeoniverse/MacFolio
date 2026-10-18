import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import { cleanDocumentName, DocumentRename, DocumentUploadRequest, documentExtension } from './documents.js';

describe('문서 파일 규칙', () => {
	it('PDF·PNG·JPG·WebP만, 대소문자는 가리지 않는다', () => {
		expect(documentExtension('이력서.PDF')).toBe('pdf');
		expect(documentExtension('a.jpeg')).toBe('jpeg');
		expect(documentExtension('a.gif')).toBeNull();
		expect(documentExtension('pdf')).toBeNull();
	});

	it('이름에서 경로 구분자와 제어 문자를 뺀다', () => {
		expect(cleanDocumentName(' ../이력서\u0000.pdf ')).toBe('..이력서.pdf');
		expect(cleanDocumentName('   ')).toBeNull();
		expect(cleanDocumentName(3)).toBeNull();
	});

	it('올리기 요청: 폴더·종류·크기를 확인한다', () => {
		expect(parse(DocumentUploadRequest, { folder: '이력서', name: '이력서.pdf', size: 1000 })).toEqual({
			value: { folder: '이력서', name: '이력서.pdf', size: 1000 },
		});
		expect('errors' in parse(DocumentUploadRequest, { folder: '사진', name: 'a.pdf', size: 1 })).toBe(true);
		expect('errors' in parse(DocumentUploadRequest, { folder: '이력서', name: 'a.exe', size: 1 })).toBe(true);
		expect('errors' in parse(DocumentUploadRequest, { folder: '이력서', name: 'a.pdf', size: 0 })).toBe(true);
		expect('errors' in parse(DocumentUploadRequest, { folder: '이력서', name: 'a.pdf', size: 30e6 })).toBe(true);
	});

	it('이름 바꾸기도 받는 종류여야 한다', () => {
		expect(parse(DocumentRename, { name: '새 이름.pdf' })).toEqual({ value: { name: '새 이름.pdf' } });
		expect('errors' in parse(DocumentRename, { name: '새 이름' })).toBe(true);
	});
});
