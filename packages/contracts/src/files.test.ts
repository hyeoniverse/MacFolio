import { describe, expect, it } from 'vitest';
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, Upload, UPLOAD_ID, uploadIdsIn, UploadUsage } from './files.js';
import { parse } from './parse.js';

describe('올린 파일', () => {
	it('한도는 10MB, 주소는 16자', () => {
		expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
		expect('AAAAAAAAAAAAAAAA').toMatch(UPLOAD_ID);
		expect('AAAAAAAAAAAAAAA').not.toMatch(UPLOAD_ID);
		expect('AAAAAAAAAAAAAAA/').not.toMatch(UPLOAD_ID);
	});

	it('글에서 가리키는 파일 id를 찾는다 (전체 주소든 경로든, 같은 id는 한 번)', () => {
		const a = 'AAAAAAAAAAAAAAAA';
		const b = 'bbbbbbbbbbbbbbb-';
		expect(uploadIdsIn(`![](https://api.x/files/${a}) [첨부](/files/${b}) ![](/files/${a})`)).toEqual([a, b]);
		// 16자보다 길면 파일 주소가 아니다
		expect(uploadIdsIn(`/files/${a}x`)).toEqual([]);
		expect(uploadIdsIn(null)).toEqual([]);
	});

	it('응답 모양: 올린 파일과 쓰는 곳', () => {
		const upload = {
			id: 'AAAAAAAAAAAAAAAA',
			name: 'a.png',
			type: 'image/png',
			size: 12,
			image: true,
			path: '/files/AAAAAAAAAAAAAAAA',
		};
		expect(parse(Upload, { ...upload, data: 'secret' })).toEqual({ value: upload });
		expect(IMAGE_TYPES).toContain(upload.type);
		const usage = {
			...upload,
			createdAt: '2026-10-11T00:00:00.000Z',
			createdBy: 'admin',
			usedBy: { posts: ['2026-10-11-abc'], revisions: [], wallpaper: false },
		};
		expect(parse(UploadUsage, usage)).toEqual({ value: usage });
		expect(parse(UploadUsage, { ...usage, usedBy: {} })).toHaveProperty('errors');
	});
});
