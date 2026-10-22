// 성능 측정용 정적 서버. 빌드한 dist를 배포(Cloudflare)와 비슷하게 내준다: 글자 파일은 brotli로 압축하고,
// 글 주소 같은 화면 주소는 index.html, 없는 /assets/*는 404. 운영 Worker의 첫 화면 내용 넣기·CSP는 하지 않는다.
// 사용: node scripts/perf/serve.mjs [dist 경로] [포트]   (기본 dist, 4810)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4810);

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.xml': 'application/xml; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.md': 'text/markdown; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.pdf': 'application/pdf',
	'.wasm': 'application/wasm',
};
/** Cloudflare가 압축해 내주는 종류 (글꼴 중 ttf·otf도 압축한다) */
const COMPRESS = new Set([
	'.html',
	'.js',
	'.mjs',
	'.css',
	'.json',
	'.svg',
	'.xml',
	'.txt',
	'.md',
	'.ico',
	'.ttf',
	'.otf',
	'.wasm',
]);
const cache = new Map();

async function file(path) {
	try {
		return (await stat(path)).isFile() ? path : null;
	} catch {
		return null;
	}
}

createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', 'http://localhost');
	const pathname = decodeURIComponent(url.pathname);
	const target = normalize(join(root, pathname));
	if (!target.startsWith(root)) return res.writeHead(403).end();
	let path = await file(target);
	if (!path && pathname.startsWith('/assets/')) return res.writeHead(404).end();
	// 화면 주소(/memo/글 등)는 index.html
	if (!path && !extname(pathname)) path = join(root, 'index.html');
	if (!path) return res.writeHead(404).end();

	const ext = extname(path).toLowerCase();
	const headers = {
		'content-type': TYPES[ext] ?? 'application/octet-stream',
		'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
	};
	let body = await readFile(path);
	if (COMPRESS.has(ext) && /\bbr\b/.test(req.headers['accept-encoding'] ?? '')) {
		if (!cache.has(path))
			cache.set(path, brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }));
		body = cache.get(path);
		headers['content-encoding'] = 'br';
	}
	headers['content-length'] = body.length;
	res.writeHead(200, headers).end(body);
}).listen(port, () => console.log(`${root} → http://localhost:${port}`));
