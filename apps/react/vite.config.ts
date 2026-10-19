import { execSync } from 'node:child_process';
import { appendFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defaultClientConditions, defaultServerConditions, defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { DEFAULT_PROJECTS } from './src/shared/profile';
import { headersFileBlock, securityHeaders } from './worker/securityHeaders';

/**
 * 보안 헤더 (worker/securityHeaders.ts). 빌드하면 dist/_headers 끝에 모든 경로(/*) 덩어리를 더하고,
 * vite preview(E2E)에도 같은 헤더를 붙여 시험이 CSP를 켠 채로 돈다
 */
function securityHeadersPlugin(): Plugin {
	let headers: Record<string, string> = {};
	return {
		name: 'macfolio-security-headers',
		apply: (_config, { command, isPreview }) => command === 'build' || Boolean(isPreview),
		configResolved(config) {
			const env = loadEnv(config.mode, config.envDir || process.cwd(), '');
			headers = securityHeaders({
				apiUrl: env.VITE_API_URL,
				frameUrls: DEFAULT_PROJECTS.flatMap((project) => (project.demo ? [project.demo] : [])),
				// E2E의 가짜 API (e2e/fakeApi.ts의 FAKE_API). 배포 빌드에는 넣지 않는다
				testApiUrls: env.CSP_TEST_API_URL ? [env.CSP_TEST_API_URL] : [],
			});
		},
		configurePreviewServer(server) {
			server.middlewares.use((_req, res, next) => {
				for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
				next();
			});
		},
		writeBundle(options) {
			appendFileSync(
				`${options.dir}/_headers`,
				`\n# 보안 헤더 (vite.config.ts가 빌드할 때 더한다)\n${headersFileBlock(headers)}`
			);
		},
	};
}

/** public/imgs 아래의 그림·영상 (프로젝트의 화면 모음 폴더: src/shared/site/publicImages.ts) */
const IMAGE_FILE = /\.(png|jpe?g|webp|gif|avif|svg|mp4)$/i;

/**
 * 'virtual:public-images': public/imgs 아래 폴더마다 그 안의 그림 주소 목록 (이름 순).
 * 관리자가 프로젝트의 화면 모음을 폴더 하나로 정하면, 그 폴더의 그림을 모두 보여 준다
 */
function publicImagesPlugin(): Plugin {
	const id = 'virtual:public-images';
	const resolved = `\0${id}`;
	const root = fileURLToPath(new URL('./public', import.meta.url));
	const collect = (dir: string, out: Record<string, string[]>) => {
		const entries = readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
		const files = entries
			.filter((entry) => entry.isFile() && IMAGE_FILE.test(entry.name))
			.map((entry) => `/${dir}/${entry.name}`);
		if (files.length) out[`/${dir}`] = files;
		for (const entry of entries) if (entry.isDirectory()) collect(`${dir}/${entry.name}`, out);
		return out;
	};
	return {
		name: 'macfolio-public-images',
		resolveId: (source) => (source === id ? resolved : null),
		load: (source) => (source === resolved ? `export default ${JSON.stringify(collect('imgs', {}))};` : null),
	};
}

/**
 * 지금 브랜치의 PR 미리보기 주소 (ci.yml의 preview 작업과 같은 별칭 규칙). main이거나 git을 읽지 못하면 null.
 * 브랜치에서 바꾼 /files/*(새 파일 종류, Range)는 배포한 사이트에 아직 없어서, 그 브랜치의 미리보기 Worker가 내줘야 한다
 */
function branchPreviewOrigin(): string | null {
	try {
		const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
		if (!branch || branch === 'main' || branch === 'HEAD') return null;
		const alias = branch
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40)
			.replace(/-+$/, '');
		return `https://${alias}-macfolio.hyeoniverse-dev.workers.dev`;
	} catch {
		return null;
	}
}

/** 로컬 개발에서 /files/*를 넘길 사이트: FILES_ORIGIN(명령 앞의 환경 변수가 .env.local보다 먼저) → 이 브랜치의 PR 미리보기 → 배포한 사이트 */
const FILES_ORIGIN =
	process.env.FILES_ORIGIN ||
	loadEnv('development', fileURLToPath(new URL('.', import.meta.url)), 'FILES_').FILES_ORIGIN ||
	branchPreviewOrigin() ||
	'https://macfolio.hyeoniverse.com';

export default defineConfig({
	plugins: [react(), securityHeadersPlugin(), publicImagesPlugin()],
	// 단위 시험(Vitest)도 desktop-core의 src를 읽는다
	ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
	// 로컬 개발(pnpm dev)에는 사이트 Worker가 없어 /files/*(R2 문서 파일)를 내줄 곳이 없다. main이 아닌 브랜치면 그 PR 미리보기로, main이면 배포한 사이트로 넘긴다.
	// 다른 곳을 보려면 FILES_ORIGIN: 명령 앞에 붙이거나 apps/react/.env.local에 적는다.
	// E2E(vite preview)는 넘기지 않는다 (시험이 가짜 파일을 준다)
	server: {
		proxy: { '/files': { target: FILES_ORIGIN, changeOrigin: true } },
	},
	preview: { proxy: {} },
	build: {
		rollupOptions: {
			// api-docs.html: 'API 문서' 앱이 iframe으로 띄우는 페이지 (Scalar가 주소·CSS를 직접 써서 사이트와 떼어 둔다)
			input: {
				main: fileURLToPath(new URL('./index.html', import.meta.url)),
				apiDocs: fileURLToPath(new URL('./api-docs.html', import.meta.url)),
			},
		},
	},
	resolve: {
		// desktop-core는 빌드하지 않고 src를 바로 읽는다 (package.json exports의 source 조건). dist는 서버가 쓴다
		conditions: ['source', ...defaultClientConditions],
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
});
