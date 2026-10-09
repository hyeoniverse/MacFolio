import { describe, expect, it } from 'vitest';
import {
	cleanFileName,
	cleanFileType,
	contentDisposition,
	newUploadId,
	sniffImage,
	UPLOAD_ID,
	uploadIdsIn,
} from './rules.js';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('올린 파일 규칙', () => {
	it('이미지는 파일 앞부분으로 확인한다', () => {
		expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
		expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
		expect(sniffImage(new TextEncoder().encode('GIF89a'))).toBe('image/gif');
		expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
		// SVG나 이름만 이미지인 파일은 이미지가 아니다
		expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
		expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WAVE'))).toBeNull();
		expect(sniffImage(bytes())).toBeNull();
	});

	it('파일 이름에서 경로와 제어 문자를 뺀다', () => {
		expect(cleanFileName('../../etc/passwd')).toBe('passwd');
		expect(cleanFileName('C:\\Users\\me\\보고서.pdf')).toBe('보고서.pdf');
		expect(cleanFileName('a\u0000b\n.txt')).toBe('ab.txt');
		expect(cleanFileName('   ')).toBe('file');
		expect(cleanFileName('가'.repeat(300))).toHaveLength(200);
	});

	it('형식 이름이 이상하면 octet-stream', () => {
		expect(cleanFileType('application/PDF')).toBe('application/pdf');
		expect(cleanFileType('text/html; charset=utf-8')).toBe('application/octet-stream');
		expect(cleanFileType('')).toBe('application/octet-stream');
	});

	it('한글 이름도 내려받을 때 깨지지 않는다', () => {
		expect(contentDisposition('attachment', '보고서 "최종".pdf')).toBe(
			`attachment; filename="___ ____.pdf"; filename*=UTF-8''${encodeURIComponent('보고서 "최종".pdf')}`
		);
		expect(contentDisposition('inline', "it's (1).png")).toBe(
			`inline; filename="it's (1).png"; filename*=UTF-8''it%27s%20%281%29.png`
		);
	});

	it('파일 주소는 짐작할 수 없는 16자', () => {
		const id = newUploadId();
		expect(id).toMatch(UPLOAD_ID);
		expect(newUploadId()).not.toBe(id);
	});

	it('글에서 가리키는 파일 id를 찾는다 (전체 주소든 경로든, 같은 id는 한 번)', () => {
		const a = 'AAAAAAAAAAAAAAAA';
		const b = 'bbbbbbbbbbbbbbb-';
		expect(uploadIdsIn(`![](https://api.x/files/${a}) [첨부](/files/${b}) ![](/files/${a})`)).toEqual([a, b]);
		// 16자보다 길면 파일 주소가 아니다
		expect(uploadIdsIn(`/files/${a}x`)).toEqual([]);
		expect(uploadIdsIn(null)).toEqual([]);
	});
});
