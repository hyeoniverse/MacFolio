import { describe, expect, it } from 'vitest';
import { DOCUMENT_EXTENSIONS } from '@macfolio/contracts';
import { FILE_CSP, FILE_TYPES, fileKey, parseRange, serveFile, type FilesBucket } from './files';
import worker from './index';

/** 메모리 R2: 키 → 내용 */
function bucket(files: Record<string, string>): FilesBucket & { gets: string[] } {
	const gets: string[] = [];
	const info = (key: string) => ({
		httpEtag: `"etag-${encodeURI(key)}"`,
		size: files[key].length,
		uploaded: new Date(0),
	});
	return {
		gets,
		async get(key, options) {
			gets.push(key);
			if (!(key in files)) return null;
			const range = options?.range;
			const content = range ? files[key].slice(range.offset, range.offset + range.length) : files[key];
			return { ...info(key), body: new Response(content).body };
		},
		async head(key) {
			return key in files ? info(key) : null;
		},
	};
}

const req = (path: string, init?: RequestInit) => new Request(`https://macfolio.example${path}`, init);

describe('파일 종류', () => {
	it('API가 받는 확장자와 Worker가 내주는 확장자가 같다', () => {
		expect(Object.keys(FILE_TYPES).sort()).toEqual(Object.keys(DOCUMENT_EXTENSIONS).sort());
	});

	it('문서·묶음은 늘 받기로, 글자·영상은 바로 보인다', async () => {
		const files = bucket({ 'resume/a.docx': 'PK', 'resume/a.txt': 'hi', 'resume/a.mp4': 'v' });
		const disposition = async (path: string) =>
			(await serveFile(req(path), files)).headers.get('content-disposition')?.split(';')[0];
		expect(await disposition('/files/resume/a.docx')).toBe('attachment');
		expect(await disposition('/files/resume/a.txt')).toBe('inline');
		expect(await disposition('/files/resume/a.mp4')).toBe('inline');
		expect((await serveFile(req('/files/resume/a.txt'), files)).headers.get('content-type')).toBe(
			'text/plain; charset=utf-8'
		);
	});
});

describe('Range (동영상을 나눠 받기)', () => {
	it('bytes=a-b, a-, -n을 파일 안의 [시작, 길이]로, 맞지 않으면 invalid', () => {
		expect(parseRange(null, 10)).toBeNull();
		expect(parseRange('bytes=0-3', 10)).toEqual({ offset: 0, length: 4 });
		expect(parseRange('bytes=4-', 10)).toEqual({ offset: 4, length: 6 });
		expect(parseRange('bytes=-3', 10)).toEqual({ offset: 7, length: 3 });
		expect(parseRange('bytes=5-99', 10)).toEqual({ offset: 5, length: 5 });
		expect(parseRange('bytes=10-', 10)).toBe('invalid');
		expect(parseRange('items=0-1', 10)).toBe('invalid');
	});

	it('Range가 오면 206과 그 부분만, 넘치면 416', async () => {
		const files = bucket({ 'desktop/a.mp4': '0123456789' });
		const part = await serveFile(req('/files/desktop/a.mp4', { headers: { range: 'bytes=2-5' } }), files);
		expect(part.status).toBe(206);
		expect(await part.text()).toBe('2345');
		expect(part.headers.get('content-range')).toBe('bytes 2-5/10');
		expect(part.headers.get('content-length')).toBe('4');
		expect(part.headers.get('accept-ranges')).toBe('bytes');
		const whole = await serveFile(req('/files/desktop/a.mp4'), files);
		expect(whole.status).toBe(200);
		expect(whole.headers.get('accept-ranges')).toBe('bytes');
		const bad = await serveFile(req('/files/desktop/a.mp4', { headers: { range: 'bytes=20-' } }), files);
		expect(bad.status).toBe(416);
		expect(bad.headers.get('content-range')).toBe('bytes */10');
	});
});

describe('fileKey', () => {
	it('허용한 확장자의 키만', () => {
		expect(fileKey('/files/resume/resume.pdf')).toBe('resume/resume.pdf');
		expect(fileKey('/files/%EC%9E%90%EA%B2%A9%EC%A6%9D/a.JPG')).toBe('자격증/a.JPG');
		for (const ext of ['png', 'jpg', 'jpeg', 'webp']) expect(fileKey(`/files/a.${ext}`)).toBe(`a.${ext}`);
		for (const path of ['/files/a.html', '/files/a.svg', '/files/a', '/files/', '/files/pdf', '/other/a.pdf'])
			expect(fileKey(path)).toBeNull();
	});

	it('프로젝트 폴더 키 (projects/<프로젝트 id>/<파일>)까지만, 더 깊은 경로는 막는다', () => {
		expect(fileKey('/files/projects/macfolio/slides.pdf')).toBe('projects/macfolio/slides.pdf');
		for (const path of [
			'/files/projects/macfolio/x/slides.pdf',
			'/files/resume/x/a.pdf',
			'/files/projects/Mac/a.pdf',
			'/files/projects/%2E%2E/a.pdf',
			'/files/projects/../resume/a.pdf',
		])
			expect(fileKey(path)).toBeNull();
	});

	it('경로 바꾸기를 막는다', () => {
		for (const path of [
			'/files/../secret.pdf',
			'/files/%2E%2E/secret.pdf',
			'/files/a/%2e%2e/b.pdf',
			'/files/a//b.pdf',
			'/files//a.pdf',
			'/files/./a.pdf',
			'/files/a%5Cb.pdf',
			'/files/a%00.pdf',
			'/files/%E0%A4%A.pdf',
		])
			expect(fileKey(path)).toBeNull();
	});
});

