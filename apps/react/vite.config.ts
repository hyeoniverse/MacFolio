import { appendFileSync } from 'node:fs';
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

export default defineConfig({
	plugins: [react(), securityHeadersPlugin()],
	// 단위 시험(Vitest)도 desktop-core의 src를 읽는다
	ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
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
