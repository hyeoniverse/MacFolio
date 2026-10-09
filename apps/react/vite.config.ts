import { fileURLToPath, URL } from 'node:url';
import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
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