describe('serveFile', () => {
	const files = bucket({ 'resume/resume.pdf': '%PDF-1.4', '자격증/정보처리기사.png': 'png' });

	it('PDF를 그 종류·캐시·ETag와 inline으로 준다', async () => {
		const res = await serveFile(req('/files/resume/resume.pdf'), files);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe('%PDF-1.4');
		expect(res.headers.get('content-type')).toBe('application/pdf');
		expect(res.headers.get('etag')).toBe('"etag-resume/resume.pdf"');
		expect(res.headers.get('cache-control')).toBe('public, max-age=300');
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(res.headers.get('content-disposition')).toBe(`inline; filename="resume.pdf"; filename*=UTF-8''resume.pdf`);
		expect(res.headers.get('content-length')).toBe('8');
	});

	it('사이트 안 iframe에만 들어가고, 그 밖은 막는다', async () => {
		const res = await serveFile(req('/files/resume/resume.pdf'), files);
		expect(res.headers.get('content-security-policy')).toBe(FILE_CSP);
		expect(FILE_CSP).toContain("frame-ancestors 'self'");
		expect(FILE_CSP).toContain("default-src 'none'");
		expect(FILE_CSP).not.toContain('script-src');
		expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
	});

	it('?download=1이면 attachment, 한글 이름은 filename*에', async () => {
		const res = await serveFile(
			req('/files/%EC%9E%90%EA%B2%A9%EC%A6%9D/%EC%A0%95%EB%B3%B4%EC%B2%98%EB%A6%AC%EA%B8%B0%EC%82%AC.png?download=1'),
			files
		);
		expect(res.headers.get('content-type')).toBe('image/png');
		expect(res.headers.get('content-disposition')).toBe(
			`attachment; filename="______.png"; filename*=UTF-8''${encodeURIComponent('정보처리기사.png')}`
		);
	});

	it('If-None-Match가 맞으면 304', async () => {
		const res = await serveFile(
			req('/files/resume/resume.pdf', { headers: { 'if-none-match': '"etag-resume/resume.pdf"' } }),
			files
		);
		expect(res.status).toBe(304);
		expect(res.headers.get('etag')).toBe('"etag-resume/resume.pdf"');
		expect(await res.text()).toBe('');
	});

	it('HEAD는 본문 없이', async () => {
		const res = await serveFile(req('/files/resume/resume.pdf', { method: 'HEAD' }), files);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-length')).toBe('8');
		expect(await res.text()).toBe('');
	});

	it('없는 파일, 허용하지 않는 키는 404 (버킷을 읽지 않는다)', async () => {
		expect((await serveFile(req('/files/nope.pdf'), files)).status).toBe(404);
		files.gets.length = 0;
		expect((await serveFile(req('/files/a.html'), files)).status).toBe(404);
		expect((await serveFile(req('/files/%2E%2E/a.pdf'), files)).status).toBe(404);
		expect(files.gets).toEqual([]);
	});

	it('GET·HEAD가 아니면 405', async () => {
		for (const method of ['POST', 'PUT', 'DELETE']) {
			const res = await serveFile(req('/files/resume/resume.pdf', { method }), files);
			expect(res.status).toBe(405);
			expect(res.headers.get('allow')).toBe('GET, HEAD');
		}
	});

	it('바인딩이 없으면(로컬·미리보기) 404', async () => {
		expect((await serveFile(req('/files/resume/resume.pdf'), undefined)).status).toBe(404);
	});
});

describe('Worker', () => {
	const assets = { fetch: async () => new Response('index') };

	it('/files/는 R2에서, 바인딩이 없으면 404', async () => {
		const files = bucket({ 'a.pdf': '%PDF' });
		const res = await worker.fetch(req('/files/a.pdf'), { ASSETS: assets, FILES: files });
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('application/pdf');
		expect((await worker.fetch(req('/files/a.pdf'), { ASSETS: assets })).status).toBe(404);
	});
});
