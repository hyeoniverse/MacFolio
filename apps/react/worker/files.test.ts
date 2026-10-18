import { describe, expect, it } from 'vitest';
import { FILE_CSP, fileKey, serveFile, type FilesBucket } from './files';
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
		async get(key) {
			gets.push(key);
			if (!(key in files)) return null;
			return { ...info(key), body: new Response(files[key]).body };
		},
		async head(key) {
			return key in files ? info(key) : null;
		},
	};
}

const req = (path: string, init?: RequestInit) => new Request(`https://macfolio.example${path}`, init);

describe('fileKey', () => {
	it('허용한 확장자의 키만', () => {
		expect(fileKey('/files/resume/resume.pdf')).toBe('resume/resume.pdf');
		expect(fileKey('/files/%EC%9E%90%EA%B2%A9%EC%A6%9D/a.JPG')).toBe('자격증/a.JPG');
		for (const ext of ['png', 'jpg', 'jpeg', 'webp']) expect(fileKey(`/files/a.${ext}`)).toBe(`a.${ext}`);
		for (const path of ['/files/a.html', '/files/a.svg', '/files/a', '/files/', '/files/pdf', '/other/a.pdf'])
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
