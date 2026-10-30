import { describe, expect, it } from 'vitest';
import { fileAppOf, fileNameOf, isRemoteFile, rememberFileName } from './fileApps';

describe('fileAppOf', () => {
	it('PDF·그림은 미리보기, Markdown·글자 파일은 텍스트 편집기, HTML은 Safari', () => {
		expect(fileAppOf('회의록.PDF')).toEqual({ app: 'preview', kind: 'pdf' });
		expect(fileAppOf('도식.svg')).toEqual({ app: 'preview', kind: 'image' });
		expect(fileAppOf('README.md')).toEqual({ app: 'textedit', markdown: true });
		expect(fileAppOf('log.txt')).toEqual({ app: 'textedit', markdown: false });
		expect(fileAppOf('data.json')).toEqual({ app: 'textedit', markdown: false });
		expect(fileAppOf('demo.html')).toEqual({ app: 'safari' });
	});

	it('맞는 앱이 없거나 확장자가 없으면 null', () => {
		expect(fileAppOf('archive.zip')).toBeNull();
		expect(fileAppOf('노래.mp3')).toBeNull();
		expect(fileAppOf('README')).toBeNull();
	});
});

describe('파일 이름', () => {
	it('기억한 이름, 없으면 주소의 마지막 조각', () => {
		rememberFileName('https://api.example.com/files/a1', '회의록.md');
		expect(fileNameOf('https://api.example.com/files/a1')).toBe('회의록.md');
		expect(fileNameOf('https://example.com/docs/%EB%85%B8%ED%8A%B8.txt?x=1')).toBe('노트.txt');
		expect(isRemoteFile('https://api.example.com/files/a1')).toBe(true);
		expect(isRemoteFile('docs/privacy.md')).toBe(false);
	});
});
